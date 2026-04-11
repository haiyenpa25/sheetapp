/**
 * auth.js
 * Quản lý xác thực (Authentication), Login/Logout và Phân Quyền (Roles)
 */
const Auth = (() => {
  'use strict';

  let _currentUser = null;
  let _role = 'viewer'; // mặc định là viewer

  async function checkSession() {
    try {
      const res = await fetch('api/auth.php?action=me');
      const data = await res.json();
      if (data.loggedIn) {
        _currentUser = data.username;
        _role = data.role;
      } else {
        _currentUser = null;
        _role = 'viewer';
      }
      _updateUI();
      return _role;
    } catch (err) {
      console.error("Auth:", err);
      _role = 'viewer';
      return _role;
    }
  }

  async function doLogin(username, password) {
    try {
      const res = await fetch('api/auth.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        _currentUser = data.username;
        _role = data.role;
        _updateUI();
        closeModal();
        window.App?.showToast?.('Đăng nhập thành công', 'success');
        // Tải lại nhạc nếu cần để bật quyền
        if (window.App && window.App.reloadCurrentXML) window.App.reloadCurrentXML();
        return true;
      } else {
        showError(data.error || 'Đăng nhập thất bại');
        return false;
      }
    } catch (err) {
      showError('Lỗi mạng');
      return false;
    }
  }

  async function doLogout() {
    await fetch('api/auth.php?action=logout');
    _currentUser = null;
    _role = 'viewer';
    _updateUI();
    closeModal();
    window.App?.showToast?.('Đã đăng xuất', 'info');
    // Tải lại nhạc để tắt quyền
    if (window.App && window.App.reloadCurrentXML) window.App.reloadCurrentXML();
  }

  function _updateUI() {
    const btnText = document.getElementById('auth-username');
    if (btnText) {
      btnText.textContent = _currentUser ? _currentUser : 'Khách';
    }

    // Modal UI
    const formPanel = document.getElementById('auth-login-form');
    const loggedInPanel = document.getElementById('auth-logged-in');
    
    if (_currentUser) {
      formPanel?.classList.add('hidden');
      loggedInPanel?.classList.remove('hidden');
      const roleDisplay = document.getElementById('auth-role-display');
      if (roleDisplay) roleDisplay.textContent = (_role === 'admin' ? 'Quản Trị' : 'Xem');
    } else {
      formPanel?.classList.remove('hidden');
      loggedInPanel?.classList.add('hidden');
    }

    // Ẩn/hiện các nút thao tác chỉnh sửa dựa trên Role
    const canEdit = isAdmin();
    document.getElementById('btn-add-chord-mode')?.classList.toggle('hidden', !canEdit);
    document.getElementById('btn-create-set')?.classList.toggle('hidden', !canEdit);
    document.getElementById('btn-delete-set')?.classList.toggle('hidden', !canEdit);
    // Nút import chỉ admin mới có
    document.getElementById('btn-import-sheet')?.classList.toggle('hidden', !canEdit);

    // Xử lý các nút add to setlist được render động
    document.querySelectorAll('.song-add-setlist-btn').forEach(btn => {
      btn.classList.toggle('hidden', !canEdit);
    });
  }

  function showError(msg) {
    const el = document.getElementById('auth-error');
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    }
  }

  function init() {
    document.getElementById('btn-auth')?.addEventListener('click', openModal);
    document.getElementById('btn-close-auth')?.addEventListener('click', closeModal);
    
    document.getElementById('btn-do-login')?.addEventListener('click', () => {
      const u = document.getElementById('auth-username-input').value;
      const p = document.getElementById('auth-password-input').value;
      doLogin(u, p);
    });

    // Enter key
    document.getElementById('auth-password-input')?.addEventListener('keyup', e => {
      if (e.key === 'Enter') document.getElementById('btn-do-login').click();
    });

    document.getElementById('btn-do-logout')?.addEventListener('click', doLogout);
    
    checkSession();
  }

  function openModal() {
    const el = document.getElementById('auth-error');
    if (el) el.classList.add('hidden');
    document.getElementById('auth-modal')?.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('auth-modal')?.classList.add('hidden');
  }

  function isAdmin() {
    return _role === 'admin';
  }

  return { init, checkSession, isAdmin, getUser: () => _currentUser };
})();

window.Auth = Auth;
