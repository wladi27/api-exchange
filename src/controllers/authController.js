const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const { JWT_SECRET } = require('../middlewares/authMiddleware');
const { isDbConnected } = require('../config/db');
const emailService = require('../services/emailService');

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      plan: user.plan
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// POST /api/v1/auth/register
async function register(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'DatabaseUnavailable',
        message: 'No hay conexión activa con la base de datos MongoDB. Si usas MongoDB Atlas, verifica que tu IP actual esté en la lista blanca de Network Access (o permitir 0.0.0.0/0).'
      });
    }

    const { name, email, password, company } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Nombre, correo electrónico y contraseña son requeridos.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'La contraseña debe tener al menos 6 caracteres.'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'UserConflict',
        message: 'Ya existe una cuenta registrada con este correo electrónico.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      company: company ? company.trim() : '',
      plan: 'free',
      subscriptionStatus: 'free'
    });

    // Generar automáticamente su primera API Key en el plan gratuito
    const keyData = ApiKey.generateRawKey('live');
    const apiKey = await ApiKey.create({
      userId: user._id,
      keyHash: keyData.keyHash,
      keyPrefix: keyData.keyPrefix,
      keyLastChars: keyData.keyLastChars,
      name: 'Clave Inicial (Desarrollo)',
      plan: 'free',
      rateLimitPerMin: 30,
      monthlyQuota: 1000
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente. Se ha generado tu primera API Key.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus
      },
      initialApiKey: {
        rawKey: keyData.rawKey,
        name: apiKey.name,
        note: 'Guarda esta clave de forma segura. No se volverá a mostrar completa.'
      }
    });
  } catch (error) {
    console.error('Error en register:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: error.message || 'Error al registrar el usuario.'
    });
  }
}

// POST /api/v1/auth/login
async function login(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'DatabaseUnavailable',
        message: 'No hay conexión activa con la base de datos MongoDB. Si usas MongoDB Atlas, verifica que tu IP actual esté en la lista blanca de Network Access (o permitir 0.0.0.0/0).'
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Correo electrónico y contraseña son requeridos.'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Credenciales inválidas. Verifique su correo o contraseña.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Credenciales inválidas. Verifique su correo o contraseña.'
      });
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al iniciar sesión.'
    });
  }
}

// GET /api/v1/auth/me
async function getMe(req, res) {
  try {
    const user = req.user;
    const activeKeysCount = await ApiKey.countDocuments({ userId: user._id, active: true });

    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        company: user.company,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        activeKeysCount,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al obtener datos del perfil.'
    });
  }
}

// POST /api/v1/auth/change-password
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Contraseña actual y nueva contraseña son requeridas.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'La nueva contraseña debe tener al menos 6 caracteres.'
      });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'InvalidPassword',
        message: 'La contraseña actual no es correcta.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.json({
      success: true,
      message: 'Contraseña actualizada correctamente.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al cambiar contraseña.'
    });
  }
}

// PUT /api/v1/auth/profile
async function updateProfile(req, res) {
  try {
    const { name, company, phone } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Usuario no encontrado.'
      });
    }

    if (name && name.trim().length > 0) user.name = name.trim();
    if (company !== undefined) user.company = company.trim();
    if (phone !== undefined) user.phone = phone.trim();

    await user.save();

    return res.json({
      success: true,
      message: 'Perfil actualizado exitosamente.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        company: user.company,
        phone: user.phone,
        role: user.role,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt
      }
    });
  } catch (error) {
    console.error('Error en updateProfile:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al actualizar perfil.'
    });
  }
}

// POST /api/v1/auth/forgot-password
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'El correo electrónico es requerido.'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    // Por seguridad, si el usuario no existe, devolvemos éxito para evitar enumeración de correos
    if (!user) {
      return res.json({
        success: true,
        message: 'Si el correo está registrado, recibirás un código de recuperación en breve.'
      });
    }

    // Generar código numérico seguro de 6 dígitos
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = expiresAt;
    await user.save();

    // Enviar correo con el servicio de email (Resend / klipp.lat)
    const emailResult = await emailService.sendPasswordResetOtp(cleanEmail, user.name, otp);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: 'EmailSendFailed',
        message: emailResult.error || 'No se pudo enviar el correo de recuperación. Inténtalo de nuevo más tarde.'
      });
    }

    return res.json({
      success: true,
      message: 'Código de recuperación enviado a tu correo electrónico.',
      devOtp: emailResult.testMode ? otp : undefined
    });
  } catch (error) {
    console.error('Error en forgotPassword:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al procesar la solicitud de recuperación.'
    });
  }
}

