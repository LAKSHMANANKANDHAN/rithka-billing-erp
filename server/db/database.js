const os = require('os');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Load environment variables (.env from root or server directory)
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
  dotenv.config();
} catch (e) {
  // dotenv optional if environment variables already set in process.env
}

// Check if Supabase / PostgreSQL connection string is provided
const supabaseDbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const isSupabase = Boolean(supabaseDbUrl);

let db = null;
let pool = global._pgPool || null;
let supabaseClient = null;
let query, getOne, run, execute;

// Optional: Initialize Supabase JavaScript SDK if credentials are present
if (process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
  } catch (err) {
    console.warn('[Supabase] Failed to initialize Supabase JS client:', err.message);
  }
}

/**
 * Helper to convert SQLite '?' parameter placeholders to PostgreSQL '$1, $2, ...'
 */
function convertPlaceholders(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

if (isSupabase) {
  // ==========================================
  // SUPABASE / POSTGRESQL ENGINE (Serverless Ready)
  // ==========================================
  const { Pool, types } = require('pg');

  // Parse BIGINT (COUNT(*) and INT8) into integer numbers in JavaScript
  types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
  // Parse NUMERIC / DECIMAL into float numbers in JavaScript
  types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

  if (!pool) {
    pool = new Pool({
      connectionString: supabaseDbUrl,
      ssl: { rejectUnauthorized: false }, // Required by Supabase connection pooler
      max: process.env.VERCEL ? 3 : 10,  // Keep connection count small per serverless instance
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });
    global._pgPool = pool;
  }

  query = async (sql, params = []) => {
    const formattedSql = convertPlaceholders(sql);
    const res = await pool.query(formattedSql, params);
    return res.rows;
  };

  getOne = async (sql, params = []) => {
    const formattedSql = convertPlaceholders(sql);
    const res = await pool.query(formattedSql, params);
    return res.rows[0] || null;
  };

  run = async (sql, params = []) => {
    let pgSql = sql.trim();
    const isInsert = /^INSERT\s+INTO/i.test(pgSql);
    if (isInsert && !/RETURNING/i.test(pgSql)) {
      pgSql += ' RETURNING id';
    }
    const formattedSql = convertPlaceholders(pgSql);
    const res = await pool.query(formattedSql, params);
    return {
      lastID: res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : null,
      changes: res.rowCount
    };
  };

  execute = async (sql) => {
    await pool.query(sql);
  };

  db = pool;
  console.log('[Database] Configured for Supabase PostgreSQL cloud database.');

} else {
  // ==========================================
  // LOCAL SQLITE FALLBACK ENGINE
  // ==========================================
  if (process.env.VERCEL) {
    // If running in Vercel without SUPABASE_DB_URL, throw clear actionable error
    const msg = 'CRITICAL: SUPABASE_DB_URL is not configured in Vercel Environment Variables. Please go to Vercel Dashboard -> Settings -> Environment Variables and add SUPABASE_DB_URL.';
    console.error(msg);
  }

  let dbPath;
  if (process.env.VERCEL) {
    const targetDb = path.join(os.tmpdir(), 'erp.db');
    const sourceDb = path.join(__dirname, 'erp.db');
    try {
      if (!fs.existsSync(targetDb) && fs.existsSync(sourceDb)) {
        fs.copyFileSync(sourceDb, targetDb);
      }
    } catch (e) {
      console.warn('Could not copy seed db to tmpdir:', e.message);
    }
    dbPath = targetDb;
  } else {
    dbPath = path.join(__dirname, 'erp.db');
  }

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
      if (process.env.VERCEL) {
        throw new Error('Database error on Vercel: SUPABASE_DB_URL is missing in Vercel Environment Variables. Please add SUPABASE_DB_URL in Vercel Dashboard -> Settings -> Environment Variables.');
      }
      console.error('Both sqlite3 and node:sqlite failed to load.');
      throw loadErr;
    }
  }
}

// Initialize schema and seed data
async function initDatabase() {
  // If running with Supabase and company_settings table already exists, skip full DDL execution for fast cold start
  if (isSupabase) {
    try {
      const existingSettings = await getOne('SELECT id FROM company_settings LIMIT 1');
      if (existingSettings) {
        // Schema is already created and seeded
        return;
      }
    } catch (checkErr) {
      // Table doesn't exist yet, proceed with schema creation below
    }
  }

  let schemaSql;
  if (isSupabase) {
    try {
      schemaSql = require('./schemaPostgresSql');
    } catch (e) {
      schemaSql = fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf-8');
    }
  } else {
    try {
      schemaSql = require('./schemaSql');
    } catch (e) {
      schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    }
  }

  if (schemaSql && schemaSql.trim()) {
    await execute(schemaSql);
  }

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

  if (isSupabase) {
    console.log('[Supabase] Database connected, schema checked and ready.');
  } else {
    console.log('[Database] SQLite database initialized successfully with schema and demo data.');
  }
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
  pool,
  isSupabase,
  supabase: supabaseClient,
  query,
  getOne,
  run,
  execute,
  initDatabase,
  logAudit
};
