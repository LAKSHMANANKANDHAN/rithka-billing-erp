const express = require('express');
const router = express.Router();
const { query } = require('../db/database');
const { authenticate, requireOwner } = require('../middleware/auth');

// GET /api/audit - List audit logs (Owner only)
router.get('/', authenticate, requireOwner, async (req, res) => {
  try {
    const { action, username, startDate, endDate, limit = 100 } = req.query;

    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }

    if (username) {
      sql += ' AND username LIKE ?';
      params.push(`%${username}%`);
    }

    if (startDate) {
      sql += ' AND DATE(created_at) >= DATE(?)';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND DATE(created_at) <= DATE(?)';
      params.push(endDate);
    }

    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = await query(sql, params);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
