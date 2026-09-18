const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./db/database');

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

// Database auto-initialization middleware (handles serverless cold starts)
let dbInitPromise = null;
app.use(async (req, res, next) => {
  // Allow health check without blocking if needed, but DB init is fast
  if (!dbInitPromise) {
    dbInitPromise = initDatabase().catch(err => {
      console.error('Database initialization error:', err);
      dbInitPromise = null;
      throw err;
    });
  }
  try {
    await dbInitPromise;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database initialization error: ' + err.message });
  }
});

// Serve reference documents and static uploads
const refPath = path.join(__dirname, '..', 'reference_docs');
if (fs.existsSync(refPath)) {
  app.use('/reference_docs', express.static(refPath));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', mastersRoutes);
app.use('/api/inward', inwardRoutes);
app.use('/api/outward', outwardRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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
