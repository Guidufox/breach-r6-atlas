'use strict';
(() => {
  const key = 'breach-r6-theme-v1';
  const root = document.documentElement;
  const labels = {
    es: { light: 'Activar modo claro', dark: 'Activar modo oscuro' },
    en: { light: 'Switch to light mode', dark: 'Switch to dark mode' },
    'pt-br': { light: 'Ativar modo claro', dark: 'Ativar modo escuro' },
  };
  let theme = 'dark';
  try { if (localStorage.getItem(key) === 'light') theme = 'light'; } catch {}
  root.dataset.theme = theme;

  function render() {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    const next = theme === 'dark' ? 'light' : 'dark';
    const language = root.lang.toLowerCase();
    const label = (labels[language] || labels.es)[next];
    button.textContent = next === 'light' ? '☀' : '☾';
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    button.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = theme;
      try { localStorage.setItem(key, theme); } catch {}
      render();
    });
    new MutationObserver(render).observe(root, { attributes: true, attributeFilter: ['lang'] });
    render();
  });
})();
