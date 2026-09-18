const express = require('express');
const router = express.Router();
const { query, getOne, run, logAudit } = require('../db/database');
const { authenticate, requireOwner } = require('../middleware/auth');

// Helper to generate next DC number (e.g. 0001/26-27 or DC-0001)
async function generateChallanNo() {
  const settings = await getOne('SELECT outward_prefix, starting_serial_no, challan_year_format FROM company_settings LIMIT 1');
  const prefix = settings?.outward_prefix || 'DC-';
  const startNo = settings?.starting_serial_no || 1;
  const yearFormat = settings?.challan_year_format || '26-27';

  const countRow = await getOne('SELECT COUNT(*) as count FROM outward_challans');
  const nextNum = (countRow?.count || 0) + startNo;
  const formatted = String(nextNum).padStart(4, '0');

  // If yearFormat contains 'XXXX/26-27', format as 0001/26-27 or DC-0001/26-27
  let candidate = `${formatted}/${yearFormat}`;
  if (prefix && prefix !== 'DC-') {
    candidate = `${prefix}${formatted}/${yearFormat}`;
  }

  // Ensure uniqueness
  let exists = await getOne('SELECT id FROM outward_challans WHERE challan_no = ?', [candidate]);
  let offset = 1;
  while (exists) {
    const nextFormatted = String(nextNum + offset).padStart(4, '0');
    candidate = `${nextFormatted}/${yearFormat}`;
    if (prefix && prefix !== 'DC-') {
      candidate = `${prefix}${nextFormatted}/${yearFormat}`;
    }
    exists = await getOne('SELECT id FROM outward_challans WHERE challan_no = ?', [candidate]);
    offset++;
  }
  return candidate;
}

