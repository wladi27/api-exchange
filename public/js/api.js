/**
 * Dolar API Client & UI Shared State Manager
 */

const API_BASE = window.location.origin;

const Auth = {
  getToken() {
    return localStorage.getItem('dolar_token');
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('dolar_user'));
    } catch {
      return null;
    }
  },
  setSession(token, user) {
    localStorage.setItem('dolar_token', token);
    localStorage.setItem('dolar_user', JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem('dolar_token');
    localStorage.removeItem('dolar_user');
  },
  isAuthenticated() {
    return !!this.getToken();
  },
  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  }
};

// UI Notifications Toast
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <div style="flex: 1;">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Fetch con autenticación automática
async function apiRequest(endpoint, options = {}) {
  const token = Auth.getToken();
  const headers = {
    ...(options.headers || {})
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && Auth.isAuthenticated()) {
        Auth.clearSession();
        showToast('Tu sesión ha expirado. Por favor inicia sesión nuevamente.', 'error');
        setTimeout(() => window.location.reload(), 1500);
      }
      throw new Error(data.message || `Error ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    throw error;
  }
}

// Modals Helper
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// Global Nav Update
function updateNavAuthUI() {
  const navActions = document.getElementById('nav-user-actions');
  if (!navActions) return;

  if (Auth.isAuthenticated()) {
    const user = Auth.getUser();
    const isAdmin = Auth.isAdmin();

    navActions.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <a href="/dashboard" class="btn btn-secondary btn-sm">
          📊 Mi Dashboard
        </a>
        ${isAdmin ? `<a href="/admin" class="btn btn-primary btn-sm" style="background: #8b5cf6;">🛡️ Panel Admin</a>` : ''}
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="badge ${user.plan === 'free' ? 'badge-test' : 'badge-pro'}">Plan ${user.plan.toUpperCase()}</span>
          <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${user.name}</span>
          <button onclick="handleLogout()" class="btn btn-secondary btn-sm" title="Cerrar sesión">Salir</button>
        </div>
      </div>
    `;
  } else {
    navActions.innerHTML = `
      <button onclick="openModal('login-modal')" class="btn btn-secondary btn-sm">Iniciar Sesión</button>
      <button onclick="openModal('register-modal')" class="btn btn-primary btn-sm">Crear Cuenta Gratis</button>
    `;
  }
}

function handleLogout() {
  Auth.clearSession();
  showToast('Has cerrado sesión correctamente.', 'info');
  setTimeout(() => {
    window.location.href = '/';
  }, 500);
}

// Global Init
document.addEventListener('DOMContentLoaded', () => {
  updateNavAuthUI();
});
