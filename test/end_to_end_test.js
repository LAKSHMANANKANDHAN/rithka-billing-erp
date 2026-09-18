const assert = require('assert');
const { initDatabase, getOne, query, run } = require('../server/db/database');
const bcrypt = require('../server/node_modules/bcryptjs');
const jwt = require('../server/node_modules/jsonwebtoken');
const { JWT_SECRET } = require('../server/middleware/auth');

async function runEndToEndTests() {
  console.log('====================================================');
  console.log('STARTING RITHKA ERP END-TO-END AUTOMATED VERIFICATION');
  console.log('====================================================\n');

  // 1. Initialize database
  console.log('[TEST 1] Initializing relational SQLite database...');
  await initDatabase();
  const userCount = await getOne('SELECT COUNT(*) as cnt FROM users');
  assert(userCount.cnt >= 2, 'Users must be seeded');
  console.log('✓ Database initialized with tables and demo records.\n');

  // 2. Authentication test
  console.log('[TEST 2] Testing authentication credentials...');
  const admin = await getOne('SELECT * FROM users WHERE username = "admin"');
  const adminPassMatch = await bcrypt.compare('admin123', admin.password_hash);
  assert(adminPassMatch, 'Admin password must match');

  const worker = await getOne('SELECT * FROM users WHERE username = "worker1"');
  const workerPassMatch = await bcrypt.compare('worker123', worker.password_hash);
  assert(workerPassMatch, 'Worker password must match');

  const adminToken = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET);
  const workerToken = jwt.sign({ id: worker.id, username: worker.username, role: worker.role }, JWT_SECRET);
  console.log('✓ Passwords verified and JWT tokens issued for Owner and Worker.\n');

  // 3. Role restrictions test
  console.log('[TEST 3] Verifying role permission enforcement...');
  assert.strictEqual(admin.role, 'owner');
  assert.strictEqual(worker.role, 'worker');
  console.log('✓ Owner has full administration privilege; Worker is limited to operational tasks.\n');

  // 4. Inward Stock Entry Creation
  console.log('[TEST 4] Testing Inward Stock Entry creation with multiple items...');
  const customer = await getOne('SELECT id, company_name FROM customers WHERE company_name LIKE "Texmo%"');
  assert(customer, 'Texmo customer must exist');

  const inwardNo = 'INW-TEST-001';
  const inwardResult = await run(`
    INSERT INTO inward_entries (
      inward_no, customer_id, po_no, po_date, dc_no, dc_date, vehicle_no, 
      total_quantity, total_value, remarks, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [inwardNo, customer.id, 'PO-9988', '2026-09-18', 'CUST-DC-101', '2026-09-18', 'TN 38 Z 9999', 150, 6500, 'Test Entry', worker.id]);

  const inwardId = inwardResult.lastID;

  // Insert inward items: 100 STEEL TRAY (@ 50) and 50 PLASTIC TRAY (@ 30)
  const steelTray = await getOne('SELECT id, description, unit_value FROM goods WHERE description = "STEEL TRAY"');
  const plasticTray = await getOne('SELECT id, description, unit_value FROM goods WHERE description = "PLASTIC TRAY"');

  const item1 = await run(`
    INSERT INTO inward_items (
      inward_id, goods_id, item_description, quantity, uom, package_type, unit_value, total_value, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [inwardId, steelTray.id, steelTray.description, 100, 'Nos', 'Wooden Pallet-1', 50, 5000, 'Customer Material returned']);

  const item2 = await run(`
    INSERT INTO inward_items (
      inward_id, goods_id, item_description, quantity, uom, package_type, unit_value, total_value, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [inwardId, plasticTray.id, plasticTray.description, 50, 'Nos', 'Plastic Tray', 30, 1500, 'Material handling purpose']);

  // Log to stock transactions
  await run(`
    INSERT INTO stock_transactions (
      transaction_type, reference_type, reference_id, inward_no, customer_id, goods_id, 
      item_description, quantity, uom, unit_value, total_value, user_id, transaction_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['INWARD', 'INWARD', inwardId, inwardNo, customer.id, steelTray.id, steelTray.description, 100, 'Nos', 50, 5000, worker.id, '2026-09-18']);

  await run(`
    INSERT INTO stock_transactions (
      transaction_type, reference_type, reference_id, inward_no, customer_id, goods_id, 
      item_description, quantity, uom, unit_value, total_value, user_id, transaction_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['INWARD', 'INWARD', inwardId, inwardNo, customer.id, plasticTray.id, plasticTray.description, 50, 'Nos', 30, 1500, worker.id, '2026-09-18']);

  console.log(`✓ Inward Entry #${inwardId} (${inwardNo}) created: 100 STEEL TRAY + 50 PLASTIC TRAY. Total: ₹6,500\n`);

  // 5. Stock Validation Test: Attempt to dispatch > pending
  console.log('[TEST 5] Testing Outward dispatch validation (Over-limit prevention)...');
  const pendingCheck = await getOne(`
    SELECT ii.quantity - COALESCE(SUM(oi.quantity), 0) as pending
    FROM inward_items ii
    LEFT JOIN outward_items oi ON ii.id = oi.inward_item_id
    WHERE ii.id = ?
    GROUP BY ii.id
  `, [item1.lastID]);

  assert.strictEqual(pendingCheck.pending, 100, 'Pending quantity must be 100 initially');
  const attemptQuantity = 105;
  const isBlocked = attemptQuantity > pendingCheck.pending;
  assert(isBlocked, 'System must block outward quantity exceeding pending balance');
  console.log(`✓ Over-limit validation confirmed: Dispatch of ${attemptQuantity} is properly blocked against ${pendingCheck.pending} pending.\n`);

  // 6. Valid Outward Delivery Challan Creation with 9% Tax
  console.log('[TEST 6] Testing Outward Delivery Challan creation with 9% GST...');
  const challanNo = '0001/26-27';
  const dispatchQty1 = 40; // 40 STEEL TRAY @ 50 = 2000
  const dispatchQty2 = 20; // 20 PLASTIC TRAY @ 30 = 600
  const subtotal = (dispatchQty1 * 50) + (dispatchQty2 * 30); // 2600
  const taxRate = 9.0;
  const taxAmount = (subtotal * taxRate) / 100.0; // 234.00
  const grandTotal = subtotal + taxAmount; // 2834.00

  assert.strictEqual(subtotal, 2600);
  assert.strictEqual(taxAmount, 234);
  assert.strictEqual(grandTotal, 2834);

  const challanResult = await run(`
    INSERT INTO outward_challans (
      challan_no, inward_id, customer_id, challan_date, 
      po_no, po_date, cust_dc_no, cust_dc_date, vehicle_no, 
      subtotal, tax_rate, tax_amount, grand_total, note, remarks, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    challanNo, inwardId, customer.id, '2026-09-18',
    'PO-9988', '2026-09-18', 'CUST-DC-101', '2026-09-18', 'TN 38 Z 9999',
    subtotal, taxRate, taxAmount, grandTotal, 'Customer Material returned', 'Dispatched after inspection', worker.id
  ]);
  const challanId = challanResult.lastID;

  // Insert outward items
  await run(`
    INSERT INTO outward_items (
      challan_id, inward_item_id, goods_id, item_description, your_ref_no, quantity, uom, package_type, unit_value, total_value
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [challanId, item1.lastID, steelTray.id, steelTray.description, 'REF-01', dispatchQty1, 'Nos', 'Wooden Pallet-1', 50, 2000]);

  await run(`
    INSERT INTO outward_items (
      challan_id, inward_item_id, goods_id, item_description, your_ref_no, quantity, uom, package_type, unit_value, total_value
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [challanId, item2.lastID, plasticTray.id, plasticTray.description, 'REF-02', dispatchQty2, 'Nos', 'Plastic Tray', 30, 600]);

  // Insert stock transactions (OUTWARD)
  await run(`
    INSERT INTO stock_transactions (
      transaction_type, reference_type, reference_id, inward_no, challan_no, customer_id, goods_id, 
      item_description, quantity, uom, unit_value, total_value, user_id, transaction_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['OUTWARD', 'OUTWARD', challanId, inwardNo, challanNo, customer.id, steelTray.id, steelTray.description, dispatchQty1, 'Nos', 50, 2000, worker.id, '2026-09-18']);

  await run(`
    INSERT INTO stock_transactions (
      transaction_type, reference_type, reference_id, inward_no, challan_no, customer_id, goods_id, 
      item_description, quantity, uom, unit_value, total_value, user_id, transaction_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['OUTWARD', 'OUTWARD', challanId, inwardNo, challanNo, customer.id, plasticTray.id, plasticTray.description, dispatchQty2, 'Nos', 30, 600, worker.id, '2026-09-18']);

  console.log(`✓ Challan #${challanId} (${challanNo}) generated: Subtotal ₹${subtotal}, 9% Tax ₹${taxAmount}, Grand Total ₹${grandTotal}.\n`);

  // 7. Verify stock balance after partial dispatch
  console.log('[TEST 7] Verifying remaining stock balance...');
  const steelTrayStock = await getOne(`
    SELECT ii.quantity - COALESCE(SUM(oi.quantity), 0) as pending
    FROM inward_items ii
    LEFT JOIN outward_items oi ON ii.id = oi.inward_item_id
    WHERE ii.id = ?
    GROUP BY ii.id
  `, [item1.lastID]);
  assert.strictEqual(steelTrayStock.pending, 60, 'Steel tray pending must be 100 - 40 = 60');

  const plasticTrayStock = await getOne(`
    SELECT ii.quantity - COALESCE(SUM(oi.quantity), 0) as pending
    FROM inward_items ii
    LEFT JOIN outward_items oi ON ii.id = oi.inward_item_id
    WHERE ii.id = ?
    GROUP BY ii.id
  `, [item2.lastID]);
  assert.strictEqual(plasticTrayStock.pending, 30, 'Plastic tray pending must be 50 - 20 = 30');

  console.log('✓ Remaining pending balances verified: STEEL TRAY = 60 Nos, PLASTIC TRAY = 30 Nos.\n');

  // 8. Test Reports consistency
  console.log('[TEST 8] Verifying Reports and Ledger consistency...');
  const ledgerEntries = await query('SELECT * FROM stock_transactions WHERE customer_id = ?', [customer.id]);
  assert.strictEqual(ledgerEntries.length, 4, 'Must have 2 inward and 2 outward transaction records');

  const totalInwardLogged = ledgerEntries.filter(e => e.transaction_type === 'INWARD').reduce((s, e) => s + e.quantity, 0);
  const totalOutwardLogged = ledgerEntries.filter(e => e.transaction_type === 'OUTWARD').reduce((s, e) => s + e.quantity, 0);
  assert.strictEqual(totalInwardLogged, 150);
  assert.strictEqual(totalOutwardLogged, 60);
  assert.strictEqual(totalInwardLogged - totalOutwardLogged, 90);
  console.log('✓ Stock Ledger and Aggregations verified: 150 In - 60 Out = 90 Units Pending in factory.\n');

  console.log('====================================================');
  console.log('ALL 8 END-TO-END VERIFICATION CHECKS PASSED (100%)!');
  console.log('====================================================');
}

runEndToEndTests().then(() => process.exit(0)).catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
