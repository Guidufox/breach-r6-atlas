'use strict';
(() => {
  const storageKey = 'breach-r6-layout-v1';
  const compact = window.matchMedia('(max-width: 800px)');
  const workspace = document.querySelector('.workspace');
  const controls = document.querySelector('.panel-controls');
  const stage = document.querySelector('.map-workspace');
  const topbar = document.querySelector('.topbar');
  const panels = {
    left: { element: document.getElementById('mapSidebar'), button: document.getElementById('toggleMapSidebar'), hide: 'hideMaps', show: 'showMaps' },
    right: { element: document.getElementById('detailSidebar'), button: document.getElementById('toggleDetailSidebar'), hide: 'hideDetails', show: 'showDetails' },
  };
  const icon = side => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M${side === 'left' ? 9 : 15} 4v16"/><path d="M${side === 'left' ? 6 : 18} 9v6" stroke-width="2.5"/></svg>`;
  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'panel-backdrop';
  backdrop.tabIndex = -1;
  backdrop.hidden = true;
  document.body.append(backdrop);
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
  const preferences = {};
  for (const mode of ['desktop', 'compact']) {
    preferences[mode] = {};
    for (const side of ['left', 'right']) preferences[mode][side] = typeof saved[mode]?.[side] === 'boolean' ? saved[mode][side] : mode === 'desktop';
  }
  if (preferences.compact.left && preferences.compact.right) preferences.compact.right = false;
  const mode = () => compact.matches ? 'compact' : 'desktop';
  const openDrawer = () => compact.matches && Object.keys(panels).find(side => preferences.compact[side]);
  function text(key) {
    const lang = document.documentElement.lang.toLowerCase();
    return window.BREACH_I18N[lang]?.[key] || window.BREACH_I18N.es[key];
  }
  function render() {
    controls.setAttribute('aria-label', text('sidePanels'));
    for (const [side, panel] of Object.entries(panels)) {
      const visible = preferences[mode()][side];
      panel.element.hidden = false;
      panel.element.inert = !visible;
      panel.element.setAttribute('aria-hidden', String(!visible));
      workspace.dataset[side + 'Panel'] = visible ? 'shown' : 'hidden';
      const label = text(visible ? panel.hide : panel.show);
      panel.button.setAttribute('aria-expanded', String(visible));
      panel.button.setAttribute('aria-label', label);
      panel.button.title = label;
      panel.close.setAttribute('aria-label', text(panel.hide));
      panel.close.title = text(panel.hide);
    }
    const drawer = openDrawer();
    backdrop.hidden = !drawer;
    backdrop.setAttribute('aria-label', text('closePanel'));
    topbar.inert = !!drawer;
    stage.inert = !!drawer;
    document.body.classList.toggle('drawer-open', !!drawer);
  }
  function setVisible(side, visible, navigate = false) {
    const panel = panels[side];
    const containedFocus = panel.element.contains(document.activeElement);
    if (compact.matches && visible) for (const other of Object.keys(panels)) preferences.compact[other] = false;
    preferences[mode()][side] = visible;
    render();
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch {}
    if (!visible && (containedFocus || navigate)) panel.button.focus({ preventScroll: true });
    if (visible && compact.matches && navigate) panel.close.focus({ preventScroll: true });
  }
  for (const [side, panel] of Object.entries(panels)) {
    const content = document.createElement('div');
    content.className = 'sidebar-content';
    content.append(...panel.element.childNodes);
    panel.element.append(content);
    const toolbar = document.createElement('div');
    toolbar.className = 'sidebar-toolbar';
    panel.close = document.createElement('button');
    panel.close.type = 'button';
    panel.close.className = 'sidebar-toggle';
    panel.close.innerHTML = icon(side);
    panel.close.onclick = () => setVisible(side, false, true);
    toolbar.append(panel.close);
    content.prepend(toolbar);
    panel.button.className = 'sidebar-toggle';
    panel.button.innerHTML = icon(side);
    panel.button.onclick = () => setVisible(side, !preferences[mode()][side], true);
  }
  backdrop.onclick = () => { const side = openDrawer(); if (side) setVisible(side, false, true); };
  document.addEventListener('keydown', event => {
    const side = openDrawer();
    if (side && !document.querySelector('dialog[open]')) {
      if (event.key === 'Escape') { event.preventDefault(); setVisible(side, false, true); return; }
      if (event.key === 'Tab') {
        const focusable = [...panels[side].element.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el => !el.disabled && !el.closest('[hidden]') && el.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.target.matches('input,textarea,select') || document.querySelector('dialog[open]')) return;
    if (!preferences[mode()].left) setVisible('left', true);
  }, true);
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  compact.addEventListener('change', () => {
    render();
    const drawer = openDrawer();
    if (drawer) panels[drawer].close.focus({ preventScroll: true });
    else if (document.activeElement?.closest('aside[inert]')) panels.left.button.focus();
  });
  render();
  if (openDrawer()) panels[openDrawer()].close.focus({ preventScroll: true });
  requestAnimationFrame(() => requestAnimationFrame(() => workspace.classList.add('panels-ready')));
})();
