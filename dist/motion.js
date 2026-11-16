(() => {
  const key = 'peerdrop-theme';
  const systemPreference = matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const validTheme = (value) => value === 'light' || value === 'dark' ? value : undefined;
  let chosenTheme;
  try { chosenTheme = validTheme(localStorage.getItem(key)); } catch { /* Storage may be disabled. */ }

  function applyTheme() {
    const theme = chosenTheme ?? (systemPreference.matches ? 'dark' : 'light');
    root.dataset.theme = theme;
    themeColor?.setAttribute('content', theme === 'dark' ? '#14161d' : '#f8f9fc');
    return theme;
  }

  applyTheme();
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme-toggle');
    if (!button) return;

    function updateToggle() {
      const dark = applyTheme() === 'dark';
      button.setAttribute('aria-pressed', String(dark));
      button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    }

    updateToggle();
    button.hidden = false;
    button.addEventListener('click', () => {
      chosenTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, chosenTheme); } catch { /* The current page still keeps the choice. */ }
      updateToggle();
    });
    systemPreference.addEventListener('change', updateToggle);
    window.addEventListener('storage', (event) => {
      if (event.storageArea !== localStorage || (event.key !== key && event.key !== null)) return;
      chosenTheme = validTheme(event.newValue);
      updateToggle();
    });
  }, { once: true });
})();

document.addEventListener('DOMContentLoaded', () => {
  const preference = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) and (forced-colors: none)');
  const root = document.documentElement;
  const cursor = document.querySelector('.site-cursor');
  if (!cursor) return;

  function hide() {
    root.classList.remove('has-site-cursor');
    cursor.classList.remove('is-pressed');
  }

  function move(event) {
    if (!preference.matches || event.pointerType !== 'mouse' ||
        event.target.closest('input, textarea, select, button:disabled, [contenteditable]:not([contenteditable="false"])')) {
      hide();
      return;
    }

    cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    cursor.classList.toggle('is-over-control', Boolean(event.target.closest('a[href], button:enabled, summary')));
    cursor.classList.toggle('is-pressed', event.type !== 'pointerup' && Boolean(event.buttons & 1));
    root.classList.add('has-site-cursor');
  }

  document.addEventListener('pointerover', move, { passive: true });
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerdown', move, { passive: true });
  document.addEventListener('pointerup', move, { passive: true });
  document.addEventListener('pointercancel', hide);
  root.addEventListener('pointerleave', hide);
  document.addEventListener('keydown', hide);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hide();
  });
  window.addEventListener('blur', hide);
  window.addEventListener('pagehide', hide);
  preference.addEventListener('change', hide);
}, { once: true });

document.addEventListener('DOMContentLoaded', () => {
  const stage = document.querySelector('.preview-stage');
  if (!stage) return;

  let inView = false;

  function updatePlayback() {
    stage.classList.toggle('is-playing', inView && !document.hidden);
  }

  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updatePlayback();
  });

  document.addEventListener('visibilitychange', updatePlayback);
  observer.observe(stage);
}, { once: true });
