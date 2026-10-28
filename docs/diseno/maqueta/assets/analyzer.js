// Analizador de blancos de la maqueta (etapa de impactos; la calibración está en calibration.js).
// Referencia de comportamiento y de cálculo de métricas (docs/features/000-mvp/shooting_metrics.md, sección 8):
// puntaje, tamaño de grupo, PMI y distancia al centro. La implementación real está en src/lib/ con tests.
// Necesita viewer.js (recuadro y zoom). Las superposiciones usan colores fijos: no cambian con el tema.
(function () {
  // Blanco del inventario (modelo de datos: ver requerimientos.md → ABM de blancos)
  var BLANCO = {
    nombre: 'ISSF Pistola Precisión',
    tipoPuntuacion: 'anillos',
    diametroMm: 500,
    zonas: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(function (p) { return { puntaje: p, diametroMm: (11 - p) * 50 }; })
  };
  // Ronda (modelo de datos: disparos declarados y distancia de tiro)
  var RONDA = { disparos: 15, distanciaM: 25 };

  // Impactos "detectados" en mm desde el centro (x a la derecha, y hacia arriba)
  var DETECTADOS = [[-13, -25], [4, -16], [-21, -7], [-4, -38], [-28, -31], [13, -32], [-10, 2], [-31, -16],
    [2, -52], [-16, -43], [16, -10], [-37, -40], [-2, -25], [-24, -53]].map(function (a) { return { x: a[0], y: a[1] }; });

  var root = document.querySelector('[data-analyzer]');
  if (!root) return;
  var target = window.mkViewer(root.querySelector('.tgt'));
  var span = BLANCO.diametroMm / 0.94; // mm representados por el ancho del cuadro
  var pts = DETECTADOS.slice();
  var hist = [];
  var mode = 'add';

  function pct(mm) { return mm / span * 100; }
  function el(tag, cls, style) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) e.setAttribute('style', style);
    return e;
  }
  function zonaDe(p) {
    var d = Math.hypot(p.x, p.y);
    var zonas = BLANCO.zonas.slice().sort(function (a, b) { return a.diametroMm - b.diametroMm; });
    for (var i = 0; i < zonas.length; i++) if (d <= zonas[i].diametroMm / 2) return zonas[i].puntaje;
    return 0;
  }
  function fmt(v) { return Math.round(v).toLocaleString('es-AR'); }
  function set(name, value) {
    root.querySelectorAll('[data-m="' + name + '"]').forEach(function (n) { n.textContent = value; });
  }

  // Simula la foto: anillos del blanco (en la app real esto es la imagen)
  BLANCO.zonas.slice().sort(function (a, b) { return b.diametroMm - a.diametroMm; }).forEach(function (z) {
    var dark = z.puntaje >= 7;
    var size = pct(z.diametroMm);
    var ring = el('div', 'ring', 'left:' + (50 - size / 2) + '%;top:' + (50 - size / 2) + '%;width:' + size + '%;height:' + size + '%;' +
      (dark ? 'background:' + (z.puntaje === 7 ? '#181818;' : 'transparent;') + 'border:1px solid #D9D4C6' : 'border:1px solid #2A2A2A'));
    ring.setAttribute('aria-hidden', 'true');
    target.appendChild(ring);
  });

  var group = el('div', 'ring', 'border:calc(2px / var(--zoom)) dashed #FF6A1A;pointer-events:none');
  group.setAttribute('aria-hidden', 'true');
  var surface = el('button', '', 'position:absolute;inset:0;background:transparent;border:0;padding:0');
  surface.type = 'button';
  surface.setAttribute('aria-label', 'Agregar impacto en el punto indicado');
  var layer = el('div', '', 'position:absolute;inset:0;pointer-events:none');
  var pmi = el('div', '', 'position:absolute;width:26px;height:26px;transform:translate(-50%,-50%) scale(calc(1 / var(--zoom)));pointer-events:none');
  pmi.setAttribute('aria-hidden', 'true');
  pmi.innerHTML = '<div style="position:absolute;left:12px;top:0;width:2px;height:26px;background:#5AA9FF"></div>' +
    '<div style="position:absolute;left:0;top:12px;width:26px;height:2px;background:#5AA9FF"></div>';
  target.appendChild(group);
  target.appendChild(surface);
  target.appendChild(layer);
  target.appendChild(pmi);

  function commit(next) { hist.push(pts); pts = next; render(); }
  function quitar(i) { commit(pts.filter(function (_, k) { return k !== i; })); }

  surface.addEventListener('click', function (e) {
    if (mode !== 'add') return;
    var b = target.getBoundingClientRect();
    commit(pts.concat([{ x: ((e.clientX - b.left) / b.width - 0.5) * span, y: -((e.clientY - b.top) / b.height - 0.5) * span }]));
  });

  root.querySelectorAll('[data-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      mode = btn.dataset.mode;
      root.querySelectorAll('[data-mode]').forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      render();
    });
  });
  document.querySelectorAll('[data-action="detect"]').forEach(function (b) {
    b.addEventListener('click', function () { commit(DETECTADOS.slice()); });
  });
  document.querySelectorAll('[data-action="undo"]').forEach(function (b) {
    b.addEventListener('click', function () { if (hist.length) { pts = hist.pop(); render(); } });
  });

  function render() {
    var n = pts.length;
    var mx = 0, my = 0;
    if (n) {
      mx = pts.reduce(function (a, p) { return a + p.x; }, 0) / n;
      my = pts.reduce(function (a, p) { return a + p.y; }, 0) / n;
    }
    var es = 0, dc = 0, gr = 0, score = 0, dist = {};
    pts.forEach(function (p, i) {
      for (var j = i + 1; j < n; j++) es = Math.max(es, Math.hypot(p.x - pts[j].x, p.y - pts[j].y));
      gr = Math.max(gr, Math.hypot(p.x - mx, p.y - my));
      dc += Math.hypot(p.x, p.y);
      var z = zonaDe(p);
      score += z;
      dist[z] = (dist[z] || 0) + 1;
    });

    // Impactos
    layer.innerHTML = '';
    pts.forEach(function (p, i) {
      var b = el('button', 'imp' + (mode === 'remove' ? ' rm' : ''),
        'left:' + (50 + pct(p.x)) + '%;top:' + (50 - pct(p.y)) + '%;pointer-events:' + (mode === 'remove' ? 'auto' : 'none'));
      b.type = 'button';
      b.setAttribute('aria-label', 'Quitar impacto ' + (i + 1) + ', zona ' + zonaDe(p));
      b.tabIndex = mode === 'remove' ? 0 : -1;
      b.addEventListener('click', function () { quitar(i); });
      layer.appendChild(b);
    });
    surface.style.cursor = mode === 'add' ? 'crosshair' : 'default';
    surface.disabled = mode !== 'add';

    pmi.hidden = !n;
    pmi.style.left = (50 + pct(mx)) + '%';
    pmi.style.top = (50 - pct(my)) + '%';
    var r = pct(gr + 5);
    group.hidden = n < 2;
    group.style.left = (50 + pct(mx) - r) + '%';
    group.style.top = (50 - pct(my) - r) + '%';
    group.style.width = group.style.height = 2 * r + '%';

    // Métricas
    var off = Math.hypot(mx, my);
    var ang = (Math.atan2(mx, my) * 180 / Math.PI + 360) % 360;
    set('count', n);
    set('score', score);
    set('max', n * 10);
    set('avg', n ? (score / n).toFixed(1).replace('.', ',') : '–');
    set('es', fmt(es));
    set('moa', RONDA.distanciaM ? (es / (RONDA.distanciaM * 0.2909)).toFixed(1).replace('.', ',') : '–');
    set('off', fmt(off));
    set('clock', Math.round(ang / 30) || 12);
    set('dc', n ? fmt(dc / n) : 0);

    var distBox = root.querySelector('[data-dist]');
    if (distBox) {
      distBox.innerHTML = '';
      Object.keys(dist).map(Number).sort(function (a, b) { return b - a; }).forEach(function (z) {
        var c = el('span', 'dist');
        c.innerHTML = '<b>' + (z === 0 ? 'Fuera' : z) + '</b><span class="num">× ' + dist[z] + '</span>';
        distBox.appendChild(c);
      });
    }

    var warn = root.querySelector('[data-mismatch]');
    if (warn) {
      warn.hidden = n === RONDA.disparos;
      set('hint', n < RONDA.disparos ? 'Tocá el blanco en modo Agregar para sumar los faltantes.' : 'Usá Quitar para eliminar los sobrantes.');
    }

    var tbody = root.querySelector('[data-impacts]');
    if (tbody) {
      tbody.innerHTML = '';
      pts.forEach(function (p, i) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td class="num">' + (i + 1) + '</td><td class="num" style="font-weight:600">' + zonaDe(p) + '</td><td class="num">' +
          fmt(p.x) + '</td><td class="num">' + fmt(p.y) + '</td><td style="text-align:right"></td>';
        var b = el('button', 'icon-btn');
        b.type = 'button';
        b.setAttribute('aria-label', 'Quitar impacto ' + (i + 1));
        b.innerHTML = '<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>';
        b.addEventListener('click', function () { quitar(i); });
        tr.lastChild.appendChild(b);
        tbody.appendChild(tr);
      });
    }
  }

  render();
})();
