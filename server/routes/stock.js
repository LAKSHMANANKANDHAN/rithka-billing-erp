const express = require('express');
const router = express.Router();
const { query, getOne } = require('../db/database');
const { authenticate } = require('../middleware/auth');

// GET /api/stock/ledger - Full searchable transaction ledger
router.get('/ledger', authenticate, async (req, res) => {
  try {
    const { search, customer_id, transaction_type, startDate, endDate, goods_id } = req.query;

    let sql = `
      SELECT st.*, c.company_name as customer_name, u.full_name as worker_name
      FROM stock_transactions st
      JOIN customers c ON st.customer_id = c.id
      JOIN users u ON st.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (customer_id) {
      sql += ' AND st.customer_id = ?';
      params.push(customer_id);
    }

    if (transaction_type) {
      sql += ' AND st.transaction_type = ?';
      params.push(transaction_type.toUpperCase());
    }

    if (goods_id) {
      sql += ' AND st.goods_id = ?';
      params.push(goods_id);
    }

    if (startDate) {
      sql += ' AND DATE(st.transaction_date) >= DATE(?)';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND DATE(st.transaction_date) <= DATE(?)';
      params.push(endDate);
    }

    if (search) {
      sql += ` AND (
        c.company_name LIKE ? OR 
        st.item_description LIKE ? OR 
        st.inward_no LIKE ? OR 
        st.challan_no LIKE ? OR 
        u.full_name LIKE ?
      )`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY st.id DESC';

    const transactions = await query(sql, params);
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/stock/summary - Aggregated stock balance per customer and item
router.get('/summary', authenticate, async (req, res) => {
  try {
    const { customer_id, search } = req.query;

    let sql = `
      SELECT 
        c.id as customer_id,
        c.company_name as customer_name,
        c.gst_no as customer_gst,
        ii.item_description,
        ii.uom,
        SUM(ii.quantity) as total_inward_qty,
        COALESCE(SUM(oi.outward_qty), 0) as total_outward_qty,
        (SUM(ii.quantity) - COALESCE(SUM(oi.outward_qty), 0)) as pending_qty,
        AVG(ii.unit_value) as avg_unit_value,
        ((SUM(ii.quantity) - COALESCE(SUM(oi.outward_qty), 0)) * AVG(ii.unit_value)) as pending_value
      FROM inward_items ii
      JOIN inward_entries ie ON ii.inward_id = ie.id
      JOIN customers c ON ie.customer_id = c.id
      LEFT JOIN (
        SELECT inward_item_id, SUM(quantity) as outward_qty
        FROM outward_items
        GROUP BY inward_item_id
      ) oi ON ii.id = oi.inward_item_id
      WHERE 1=1
    `;
    const params = [];

    if (customer_id) {
      sql += ' AND c.id = ?';
      params.push(customer_id);
    }

    if (search) {
      sql += ' AND (c.company_name LIKE ? OR ii.item_description LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term);
    }

    sql += `
      GROUP BY c.id, ii.item_description, ii.uom
      ORDER BY c.company_name ASC, ii.item_description ASC
    `;

    const summary = await query(sql, params);
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
