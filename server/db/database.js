const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const dbPath = path.join(__dirname, 'erp.db');

let db;
let query, getOne, run, execute;

try {
  const sqlite3 = require('sqlite3').verbose();
  const sdb = new sqlite3.Database(dbPath);
  sdb.run('PRAGMA foreign_keys = ON');

  query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      sdb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  getOne = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      sdb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      sdb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };

  execute = (sql) => {
    return new Promise((resolve, reject) => {
      sdb.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  db = sdb;
} catch (loadErr) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const nodeDb = new DatabaseSync(dbPath);
    nodeDb.exec('PRAGMA foreign_keys = ON');

    query = async (sql, params = []) => {
      const stmt = nodeDb.prepare(sql);
      return stmt.all(...params);
    };

    getOne = async (sql, params = []) => {
      const stmt = nodeDb.prepare(sql);
      return stmt.get(...params);
    };

    run = async (sql, params = []) => {
      const stmt = nodeDb.prepare(sql);
      const result = stmt.run(...params);
      return { lastID: Number(result.lastInsertRowid), changes: Number(result.changes) };
    };

    execute = async (sql) => {
      nodeDb.exec(sql);
    };

    db = nodeDb;
    console.log('Using Node.js built-in node:sqlite engine.');
  } catch (fallbackErr) {
    console.error('Both sqlite3 and node:sqlite failed to load.');
    throw loadErr;
  }
}

// Initialize schema and seed data
async function initDatabase() {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await execute(schemaSql);

  // Check if company settings exist
  const existingSettings = await getOne('SELECT id FROM company_settings LIMIT 1');
  if (!existingSettings) {
    await run(`
      INSERT INTO company_settings (
        company_name, gst_no, address, phone, email, 
        default_tax_rate, inward_prefix, outward_prefix, challan_year_format, starting_serial_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'Shri.Bharathi & Co.,',
      '33AATPY9887A1ZU',
      'Site No : 9, S.F No : 208/1B , Anjugam Nagar, Ambigai Nagar Road,\nChinnavedampatti (PO), Coimbatore - 641 049',
      '95433 49900',
      'a.yuvarajan@gmail.com',
      9.0,
      'INW-',
      'DC-',
      'XXXX/26-27',
      1
    ]);
  }

  // Check if users exist
  const existingUsers = await getOne('SELECT id FROM users LIMIT 1');
  if (!existingUsers) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const workerHash = await bcrypt.hash('worker123', 10);

    await run(`
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES (?, ?, ?, ?)
    `, ['admin', adminHash, 'Company Owner / Admin', 'owner']);

    await run(`
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES (?, ?, ?, ?)
    `, ['worker1', workerHash, 'Production Worker', 'worker']);
  }

  // Check UOM
  const existingUom = await getOne('SELECT id FROM uom LIMIT 1');
  if (!existingUom) {
    const uoms = ['Nos', 'Kgs', 'Litres', 'Meter'];
    for (const u of uoms) {
      await run('INSERT INTO uom (name) VALUES (?)', [u]);
    }
  }

  // Check Packages
  const existingPkg = await getOne('SELECT id FROM packages LIMIT 1');
  if (!existingPkg) {
    const pkgs = [
      'Loose',
      'Wooden Pallet-1',
      'Wooden Pallet-2',
      'Plastic Tray',
      'Plastic Crate',
      'Gunny bag',
      'NIL'
    ];
    for (const p of pkgs) {
      await run('INSERT INTO packages (name) VALUES (?)', [p]);
    }
  }

  // Check Notes
  const existingNote = await getOne('SELECT id FROM notes LIMIT 1');
  if (!existingNote) {
    const defaultNotes = [
      'Customer Material returned',
      'Material handling purpose',
      'Sent for service and return',
      'Sent for repair and return'
    ];
    for (const n of defaultNotes) {
      await run('INSERT INTO notes (text) VALUES (?)', [n]);
    }
  }

  // Check Goods
  const existingGoods = await getOne('SELECT id FROM goods LIMIT 1');
  if (!existingGoods) {
    const defaultGoods = [
      { desc: 'STEEL TRAY', rate: 50.0, uom: 'Nos' },
      { desc: 'PLASTIC TRAY', rate: 30.0, uom: 'Nos' },
      { desc: 'DEDICATED TRAY', rate: 75.0, uom: 'Nos' },
      { desc: 'PLASTIC BIN', rate: 120.0, uom: 'Nos' },
      { desc: 'WOODEN PALLET', rate: 450.0, uom: 'Nos' }
    ];
    for (const g of defaultGoods) {
      await run('INSERT INTO goods (description, unit_value, uom) VALUES (?, ?, ?)', [
        g.desc,
        g.rate,
        g.uom
      ]);
    }
  }

  // Check Customers
  const existingCust = await getOne('SELECT id FROM customers LIMIT 1');
  if (!existingCust) {
    const defaultCustomers = [
      {
        code: 'CUST-001',
        name: 'Texmo Precision Tools Pvt Ltd',
        address: 'Site No. 14, Mettupalayam Road, GN Mills Post, Coimbatore - 641029',
        gst: '33AAACT1984Q1Z2',
        type: 'Private Limited',
        contact: 'Mr. S. Ramanathan',
        phone: '98422 12345',
        email: 'purchase@texmopowertools.com'
      },
      {
        code: 'CUST-002',
        name: 'Roots Industries India Limited',
        address: 'R.K.G. Industrial Estate, Ganapathy, Coimbatore - 641006',
        gst: '33AAACR2981M1ZX',
        type: 'Public Limited',
        contact: 'Mr. K. Murugesan',
        phone: '98940 56789',
        email: 'stores@roots.co.in'
      },
      {
        code: 'CUST-003',
        name: 'Lakshmi Machine Works Ltd',
        address: 'Perianaickenpalayam, SRKV Post, Coimbatore - 641020',
        gst: '33AAACL1290F1Z4',
        type: 'Public Limited',
        contact: 'Mr. R. Balaji',
        phone: '94433 78901',
        email: 'logistics@lmw.co.in'
      },
      {
        code: 'CUST-004',
        name: 'Sundaram Fasteners Limited',
        address: 'Plot No. 24, SIDCO Industrial Estate, Kurichi, Coimbatore - 641021',
        gst: '33AAACS5514E1Z1',
        type: 'Corporate',
        contact: 'Mrs. V. Geetha',
        phone: '97890 23456',
        email: 'dispatch@sundaramfasteners.com'
      }
    ];

    for (const c of defaultCustomers) {
      await run(`
        INSERT INTO customers (
          customer_code, company_name, address, gst_no, company_type, contact_person, phone, email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [c.code, c.name, c.address, c.gst, c.type, c.contact, c.phone, c.email]);
    }
  }

  console.log('Database initialized successfully with schema and demo data.');
}

// Audit logger helper
async function logAudit(userId, username, action, entityType, entityId, details) {
  try {
    await run(`
      INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId || null, username || 'system', action, entityType, String(entityId || ''), details || '']);
  } catch (err) {
    console.error('Failed to log audit event:', err.message);
  }
}

module.exports = {
  db,
  query,
  getOne,
  run,
  execute,
  initDatabase,
  logAudit
};
