const BankAccount = require('../models/BankAccount');
const { isDbConnected } = require('../config/db');

// Validar y sanitizar texto simple
function sanitizeString(str, maxLen = 150) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

// GET /api/v1/accounts - Listar cuentas del usuario autenticado
async function getAccounts(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'DatabaseUnavailable',
        message: 'Base de datos no disponible temporalmente.'
      });
    }

    const accounts = await BankAccount.find({ userId: req.user._id })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: accounts.length,
      accounts: accounts.map(acc => ({
        id: acc._id,
        _id: acc._id,
        type: acc.type,
        label: acc.label,
        bankName: acc.bankName,
        bankCode: acc.bankCode,
        holderName: acc.holderName,
        docType: acc.docType,
        docNumber: acc.docNumber,
        phoneNumber: acc.phoneNumber,
        accountNumber: acc.accountNumber,
        email: acc.email,
        payId: acc.payId,
        isDefault: acc.isDefault,
        notes: acc.notes,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error en getAccounts:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al obtener las cuentas bancarias.'
    });
  }
}

// GET /api/v1/accounts/:id - Obtener una cuenta específica
async function getAccountById(req, res) {
  try {
    const { id } = req.params;
    const account = await BankAccount.findOne({ _id: id, userId: req.user._id }).lean();

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Cuenta bancaria no encontrada o no pertenece a tu usuario.'
      });
    }

    return res.json({
      success: true,
      account: {
        id: account._id,
        _id: account._id,
        type: account.type,
        label: account.label,
        bankName: account.bankName,
        bankCode: account.bankCode,
        holderName: account.holderName,
        docType: account.docType,
        docNumber: account.docNumber,
        phoneNumber: account.phoneNumber,
        accountNumber: account.accountNumber,
        email: account.email,
        payId: account.payId,
        isDefault: account.isDefault,
        notes: account.notes
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al consultar cuenta bancaria.'
    });
  }
}

// POST /api/v1/accounts - Crear nueva cuenta bancaria
async function createAccount(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'DatabaseUnavailable',
        message: 'Base de datos no disponible.'
      });
    }

    const {
      type = 'PAGO_MOVIL',
      label,
      bankName,
      bankCode,
      holderName,
      docType = 'V',
      docNumber,
      phoneNumber,
      accountNumber,
      email,
      payId,
      isDefault = false,
      notes
    } = req.body;

    if (!holderName || typeof holderName !== 'string' || holderName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'El nombre del titular es obligatorio.'
      });
    }

    const existingCount = await BankAccount.countDocuments({ userId: req.user._id });
    const shouldBeDefault = isDefault || existingCount === 0;

    // Si la nueva cuenta será default, remover default de las demás
    if (shouldBeDefault) {
      await BankAccount.updateMany({ userId: req.user._id }, { isDefault: false });
    }

    const newAccount = await BankAccount.create({
      userId: req.user._id,
      type: sanitizeString(type, 30) || 'PAGO_MOVIL',
      label: sanitizeString(label, 60) || 'Mi Cuenta',
      bankName: sanitizeString(bankName, 80),
      bankCode: sanitizeString(bankCode, 10),
      holderName: sanitizeString(holderName, 120),
      docType: sanitizeString(docType, 10) || 'V',
      docNumber: sanitizeString(docNumber, 20),
      phoneNumber: sanitizeString(phoneNumber, 25),
      accountNumber: sanitizeString(accountNumber, 30),
      email: sanitizeString(email, 80).toLowerCase(),
      payId: sanitizeString(payId, 100),
      isDefault: shouldBeDefault,
      notes: sanitizeString(notes, 300)
    });

    return res.status(201).json({
      success: true,
      message: 'Cuenta bancaria registrada con éxito.',
      account: {
        id: newAccount._id,
        _id: newAccount._id,
        type: newAccount.type,
        label: newAccount.label,
        bankName: newAccount.bankName,
        bankCode: newAccount.bankCode,
        holderName: newAccount.holderName,
        docType: newAccount.docType,
        docNumber: newAccount.docNumber,
        phoneNumber: newAccount.phoneNumber,
        accountNumber: newAccount.accountNumber,
        email: newAccount.email,
        payId: newAccount.payId,
        isDefault: newAccount.isDefault,
        notes: newAccount.notes
      }
    });
  } catch (error) {
    console.error('Error en createAccount:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: error.message || 'Error al registrar la cuenta bancaria.'
    });
  }
}

