// Calibración de la foto en la maqueta (etapa previa del análisis, blanco con anillos).
// Referencia de interacción: el centro se ubica solo, el punto del anillo se toca o se arrastra,
// "Forma" deforma los anillos (foto en ángulo) y "Volver a círculos" lo deshace. La implementación
// real está en src/lib/calibration.ts (escala, elipses y reshapeDraft) y src/lib/target-center.ts.
// Necesita viewer.js. Las posiciones van en % de la foto (cuadrada en la maqueta).
(function () {
  var root = document.querySelector('[data-calibration]');
  if (!root) return;

  var ZONAS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(function (p) { return { puntaje: p, diametroMm: (11 - p) * 50 }; });
  var MM_PER_PCT = 500 / 94; // el anillo exterior ocupa el 94 % de la foto
  // La foto de ejemplo se sacó un poco desde abajo: los anillos se ven achatados.
  var FOTO_ACHATADA = 0.86;
  var LABELS = { center: 'Centro', edge: 'Anillo', shape: 'Forma' };
  var INSTRUCCIONES = {
    center: 'Tocá el centro del blanco.',
    edge: 'Tocá un punto sobre un anillo que se vea entero y elegí abajo cuál es. Los anillos verdes tienen que coincidir con los de la foto.',
    shape: 'Si la foto está en ángulo, mantené apretado y arrastrá: los anillos verdes se estiran o se achican hasta el dedo en esa dirección. Repetilo en otra dirección hasta que coincidan con los de la foto.'
  };

  var content = window.mkViewer(root.querySelector('.tgt'));
  // Centro encontrado automáticamente (en la app, target-center.ts); el anillo lo marca el usuario.
  var auto = { x: 50, y: 50 };
  var state = { center: auto, edge: null, shape: null, ring: 150 };
  var active = 'edge';
  var error = '';

  function el(tag, cls, style) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) e.setAttribute('style', style);
    return e;
  }

  // "Foto": anillos impresos, achatados en vertical.
  ZONAS.slice().sort(function (a, b) { return b.diametroMm - a.diametroMm; }).forEach(function (z) {
    var w = z.diametroMm / MM_PER_PCT;
    var h = w * FOTO_ACHATADA;
    var dark = z.puntaje >= 7;
    var ring = el('div', 'ring', 'left:' + (50 - w / 2) + '%;top:' + (50 - h / 2) + '%;width:' + w + '%;height:' + h + '%;' +
      (dark ? 'background:' + (z.puntaje === 7 ? '#181818;' : 'transparent;') + 'border:1px solid #D9D4C6' : 'border:1px solid #2A2A2A'));
    ring.setAttribute('aria-hidden', 'true');
    content.appendChild(ring);
  });

  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'cal');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  content.appendChild(svg);
  var surface = el('button', '', 'position:absolute;inset:0;background:transparent;border:0;padding:0;cursor:crosshair');
  surface.type = 'button';
  content.appendChild(surface);
  var centerMk = el('span', 'mk cross');
  var edgeMk = el('span', 'mk');
  [centerMk, edgeMk].forEach(function (m) { m.setAttribute('aria-hidden', 'true'); content.appendChild(m); });

  // --- Escala y forma (como en src/lib/calibration.ts) -------------------------------------
  function shapeMatrix(s) {
    if (!s) return [1, 0, 0, 1];
    var c = Math.cos(s.angle), n = Math.sin(s.angle), k = s.ratio;
    return [c * c + k * n * n, (1 - k) * c * n, (1 - k) * c * n, n * n + k * c * c];
  }
  function invert(m) { var d = m[0] * m[3] - m[1] * m[2]; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d]; }
  function apply(m, v) { return { x: m[0] * v.x + m[1] * v.y, y: m[2] * v.x + m[3] * v.y }; }
  function len(v) { return Math.hypot(v.x, v.y); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }

  // Deforma los anillos hacia `p`: en esa dirección pasan por ahí y en la perpendicular conservan
  // la medida de `start`. El punto del anillo se mueve sobre la nueva elipse.
  function reshape(start, p) {
    var along = sub(p, start.center), r = len(along), off = sub(start.edge, start.center);
    if (r < 2 || len(off) < 2) return start;
    var u = { x: along.x / r, y: along.y / r }, perp = { x: -u.y, y: u.x };
    var inv = invert(shapeMatrix(start.shape));
    var across = len(apply(inv, off)) / len(apply(inv, perp));
    var ratio = Math.min(5, Math.max(0.2, across / r));
    var d = { x: off.x / len(off), y: off.y / len(off) };
    var dist = 1 / Math.hypot((d.x * u.x + d.y * u.y) / r, (d.x * perp.x + d.y * perp.y) / (r * ratio));
    return { center: start.center, ring: start.ring, shape: { angle: Math.atan2(u.y, u.x), ratio: ratio },
      edge: { x: start.center.x + d.x * dist, y: start.center.y + d.y * dist } };
  }

  function pctPerMm() {
    return len(apply(invert(shapeMatrix(state.shape)), sub(state.edge, state.center))) / (state.ring / 2);
  }

  // --- Interacción -------------------------------------------------------------------------
  function pointAt(e) {
    var b = content.getBoundingClientRect();
    var clamp = function (v) { return Math.min(100, Math.max(0, v)); };
    return { x: clamp((e.clientX - b.left) / b.width * 100), y: clamp((e.clientY - b.top) / b.height * 100) };
  }
  var dragStart = null;
  function place(p) {
    if (active === 'shape') {
      if (!state.center || !state.edge) { error = 'Ubicá el centro y un punto sobre un anillo antes de deformarlos'; return; }
      state = reshape(dragStart || state, p);
    } else {
      state[active] = p;
    }
    error = '';
  }
  surface.addEventListener('pointerdown', function (e) {
    surface.setPointerCapture(e.pointerId);
    dragStart = { center: state.center, edge: state.edge, shape: state.shape, ring: state.ring };
    place(pointAt(e));
    render();
  });
  surface.addEventListener('pointermove', function (e) {
    if (!dragStart) return;
    place(pointAt(e));
    render();
  });
  surface.addEventListener('pointerup', function () {
    dragStart = null;
    // Al soltar pasa solo al próximo punto que falte.
    if (active === 'center' && !state.edge) setActive('edge');
    render();
  });

  function setActive(tool) {
    active = tool;
    root.querySelectorAll('[data-tools] [role="radio"]').forEach(function (r) {
      var on = r.dataset.value === tool;
      r.classList.toggle('on', on);
      r.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  root.querySelector('[data-tools]').addEventListener('mk-change', function (e) { setActive(e.detail); render(); });
  root.querySelector('[data-ring]').addEventListener('change', function (e) { state.ring = Number(e.target.value); render(); });
  root.querySelector('[data-reset-shape]').addEventListener('click', function () {
    if (!state.shape) return;
    // Vuelve a círculos que pasan por el punto del anillo.
    state = { center: state.center, edge: state.edge, shape: null, ring: state.ring };
    render();
  });

  // --- Dibujo ------------------------------------------------------------------------------
  function render() {
    svg.innerHTML = '';
    if (state.center && state.edge) {
      var k = pctPerMm();
      var angle = state.shape ? state.shape.angle * 180 / Math.PI : 0;
      ZONAS.forEach(function (z) {
        var e = document.createElementNS(svgNS, 'ellipse');
        var rx = z.diametroMm / 2 * k;
        e.setAttribute('cx', state.center.x);
        e.setAttribute('cy', state.center.y);
        e.setAttribute('rx', rx);
        e.setAttribute('ry', rx * (state.shape ? state.shape.ratio : 1));
        if (angle) e.setAttribute('transform', 'rotate(' + angle + ' ' + state.center.x + ' ' + state.center.y + ')');
        svg.appendChild(e);
      });
    }
    [[centerMk, 'center'], [edgeMk, 'edge']].forEach(function (pair) {
      var p = state[pair[1]];
      pair[0].hidden = !p;
      pair[0].classList.toggle('on', active === pair[1]);
      if (p) { pair[0].style.left = p.x + '%'; pair[0].style.top = p.y + '%'; }
    });
    root.querySelectorAll('[data-tools] [role="radio"]').forEach(function (r) {
      var t = r.dataset.value;
      var done = t === 'shape' ? !!state.shape : !!state[t];
      r.textContent = LABELS[t] + (done ? ' ✓' : '');
    });
    root.querySelector('[data-instruction]').textContent = INSTRUCCIONES[active];
    root.querySelector('[data-auto]').hidden = state.center !== auto;
    root.querySelector('[data-reset-shape]').hidden = !state.shape;
    var err = root.querySelector('[data-error]');
    err.hidden = !error;
    err.textContent = error;
  }

  setActive(active);
  render();
})();
