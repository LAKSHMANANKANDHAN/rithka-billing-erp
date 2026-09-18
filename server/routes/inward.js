const express = require('express');
const router = express.Router();
const { query, getOne, run, logAudit } = require('../db/database');
const { authenticate, requireOwner } = require('../middleware/auth');

// Helper to generate next Inward Number
async function generateInwardNo() {
  const settings = await getOne('SELECT inward_prefix, starting_serial_no FROM company_settings LIMIT 1');
  const prefix = settings?.inward_prefix || 'INW-';
  const startNo = settings?.starting_serial_no || 1;

  const countRow = await getOne('SELECT COUNT(*) as count FROM inward_entries');
  const nextNum = (countRow?.count || 0) + startNo;
  const formatted = String(nextNum).padStart(4, '0');
  
  let candidate = `${prefix}${formatted}`;
  // Ensure uniqueness
  let exists = await getOne('SELECT id FROM inward_entries WHERE inward_no = ?', [candidate]);
  let offset = 1;
  while (exists) {
    candidate = `${prefix}${String(nextNum + offset).padStart(4, '0')}`;
    exists = await getOne('SELECT id FROM inward_entries WHERE inward_no = ?', [candidate]);
    offset++;
  }
  return candidate;
}

// GET /api/inward - List all inward entries
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, customer_id, startDate, endDate } = req.query;

    let sql = `
      SELECT ie.*, c.company_name as customer_name, c.gst_no as customer_gst, u.full_name as created_by_name,
             (SELECT COUNT(*) FROM inward_items WHERE inward_id = ie.id) as item_count
      FROM inward_entries ie
      JOIN customers c ON ie.customer_id = c.id
      JOIN users u ON ie.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (customer_id) {
      sql += ' AND ie.customer_id = ?';
      params.push(customer_id);
    }

    if (startDate) {
      sql += ' AND DATE(ie.created_at) >= DATE(?)';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND DATE(ie.created_at) <= DATE(?)';
      params.push(endDate);
    }

    if (search) {
      sql += ` AND (
        ie.inward_no LIKE ? OR 
        c.company_name LIKE ? OR 
        ie.po_no LIKE ? OR 
        ie.dc_no LIKE ? OR 
        ie.vehicle_no LIKE ?
      )`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY ie.id DESC';

    const entries = await query(sql, params);
    res.json({ success: true, entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/inward/pending-items - Inward entries that have items with pending quantity > 0
router.get('/pending-items', authenticate, async (req, res) => {
  try {
    const sql = `
      SELECT ie.id, ie.inward_no, ie.created_at, ie.po_no, ie.po_date, ie.dc_no, ie.dc_date, ie.vehicle_no,
             c.id as customer_id, c.company_name as customer_name, c.address as customer_address, c.gst_no as customer_gst
      FROM inward_entries ie
      JOIN customers c ON ie.customer_id = c.id
      WHERE EXISTS (
        SELECT 1 FROM inward_items ii
        LEFT JOIN (
          SELECT inward_item_id, SUM(quantity) as outward_qty 
          FROM outward_items 
          GROUP BY inward_item_id
        ) oi ON ii.id = oi.inward_item_id
        WHERE ii.inward_id = ie.id AND (ii.quantity - COALESCE(oi.outward_qty, 0)) > 0
      )
      ORDER BY ie.id DESC
    `;
    const pendingInwards = await query(sql);
    res.json({ success: true, pendingInwards });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/inward/:id - Detailed inward entry with items and item-level pending balance
router.get('/:id', authenticate, async (req, res) => {
  try {
    const entry = await getOne(`
      SELECT ie.*, c.company_name as customer_name, c.address as customer_address, c.gst_no as customer_gst,
             c.phone as customer_phone, c.email as customer_email, u.full_name as created_by_name
      FROM inward_entries ie
      JOIN customers c ON ie.customer_id = c.id
      JOIN users u ON ie.created_by = u.id
      WHERE ie.id = ?
    `, [req.params.id]);

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Inward entry not found.' });
    }

    const items = await query(`
      SELECT ii.*, 
             COALESCE(SUM(oi.quantity), 0) as already_outward_qty,
             (ii.quantity - COALESCE(SUM(oi.quantity), 0)) as pending_qty
      FROM inward_items ii
      LEFT JOIN outward_items oi ON ii.id = oi.inward_item_id
      WHERE ii.inward_id = ?
      GROUP BY ii.id
    `, [req.params.id]);

    res.json({ success: true, entry, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/inward - Create new Inward Entry with multiple items
router.post('/', authenticate, async (req, res) => {
  try {
    const { customer_id, po_no, po_date, dc_no, dc_date, vehicle_no, remarks, items } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, message: 'Customer selection is required.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required in the inward register.' });
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.item_description || !item.item_description.trim()) {
        return res.status(400).json({ success: false, message: `Item #${i + 1} must have a valid description.` });
      }
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: `Item #${i + 1} quantity must be greater than zero.` });
      }
      const rate = parseFloat(item.unit_value);
      if (isNaN(rate) || rate < 0) {
        return res.status(400).json({ success: false, message: `Item #${i + 1} unit value cannot be negative.` });
      }
    }

    // Calculate totals
    let totalQty = 0;
    let totalVal = 0;
    items.forEach(item => {
      const q = parseFloat(item.quantity);
      const r = parseFloat(item.unit_value || 0);
      totalQty += q;
      totalVal += (q * r);
    });

    const inwardNo = await generateInwardNo();
    const todayStr = new Date().toISOString().split('T')[0];

    // Insert inward entry
    const entryResult = await run(`
      INSERT INTO inward_entries (
        inward_no, customer_id, po_no, po_date, dc_no, dc_date, vehicle_no, 
        total_quantity, total_value, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      inwardNo,
      customer_id,
      po_no || '',
      po_date || '',
      dc_no || '',
      dc_date || '',
      vehicle_no || '',
      totalQty,
      totalVal,
      remarks || '',
      req.user.id
    ]);

    const inwardId = entryResult.lastID;

    // Insert items and stock ledger records
    for (const it of items) {
      const q = parseFloat(it.quantity);
      const r = parseFloat(it.unit_value || 0);
      const lineTotal = q * r;

      const itemResult = await run(`
        INSERT INTO inward_items (
          inward_id, goods_id, item_description, quantity, uom, package_type, unit_value, total_value, note, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        inwardId,
        it.goods_id || null,
        it.item_description.trim().toUpperCase(),
        q,
        it.uom || 'Nos',
        it.package_type || 'Loose',
        r,
        lineTotal,
        it.note || '',
        it.remarks || ''
      ]);

      // Stock transaction entry
      await run(`
        INSERT INTO stock_transactions (
          transaction_type, reference_type, reference_id, inward_no, challan_no, 
          customer_id, goods_id, item_description, quantity, uom, unit_value, total_value, 
          user_id, notes, transaction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'INWARD',
        'INWARD',
        inwardId,
        inwardNo,
        null,
        customer_id,
        it.goods_id || null,
        it.item_description.trim().toUpperCase(),
        q,
        it.uom || 'Nos',
        r,
        lineTotal,
        req.user.id,
        it.note || 'Inward stock receipt',
        todayStr
      ]);
    }

    // Customer name for audit
    const cust = await getOne('SELECT company_name FROM customers WHERE id = ?', [customer_id]);

    await logAudit(
      req.user.id,
      req.user.username,
      'CREATE_INWARD',
      'inward_entries',
      inwardId,
      `Created Inward Entry ${inwardNo} for ${cust?.company_name || 'Customer'} with ${items.length} items (Total: ₹${totalVal})`
    );

    res.json({
      success: true,
      message: 'Inward entry saved successfully.',
      inwardId,
      inwardNo
    });
  } catch (err) {
    console.error('Inward creation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/inward/:id (Owner only)
router.delete('/:id', authenticate, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await getOne('SELECT * FROM inward_entries WHERE id = ?', [id]);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Inward entry not found.' });
    }

    // Check if any outward challan references this inward
    const outwardCheck = await getOne('SELECT COUNT(*) as cnt FROM outward_challans WHERE inward_id = ?', [id]);
    if (outwardCheck && outwardCheck.cnt > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete this Inward Entry because Outward Delivery Challans have already been issued against it.'
      });
    }

    // Delete stock transactions
    await run('DELETE FROM stock_transactions WHERE reference_type = "INWARD" AND reference_id = ?', [id]);
    // Delete inward items
    await run('DELETE FROM inward_items WHERE inward_id = ?', [id]);
    // Delete inward entry
    await run('DELETE FROM inward_entries WHERE id = ?', [id]);

    await logAudit(req.user.id, req.user.username, 'DELETE_INWARD', 'inward_entries', id, `Deleted inward entry ${entry.inward_no}`);

    res.json({ success: true, message: 'Inward entry and associated stock ledger records deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