// PUT /api/v1/accounts/:id - Actualizar cuenta bancaria
async function updateAccount(req, res) {
  try {
    const { id } = req.params;
    const account = await BankAccount.findOne({ _id: id, userId: req.user._id });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Cuenta bancaria no encontrada o sin permisos para modificar.'
      });
    }

    const {
      type,
      label,
      bankName,
      bankCode,
      holderName,
      docType,
      docNumber,
      phoneNumber,
      accountNumber,
      email,
      payId,
      isDefault,
      notes
    } = req.body;

    if (holderName !== undefined) account.holderName = sanitizeString(holderName, 120);
    if (type !== undefined) account.type = sanitizeString(type, 30);
    if (label !== undefined) account.label = sanitizeString(label, 60);
    if (bankName !== undefined) account.bankName = sanitizeString(bankName, 80);
    if (bankCode !== undefined) account.bankCode = sanitizeString(bankCode, 10);
    if (docType !== undefined) account.docType = sanitizeString(docType, 10);
    if (docNumber !== undefined) account.docNumber = sanitizeString(docNumber, 20);
    if (phoneNumber !== undefined) account.phoneNumber = sanitizeString(phoneNumber, 25);
    if (accountNumber !== undefined) account.accountNumber = sanitizeString(accountNumber, 30);
    if (email !== undefined) account.email = sanitizeString(email, 80).toLowerCase();
    if (payId !== undefined) account.payId = sanitizeString(payId, 100);
    if (notes !== undefined) account.notes = sanitizeString(notes, 300);

    if (isDefault === true) {
      await BankAccount.updateMany({ userId: req.user._id, _id: { $ne: account._id } }, { isDefault: false });
      account.isDefault = true;
    } else if (isDefault === false) {
      account.isDefault = false;
    }

    await account.save();

    return res.json({
      success: true,
      message: 'Cuenta bancaria actualizada correctamente.',
      account: {
        id: account._id,
        _id: account._id,
        type: account.type,
        label: account.label,
        bankName: account.bankName,
        bankCode: account.bankCode,
        holderName: account.holderName,
        docType: account.docType,
        docNumber: account.docNumber,
        phoneNumber: account.phoneNumber,
        accountNumber: account.accountNumber,
        email: account.email,
        payId: account.payId,
        isDefault: account.isDefault,
        notes: account.notes
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al actualizar cuenta bancaria.'
    });
  }
}

// DELETE /api/v1/accounts/:id - Eliminar cuenta
async function deleteAccount(req, res) {
  try {
    const { id } = req.params;
    const deleted = await BankAccount.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Cuenta bancaria no encontrada o sin permisos.'
      });
    }

    // Si la cuenta eliminada era default, seleccionar otra como default si existe
    if (deleted.isDefault) {
      const another = await BankAccount.findOne({ userId: req.user._id });
      if (another) {
        another.isDefault = true;
        await another.save();
      }
    }

    return res.json({
      success: true,
      message: 'Cuenta bancaria eliminada exitosamente.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al eliminar cuenta bancaria.'
    });
  }
}

// POST /api/v1/accounts/:id/default - Establecer como cuenta por defecto
async function setDefaultAccount(req, res) {
  try {
    const { id } = req.params;
    const account = await BankAccount.findOne({ _id: id, userId: req.user._id });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Cuenta bancaria no encontrada.'
      });
    }

    await BankAccount.updateMany({ userId: req.user._id }, { isDefault: false });
    account.isDefault = true;
    await account.save();

    return res.json({
      success: true,
      message: 'Cuenta establecida como predeterminada.',
      account
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al establecer cuenta predeterminada.'
    });
  }
}

module.exports = {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  setDefaultAccount
};
