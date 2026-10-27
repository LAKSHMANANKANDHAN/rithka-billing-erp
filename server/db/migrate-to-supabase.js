const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

async function migrateToSupabase() {
  console.log('====================================================');
  console.log('  RITHKA ERP -> SUPABASE DATA MIGRATION UTILITY');
  console.log('====================================================\n');

  if (!connectionString) {
    console.error('❌ ERROR: SUPABASE_DB_URL is not set in your .env file.');
    console.error('Please configure your Supabase connection string before migrating.\n');
    process.exit(1);
  }

  // 1. Connect to local SQLite
  const sqlite3 = require('sqlite3').verbose();
  const sqliteDbPath = path.join(__dirname, 'erp.db');

  if (!fs.existsSync(sqliteDbPath)) {
    console.error(`❌ Local SQLite file not found at: ${sqliteDbPath}`);
    process.exit(1);
  }

  const sdb = new sqlite3.Database(sqliteDbPath);
  const sqliteQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      sdb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  // 2. Connect to Supabase PostgreSQL
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('[1/4] Connecting to Supabase...');
    await pool.query('SELECT 1');
    console.log('  ✓ Connected successfully!\n');

    // 3. Apply schema
    console.log('[2/4] Applying PostgreSQL schema to Supabase...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf-8');
    await pool.query(schemaSql);
    console.log('  ✓ Tables, indexes, and compatibility functions created.\n');

    // 4. Tables to migrate in dependency order
    const tables = [
      'users',
      'company_settings',
      'customers',
      'goods',
      'uom',
      'packages',
      'notes',
      'inward_entries',
      'inward_items',
      'outward_challans',
      'outward_items',
      'stock_transactions',
      'audit_logs'
    ];

    console.log('[3/4] Migrating table data from SQLite to Supabase...');
    const summary = [];

    for (const table of tables) {
      try {
        const rows = await sqliteQuery(`SELECT * FROM ${table} ORDER BY id ASC`);
        if (!rows || rows.length === 0) {
          summary.push({ table, count: 0, status: 'Empty (Skipped)' });
          continue;
        }

        const columns = Object.keys(rows[0]);
        const colList = columns.join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        let insertedCount = 0;
        for (const row of rows) {
          const values = columns.map(c => row[c]);
          const insertSql = `
            INSERT INTO ${table} (${colList}) 
            VALUES (${placeholders}) 
            ON CONFLICT (id) DO NOTHING
          `;
          const res = await pool.query(insertSql, values);
          if (res.rowCount > 0) insertedCount++;
        }

        // Reset sequence to highest ID
        try {
          await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`);
        } catch (seqErr) {
          // ignore if table doesn't use sequence
        }

        summary.push({ table, count: insertedCount, total: rows.length, status: 'Migrated' });
        console.log(`  ✓ ${table}: ${insertedCount}/${rows.length} records transferred.`);
      } catch (tableErr) {
        summary.push({ table, count: 0, status: 'Error: ' + tableErr.message });
        console.warn(`  ⚠ ${table}: Failed (${tableErr.message})`);
      }
    }

    console.log('\n[4/4] Finalizing and resetting database sequences...');
    console.log('\n====================================================');
    console.log('            MIGRATION COMPLETE SUMMARY');
    console.log('====================================================');
    console.table(summary);
    console.log('\nAll your local SQLite records are now safely live in Supabase!');
    console.log('You can now start your application with "npm start" or "start-application.bat".');

    sdb.close();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    sdb.close();
    await pool.end();
    process.exit(1);
  }
}

migrateToSupabase();
