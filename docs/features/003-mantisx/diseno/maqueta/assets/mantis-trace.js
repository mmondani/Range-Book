// Pantalla MantisX de la ronda (maqueta): resumen, lista de disparos y trayectoria con reproducción.
// Referencia de cálculo para src/lib/mantis-trace.ts. Usa window.MANTIS_ROUND (mantis-data.js).
(function () {
  var data = window.MANTIS_ROUND;
  var root = document.querySelector('[data-mantis]');
  if (!data || !root) return;

  var PROBLEMS = {
    'GREAT SHOT': 'Buen disparo',
    'PUSHING FORWARD': 'Empujar hacia adelante',
    'SLAPPING TRIGGER': 'Golpear el gatillo',
    'TIGHTENING FINGERS': 'Cerrar los dedos',
    'TIGHTENING GRIP': 'Apretar el agarre',
    'HEELING': 'Empujar con la palma',
    'TOO LITTLE TRIGGER FINGER': 'Poco dedo en el gatillo',
    'TOO MUCH TRIGGER FINGER': 'Mucho dedo en el gatillo',
    'PUSHING': 'Empujar (anticipar el retroceso)',
    'BREAKING WRIST UP': 'Quebrar la muñeca hacia arriba'
  };
  var nf1 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var shots = data.shots;
  var D = data.distanceM;

  function problem(p) { return PROBLEMS[p] || p; }
  // angle: 0° = derecha, 90° = arriba (antihorario) → hora de reloj, como el PMI.
  function clock(angle) { var h = Math.round((90 - angle) / 30) % 12; if (h <= 0) h += 12; return h + ' h'; }
  function mm(deg) { return Math.tan(deg * Math.PI / 180) * D * 1000; }

  // --- Resumen ---------------------------------------------------------------------------
  var scores = shots.map(function (s) { return s.score; });
  var splits = shots.slice(1).map(function (s) { return s.split; });
  var total = shots.reduce(function (a, s) { return a + s.split; }, 0);
  var set = function (k, v) { var el = root.querySelector('[data-' + k + ']'); if (el) el.textContent = v; };
  set('avg', nf1.format(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length));
  set('total', nf1.format(total));
  set('split', nf2.format(splits.reduce(function (a, b) { return a + b; }, 0) / splits.length));
  var best = scores.indexOf(Math.max.apply(null, scores));
  var worst = scores.indexOf(Math.min.apply(null, scores));
  var fast = 1 + splits.indexOf(Math.min.apply(null, splits));
  var slow = 1 + splits.indexOf(Math.max.apply(null, splits));

  // --- Lista de disparos -----------------------------------------------------------------
  var list = root.querySelector('[data-shots]');
  var selected = 0;
  function badge(text, tone) {
    if (tone === 'neutral') return '<span class="badge" style="background:var(--surface-3);color:var(--text-2)">' + text + '</span>';
    return '<span class="badge" style="background:color-mix(in srgb, var(--' + tone + ') 14%, transparent);color:var(--' + tone + ')">' + text + '</span>';
  }
  shots.forEach(function (s, i) {
    var b = '';
    if (i === best) b += badge('Mejor', 'success');
    if (i === worst) b += badge('Peor', 'warning');
    if (i === fast) b += badge('Split más rápido', 'info');
    if (i === slow) b += badge('Split más lento', 'neutral');
    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'shot-row';
    row.setAttribute('aria-pressed', 'false');
    row.setAttribute('aria-label', 'Disparo ' + s.n + ': ' + nf1.format(s.score) + ' puntos, split ' + nf2.format(s.split) + ' s, ' + problem(s.problem));
    row.innerHTML =
      '<span class="shot-n display num">' + s.n + '</span>' +
      '<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;text-align:left">' +
        '<span style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap"><span class="display num" style="font-size:22px">' + nf1.format(s.score) + '</span>' +
        '<span class="num" style="color:var(--text-2);font-size:14px">' + (i === 0 ? 'Primer disparo' : 'Split ' + nf2.format(s.split) + ' s') + '</span></span>' +
        '<span style="font-size:14px;color:var(--text-2)">' + problem(s.problem) + '</span>' +
        (b ? '<span style="display:flex;gap:6px;flex-wrap:wrap">' + b + '</span>' : '') +
      '</span>' +
      '<span class="dir" aria-hidden="true" title="Dirección"><svg viewBox="-12 -12 24 24" width="28" height="28"><circle r="10.5" fill="none" stroke="var(--border)" stroke-width="1.5"></circle>' +
        '<g transform="rotate(' + (-s.angle) + ')"><path d="M-5 0H6M2.5 -3.5 6 0 2.5 3.5" fill="none" stroke="var(--text-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></g></svg>' +
        '<span class="num" style="font-size:12px;color:var(--text-3)">' + clock(s.angle) + '</span></span>';
    row.addEventListener('click', function () { select(i); });
    list.appendChild(row);
  });

  // --- Trayectoria -----------------------------------------------------------------------
  var svg = root.querySelector('[data-trace]');
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function points(s) {
    // Relativa al punto del disparo (shotIndex), en mm a la distancia de la ronda; x a la derecha, y hacia arriba.
    var p0 = s.pitch[s.shotIndex], y0 = s.yaw[s.shotIndex];
    return s.pitch.map(function (p, k) { return [mm(s.yaw[k] - y0), mm(p - p0)]; });
  }
  function niceRadius(r) {
    var steps = [2, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
    for (var i = 0; i < steps.length; i++) if (steps[i] >= r) return steps[i];
    return Math.ceil(r / 50) * 50;
  }
  var state = { pts: [], R: 10, shown: 0, raf: 0, playing: false, start: 0, from: 0 };
  var speedBtns = root.querySelectorAll('[data-speed] [role="radio"]');
  function speed() { var on = root.querySelector('[data-speed] [aria-checked="true"]'); return on ? Number(on.dataset.value) : 0.25; }

  function draw(upto) {
    var s = shots[selected];
    var pts = state.pts, R = state.R;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var V = R * 1.15;
    svg.setAttribute('viewBox', [-V, -V, 2 * V, 2 * V].join(' '));
    var k = 2 * V / (Number(svg.getAttribute('width')) || 280); // px de pantalla → unidades del gráfico
    var g = el('g', {}, svg);
    el('line', { x1: -V, y1: 0, x2: V, y2: 0, stroke: 'var(--border)', 'stroke-width': k }, g);
    el('line', { x1: 0, y1: -V, x2: 0, y2: V, stroke: 'var(--border)', 'stroke-width': k }, g);
    [R / 2, R].forEach(function (r) {
      el('circle', { r: r, fill: 'none', stroke: 'var(--axis)', 'stroke-width': k, 'stroke-dasharray': (3 * k) + ' ' + (3 * k) }, g);
      var t = el('text', { x: r * 0.71 + 3 * k, y: -r * 0.71 - 3 * k, fill: 'var(--text-3)', 'font-size': 12 * k, 'font-family': 'Barlow, sans-serif' }, g);
      t.textContent = nf1.format(r).replace(',0', '') + ' mm';
    });
    var phases = [
      { a: s.holdIndex, b: s.pullIndex, color: 'var(--info)', w: 2, dash: '' },
      { a: s.pullIndex, b: s.shotIndex, color: 'var(--warning)', w: 3, dash: '' },
      { a: s.shotIndex, b: pts.length - 1, color: 'var(--accent)', w: 2, dash: (4 * k) + ' ' + (3 * k) }
    ];
    var clip = el('clipPath', { id: 'clip' }, el('defs', {}, svg));
    el('rect', { x: -V, y: -V, width: 2 * V, height: 2 * V }, clip);
    var lines = el('g', { 'clip-path': 'url(#clip)' }, svg);
    phases.forEach(function (ph) {
      var end = Math.min(ph.b, upto);
      if (end <= ph.a) return;
      var d = '';
      for (var i = ph.a; i <= end; i++) d += (i === ph.a ? 'M' : 'L') + pts[i][0].toFixed(2) + ' ' + (-pts[i][1]).toFixed(2);
      el('path', { d: d, fill: 'none', stroke: ph.color, 'stroke-width': ph.w * k, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': ph.dash }, lines);
    });
    if (upto >= s.shotIndex) {
      var c = 6 * k;
      el('path', { d: 'M' + -c + ' ' + -c + 'L' + c + ' ' + c + 'M' + c + ' ' + -c + 'L' + -c + ' ' + c, stroke: 'var(--text)', 'stroke-width': 2.5 * k, 'stroke-linecap': 'round' }, svg);
    }
    if (upto < pts.length - 1) {
      var p = pts[Math.max(0, upto)];
      el('circle', { cx: p[0], cy: -p[1], r: 5 * k, fill: 'var(--text)', stroke: 'var(--bg)', 'stroke-width': 2 * k }, lines);
    }
    var t = (upto - s.shotIndex) / s.rate;
    root.querySelector('[data-time]').textContent = upto >= pts.length - 1 ? '' : (t < 0 ? '−' : '+') + nf2.format(Math.abs(t)) + ' s';
  }

  function stop(atEnd) {
    cancelAnimationFrame(state.raf);
    state.playing = false;
    var btn = root.querySelector('[data-play]');
    btn.querySelector('span').textContent = atEnd ? 'Repetir' : 'Reproducir';
    btn.querySelector('[data-icon-play]').hidden = false;
    btn.querySelector('[data-icon-pause]').hidden = true;
  }
  function tick(now) {
    var s = shots[selected];
    var idx = state.from + Math.floor((now - state.start) / 1000 * s.rate * speed());
    if (idx >= state.pts.length - 1) { state.shown = state.pts.length - 1; draw(state.shown); stop(true); return; }
    state.shown = idx;
    draw(idx);
    state.raf = requestAnimationFrame(tick);
  }
  root.querySelector('[data-play]').addEventListener('click', function () {
    var btn = this;
    if (state.playing) { stop(false); return; }
    if (state.shown >= state.pts.length - 1) state.shown = 0;
    state.from = state.shown;
    state.start = performance.now();
    state.playing = true;
    btn.querySelector('span').textContent = 'Pausar';
    btn.querySelector('[data-icon-play]').hidden = true;
    btn.querySelector('[data-icon-pause]').hidden = false;
    state.raf = requestAnimationFrame(tick);
  });
  speedBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      if (!state.playing) return;
      state.from = state.shown; state.start = performance.now();
    });
  });

  function select(i) {
    stop(false);
    selected = i;
    var s = shots[i];
    state.pts = points(s);
    var r = 0;
    for (var k = s.holdIndex; k <= s.shotIndex; k++) r = Math.max(r, Math.hypot(state.pts[k][0], state.pts[k][1]));
    state.R = niceRadius(r * 1.1);
    state.shown = state.pts.length - 1;
    draw(state.shown);
    list.querySelectorAll('.shot-row').forEach(function (row, j) { row.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
    set('shot-title', 'Disparo ' + s.n + ' de ' + shots.length);
    set('shot-score', nf1.format(s.score));
    set('shot-split', i === 0 ? '—' : nf2.format(s.split) + ' s');
    set('shot-problem', problem(s.problem));
    set('shot-dir', clock(s.angle));
    set('shot-hold', nf2.format(s.hold));
    set('shot-pull', nf2.format(s.pull));
    set('shot-cant', nf1.format(Math.abs(s.cant)) + '°');
    root.querySelector('[data-prev]').disabled = i === 0;
    root.querySelector('[data-next]').disabled = i === shots.length - 1;
    svg.setAttribute('aria-label', 'Trayectoria del disparo ' + s.n + ': apuntado, presión del gatillo y seguimiento, en mm a ' + nf1.format(D) + ' m. Círculos de ' + nf1.format(state.R / 2) + ' y ' + nf1.format(state.R) + ' mm.');
  }
  root.querySelector('[data-prev]').addEventListener('click', function () { if (selected > 0) select(selected - 1); });
  root.querySelector('[data-next]').addEventListener('click', function () { if (selected < shots.length - 1) select(selected + 1); });
  select(0);
})();
