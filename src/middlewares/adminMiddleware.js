function requireAdminRole(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Acceso denegado. Se requieren privilegios de Administrador.'
    });
  }
  next();
}

module.exports = { requireAdminRole };