// GET /api/outward - List outward challans
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, customer_id, startDate, endDate } = req.query;

    let sql = `
      SELECT oc.*, c.company_name as customer_name, c.gst_no as customer_gst,
             ie.inward_no, u.full_name as created_by_name,
             (SELECT COUNT(*) FROM outward_items WHERE challan_id = oc.id) as item_count
      FROM outward_challans oc
      JOIN customers c ON oc.customer_id = c.id
      JOIN inward_entries ie ON oc.inward_id = ie.id
      JOIN users u ON oc.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (customer_id) {
      sql += ' AND oc.customer_id = ?';
      params.push(customer_id);
    }

    if (startDate) {
      sql += ' AND DATE(oc.challan_date) >= DATE(?)';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND DATE(oc.challan_date) <= DATE(?)';
      params.push(endDate);
    }

    if (search) {
      sql += ` AND (
        oc.challan_no LIKE ? OR 
        c.company_name LIKE ? OR 
        ie.inward_no LIKE ? OR 
        oc.po_no LIKE ? OR 
        oc.cust_dc_no LIKE ? OR 
        oc.vehicle_no LIKE ?
      )`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term);
    }

    sql += ' ORDER BY oc.id DESC';

    const challans = await query(sql, params);
    res.json({ success: true, challans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/outward/:id - Detailed challan for print preview and viewing
router.get('/:id', authenticate, async (req, res) => {
  try {
    const challan = await getOne(`
      SELECT oc.*, 
             c.company_name as customer_name, c.address as customer_address, c.gst_no as customer_gst,
             c.phone as customer_phone, c.email as customer_email,
             ie.inward_no, ie.created_at as inward_date,
             u.full_name as created_by_name
      FROM outward_challans oc
      JOIN customers c ON oc.customer_id = c.id
      JOIN inward_entries ie ON oc.inward_id = ie.id
      JOIN users u ON oc.created_by = u.id
      WHERE oc.id = ?
    `, [req.params.id]);

    if (!challan) {
      return res.status(404).json({ success: false, message: 'Delivery challan not found.' });
    }

    const items = await query(`
      SELECT oi.*, ii.package_type as default_pkg
      FROM outward_items oi
      JOIN inward_items ii ON oi.inward_item_id = ii.id
      WHERE oi.challan_id = ?
      ORDER BY oi.id ASC
    `, [req.params.id]);

    const company = await getOne('SELECT * FROM company_settings LIMIT 1');

    res.json({ success: true, challan, items, company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/outward - Create outward delivery challan
router.post('/', authenticate, async (req, res) => {
  try {
    const { inward_id, challan_date, vehicle_no, note, remarks, items } = req.body;

    if (!inward_id) {
      return res.status(400).json({ success: false, message: 'Inward entry reference is required.' });
    }

    const inward = await getOne('SELECT * FROM inward_entries WHERE id = ?', [inward_id]);
    if (!inward) {
      return res.status(404).json({ success: false, message: 'Selected Inward Entry does not exist.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one item to dispatch.' });
    }

    // Strict validation of pending quantities for every item
    const validatedItems = [];
    let subtotal = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const outwardQty = parseFloat(it.quantity);

      if (isNaN(outwardQty) || outwardQty <= 0) {
        continue; // Skip items with 0 or invalid qty
      }

      // Fetch inward item and compute already outward qty
      const inwardItem = await getOne(`
        SELECT ii.*, 
               COALESCE(SUM(oi.quantity), 0) as already_outward
        FROM inward_items ii
        LEFT JOIN outward_items oi ON ii.id = oi.inward_item_id
        WHERE ii.id = ? AND ii.inward_id = ?
        GROUP BY ii.id
      `, [it.inward_item_id, inward_id]);

      if (!inwardItem) {
        return res.status(400).json({
          success: false,
          message: `Inward item ID ${it.inward_item_id} not found in this inward consignment.`
        });
      }

      const pendingQty = inwardItem.quantity - inwardItem.already_outward;

      if (outwardQty > pendingQty) {
        return res.status(400).json({
          success: false,
          message: `Cannot dispatch ${outwardQty} of "${inwardItem.item_description}". Only ${pendingQty} pending from inward entry ${inward.inward_no}.`
        });
      }

      const unitRate = parseFloat(it.unit_value || inwardItem.unit_value || 0);
      const lineTotal = outwardQty * unitRate;
      subtotal += lineTotal;

      validatedItems.push({
        inward_item_id: inwardItem.id,
        goods_id: inwardItem.goods_id,
        item_description: inwardItem.item_description,
        your_ref_no: it.your_ref_no || '',
        quantity: outwardQty,
        uom: it.uom || inwardItem.uom || 'Nos',
        package_type: it.package_type || inwardItem.package_type || 'Loose',
        unit_value: unitRate,
        total_value: lineTotal
      });
    }

    if (validatedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid items with positive dispatch quantities were specified.'
      });
    }

    // Load company tax settings
    const settings = await getOne('SELECT default_tax_rate FROM company_settings LIMIT 1');
    const taxRate = parseFloat(settings?.default_tax_rate ?? 9.0);
    const taxAmount = (subtotal * taxRate) / 100.0;
    const grandTotal = subtotal + taxAmount;

    const challanNo = await generateChallanNo();
    const dateStr = challan_date || new Date().toISOString().split('T')[0];

    // Insert outward challan
    const challanResult = await run(`
      INSERT INTO outward_challans (
        challan_no, inward_id, customer_id, challan_date, 
        po_no, po_date, cust_dc_no, cust_dc_date, vehicle_no, 
        subtotal, tax_rate, tax_amount, grand_total, note, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      challanNo,
      inward.id,
      inward.customer_id,
      dateStr,
      inward.po_no,
      inward.po_date,
      inward.dc_no,
      inward.dc_date,
      vehicle_no || inward.vehicle_no,
      subtotal,
      taxRate,
      taxAmount,
      grandTotal,
      note || '',
      remarks || '',
      req.user.id
    ]);

    const challanId = challanResult.lastID;

    // Insert outward items & stock ledger deduction
    for (const vit of validatedItems) {
      await run(`
        INSERT INTO outward_items (
          challan_id, inward_item_id, goods_id, item_description, your_ref_no, 
          quantity, uom, package_type, unit_value, total_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        challanId,
        vit.inward_item_id,
        vit.goods_id,
        vit.item_description,
        vit.your_ref_no,
        vit.quantity,
        vit.uom,
        vit.package_type,
        vit.unit_value,
        vit.total_value
      ]);

      // Stock transaction entry (OUTWARD)
      await run(`
        INSERT INTO stock_transactions (
          transaction_type, reference_type, reference_id, inward_no, challan_no, 
          customer_id, goods_id, item_description, quantity, uom, unit_value, total_value, 
          user_id, notes, transaction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'OUTWARD',
        'OUTWARD',
        challanId,
        inward.inward_no,
        challanNo,
        inward.customer_id,
        vit.goods_id,
        vit.item_description,
        vit.quantity,
        vit.uom,
        vit.unit_value,
        vit.total_value,
        req.user.id,
        note || 'Outward delivery dispatch',
        dateStr
      ]);
    }

    const cust = await getOne('SELECT company_name FROM customers WHERE id = ?', [inward.customer_id]);

    await logAudit(
      req.user.id,
      req.user.username,
      'CREATE_OUTWARD',
      'outward_challans',
      challanId,
      `Created Outward Delivery Challan ${challanNo} for ${cust?.company_name || 'Customer'} (Grand Total: ₹${grandTotal.toFixed(2)}) against ${inward.inward_no}`
    );

    res.json({
      success: true,
      message: 'Delivery Challan created successfully.',
      challanId,
      challanNo,
      subtotal,
      taxAmount,
      grandTotal
    });
  } catch (err) {
    console.error('Outward challan creation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/outward/:id (Owner only)
router.delete('/:id', authenticate, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const challan = await getOne('SELECT * FROM outward_challans WHERE id = ?', [id]);
    if (!challan) {
      return res.status(404).json({ success: false, message: 'Delivery Challan not found.' });
    }

    // Delete stock transactions
    await run('DELETE FROM stock_transactions WHERE reference_type = "OUTWARD" AND reference_id = ?', [id]);
    // Delete items
    await run('DELETE FROM outward_items WHERE challan_id = ?', [id]);
    // Delete challan
    await run('DELETE FROM outward_challans WHERE id = ?', [id]);

    await logAudit(req.user.id, req.user.username, 'DELETE_OUTWARD', 'outward_challans', id, `Deleted outward challan ${challan.challan_no}`);

    res.json({ success: true, message: 'Delivery Challan deleted and stock rolled back.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
