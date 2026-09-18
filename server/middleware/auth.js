const jwt = require('jsonwebtoken');
const { getOne } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'rithka-erp-super-secret-key-2026';

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await getOne('SELECT id, username, full_name, role, is_active FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found or deleted.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact administrator.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
};

const requireOwner = (req, res, next) => {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: This operation requires Owner / Administrator privileges.'
    });
  }
  next();
};

module.exports = {
  JWT_SECRET,
  authenticate,
  requireOwner
};
