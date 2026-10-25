// Comportamientos genéricos de la maqueta (sin dependencias).
(function () {
  // Tema: oscuro por defecto; 'claro' u 'oscuro' explícitos, o 'sistema' (prefers-color-scheme)
  var KEY = 'rb-theme';
  var media = window.matchMedia('(prefers-color-scheme: light)');
  function readPref() {
    try { return localStorage.getItem(KEY) || 'oscuro'; } catch (e) { return 'oscuro'; }
  }
  function applyTheme() {
    var pref = readPref();
    var light = pref === 'claro' || (pref === 'sistema' && media.matches);
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    var btn = document.querySelector('.mk-theme');
    if (btn) btn.textContent = light ? 'Ver tema oscuro' : 'Ver tema claro';
    document.querySelectorAll('[data-theme-control] [role="radio"]').forEach(function (r) {
      var on = r.dataset.value === pref;
      r.classList.toggle('on', on);
      r.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  function savePref(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* sin almacenamiento: solo esta página */ }
    applyTheme();
    if (readPref() !== value) document.documentElement.setAttribute('data-theme', value === 'claro' ? 'light' : 'dark');
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY) applyTheme(); });
  media.addEventListener('change', applyTheme);
  var forced = new URLSearchParams(location.search).get('tema');
  if (forced === 'claro' || forced === 'oscuro' || forced === 'sistema') {
    try { localStorage.setItem(KEY, forced); } catch (e) { /* sin almacenamiento */ }
  }
  applyTheme();
  if (forced === 'claro') document.documentElement.setAttribute('data-theme', 'light');
  document.querySelectorAll('[data-theme-control]').forEach(function (g) {
    g.addEventListener('mk-change', function (e) { savePref(e.detail); });
  });

  // Grupos de opción única: chips de clima, controles segmentados
  document.querySelectorAll('[role="radiogroup"]').forEach(function (group) {
    group.addEventListener('click', function (e) {
      var picked = e.target.closest('[role="radio"]');
      if (!picked || !group.contains(picked)) return;
      group.querySelectorAll('[role="radio"]').forEach(function (r) {
        var on = r === picked;
        r.classList.toggle('on', on);
        r.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      group.dispatchEvent(new CustomEvent('mk-change', { detail: picked.dataset.value }));
    });
  });

  // Pestañas de categorías (inventario)
  document.querySelectorAll('[role="tablist"]').forEach(function (list) {
    list.addEventListener('click', function (e) {
      var tab = e.target.closest('[role="tab"]');
      if (!tab) return;
      list.querySelectorAll('[role="tab"]').forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('[data-panel]').forEach(function (p) {
        p.hidden = p.dataset.panel !== tab.dataset.tab;
      });
      var cta = document.querySelector('[data-new-label]');
      if (cta) {
        cta.querySelector('span').textContent = tab.dataset.new;
        cta.setAttribute('href', tab.dataset.newHref || '#');
      }
    });
  });

  // Stepper numérico
  document.querySelectorAll('[data-stepper]').forEach(function (s) {
    var out = s.querySelector('output');
    var min = Number(s.dataset.min || 0);
    s.querySelector('[data-dec]').addEventListener('click', function () {
      out.textContent = Math.max(min, Number(out.textContent) - 1);
    });
    s.querySelector('[data-inc]').addEventListener('click', function () {
      out.textContent = Number(out.textContent) + 1;
    });
  });

  // Los formularios de la maqueta no envían nada
  document.querySelectorAll('form').forEach(function (f) {
    f.addEventListener('submit', function (e) { e.preventDefault(); });
  });
  document.querySelectorAll('a[href="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  // Acceso al índice cuando la página no está embebida
  if (window.top === window) {
    var a = document.createElement('a');
    a.href = '../index.html';
    a.className = 'mk-index';
    a.textContent = '← Índice de pantallas';
    document.body.appendChild(a);
    var t = document.createElement('button');
    t.type = 'button';
    t.className = 'mk-theme';
    t.addEventListener('click', function () {
      savePref(document.documentElement.getAttribute('data-theme') === 'light' ? 'oscuro' : 'claro');
    });
    document.body.appendChild(t);
    applyTheme();
  }
})();
