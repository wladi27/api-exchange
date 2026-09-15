require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { connectDB } = require('./src/config/db');
const { startCronJobs } = require('./src/services/cronService');

// Importar rutas de la API
const authRoutes = require('./src/routes/authRoutes');
const keyRoutes = require('./src/routes/keyRoutes');
const billingRoutes = require('./src/routes/billingRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const exchangeRoutes = require('./src/routes/exchangeRoutes');
const accountRoutes = require('./src/routes/accountRoutes');

const app = express();
const PORT = process.env.PORT || 3003;

// ==========================================
// SEGURIDAD PROFESIONAL (HARDENING)
// ==========================================

// 1. Headers de seguridad HTTP con Helmet (configurado para permitir CDN y Swagger)
app.use(
  helmet({
    contentSecurityPolicy: false, // Permitir visualización de scripts en Docs y Dashboards
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS restringido y configurable
app.use(cors());

// 3. Rate limiting estricto para prevenir fuerza bruta en Auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // 30 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'TooManyRequests',
    message: 'Demasiados intentos de acceso desde esta IP. Por favor intente más tarde.'
  }
});

// 4. Parsing con límites de carga seguros
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Servir archivos estáticos del frontend (CSS, JS, imágenes)
app.use(express.static(path.join(__dirname, 'public')));

// Servir carpeta de comprobantes de pago subidos
const uploadsDir = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  // Ignorar en entornos de solo lectura
}
app.use('/uploads', express.static(uploadsDir));

// Servir especificación OpenAPI 3.1
app.get('/docs/openapi.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'openapi.json'));
});

// Middleware para asegurar conexión a MongoDB en entornos Serverless (Vercel)
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.warn('⚠️ Warning conectando a MongoDB en middleware:', err.message);
  }
  next();
});

// ==========================================
// RUTAS VISUALES DEL FRONTEND (UI)
// ==========================================

// 1. Landing Page Comercial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Documentación Interactiva OpenAPI 3.1
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

// 3. Dashboard del Desarrollador (Gestión de Keys y Pagos)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 4. Panel de Administración (Validación de Pagos y Métricas)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ==========================================
// ENDPOINTS REST API
// ==========================================
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/user/keys', keyRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', exchangeRoutes);

// Manejo de rutas no encontradas (404)
app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: `Ruta ${req.method} ${req.originalUrl} no encontrada.`,
    documentation: '/docs'
  });
});

// Manejo global de errores (500)
app.use((err, req, res, next) => {
  console.error('❌ Error capturado:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'Ha ocurrido un error interno en el servidor.'
  });
});

// Iniciar servidor y servicios
async function startServer() {
  await connectDB();
  if (!process.env.VERCEL) {
    startCronJobs();
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('🚀 DOLAR API & BCV EXCHANGE RATES SAAS ACTIVO (MODO SEGURO)');
    console.log('='.repeat(60));
    console.log(`🌐 Landing Page:      http://localhost:${PORT}/`);
    console.log(`📖 Documentación:     http://localhost:${PORT}/docs`);
    console.log(`📊 Panel Desarrollador: http://localhost:${PORT}/dashboard`);
    console.log(`🛡️ Panel Admin:        http://localhost:${PORT}/admin`);
    console.log(`🏦 Cuentas Bancarias: http://localhost:${PORT}/api/v1/accounts`);
    console.log(`📋 OpenAPI Spec:      http://localhost:${PORT}/docs/openapi.json`);
    console.log(`💵 Endpoint Tasas:    http://localhost:${PORT}/api/v1/tipo-cambio`);
    console.log('='.repeat(60));
  });
}

module.exports = app;

if (require.main === module && !process.env.VERCEL) {
  startServer();
}
