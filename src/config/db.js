const mongoose = require('mongoose');

let isConnected = false;
let retryTimer = null;
let cachedConn = null;

async function connectDB() {
  if (cachedConn && mongoose.connection.readyState === 1) {
    return cachedConn;
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dolar_api';

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
      autoIndex: true
    });

    cachedConn = conn;
    isConnected = conn.connections[0].readyState === 1;
    console.log(`✅ MongoDB conectado exitosamente a: ${conn.connection.host}/${conn.connection.name}`);

    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
    return conn;
  } catch (error) {
    isConnected = false;
    console.error('❌ Error conectando a MongoDB:', error.message);
    if (mongoUri.includes('mongodb.net')) {
      console.warn('⚠️ ATENCIÓN: Si usas MongoDB Atlas, asegúrate de haber agregado tu IP actual a la lista blanca de Network Access (o permitir 0.0.0.0/0) en https://cloud.mongodb.com');
    }

    // En serverless no dejamos timers activos de fondo
    if (!process.env.VERCEL && !retryTimer) {
      retryTimer = setInterval(() => {
        console.log('🔄 Reintentando conectar a MongoDB...');
        connectDB();
      }, 10000);
    }
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Conexión a MongoDB perdida.');
  isConnected = false;
  cachedConn = null;
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB reconectado exitosamente.');
  isConnected = true;
});

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDbConnected };
