const express = require('express');
const router = express.Router();
const { query, getOne, run, logAudit } = require('../db/database');
const { authenticate, requireOwner } = require('../middleware/auth');

// GET /api/settings - Fetch current company settings
router.get('/', authenticate, async (req, res) => {
  try {
    const settings = await getOne('SELECT * FROM company_settings LIMIT 1');
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/settings - Update company settings (Owner only)
router.put('/', authenticate, requireOwner, async (req, res) => {
  try {
    const {
      company_name,
      gst_no,
      address,
      phone,
      email,
      logo_url,
      default_tax_rate,
      inward_prefix,
      outward_prefix,
      challan_year_format,
      starting_serial_no
    } = req.body;

    const current = await getOne('SELECT * FROM company_settings LIMIT 1');

    await run(`
      UPDATE company_settings
      SET company_name = ?, gst_no = ?, address = ?, phone = ?, email = ?, 
          logo_url = ?, default_tax_rate = ?, inward_prefix = ?, outward_prefix = ?, 
          challan_year_format = ?, starting_serial_no = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      company_name || current.company_name,
      gst_no || current.gst_no,
      address || current.address,
      phone || current.phone,
      email || current.email,
      typeof logo_url !== 'undefined' ? logo_url : current.logo_url,
      typeof default_tax_rate !== 'undefined' ? parseFloat(default_tax_rate) : current.default_tax_rate,
      inward_prefix || current.inward_prefix,
      outward_prefix || current.outward_prefix,
      challan_year_format || current.challan_year_format,
      typeof starting_serial_no !== 'undefined' ? parseInt(starting_serial_no) : current.starting_serial_no,
      current.id
    ]);

    await logAudit(
      req.user.id,
      req.user.username,
      'UPDATE_SETTINGS',
      'company_settings',
      current.id,
      `Updated company settings: Name=${company_name || current.company_name}, Tax=${default_tax_rate}%`
    );

    const updated = await getOne('SELECT * FROM company_settings WHERE id = ?', [current.id]);
    res.json({ success: true, message: 'Company settings updated successfully.', settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
