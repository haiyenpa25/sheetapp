/**
 * chord-canvas-ui.js — UI Components for ChordCanvas
 * Xử lý tạo Popup, Modals, tính toán kích thước Dots.
 */
const ChordCanvasUI = (() => {
  'use strict';

  function getScale() {
    return window.App?.getCurrentZoom?.() ?? 1.0;
  }

  function getTextSize(scale) {
    const svgText = document.querySelector('#osmd-container svg text');
    if (svgText) {
      const fs = parseFloat(window.getComputedStyle(svgText).fontSize);
      if (fs > 0 && fs < 100) return Math.round(fs * 0.85) + 'px';
    }
    return Math.round(11 * scale) + 'px';
  }

  function getDotSize(scale) {
    return Math.max(12, Math.round(16 * scale));
  }

  function applyAbsolute(el, cx, cy, extras) {
    el.style.cssText = [
      'position:absolute', `left:${cx}px`, `top:${cy}px`,
      'transform:translateX(-50%)', 'z-index:80', ...extras
    ].join(';');
  }

  /* ─── Popup Hợp âm ─────────────────────────────────────────── */
  function createPopup(anchor, measureIdx, noteIdx, existing, currentSet, callbacks) {
    const ar  = anchor.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'cc-popup';
    
    // Ràng buộc 2 bên mép màn hình để popup k bị văng (Mobile responsive)
    let popLeft = ar.left + window.scrollX + ar.width / 2;
    const halfWidth = 110; // ~ 200px/2 + padding
    if (popLeft < halfWidth) popLeft = halfWidth;
    if (popLeft > document.documentElement.scrollWidth - halfWidth) popLeft = document.documentElement.scrollWidth - halfWidth;

    const popTop = ar.top + window.scrollY - 12;

    pop.style.cssText = [
      'position:absolute', `left:${popLeft}px`, `top:${popTop}px`,
      'transform:translateX(-50%) translateY(-100%)', 'z-index:99999',
      'background:#fff', 'border:1.5px solid #6d28d9', 'border-radius:8px',
      'padding:.6rem .75rem', 'box-shadow:0 8px 28px rgba(109,40,217,.22)',
      'min-width:200px', 'pointer-events:auto'
    ].join(';');

    const isDefault  = currentSet === 'default';
    const semitones  = window.App?.getCurrentTranspose?.() ?? 0;
    const keyHint    = semitones !== 0
      ? `<span style="font-size:.6rem;color:#f59e0b;font-weight:600;margin-left:4px;">
           (tông ${semitones > 0 ? '+' : ''}${semitones} — nhập theo key này)
         </span>` : '';
         
    pop.innerHTML = `
      <div style="font-size:.65rem;font-weight:700;color:#6d28d9;text-transform:uppercase;
                  letter-spacing:.5px;margin-bottom:.3rem;">
        ${existing ? 'Sửa' : 'Thêm'} hợp âm
        ${!isDefault ? `<span style="opacity:.6;font-weight:400"> · ${currentSet}</span>` : ''}
        ${keyHint}
      </div>
      <input id="cc-pop-inp" type="text" maxlength="10" list="cc-chord-suggestions"
             placeholder="VD: Am, D7, G…" value="${existing}" autocomplete="off"
             style="width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:5px;text-transform:capitalize;
                    padding:.3rem .55rem;font-size:.92rem;font-weight:700;font-family:monospace;
                    color:#c00;outline:none;background:#fff;margin-bottom:.4rem;">
      <datalist id="cc-chord-suggestions"></datalist>
      <div style="display:flex;gap:.35rem;justify-content:flex-end;">
        <button id="cc-pop-save" class="btn btn-primary btn-xs">✓ Lưu</button>
        ${existing ? '<button id="cc-pop-del" class="btn btn-danger btn-xs">🗑</button>' : ''}
        <button id="cc-pop-cancel" class="btn btn-ghost btn-xs">✕</button>
      </div>`;

    document.body.appendChild(pop);
    
    const inp = pop.querySelector('#cc-pop-inp');
    const dl = pop.querySelector('#cc-chord-suggestions');

    // Hàm chuẩn hóa Hợp âm (Viết hoa nốt gốc, b/# chuẩn)
    const formatChord = (val) => {
        if (!val) return val;
        let res = val.charAt(0).toUpperCase() + val.substring(1);
        if (res.length >= 2) {
            let second = res.charAt(1).toLowerCase();
            if (second === 'b' || second === '#') {
               res = res.substring(0, 1) + second + res.substring(2);
            }
        }
        return res;
    };

    inp.addEventListener('input', (e) => {
        let val = e.target.value;
        if (!val) { dl.innerHTML = ''; return; }
        
        // Auto suggestions
        const rootMatch = val.match(/^[A-Ga-g][b#B]?/);
        if (rootMatch) {
            const root = formatChord(rootMatch[0]);
            const suffixes = ['', 'm', '7', 'm7', 'maj7', '+', 'dim', 'sus4', 'sus2', 'm7b5', 'add9'];
            dl.innerHTML = suffixes.map(s => `<option value="${root}${s}">`).join('');
        }
    });

    setTimeout(() => { inp?.focus(); inp?.select(); }, 20);

    const doSave = () => {
      let val = inp.value.trim();
      val = formatChord(val);
      callbacks.onClose();
      if (val) callbacks.onSave(val);
      else if (existing) callbacks.onDelete();
    };

    pop.querySelector('#cc-pop-save')?.addEventListener('click', doSave);
    pop.querySelector('#cc-pop-del')?.addEventListener('click', () => {
      callbacks.onClose(); callbacks.onDelete();
    });
    pop.querySelector('#cc-pop-cancel')?.addEventListener('click', callbacks.onClose);
    const doSaveNext = async () => {
      let val = inp.value.trim();
      val = formatChord(val);
      callbacks.onClose();
      // Gọi lên Canvas để lưu âm thầm, không vẽ lại (fast entry)
      if (val) {
         window.ChordCanvas?.saveChordWithoutReload?.(measureIdx, noteIdx, val);
         // Render tạm để thấy trực quan ngay lập tức
         anchor.style.opacity = '1';
         anchor.style.background = 'transparent';
         anchor.style.boxShadow = 'none';
         anchor.innerHTML = `<span class="chord-dot-text" style="font-size:1.1rem; color:#8b5cf6">${val}</span>`;
      }
      // Mở liền nốt sau đó
      window.ChordCanvas?.openNextPopup?.(measureIdx, noteIdx);
    };

    inp?.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.stopPropagation(); doSave(); e.preventDefault(); }
      if (e.key === 'Escape') { e.stopPropagation(); callbacks.onClose(); e.preventDefault(); }
      if (e.key === 'Tab' || e.code === 'Space' || e.key === 'ArrowRight') {
        e.stopPropagation();
        e.preventDefault();
        doSaveNext();
      }
    });
    pop.addEventListener('click', e => e.stopPropagation());
    
    const outside = ev => {
      // Bỏ qua nếu click vào chính popup
      if (pop.contains(ev.target)) return;
      // Bỏ qua nếu click vào anchor (đã được xử lý ở ngõ gọi showPopup)
      if (ev.target === anchor || anchor.contains(ev.target)) return;
      
      // Nếu focus đang ở input, blur nó trước để tránh keyboard giật cục
      if (document.activeElement === inp) {
        inp.blur();
      }

      callbacks.onClose();
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('click', outside, true);
    };

    setTimeout(() => {
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('click', outside, true);
    }, 150);
    
    return pop;
  }

  /* ─── Modal Tạo Mới Hợp Âm ─────────────────────────────────── */
  function showNewSetModal(callbacks) {
    document.getElementById('cc-new-set-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cc-new-set-modal';
    overlay.style.cssText = [
      'position:fixed','inset:0','background:rgba(0,0,0,.45)',
      'display:flex','align-items:center','justify-content:center',
      'z-index:99999','animation:fadeIn .15s ease'
    ].join(';');

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:1.5rem 1.75rem;
                  min-width:320px;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <div style="font-size:1rem;font-weight:700;color:#1e1b4b;margin-bottom:.2rem;">Tạo bộ hợp âm mới</div>
        <div style="font-size:.8rem;color:#6b7280;margin-bottom:1rem;">
          Nhập tên người hoặc phong cách chơi (VD: Hoài Dinh, Gospel...)
        </div>
        <input id="cc-new-set-inp" type="text" maxlength="40"
               placeholder="Tên bộ hợp âm…"
               style="width:100%;box-sizing:border-box;border:1.5px solid #ddd;
                      border-radius:7px;padding:.45rem .7rem;font-size:.95rem;
                      font-weight:600;outline:none;margin-bottom:1rem;"
               onfocus="this.style.borderColor='#6d28d9';"
               onblur="this.style.borderColor='#ddd';">
        <div style="display:flex;gap:.5rem;justify-content:flex-end;">
          <button id="cc-new-set-cancel" class="btn btn-ghost btn-sm">Hủy</button>
          <button id="cc-new-set-ok" class="btn btn-primary btn-sm">✓ Tạo</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const inp = overlay.querySelector('#cc-new-set-inp');
    setTimeout(() => inp?.focus(), 50);

    const doCreate = () => {
      const n = inp.value.trim();
      overlay.remove();
      if (n) callbacks.onCreate(n);
    };

    overlay.querySelector('#cc-new-set-ok').addEventListener('click', doCreate);
    overlay.querySelector('#cc-new-set-cancel').addEventListener('click', () => overlay.remove());
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.stopPropagation(); doCreate(); }
      if (e.key === 'Escape') { e.stopPropagation(); overlay.remove(); }
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  /* ─── Modal Xác nhận xoá ─────────────────────────────────── */
  function showDeleteConfirmModal(name, callbacks) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99999;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:1.4rem 1.75rem;min-width:280px;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <div style="font-size:.95rem;font-weight:700;color:#b91c1c;margin-bottom:.5rem;">Xóa bộ hợp âm?</div>
        <div style="font-size:.8rem;color:#6b7280;margin-bottom:1rem;">Xóa "<strong>${name}</strong>"? Hành động này không thể hoàn tác.</div>
        <div style="display:flex;gap:.5rem;justify-content:flex-end;">
          <button id="cc-del-cancel" class="btn btn-ghost btn-sm">Hủy</button>
          <button id="cc-del-ok" class="btn btn-danger btn-sm">🗑 Xóa</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    
    overlay.querySelector('#cc-del-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#cc-del-ok').onclick = () => {
      overlay.remove();
      callbacks.onConfirm();
    };
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  }

  return { getScale, getTextSize, getDotSize, applyAbsolute, createPopup, showNewSetModal, showDeleteConfirmModal };
})();
