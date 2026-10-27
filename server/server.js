const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase, isSupabase, query, getOne } = require('./db/database');

// Import routes
const authRoutes = require('./routes/auth');
const mastersRoutes = require('./routes/masters');
const inwardRoutes = require('./routes/inward');
const outwardRoutes = require('./routes/outward');
const stockRoutes = require('./routes/stock');
const reportsRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (always accessible without blocking)
app.get('/api/health', async (req, res) => {
  try {
    let dbConnected = false;
    let dbError = null;
    try {
      const ping = await getOne('SELECT 1 as connected');
      dbConnected = Boolean(ping?.connected);
    } catch (dbErr) {
      dbConnected = false;
      dbError = dbErr.message;
    }

    res.json({
      status: dbConnected ? 'ok' : 'degraded',
      environment: process.env.VERCEL ? 'vercel-serverless' : 'local',
      databaseType: isSupabase ? 'supabase-postgresql' : 'sqlite',
      databaseConnected: dbConnected,
      supabaseConfigured: Boolean(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL),
      databaseError: dbError,
      hint: !isSupabase && process.env.VERCEL
        ? 'Please set SUPABASE_DB_URL in Vercel Project Settings -> Environment Variables.'
        : undefined,
      time: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Database auto-initialization middleware (handles serverless cold starts)
let dbInitPromise = global._dbInitPromise || null;
app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next();

  if (!dbInitPromise) {
    dbInitPromise = initDatabase()
      .then(() => {
        global._dbInitPromise = dbInitPromise;
      })
      .catch(err => {
        console.error('Database initialization error:', err);
        dbInitPromise = null;
        global._dbInitPromise = null;
        throw err;
      });
    global._dbInitPromise = dbInitPromise;
  }

  try {
    await dbInitPromise;
    next();
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Database initialization error: ' + err.message,
      hint: !isSupabase && process.env.VERCEL
        ? 'Please add SUPABASE_DB_URL to your Vercel Project Settings -> Environment Variables.'
        : undefined
    });
  }
});

// Serve frontend in production
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    } else {
      res.status(404).json({ success: false, message: 'API route not found' });
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`Billing & Inward/Outward Stock ERP Server running!`);
      console.log(`Backend API: http://localhost:${PORT}`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (process.env.VERCEL || process.env.NODE_ENV === 'test' || require.main !== module) {
  module.exports = app;
} else {
  startServer();
}
