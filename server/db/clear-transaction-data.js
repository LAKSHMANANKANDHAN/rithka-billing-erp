const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

async function clearData() {
  console.log('====================================================');
  console.log('  RITHKA ERP - RESET TRANSACTION & CUSTOMER DATA');
  console.log('====================================================\n');

  const tablesToClear = [
    'outward_items',
    'outward_challans',
    'inward_items',
    'inward_entries',
    'stock_transactions',
    'customers',
    'audit_logs'
  ];

  // 1. Clear Supabase PostgreSQL if configured
  if (connectionString) {
    console.log('[1/2] Clearing Supabase Cloud Database...');
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });

    try {
      for (const table of tablesToClear) {
        // Truncate cascade clears table and dependent references
        await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
        try {
          await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), 1, false)`);
        } catch (seqErr) {
          // ignore
        }
        console.log(`  ✓ Cleared Supabase table: ${table} (reset to 0)`);
      }

      await pool.query('UPDATE company_settings SET starting_serial_no = 1');
      console.log('  ✓ Company settings starting_serial_no reset to 1.');
      await pool.end();
      console.log('  ✅ Supabase database is completely fresh and clean.\n');
    } catch (err) {
      console.error('  ❌ Supabase clear failed:', err.message);
      await pool.end();
    }
  }

  // 2. Clear local SQLite database (server/db/erp.db)
  console.log('[2/2] Clearing Local SQLite Database...');
  const sqliteDbPath = path.join(__dirname, 'erp.db');
  if (fs.existsSync(sqliteDbPath)) {
    const sqlite3 = require('sqlite3').verbose();
    const sdb = new sqlite3.Database(sqliteDbPath);

    const srun = (sql) => new Promise((resolve, reject) => {
      sdb.run(sql, (err) => err ? reject(err) : resolve());
    });

    try {
      await srun('PRAGMA foreign_keys = OFF');
      for (const table of tablesToClear) {
        await srun(`DELETE FROM ${table}`);
        console.log(`  ✓ Cleared SQLite table: ${table} (reset to 0)`);
      }
      // Reset auto-increment sequences in SQLite
      await srun(`DELETE FROM sqlite_sequence WHERE name IN (${tablesToClear.map(t => `'${t}'`).join(', ')})`);
      await srun('UPDATE company_settings SET starting_serial_no = 1');
      await srun('PRAGMA foreign_keys = ON');
      console.log('  ✓ SQLite sequences reset.');
      sdb.close();
      console.log('  ✅ Local SQLite database is completely fresh and clean.\n');
    } catch (err) {
      console.error('  ❌ SQLite clear failed:', err.message);
      sdb.close();
    }
  }

  console.log('====================================================');
  console.log('SUCCESS: All inward challans, outward challans,');
  console.log('stock records, and demo customers have been removed.');
  console.log('Masters (Goods, Rates, UOM, Packages, Users) remain ready.');
  console.log('====================================================');
}

clearData();
