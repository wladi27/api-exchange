const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'dolar_api_super_secret_jwt_key_2026';

async function requireAuth(req, res, next) {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Acceso no autorizado. Debe incluir un token Bearer válido.'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Usuario no encontrado o sesión inválida.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'TokenExpired',
        message: 'El token de sesión ha expirado. Por favor inicie sesión nuevamente.'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'InvalidToken',
      message: 'Token de autenticación inválido.'
    });
  }
}

module.exports = {
  requireAuth,
  JWT_SECRET
};
