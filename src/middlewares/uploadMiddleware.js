const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Directorio seguro de almacenamiento para comprobantes
const UPLOADS_DIR = process.env.VERCEL
  ? path.join('/tmp', 'uploads', 'receipts')
  : path.join(__dirname, '../../uploads/receipts');

try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  // Ignorar errores de creación en entornos de solo lectura
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const randomName = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `receipt_${Date.now()}_${randomName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'application/pdf'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Formato de archivo no soportado. Solo se permiten imágenes (JPG, PNG, WebP) o documentos PDF.'
      ),
      false
    );
  }
};

const uploadReceipt = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB máximo
  },
  fileFilter: fileFilter
});

module.exports = {
  uploadReceipt,
  UPLOADS_DIR
};
