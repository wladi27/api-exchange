const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const { JWT_SECRET } = require('../middlewares/authMiddleware');
const { isDbConnected } = require('../config/db');

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
  changePassword
};