// POST /api/v1/auth/reset-password
async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Correo, código de verificación y nueva contraseña son requeridos.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'La nueva contraseña debe tener al menos 6 caracteres.'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const user = await User.findOne({
      email: cleanEmail,
      resetPasswordOtp: cleanOtp,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'InvalidOtp',
        message: 'El código ingresado es inválido o ha expirado. Solicita uno nuevo.'
      });
    }

    // Hashear y guardar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.resetPasswordOtp = null;
    user.resetPasswordExpires = null;
    await user.save();

    // Generar token JWT para inicio de sesión inmediato
    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente. Bienvenido de vuelta.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt
      }
    });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al restablecer la contraseña.'
    });
  }
}

// POST /api/v1/auth/google
async function googleLogin(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'DatabaseUnavailable',
        message: 'No hay conexión activa con la base de datos MongoDB.'
      });
    }

    let { email, name, googleId, photoUrl, code, redirectUri, codeVerifier } = req.body;

    // Si el cliente envía un código de autorización de Google OAuth 2.0, canjearlo en el backend
    if (code) {
      try {
        const clientId = process.env.GOOGLE_CLIENT_ID || '';
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

        const params = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri || 'http://localhost:8081',
        });
        if (codeVerifier) {
          params.append('code_verifier', codeVerifier);
        }

        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (tokenRes.data?.access_token) {
          const userProfileRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
          });
          const profile = userProfileRes.data;
          email = profile.email;
          name = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim() || profile.email?.split('@')[0];
          googleId = profile.sub || profile.id;
          photoUrl = profile.picture;
        }
      } catch (exchangeErr) {
        console.warn('⚠️ Error canjeando código en backend Google OAuth:', exchangeErr.response?.data || exchangeErr.message);
        if (!email) {
          return res.status(400).json({
            success: false,
            error: 'GoogleAuthFailed',
            message: exchangeErr.response?.data?.error_description || exchangeErr.message || 'Error al validar con Google'
          });
        }
      }
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'El correo electrónico de Google es requerido.'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });

    const resolvedName = name && name.trim().length > 0 ? name.trim() : cleanEmail.split('@')[0];

    if (!user) {
      // Registrar nuevo usuario desde Google OAuth
      const salt = await bcrypt.genSalt(10);
      const randomSecret = Math.random().toString(36).slice(-10) + Date.now().toString(36);
      const passwordHash = await bcrypt.hash(randomSecret, salt);

      user = await User.create({
        name: resolvedName,
        email: cleanEmail,
        passwordHash,
        plan: 'free',
        subscriptionStatus: 'free'
      });

      try {
        const keyData = ApiKey.generateRawKey('live');
        await ApiKey.create({
          userId: user._id,
          keyHash: keyData.keyHash,
          keyPrefix: keyData.keyPrefix,
          keyLastChars: keyData.keyLastChars,
          name: 'Clave Inicial (Google Auth)',
          plan: 'free',
          rateLimitPerMin: 30,
          monthlyQuota: 1000
        });
      } catch (keyErr) {
        console.warn('Advertencia creando API Key inicial para Google user:', keyErr);
      }
    } else {
      // Si el usuario ya existe pero el nombre de Google es más completo, actualizarlo
      if (name && name.trim().length > 0 && user.name !== resolvedName) {
        user.name = resolvedName;
        await user.save();
      }
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Inicio de sesión con Google exitoso.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt
      }
    });
  } catch (error) {
    console.error('Error en googleLogin:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Error al autenticar con Google.'
    });
  }
}

module.exports = {
  register,
  login,
  googleLogin,
  getMe,
  changePassword,
  updateProfile,
  forgotPassword,
  resetPassword
};
