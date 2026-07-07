/* ==========================================================
   Camada compartilhada de comemoração (fogos + toast).
   Requer os estilos .portfolio-celebration-layer / .portfolio-firework /
   .portfolio-celebration-toast injetados por este script (para funcionar
   em qualquer página do sistema, mesmo sem CSS local).
   ========================================================== */
(function () {
  'use strict';

  // Injeta CSS se ainda não existir
  if (!document.getElementById('emag-celebration-styles')) {
    const s = document.createElement('style');
    s.id = 'emag-celebration-styles';
    s.textContent = `
      .portfolio-celebration-layer {
        position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 4000;
      }
      .portfolio-firework {
        position: absolute; left: var(--left); top: var(--top);
        width: 8px; height: 8px; border-radius: 999px; background: #9fda68;
        box-shadow: 0 0 24px rgba(159,218,104,0.95);
        animation: emagfw-core 900ms ease-out forwards;
      }
      .portfolio-firework span {
        position: absolute; left: 50%; top: 50%;
        width: 5px; height: 5px; border-radius: 999px; background: #9fda68;
        box-shadow: 0 0 14px rgba(159,218,104,0.95);
        transform: translate(-50%, -50%);
        animation: emagfw-spark 900ms cubic-bezier(.12,.74,.24,1) forwards;
      }
      .portfolio-celebration-toast {
        position: fixed; left: 50%; top: 92px;
        transform: translate(-50%, -18px) scale(0.96);
        z-index: 4001;
        width: min(520px, calc(100vw - 32px));
        padding: 16px 18px; border-radius: 16px;
        border: 1px solid rgba(159,218,104,0.48);
        background: linear-gradient(135deg, rgba(18,29,23,0.96), rgba(21,45,31,0.94));
        color: #ecfccb;
        box-shadow: 0 22px 70px rgba(0,0,0,0.45), 0 0 34px rgba(159,218,104,0.22);
        text-align: center; opacity: 0; pointer-events: none;
        transition: opacity 260ms ease, transform 260ms ease;
      }
      .portfolio-celebration-toast.show { opacity: 1; transform: translate(-50%, 0) scale(1); }
      .portfolio-celebration-toast strong { display: block; font-size: 16px; margin-bottom: 4px; color: #bef264; }
      .portfolio-celebration-toast span { display: block; color: rgba(236,252,203,0.84); font-size: 13px; line-height: 1.4; }
      @keyframes emagfw-core {
        0% { opacity: 1; transform: scale(0.8); }
        25% { opacity: 1; transform: scale(1.4); }
        100% { opacity: 0; transform: scale(0.1); }
      }
      @keyframes emagfw-spark {
        0% { opacity: 1; transform: translate(-50%, -50%) scale(0.8); }
        100% { opacity: 0; transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(0.1); }
      }
      @media (prefers-reduced-motion: reduce) {
        .portfolio-firework, .portfolio-firework span { animation: none; opacity: 0; }
        .portfolio-celebration-toast { transition: opacity 120ms ease; transform: translate(-50%, 0); }
      }
    `;
    document.head.appendChild(s);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function showGenericCelebration(title, text, opts) {
    const options = opts || {};
    const focusMode = !!(window.EMAG_SUPPRESS_CELEBRATION || document.documentElement.classList.contains('emag-focus-mode'));
    const fireworkCount = focusMode ? 0 : (options.fireworks != null ? options.fireworks : 6);
    const showDuration  = options.duration  != null ? options.duration  : 1600;

    // Remove instâncias anteriores
    const oldLayer = document.querySelector('.portfolio-celebration-layer');
    if (oldLayer) oldLayer.remove();
    const oldToast = document.querySelector('.portfolio-celebration-toast');
    if (oldToast) oldToast.remove();

    const layer = document.createElement('div');
    layer.className = 'portfolio-celebration-layer';
    document.body.appendChild(layer);

    const reduce = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      document.documentElement.classList.contains('emag-motion-reduced');
    const total = reduce ? 0 : fireworkCount;
    for (let i = 0; i < total; i++) {
      setTimeout(() => {
        const firework = document.createElement('div');
        firework.className = 'portfolio-firework';
        firework.style.setProperty('--left', (12 + Math.random() * 76) + 'vw');
        firework.style.setProperty('--top',  (16 + Math.random() * 48) + 'vh');
        const sparkTotal = 16;
        for (let s = 0; s < sparkTotal; s++) {
          const spark = document.createElement('span');
          const angle = (Math.PI * 2 * s) / sparkTotal;
          const distance = 42 + Math.random() * 52;
          spark.style.setProperty('--x', (Math.cos(angle) * distance) + 'px');
          spark.style.setProperty('--y', (Math.sin(angle) * distance) + 'px');
          firework.appendChild(spark);
        }
        layer.appendChild(firework);
        setTimeout(() => firework.remove(), 1000);
      }, i * 180);
    }

    const toast = document.createElement('div');
    toast.className = 'portfolio-celebration-toast';
    toast.innerHTML = '<strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(text) + '</span>';
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => toast.classList.remove('show'), showDuration);
    setTimeout(() => { toast.remove(); layer.remove(); }, showDuration + 500);
  }

  window.showGenericCelebration = showGenericCelebration;
})();
