'use strict';
(() => {
  const storageKey = 'breach-r6-layout-v1';
  const compact = window.matchMedia('(max-width: 800px)');
  const workspace = document.querySelector('.workspace');
  const controls = document.querySelector('.panel-controls');
  const panels = {
    left: { element: document.getElementById('mapSidebar'), button: document.getElementById('toggleMapSidebar'), hide: 'hideMaps', show: 'showMaps' },
    right: { element: document.getElementById('detailSidebar'), button: document.getElementById('toggleDetailSidebar'), hide: 'hideDetails', show: 'showDetails' },
  };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
  const preferences = {};
  for (const mode of ['desktop', 'compact']) {
    preferences[mode] = {};
    for (const side of ['left', 'right']) preferences[mode][side] = typeof saved[mode]?.[side] === 'boolean' ? saved[mode][side] : mode === 'desktop';
  }
  const mode = () => compact.matches ? 'compact' : 'desktop';
  function text(key) {
    const lang = document.documentElement.lang.toLowerCase();
    return window.BREACH_I18N[lang]?.[key] || window.BREACH_I18N.es[key];
  }
  function render() {
    controls.setAttribute('aria-label', text('sidePanels'));
    for (const [side, panel] of Object.entries(panels)) {
      const visible = preferences[mode()][side];
      panel.element.hidden = !visible;
      workspace.dataset[side + 'Panel'] = visible ? 'shown' : 'hidden';
      panel.button.setAttribute('aria-expanded', String(visible));
      panel.button.textContent = text(visible ? panel.hide : panel.show);
      panel.close.textContent = text('closePanel');
    }
  }
  function setVisible(side, visible, navigate = false) {
    const panel = panels[side];
    const containedFocus = panel.element.contains(document.activeElement);
    preferences[mode()][side] = visible;
    render();
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch {}
    if (!visible && (containedFocus || navigate)) panel.button.focus();
    if (visible && compact.matches && navigate) {
      panel.element.scrollIntoView({ block: 'start' });
      panel.close.focus({ preventScroll: true });
    }
  }
  for (const [side, panel] of Object.entries(panels)) {
    panel.close = document.createElement('button');
    panel.close.type = 'button';
    panel.close.className = 'panel-close-mobile';
    panel.close.onclick = () => setVisible(side, false, true);
    panel.element.prepend(panel.close);
    panel.button.onclick = () => setVisible(side, !preferences[mode()][side], true);
  }
  // Keep the existing map-search shortcut usable when its panel is hidden.
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.target.matches('input,textarea,select') || document.querySelector('dialog[open]')) return;
    if (!preferences[mode()].left) setVisible('left', true);
  }, true);
  const languageObserver = new MutationObserver(render);
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  compact.addEventListener('change', render);
  render();
})();
