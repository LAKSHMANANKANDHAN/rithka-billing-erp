const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

async function testSupabaseConnection() {
  console.log('====================================================');
  console.log('     SUPABASE POSTGRESQL CONNECTION TEST');
  console.log('====================================================\n');

  if (!connectionString) {
    console.error('❌ ERROR: No connection string found.');
    console.error('Please add SUPABASE_DB_URL to your .env file.\n');
    console.log('Example in .env:');
    console.log('SUPABASE_DB_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres\n');
    process.exit(1);
  }

  // Mask sensitive password from display
  const maskedUrl = connectionString.replace(/:(.*?)@/, ':******@');
  console.log(`Connecting to: ${maskedUrl} ...\n`);

  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const timeRes = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Connected successfully to Supabase PostgreSQL!');
    console.log(`   Server Time: ${timeRes.rows[0].current_time}`);
    console.log(`   Postgres Version: ${timeRes.rows[0].pg_version.split(' ')[0]} ${timeRes.rows[0].pg_version.split(' ')[1]}\n`);

    // Check if tables exist
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`Found ${tableNames.length} tables in public schema:`);
    if (tableNames.length > 0) {
      console.log(`  ${tableNames.join(', ')}`);
    } else {
      console.log('  (No tables found yet. Run "npm run db:migrate-supabase" to initialize and copy your data!)');
    }

    console.log('\n====================================================');
    console.log('SUPABASE CONNECTION VERIFIED AND READY TO USE!');
    console.log('====================================================');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Connection Failed:', err.message);
    if (err.message.includes('password authentication failed')) {
      console.error('👉 Hint: Check your database password in the connection string.');
    } else if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
      console.error('👉 Hint: Check your host/domain name in the connection string.');
    } else if (err.message.includes('timeout')) {
      console.error('👉 Hint: Supabase connection timed out. Check your network or try using the Supabase Connection Pooler (port 6543 or 5432).');
    }
    await pool.end();
    process.exit(1);
  }
}

testSupabaseConnection();
