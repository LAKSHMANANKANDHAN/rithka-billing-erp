const express = require('express');
const router = express.Router();
const { query, getOne, run, logAudit } = require('../db/database');
const { authenticate, requireOwner } = require('../middleware/auth');

// ==========================================
// CUSTOMERS MASTER
// ==========================================

// GET /api/customers
router.get('/customers', authenticate, async (req, res) => {
  try {
    const { search, activeOnly } = req.query;
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    if (activeOnly === 'true') {
      sql += ' AND is_active = 1';
    }

    if (search) {
      sql += ' AND (company_name LIKE ? OR gst_no LIKE ? OR contact_person LIKE ? OR customer_code LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY company_name ASC';
    const customers = await query(sql, params);
    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/customers/:id
router.get('/customers/:id', authenticate, async (req, res) => {
  try {
    const customer = await getOne('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    res.json({ success: true, customer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/customers (Owner only)
router.post('/customers', authenticate, requireOwner, async (req, res) => {
  try {
    const { company_name, address, gst_no, company_type, contact_person, phone, email, customer_code } = req.body;

    if (!company_name || !address || !gst_no) {
      return res.status(400).json({
        success: false,
        message: 'Company Name, Address, and GST Number are required.'
      });
    }

    // Basic GST format check (15 chars typically for Indian GST)
    const cleanGst = gst_no.trim().toUpperCase();

    const code = customer_code || `CUST-${Date.now().toString().slice(-4)}`;

    const result = await run(`
      INSERT INTO customers (
        customer_code, company_name, address, gst_no, company_type, contact_person, phone, email, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [code, company_name.trim(), address.trim(), cleanGst, company_type || '', contact_person || '', phone || '', email || '']);

    await logAudit(req.user.id, req.user.username, 'CREATE_CUSTOMER', 'customers', result.lastID, `Created customer: ${company_name}`);

    res.json({ success: true, message: 'Customer added successfully.', customerId: result.lastID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/customers/:id (Owner only)
router.put('/customers/:id', authenticate, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, address, gst_no, company_type, contact_person, phone, email, is_active, customer_code } = req.body;

    const existing = await getOne('SELECT * FROM customers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const activeStatus = typeof is_active !== 'undefined' ? (is_active ? 1 : 0) : existing.is_active;

    await run(`
      UPDATE customers 
      SET company_name = ?, address = ?, gst_no = ?, company_type = ?, 
          contact_person = ?, phone = ?, email = ?, customer_code = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      company_name ? company_name.trim() : existing.company_name,
      address ? address.trim() : existing.address,
      gst_no ? gst_no.trim().toUpperCase() : existing.gst_no,
      typeof company_type !== 'undefined' ? company_type : existing.company_type,
      typeof contact_person !== 'undefined' ? contact_person : existing.contact_person,
      typeof phone !== 'undefined' ? phone : existing.phone,
      typeof email !== 'undefined' ? email : existing.email,
      customer_code || existing.customer_code,
      activeStatus,
      id
    ]);

    await logAudit(req.user.id, req.user.username, 'UPDATE_CUSTOMER', 'customers', id, `Updated customer: ${company_name || existing.company_name}`);

    res.json({ success: true, message: 'Customer updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/customers/:id (Owner only) - Soft deletes if has transactions
router.delete('/customers/:id', authenticate, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getOne('SELECT * FROM customers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    // Check if customer has inward records
    const inwardCount = await getOne('SELECT COUNT(*) as cnt FROM inward_entries WHERE customer_id = ?', [id]);
    if (inwardCount && inwardCount.cnt > 0) {
      // Soft deactivate
      await run('UPDATE customers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      await logAudit(req.user.id, req.user.username, 'DEACTIVATE_CUSTOMER', 'customers', id, `Deactivated customer: ${existing.company_name} (has active transactions)`);
      return res.json({ success: true, message: 'Customer has transaction history and has been deactivated instead of deleted.' });
    }

    // If no transactions, delete
    await run('DELETE FROM customers WHERE id = ?', [id]);
    await logAudit(req.user.id, req.user.username, 'DELETE_CUSTOMER', 'customers', id, `Deleted customer: ${existing.company_name}`);

    res.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GOODS MASTER
// ==========================================

// GET /api/goods
router.get('/goods', authenticate, async (req, res) => {
  try {
    const { activeOnly } = req.query;
    let sql = 'SELECT * FROM goods WHERE 1=1';
    if (activeOnly === 'true') {
      sql += ' AND is_active = 1';
    }
    sql += ' ORDER BY description ASC';
    const goods = await query(sql);
    res.json({ success: true, goods });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/goods (Owner only)
router.post('/goods', authenticate, requireOwner, async (req, res) => {
  try {
    const { description, unit_value, uom } = req.body;
    if (!description || isNaN(unit_value)) {
      return res.status(400).json({ success: false, message: 'Description and numeric unit value are required.' });
    }

    const rate = Math.max(0, parseFloat(unit_value));
    const result = await run(`
      INSERT INTO goods (description, unit_value, uom, is_active)
      VALUES (?, ?, ?, 1)
    `, [description.trim().toUpperCase(), rate, uom || 'Nos']);

    await logAudit(req.user.id, req.user.username, 'CREATE_GOODS', 'goods', result.lastID, `Added item: ${description} @ ₹${rate}`);

    res.json({ success: true, message: 'Goods item added successfully.', goodsId: result.lastID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/goods/:id (Owner only)
router.put('/goods/:id', authenticate, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, unit_value, uom, is_active } = req.body;

    const existing = await getOne('SELECT * FROM goods WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Goods item not found.' });
    }

    const rate = typeof unit_value !== 'undefined' ? Math.max(0, parseFloat(unit_value)) : existing.unit_value;
    const active = typeof is_active !== 'undefined' ? (is_active ? 1 : 0) : existing.is_active;

    await run(`
      UPDATE goods 
      SET description = ?, unit_value = ?, uom = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      description ? description.trim().toUpperCase() : existing.description,
      rate,
      uom || existing.uom,
      active,
      id
    ]);

    await logAudit(req.user.id, req.user.username, 'UPDATE_GOODS', 'goods', id, `Updated goods: ${description || existing.description} @ ₹${rate}`);

    res.json({ success: true, message: 'Goods item updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/goods/:id (Owner only)
router.delete('/goods/:id', authenticate, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getOne('SELECT * FROM goods WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Goods item not found.' });
    }

    const usageCount = await getOne('SELECT COUNT(*) as cnt FROM inward_items WHERE goods_id = ?', [id]);
    if (usageCount && usageCount.cnt > 0) {
      await run('UPDATE goods SET is_active = 0 WHERE id = ?', [id]);
      await logAudit(req.user.id, req.user.username, 'DEACTIVATE_GOODS', 'goods', id, `Deactivated goods: ${existing.description}`);
      return res.json({ success: true, message: 'Item is in use by transactions; deactivated instead of deleted.' });
    }

    await run('DELETE FROM goods WHERE id = ?', [id]);
    await logAudit(req.user.id, req.user.username, 'DELETE_GOODS', 'goods', id, `Deleted goods: ${existing.description}`);

    res.json({ success: true, message: 'Goods item deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// UOM MASTER
// ==========================================

// GET /api/uom
router.get('/uom', authenticate, async (req, res) => {
  try {
    const uoms = await query('SELECT * FROM uom WHERE is_active = 1 ORDER BY name ASC');
    res.json({ success: true, uom: uoms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/uom (Owner only)
router.post('/uom', authenticate, requireOwner, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'UOM name is required.' });
    }
    const result = await run('INSERT INTO uom (name) VALUES (?)', [name.trim()]);
    res.json({ success: true, message: 'UOM added successfully.', id: result.lastID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/uom/:id (Owner only)
router.delete('/uom/:id', authenticate, requireOwner, async (req, res) => {
  try {
    await run('UPDATE uom SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'UOM deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// PACKAGES MASTER
// ==========================================

// GET /api/packages
router.get('/packages', authenticate, async (req, res) => {
  try {
    const pkgs = await query('SELECT * FROM packages WHERE is_active = 1 ORDER BY id ASC');
    res.json({ success: true, packages: pkgs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/packages (Owner only)
router.post('/packages', authenticate, requireOwner, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Package name is required.' });
    }
    const result = await run('INSERT INTO packages (name) VALUES (?)', [name.trim()]);
    res.json({ success: true, message: 'Package type added successfully.', id: result.lastID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/packages/:id (Owner only)
router.delete('/packages/:id', authenticate, requireOwner, async (req, res) => {
  try {
    await run('UPDATE packages SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Package type deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// NOTES MASTER
// ==========================================

// GET /api/notes
router.get('/notes', authenticate, async (req, res) => {
  try {
    const notes = await query('SELECT * FROM notes WHERE is_active = 1 ORDER BY id ASC');
    res.json({ success: true, notes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notes (Owner only)
router.post('/notes', authenticate, requireOwner, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Note text is required.' });
    }
    const result = await run('INSERT INTO notes (text) VALUES (?)', [text.trim()]);
    res.json({ success: true, message: 'Note added successfully.', id: result.lastID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/notes/:id (Owner only)
router.delete('/notes/:id', authenticate, requireOwner, async (req, res) => {
  try {
    await run('UPDATE notes SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Note deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
