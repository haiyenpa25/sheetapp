/**
 * assets/js/core/ServiceWorkerManager.js
 * Đăng ký SW + thông báo có version mới
 */
'use strict';

const ServiceWorkerManager = (() => {

  function register() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // Kiểm tra update
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Có bản mới — thông báo nhẹ nhàng
              window.App?.showToast?.('🔄 Có cập nhật mới! Tải lại để áp dụng.', 'info');
            }
          });
        });
      } catch (e) {
        // SW không hỗ trợ — không crash app
      }
    });
  }

  return { register };
})();

window.ServiceWorkerManager = ServiceWorkerManager;
