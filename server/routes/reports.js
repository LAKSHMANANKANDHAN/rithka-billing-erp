const express = require('express');
const router = express.Router();
const { query, getOne } = require('../db/database');
const { authenticate } = require('../middleware/auth');

// GET /api/reports/dashboard-stats
router.get('/dashboard-stats', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const customerCount = await getOne('SELECT COUNT(*) as count FROM customers WHERE is_active = 1');
    const totalInward = await getOne('SELECT COUNT(*) as count, COALESCE(SUM(total_quantity), 0) as total_qty, COALESCE(SUM(total_value), 0) as total_val FROM inward_entries');
    const totalOutward = await getOne('SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total_val FROM outward_challans');
    const outwardQtyRow = await getOne('SELECT COALESCE(SUM(quantity), 0) as total_qty FROM outward_items');

    const todayInward = await getOne(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_quantity), 0) as total_qty, COALESCE(SUM(total_value), 0) as total_val 
      FROM inward_entries 
      WHERE DATE(created_at) = DATE(?)
    `, [today]);

    const todayOutward = await getOne(`
      SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total_val 
      FROM outward_challans 
      WHERE DATE(challan_date) = DATE(?)
    `, [today]);

    const todayOutwardQtyRow = await getOne(`
      SELECT COALESCE(SUM(oi.quantity), 0) as total_qty 
      FROM outward_items oi
      JOIN outward_challans oc ON oi.challan_id = oc.id
      WHERE DATE(oc.challan_date) = DATE(?)
    `, [today]);

    // Pending tasks count
    const pendingTasksCount = await getOne(`
      SELECT COUNT(*) as count
      FROM inward_items ii
      LEFT JOIN (
        SELECT inward_item_id, SUM(quantity) as outward_qty
        FROM outward_items
        GROUP BY inward_item_id
      ) oi ON ii.id = oi.inward_item_id
      WHERE (ii.quantity - COALESCE(oi.outward_qty, 0)) > 0
    `);

    // Inward vs Outward last 7 days
    const recentActivity = await query(`
      SELECT 
        d.dt as date,
        COALESCE((SELECT SUM(total_quantity) FROM inward_entries WHERE DATE(created_at) = d.dt), 0) as inward_qty,
        COALESCE((SELECT SUM(oi.quantity) FROM outward_items oi JOIN outward_challans oc ON oi.challan_id = oc.id WHERE DATE(oc.challan_date) = d.dt), 0) as outward_qty
      FROM (
        SELECT DATE('now', '-' || num || ' days') as dt
        FROM (
          SELECT 0 as num UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL 
          SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
        )
      ) d
      ORDER BY d.dt ASC
    `);

    // Top pending materials
    const pendingMaterials = await query(`
      SELECT 
        c.company_name,
        ii.item_description,
        ii.quantity as inward_qty,
        COALESCE(oi.outward_qty, 0) as outward_qty,
        (ii.quantity - COALESCE(oi.outward_qty, 0)) as pending_qty,
        ii.uom
      FROM inward_items ii
      JOIN inward_entries ie ON ii.inward_id = ie.id
      JOIN customers c ON ie.customer_id = c.id
      LEFT JOIN (
        SELECT inward_item_id, SUM(quantity) as outward_qty
        FROM outward_items
        GROUP BY inward_item_id
      ) oi ON ii.id = oi.inward_item_id
      WHERE (ii.quantity - COALESCE(oi.outward_qty, 0)) > 0
      ORDER BY (ii.quantity - COALESCE(oi.outward_qty, 0)) DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      stats: {
        totalCustomers: customerCount?.count || 0,
        totalInwardEntries: totalInward?.count || 0,
        totalInwardQty: totalInward?.total_qty || 0,
        totalInwardVal: totalInward?.total_val || 0,
        totalOutwardChallans: totalOutward?.count || 0,
        totalOutwardQty: outwardQtyRow?.total_qty || 0,
        totalOutwardVal: totalOutward?.total_val || 0,
        currentStockPending: (totalInward?.total_qty || 0) - (outwardQtyRow?.total_qty || 0),
        totalPendingTasks: pendingTasksCount?.count || 0,
        todayInwardEntries: todayInward?.count || 0,
        todayInwardQty: todayInward?.total_qty || 0,
        todayInwardVal: todayInward?.total_val || 0,
        todayOutwardChallans: todayOutward?.count || 0,
        todayOutwardQty: todayOutwardQtyRow?.total_qty || 0,
        todayOutwardVal: todayOutward?.total_val || 0
      },
      recentActivity,
      pendingMaterials
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reports/daily - Daily report for a specific date
router.get('/daily', authenticate, async (req, res) => {
  try {
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];

    const inwardList = await query(`
      SELECT ie.*, c.company_name, u.full_name as worker_name
      FROM inward_entries ie
      JOIN customers c ON ie.customer_id = c.id
      JOIN users u ON ie.created_by = u.id
      WHERE DATE(ie.created_at) = DATE(?)
      ORDER BY ie.id ASC
    `, [targetDate]);

    const outwardList = await query(`
      SELECT oc.*, c.company_name, u.full_name as worker_name, ie.inward_no
      FROM outward_challans oc
      JOIN customers c ON oc.customer_id = c.id
      JOIN inward_entries ie ON oc.inward_id = ie.id
      JOIN users u ON oc.created_by = u.id
      WHERE DATE(oc.challan_date) = DATE(?)
      ORDER BY oc.id ASC
    `, [targetDate]);

    let totalInwardQty = 0;
    let totalInwardVal = 0;
    inwardList.forEach(i => {
      totalInwardQty += i.total_quantity;
      totalInwardVal += i.total_value;
    });

    let totalOutwardVal = 0;
    outwardList.forEach(o => {
      totalOutwardVal += o.grand_total;
    });

    const outwardQtyRow = await getOne(`
      SELECT COALESCE(SUM(oi.quantity), 0) as total_qty 
      FROM outward_items oi
      JOIN outward_challans oc ON oi.challan_id = oc.id
      WHERE DATE(oc.challan_date) = DATE(?)
    `, [targetDate]);

    // Customer-wise breakdown for the day
    const customerBreakdown = await query(`
      SELECT 
        c.company_name,
        COALESCE(SUM(CASE WHEN st.transaction_type = 'INWARD' THEN st.quantity ELSE 0 END), 0) as inward_qty,
        COALESCE(SUM(CASE WHEN st.transaction_type = 'OUTWARD' THEN st.quantity ELSE 0 END), 0) as outward_qty,
        COALESCE(SUM(CASE WHEN st.transaction_type = 'INWARD' THEN st.total_value ELSE 0 END), 0) as inward_val,
        COALESCE(SUM(CASE WHEN st.transaction_type = 'OUTWARD' THEN st.total_value ELSE 0 END), 0) as outward_val
      FROM customers c
      JOIN stock_transactions st ON c.id = st.customer_id
      WHERE DATE(st.transaction_date) = DATE(?)
      GROUP BY c.id
      ORDER BY c.company_name ASC
    `, [targetDate]);

    res.json({
      success: true,
      date: targetDate,
      summary: {
        totalInwardEntries: inwardList.length,
        totalInwardQty,
        totalInwardVal,
        totalOutwardChallans: outwardList.length,
        totalOutwardQty: outwardQtyRow?.total_qty || 0,
        totalOutwardVal
      },
      inwardList,
      outwardList,
      customerBreakdown
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reports/date-range (Weekly / Custom)
router.get('/date-range', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required.' });
    }

    const inwardList = await query(`
      SELECT ie.*, c.company_name, u.full_name as worker_name
      FROM inward_entries ie
      JOIN customers c ON ie.customer_id = c.id
      JOIN users u ON ie.created_by = u.id
      WHERE DATE(ie.created_at) BETWEEN DATE(?) AND DATE(?)
      ORDER BY ie.id ASC
    `, [startDate, endDate]);

    const outwardList = await query(`
      SELECT oc.*, c.company_name, u.full_name as worker_name, ie.inward_no
      FROM outward_challans oc
      JOIN customers c ON oc.customer_id = c.id
      JOIN inward_entries ie ON oc.inward_id = ie.id
      JOIN users u ON oc.created_by = u.id
      WHERE DATE(oc.challan_date) BETWEEN DATE(?) AND DATE(?)
      ORDER BY oc.id ASC
    `, [startDate, endDate]);

    const outwardQtyRow = await getOne(`
      SELECT COALESCE(SUM(oi.quantity), 0) as total_qty 
      FROM outward_items oi
      JOIN outward_challans oc ON oi.challan_id = oc.id
      WHERE DATE(oc.challan_date) BETWEEN DATE(?) AND DATE(?)
    `, [startDate, endDate]);

    let totalInwardQty = inwardList.reduce((acc, i) => acc + i.total_quantity, 0);
    let totalInwardVal = inwardList.reduce((acc, i) => acc + i.total_value, 0);
    let totalOutwardVal = outwardList.reduce((acc, o) => acc + o.grand_total, 0);

    const customerBreakdown = await query(`
      SELECT 
        c.company_name,
        COALESCE(SUM(CASE WHEN st.transaction_type = 'INWARD' THEN st.quantity ELSE 0 END), 0) as inward_qty,
        COALESCE(SUM(CASE WHEN st.transaction_type = 'OUTWARD' THEN st.quantity ELSE 0 END), 0) as outward_qty,
        COALESCE(SUM(CASE WHEN st.transaction_type = 'INWARD' THEN st.total_value ELSE 0 END), 0) as inward_val,
        COALESCE(SUM(CASE WHEN st.transaction_type = 'OUTWARD' THEN st.total_value ELSE 0 END), 0) as outward_val
      FROM customers c
      JOIN stock_transactions st ON c.id = st.customer_id
      WHERE DATE(st.transaction_date) BETWEEN DATE(?) AND DATE(?)
      GROUP BY c.id
      ORDER BY c.company_name ASC
    `, [startDate, endDate]);

    res.json({
      success: true,
      startDate,
      endDate,
      summary: {
        totalInwardEntries: inwardList.length,
        totalInwardQty,
        totalInwardVal,
        totalOutwardChallans: outwardList.length,
        totalOutwardQty: outwardQtyRow?.total_qty || 0,
        totalOutwardVal
      },
      inwardList,
      outwardList,
      customerBreakdown
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reports/customer-wise - Customer report
router.get('/customer-wise', authenticate, async (req, res) => {
  try {
    const { customer_id, startDate, endDate } = req.query;
    if (!customer_id) {
      return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    const customer = await getOne('SELECT * FROM customers WHERE id = ?', [customer_id]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    let inwardFilter = 'WHERE ie.customer_id = ?';
    let outwardFilter = 'WHERE oc.customer_id = ?';
    const inwardParams = [customer_id];
    const outwardParams = [customer_id];

    if (startDate && endDate) {
      inwardFilter += ' AND DATE(ie.created_at) BETWEEN DATE(?) AND DATE(?)';
      inwardParams.push(startDate, endDate);

      outwardFilter += ' AND DATE(oc.challan_date) BETWEEN DATE(?) AND DATE(?)';
      outwardParams.push(startDate, endDate);
    }

    const inwardHistory = await query(`
      SELECT ie.*, u.full_name as worker_name
      FROM inward_entries ie
      JOIN users u ON ie.created_by = u.id
      ${inwardFilter}
      ORDER BY ie.id DESC
    `, inwardParams);

    const outwardHistory = await query(`
      SELECT oc.*, ie.inward_no, u.full_name as worker_name
      FROM outward_challans oc
      JOIN inward_entries ie ON oc.inward_id = ie.id
      JOIN users u ON oc.created_by = u.id
      ${outwardFilter}
      ORDER BY oc.id DESC
    `, outwardParams);

    // Pending items for this customer
    const pendingItems = await query(`
      SELECT 
        ie.inward_no,
        ie.created_at as inward_date,
        ie.po_no,
        ie.dc_no,
        ii.id as inward_item_id,
        ii.item_description,
        ii.quantity as original_qty,
        COALESCE(oi.outward_qty, 0) as outward_qty,
        (ii.quantity - COALESCE(oi.outward_qty, 0)) as pending_qty,
        ii.uom,
        ii.unit_value,
        ((ii.quantity - COALESCE(oi.outward_qty, 0)) * ii.unit_value) as pending_value
      FROM inward_items ii
      JOIN inward_entries ie ON ii.inward_id = ie.id
      LEFT JOIN (
        SELECT inward_item_id, SUM(quantity) as outward_qty
        FROM outward_items
        GROUP BY inward_item_id
      ) oi ON ii.id = oi.inward_item_id
      WHERE ie.customer_id = ? AND (ii.quantity - COALESCE(oi.outward_qty, 0)) > 0
      ORDER BY ie.id DESC
    `, [customer_id]);

    let totalInwardQty = inwardHistory.reduce((acc, i) => acc + i.total_quantity, 0);
    let totalInwardVal = inwardHistory.reduce((acc, i) => acc + i.total_value, 0);
    let totalOutwardVal = outwardHistory.reduce((acc, o) => acc + o.grand_total, 0);
    let totalPendingQty = pendingItems.reduce((acc, p) => acc + p.pending_qty, 0);
    let totalPendingVal = pendingItems.reduce((acc, p) => acc + p.pending_value, 0);

    res.json({
      success: true,
      customer,
      summary: {
        totalInwardQty,
        totalInwardVal,
        totalOutwardVal,
        totalPendingQty,
        totalPendingVal
      },
      inwardHistory,
      outwardHistory,
      pendingItems
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reports/pending-tasks - Status of all inward materials
router.get('/pending-tasks', authenticate, async (req, res) => {
  try {
    const { customer_id, status } = req.query;

    let sql = `
      SELECT 
        ie.id as inward_id,
        ie.inward_no,
        ie.created_at as inward_date,
        ie.po_no,
        ie.dc_no,
        ie.vehicle_no,
        c.id as customer_id,
        c.company_name as customer_name,
        ii.id as inward_item_id,
        ii.item_description,
        ii.quantity as inward_qty,
        COALESCE(oi.outward_qty, 0) as outward_qty,
        (ii.quantity - COALESCE(oi.outward_qty, 0)) as pending_qty,
        ii.uom,
        ii.unit_value,
        ((ii.quantity - COALESCE(oi.outward_qty, 0)) * ii.unit_value) as pending_value,
        CASE 
          WHEN (ii.quantity - COALESCE(oi.outward_qty, 0)) <= 0 THEN 'COMPLETED'
          ELSE 'PENDING'
        END as status
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
      sql += ' AND ie.customer_id = ?';
      params.push(customer_id);
    }

    if (status === 'PENDING') {
      sql += ' AND (ii.quantity - COALESCE(oi.outward_qty, 0)) > 0';
    } else if (status === 'COMPLETED') {
      sql += ' AND (ii.quantity - COALESCE(oi.outward_qty, 0)) <= 0';
    }

    sql += ' ORDER BY ie.id DESC, ii.id ASC';

    const tasks = await query(sql, params);
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reports/complete-work - Complete work overview
router.get('/complete-work', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, customer_id, worker_id } = req.query;

    let filterSql = 'WHERE 1=1';
    const params = [];

    if (customer_id) {
      filterSql += ' AND st.customer_id = ?';
      params.push(customer_id);
    }

    if (worker_id) {
      filterSql += ' AND st.user_id = ?';
      params.push(worker_id);
    }

    if (startDate && endDate) {
      filterSql += ' AND DATE(st.transaction_date) BETWEEN DATE(?) AND DATE(?)';
      params.push(startDate, endDate);
    }

    const transactions = await query(`
      SELECT st.*, c.company_name, u.full_name as worker_name
      FROM stock_transactions st
      JOIN customers c ON st.customer_id = c.id
      JOIN users u ON st.user_id = u.id
      ${filterSql}
      ORDER BY st.id DESC
    `, params);

    // Worker breakdown
    const workerActivity = await query(`
      SELECT 
        u.full_name as worker_name,
        u.role,
        COUNT(CASE WHEN st.transaction_type = 'INWARD' THEN 1 END) as inward_entries,
        COUNT(CASE WHEN st.transaction_type = 'OUTWARD' THEN 1 END) as outward_entries,
        COALESCE(SUM(st.quantity), 0) as total_units_handled,
        COALESCE(SUM(st.total_value), 0) as total_val
      FROM users u
      LEFT JOIN stock_transactions st ON u.id = st.user_id
      GROUP BY u.id
    `);

    res.json({
      success: true,
      transactions,
      workerActivity
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
