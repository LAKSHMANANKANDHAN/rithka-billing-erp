const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, getOne, run, logAudit } = require('../db/database');
const { JWT_SECRET, authenticate, requireOwner } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const user = await getOne('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username.trim()]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'This account has been deactivated. Please contact the owner.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await logAudit(user.id, user.username, 'LOGIN', 'users', user.id, `User logged in from web client`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// GET /api/auth/users (Owner only)
router.get('/users', authenticate, requireOwner, async (req, res) => {
  try {
    const users = await query(`
      SELECT id, username, full_name, role, is_active, created_at, updated_at 
      FROM users 
      ORDER BY id ASC
    `);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/users (Owner only)
router.post('/users', authenticate, requireOwner, async (req, res) => {
  try {
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ success: false, message: 'Username, password and full name are required.' });
    }

    const userRole = role === 'owner' ? 'owner' : 'worker';
    const existing = await getOne('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username.trim()]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'A user with this username already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(`
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES (?, ?, ?, ?)
    `, [username.trim(), passwordHash, full_name.trim(), userRole]);

    await logAudit(req.user.id, req.user.username, 'CREATE_USER', 'users', result.lastID, `Created new ${userRole} account: ${username}`);

    res.json({ success: true, message: 'User account created successfully.', userId: result.lastID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/auth/users/:id (Owner only)
router.put('/users/:id', authenticate, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, role, is_active, password } = req.body;

    const existing = await getOne('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let passwordHash = existing.password_hash;
    if (password && password.trim().length > 0) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const updatedRole = role ? (role === 'owner' ? 'owner' : 'worker') : existing.role;
    const updatedActive = typeof is_active !== 'undefined' ? (is_active ? 1 : 0) : existing.is_active;
    const updatedName = full_name ? full_name.trim() : existing.full_name;

    await run(`
      UPDATE users 
      SET full_name = ?, role = ?, is_active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updatedName, updatedRole, updatedActive, passwordHash, id]);

    await logAudit(req.user.id, req.user.username, 'UPDATE_USER', 'users', id, `Updated user ${existing.username}`);

    res.json({ success: true, message: 'User updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
