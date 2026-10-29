// Calibración de la foto en la maqueta (iteración 001: inclinación con perspectiva).
// Referencia de interacción y de cálculo para src/lib/calibration.ts:
// - El centro se ubica solo; el punto del anillo se toca o se arrastra.
// - "Inclinación" (antes "Forma"): mantener apretado y arrastrar inclina el blanco en 3D. El lado
//   hacia el que se arrastra se acerca (se ve más grande) y el opuesto se aleja; los anillos verdes
//   se dibujan con perspectiva: elipses que ya no son concéntricas ni del mismo aplastamiento.
// - "Quitar la inclinación" vuelve a círculos.
// Modelo: cámara estenopeica con el punto principal en el centro de la foto y distancia focal
// FOCAL × el lado mayor (≈ la cámara principal de un celular). El blanco es un plano girado
// `tilt` alrededor de un eje de la foto; su centro cae sobre el marcador del centro y la escala
// sale del punto del anillo. Un círculo del blanco se ve como una cónica: se dibuja su elipse.
// Necesita viewer.js. Las posiciones van en % de la foto (cuadrada en la maqueta).
(function () {
  var root = document.querySelector('[data-calibration]');
  if (!root) return;

  var ZONAS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(function (p) { return { puntaje: p, diametroMm: (11 - p) * 50 }; });
  var FOCAL = 0.75;
  var MAX_TILT = 70 * Math.PI / 180;
  // Radianes de inclinación por cada % de la foto arrastrado.
  var TILT_PER_PCT = 0.02;
  var LABELS = { center: 'Centro', edge: 'Anillo', shape: 'Inclinación' };
  var INSTRUCCIONES = {
    center: 'Tocá el centro del blanco.',
    edge: 'Tocá un punto sobre un anillo que se vea entero y elegí abajo cuál es. Los anillos verdes tienen que coincidir con los de la foto.',
    shape: 'Si la foto está en ángulo, mantené apretado y arrastrá: el blanco se inclina hacia donde arrastrás (ese lado se acerca y se ve más grande). Ajustá hasta que los anillos verdes coincidan con los de la foto.'
  };

  // --- Geometría -----------------------------------------------------------------------------
  // Matrices 3 × 3 como arrays de 9 (por filas).
  function mul(a, b) {
    var r = [];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
    return r;
  }
  function transpose(m) { return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]; }
  function invert(m) {
    var a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
    var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    var det = a * A + b * B + c * C;
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
      B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
      C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  }
  function project(m, x, y) {
    var w = m[6] * x + m[7] * y + m[8];
    return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
  }

  // Giro de `tilt` = {x, y} (radianes; la dirección es hacia dónde se inclina, sobre la foto).
  function rotate(tilt, v) {
    var t = Math.hypot(tilt.x, tilt.y);
    if (t < 1e-9) return v;
    var a = [-tilt.y / t, tilt.x / t, 0]; // eje en la foto, perpendicular a la inclinación
    var c = Math.cos(t), s = Math.sin(t), dot = a[0] * v[0] + a[1] * v[1];
    var cross = [a[1] * v[2], -a[0] * v[2], a[0] * v[1] - a[1] * v[0]];
    return [0, 1, 2].map(function (k) { return v[k] * c + cross[k] * s + a[k] * dot * (1 - c); });
  }

  // Homografía del plano del blanco (unidades a escala 1) a la foto (%).
  function homography(center, tilt) {
    var f = FOCAL * 100;
    var e1 = rotate(tilt, [1, 0, 0]);      // x del blanco: a la derecha
    var e2 = rotate(tilt, [0, -1, 0]);     // y del blanco: hacia arriba
    var t = [center.x - 50, center.y - 50, f];
    var K = [f, 0, 50, 0, f, 50, 0, 0, 1];
    return mul(K, [e1[0], e2[0], t[0], e1[1], e2[1], t[1], e1[2], e2[2], t[2]]);
  }

  // mm del blanco → % de la foto: la escala sale de que el punto del anillo esté a `radiusMm`.
  function mmToPhoto(center, edge, radiusMm, tilt) {
    var h = homography(center, tilt);
    var p = project(invert(h), edge.x, edge.y);
    var scale = Math.hypot(p.x, p.y) / radiusMm;
    return mul(h, [scale, 0, 0, 0, scale, 0, 0, 0, 1]);
  }

  // Cómo se ve en la foto un círculo del blanco de radio `r` mm: la elipse de la cónica proyectada.
  function ellipse(h, r) {
    var inv = invert(h);
    var c = mul(mul(transpose(inv), [1, 0, 0, 0, 1, 0, 0, 0, -r * r]), inv);
    var a = c[0], b = c[1], cc = c[4], d = c[2], e = c[5], g = c[8];
    var det = a * cc - b * b;
    var x0 = (b * e - cc * d) / det, y0 = (b * d - a * e) / det;
    var g0 = g + d * x0 + e * y0;
    var mean = (a + cc) / 2, diff = Math.hypot((a - cc) / 2, b);
    var l1 = mean - diff, l2 = mean + diff;
    var angle = Math.abs(b) < 1e-12 ? (a <= cc ? 0 : 90) : Math.atan2(l1 - a, b) * 180 / Math.PI;
    return { cx: x0, cy: y0, rx: Math.sqrt(-g0 / l1), ry: Math.sqrt(-g0 / l2), angle: angle };
  }

  function describeTilt(tilt) {
    var t = Math.hypot(tilt.x, tilt.y);
    if (t < 0.01) return '';
    var deg = Math.round(t * 180 / Math.PI);
    var dir = Math.round(Math.atan2(tilt.y, tilt.x) / (Math.PI / 4));
    var words = { 0: 'la derecha', 1: 'abajo a la derecha', 2: 'abajo', 3: 'abajo a la izquierda', 4: 'la izquierda', '-4': 'la izquierda', '-3': 'arriba a la izquierda', '-2': 'arriba', '-1': 'arriba a la derecha' };
    return 'Inclinación: ' + deg + '° hacia ' + words[dir];
  }

  // --- Maqueta -------------------------------------------------------------------------------
  var content = window.mkViewer(root.querySelector('.tgt'));
  var svgNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var e = document.createElementNS(svgNS, tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function draw(svg, e, attrs) {
    svg.appendChild(svgEl('ellipse', Object.assign({
      cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry,
      transform: 'rotate(' + e.angle + ' ' + e.cx + ' ' + e.cy + ')'
    }, attrs)));
  }

  // "Foto": el blanco sacado desde abajo, con 30° de inclinación (el borde de abajo, más cerca).
  var FOTO = { center: { x: 50, y: 52 }, tilt: { x: 0, y: 30 * Math.PI / 180 } };
  // El anillo exterior (Ø 500 mm) ocupa unos 88 % de la foto: 44 % de radio.
  var photoH = mul(homography(FOTO.center, FOTO.tilt), [44 / 250, 0, 0, 0, 44 / 250, 0, 0, 0, 1]);
  var photo = svgEl('svg', { class: 'cal', viewBox: '0 0 100 100', 'aria-hidden': 'true' });
  ZONAS.slice().sort(function (a, b) { return b.diametroMm - a.diametroMm; }).forEach(function (z) {
    var dark = z.puntaje >= 7;
    draw(photo, ellipse(photoH, z.diametroMm / 2), {
      style: 'fill:' + (z.puntaje === 7 ? '#181818' : 'none') + ';stroke:' + (dark ? '#D9D4C6' : '#2A2A2A') + ';stroke-width:1'
    });
  });
  content.appendChild(photo);

  var svg = svgEl('svg', { class: 'cal', viewBox: '0 0 100 100', 'aria-hidden': 'true' });
  content.appendChild(svg);
  var surface = document.createElement('button');
  surface.type = 'button';
  surface.setAttribute('style', 'position:absolute;inset:0;background:transparent;border:0;padding:0;cursor:crosshair');
  content.appendChild(surface);
  var centerMk = document.createElement('span');
  centerMk.className = 'mk cross';
  var edgeMk = document.createElement('span');
  edgeMk.className = 'mk';
  [centerMk, edgeMk].forEach(function (m) { m.setAttribute('aria-hidden', 'true'); content.appendChild(m); });

  // Centro encontrado automáticamente (en la app, target-center.ts): el del blanco en la foto.
  var auto = project(photoH, 0, 0);
  var NO_TILT = { x: 0, y: 0 };
  var state = { center: auto, edge: null, tilt: NO_TILT, ring: 150 };
  var active = 'edge';
  var error = '';
  var drag = null;

  function pointAt(e) {
    var r = content.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 };
  }
  function place(p) {
    if (active === 'shape') {
      if (!state.center || !state.edge) { error = 'Ubicá el centro y un punto sobre un anillo antes de inclinar el blanco'; return; }
      var t = { x: drag.tilt.x + (p.x - drag.from.x) * TILT_PER_PCT, y: drag.tilt.y + (p.y - drag.from.y) * TILT_PER_PCT };
      var len = Math.hypot(t.x, t.y);
      if (len > MAX_TILT) t = { x: t.x / len * MAX_TILT, y: t.y / len * MAX_TILT };
      state.tilt = t;
    } else {
      state[active] = p;
    }
    error = '';
  }
  surface.addEventListener('pointerdown', function (e) {
    surface.setPointerCapture(e.pointerId);
    drag = { from: pointAt(e), tilt: state.tilt };
    // Con "Inclinación", tocar sin arrastrar no cambia nada.
    if (active !== 'shape') place(drag.from);
    render();
  });
  surface.addEventListener('pointermove', function (e) {
    if (!drag) return;
    place(pointAt(e));
    render();
  });
  surface.addEventListener('pointerup', function () {
    drag = null;
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
    state.tilt = NO_TILT;
    render();
  });

  function tilted() { return Math.hypot(state.tilt.x, state.tilt.y) >= 0.01; }

  function render() {
    svg.innerHTML = '';
    if (state.center && state.edge && Math.hypot(state.edge.x - state.center.x, state.edge.y - state.center.y) > 1) {
      var h = mmToPhoto(state.center, state.edge, state.ring / 2, state.tilt);
      ZONAS.forEach(function (z) { draw(svg, ellipse(h, z.diametroMm / 2), {}); });
    }
    [[centerMk, 'center'], [edgeMk, 'edge']].forEach(function (pair) {
      var p = state[pair[1]];
      pair[0].hidden = !p;
      pair[0].classList.toggle('on', active === pair[1]);
      if (p) { pair[0].style.left = p.x + '%'; pair[0].style.top = p.y + '%'; }
    });
    root.querySelectorAll('[data-tools] [role="radio"]').forEach(function (r) {
      var t = r.dataset.value;
      var done = t === 'shape' ? tilted() : !!state[t];
      r.textContent = LABELS[t] + (done ? ' ✓' : '');
    });
    root.querySelector('[data-instruction]').textContent = INSTRUCCIONES[active];
    root.querySelector('[data-auto]').hidden = state.center !== auto;
    root.querySelector('[data-reset-shape]').hidden = !tilted();
    var tiltBox = root.querySelector('[data-tilt]');
    if (tiltBox) { tiltBox.hidden = !tilted(); tiltBox.textContent = describeTilt(state.tilt); }
    var err = root.querySelector('[data-error]');
    err.hidden = !error;
    err.textContent = error;
  }

  setActive(active);
  render();
})();
