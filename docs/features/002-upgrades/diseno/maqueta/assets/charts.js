// Gráficos de la maqueta (iteración 001). Referencia de comportamiento para LineChart, BarChart y
// el nuevo MpiScatter:
// - Cada punto lleva siempre su valor (sin unidad: la unidad va en el título del gráfico).
// - Cada punto ocupa como mínimo MIN_BAND px. Si no entran, el área del gráfico se desplaza en
//   horizontal (arranca mostrando los más recientes) y el eje y queda fijo a la izquierda.
// - Tocar o pasar el mouse por un punto lo destaca y muestra su fecha (o ronda) en el eje x.
// Uso: <div data-chart='{"type":"line","points":[["2 ago",8.1],...],"decimals":1}'></div>
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var MIN_BAND = 52;
  var HEIGHT = 180;
  var PAD = { top: 30, bottom: 26 };
  var AXIS_W = 34;

  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function html(tag, text) {
    var e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function fmt(v, d) { return v.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  function ticks(values, zero) {
    var min = zero ? Math.min(0, Math.min.apply(null, values)) : Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    if (max === min) { max += 1; if (!zero) min -= 1; }
    var raw = (max - min) / 2;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = [1, 2, 2.5, 5, 10].map(function (s) { return s * mag; }).find(function (s) { return s >= raw; });
    var out = [];
    for (var v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) out.push(Number(v.toFixed(10)));
    return out;
  }

  // 002: selección compartida. Los gráficos de la Evolución (los que están dentro de un
  // [data-evo-panel]) comparten la ronda seleccionada: tocarla en cualquiera de ellos, línea o
  // dispersión, la selecciona en todos, también en las otras pestañas. La clave es el número de
  // ronda ("R3" en la línea, "3" en la dispersión).
  var SEL = {};
  function syncGroup(box) { return box.closest('[data-evo-panel]') ? 'evo' : null; }
  function roundKey(label) { return String(label).replace(/^R/, ''); }
  function broadcast(group, key) {
    SEL[group] = key;
    document.dispatchEvent(new CustomEvent('mk-sel', { detail: { group: group, key: key } }));
  }
  function onSel(group, fn) {
    document.addEventListener('mk-sel', function (e) { if (e.detail.group === group) fn(e.detail.key); });
  }

  function chart(box, cfg) {
    var pts = cfg.points;
    var group = cfg.type === 'line' ? syncGroup(box) : null;
    var keys = pts.map(function (p) { return roundKey(p[0]); });
    function selectedIndex() { var i = group ? keys.indexOf(SEL[group]) : -1; return i < 0 ? null : i; }
    var view = { setActive: null };
    if (group) onSel(group, function () { if (view.setActive) { view.setActive(null); view.reveal(); } });
    var values = pts.map(function (p) { return p[1]; });
    var tk = ticks(values, cfg.type === 'bar');
    var min = tk[0], max = tk[tk.length - 1];
    var y = function (v) { return HEIGHT - PAD.bottom - (v - min) / (max - min) * (HEIGHT - PAD.top - PAD.bottom); };

    box.style.cssText = 'display:flex;align-items:stretch';
    var axis = el('svg', { width: AXIS_W, height: HEIGHT, 'aria-hidden': 'true' });
    axis.style.flexShrink = '0';
    tk.forEach(function (t) { axis.appendChild(el('text', { x: AXIS_W - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'ax' }, fmt(t, t % 1 ? 1 : 0))); });
    box.appendChild(axis);

    var scroller = document.createElement('div');
    scroller.style.cssText = 'flex:1;min-width:0;overflow-x:auto;overscroll-behavior-x:contain';
    scroller.tabIndex = 0;
    scroller.setAttribute('aria-label', cfg.label || 'Gráfico');
    box.appendChild(scroller);

    function draw() {
      scroller.innerHTML = '';
      var width = Math.max(scroller.clientWidth, pts.length * MIN_BAND);
      var band = width / pts.length;
      var x = function (i) { return band * (i + 0.5); };
      var svg = el('svg', { width: width, height: HEIGHT, role: 'img', 'aria-label': cfg.label || '' });
      svg.style.display = 'block';
      tk.forEach(function (t) { svg.appendChild(el('line', { x1: 0, x2: width, y1: y(t), y2: y(t), style: 'stroke:' + (cfg.type === 'bar' && t === 0 ? 'var(--axis)' : 'var(--surface-3)') })); });
      var active = pts.length - 1;
      // Banda vertical translúcida detrás de la ronda seleccionada (de arriba hasta el eje x, con
      // su "R3" adentro), en el color del PMI: marca la misma ronda que se resalta en la dispersión.
      var selBand = el('rect', { y: 4, height: HEIGHT - 8, rx: 8, style: 'fill:var(--info);fill-opacity:.14;stroke:var(--info);stroke-opacity:.35', display: 'none' });
      svg.appendChild(selBand);
      var marks = [], labels = [], dates = [];
      if (cfg.type === 'line') {
        svg.appendChild(el('polyline', { points: pts.map(function (p, i) { return x(i) + ',' + y(p[1]); }).join(' '), fill: 'none', 'stroke-width': 2.5, 'stroke-linejoin': 'round', style: 'stroke:var(--accent)' }));
      }
      pts.forEach(function (p, i) {
        var m = cfg.type === 'line'
          ? el('circle', { cx: x(i), cy: y(p[1]), r: 3.5, style: 'fill:var(--accent)' })
          : el('rect', { x: x(i) - Math.min(30, band * 0.6) / 2, y: y(p[1]), width: Math.min(30, band * 0.6), height: y(Math.max(min, 0)) - y(p[1]), rx: 3, style: 'fill:var(--info)', opacity: 0.55 });
        svg.appendChild(m); marks.push(m);
        var top = cfg.type === 'line' ? y(p[1]) - 10 : y(p[1]) - 6;
        var l = el('text', { x: x(i), y: Math.max(top, 12), 'text-anchor': 'middle', class: 'val' }, fmt(p[1], cfg.decimals));
        svg.appendChild(l); labels.push(l);
        var d = el('text', { x: x(i), y: HEIGHT - 6, 'text-anchor': 'middle', class: 'ax' }, p[0]);
        svg.appendChild(d); dates.push(d);
      });
      // Franjas de toque.
      pts.forEach(function (p, i) {
        var hit = el('rect', { x: band * i, y: 0, width: band, height: HEIGHT, fill: 'transparent', style: 'cursor:pointer' });
        hit.appendChild(el('title', {}, p[0] + ': ' + fmt(p[1], cfg.decimals)));
        hit.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') setActive(i); });
        if (group) {
          // En la Evolución, tocar una ronda la selecciona (en todos los gráficos); tocarla de nuevo la quita.
          hit.setAttribute('role', 'button');
          hit.setAttribute('tabindex', '0');
          hit.setAttribute('aria-label', 'Ronda ' + keys[i]);
          var toggle = function () { broadcast(group, selectedIndex() === i ? null : keys[i]); };
          hit.addEventListener('click', toggle);
          hit.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
            if (e.key === 'Escape') broadcast(group, null);
          });
        } else {
          hit.addEventListener('click', function () { setActive(i); });
        }
        svg.appendChild(hit);
      });
      // Al salir el mouse, vuelve a la ronda seleccionada (o a la última).
      if (group) svg.addEventListener('pointerleave', function () { setActive(null); });
      function setActive(i) {
        var sel = selectedIndex();
        active = i === null ? (sel === null ? pts.length - 1 : sel) : i;
        if (group) {
          var w = Math.min(band - 8, 44);
          selBand.setAttribute('display', sel === null ? 'none' : '');
          if (sel !== null) { selBand.setAttribute('x', x(sel) - w / 2); selBand.setAttribute('width', w); }
          svg.querySelectorAll('[role="button"]').forEach(function (h, j) { h.setAttribute('aria-pressed', j === sel ? 'true' : 'false'); });
        }
        marks.forEach(function (m, j) {
          var on = j === active;
          if (cfg.type === 'line') {
            m.setAttribute('r', on ? 5.5 : 3.5);
            m.style.stroke = on ? 'var(--surface)' : '';
            m.style.strokeWidth = on ? 2 : 0;
          }
          else m.setAttribute('opacity', on ? 1 : 0.55);
          // La ronda seleccionada mantiene su valor y su "R3" destacados aunque el mouse destaque otra.
          var mark = on || j === sel;
          labels[j].classList.toggle('on', mark);
          // En el eje x se ve la fecha del punto destacado; del resto, una de cada tantas.
          var every = Math.max(1, Math.round(80 / band));
          dates[j].style.display = mark || (j % every === 0 && Math.abs(j - active) * band > 60 && (sel === null || Math.abs(j - sel) * band > 60)) ? '' : 'none';
          dates[j].classList.toggle('on', mark);
        });
      }
      view.setActive = setActive;
      // Si la ronda seleccionada no se ve (línea con desplazamiento), se lleva a la vista.
      view.reveal = function () {
        var sel = selectedIndex();
        if (sel === null) return;
        var left = x(sel) - scroller.clientWidth / 2;
        if (x(sel) < scroller.scrollLeft + 20 || x(sel) > scroller.scrollLeft + scroller.clientWidth - 20) scroller.scrollLeft = left;
      };
      setActive(null);
      scroller.appendChild(svg);
      scroller.scrollLeft = scroller.scrollWidth;
      view.reveal();
    }
    draw();
    window.addEventListener('resize', draw);
  }

  // Dispersión de los PMI de cada ronda alrededor del centro del blanco (mm, y hacia arriba).
  // 002: cada punto puede llevar un círculo centrado en su PMI (p[3] = radio: medio grupo o el
  // radio medio). Tocar un punto lo resalta (con su círculo), opaca los demás y
  // muestra debajo la ronda con "Ver análisis". Tocar el mismo punto o fuera de los puntos lo quita.
  // La selección es la compartida de la Evolución (ver SEL): la misma ronda en todas las pestañas
  // y también la que se toca en el gráfico de línea.
  // Zoom: pellizcar con dos dedos (o Ctrl + rueda / pellizco del trackpad) acerca alrededor de los
  // dedos, de 1× a 8×; con zoom, arrastrar con un dedo desplaza. Los botones − / + / "1×" son la
  // alternativa sin gestos. Los puntos, los trazos y los textos no cambian de tamaño: solo se
  // separan. Los círculos de referencia se recalculan para la escala visible.
  var ZOOM_MAX = 8, ZOOM_STEP = 1.6;
  var RINGS = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  function scatter(box, cfg) {
    var size = 220, c = size / 2;
    var unit = cfg.unit || 'mm';
    var d = cfg.decimals == null ? 1 : cfg.decimals;
    var far = Math.max.apply(null, cfg.points.map(function (p) { return Math.hypot(p[1], p[2]) + (p[3] || 0); }));
    var ring0 = RINGS.find(function (r) { return r * 2 >= far; }) || 100;
    var k = (c - 18) / (ring0 * 2);
    // Vista: escala s y desplazamiento (tx, ty) en unidades del viewBox.
    var view = { s: 1, tx: 0, ty: 0 };
    function X(x) { return x * k * view.s + c + view.tx; }
    function Y(y) { return -y * k * view.s + c + view.ty; }

    var svg = el('svg', { viewBox: '0 0 ' + size + ' ' + size, role: 'img', 'aria-label': cfg.label || '' });
    svg.style.cssText = 'width:100%;height:auto;display:block;cursor:pointer;touch-action:pan-x pan-y;user-select:none;-webkit-user-select:none';
    var clipId = 'clip' + Math.random().toString(36).slice(2);
    var defs = el('defs', {});
    var clip = el('clipPath', { id: clipId });
    clip.appendChild(el('rect', { x: 0, y: 0, width: size, height: size, rx: 8 }));
    defs.appendChild(clip);
    svg.appendChild(defs);
    var plot = el('g', { 'clip-path': 'url(#' + clipId + ')' });
    svg.appendChild(plot);
    var refs = el('g', {});
    plot.appendChild(refs);
    var axX = el('line', { style: 'stroke:var(--axis)' });
    var axY = el('line', { style: 'stroke:var(--axis)' });
    plot.appendChild(axX);
    plot.appendChild(axY);
    var last = cfg.points.length - 1;
    var path = el('polyline', { fill: 'none', 'stroke-dasharray': '3 3', style: 'stroke:var(--text-3)' });
    plot.appendChild(path);
    var circles = [], dots = [];
    cfg.points.forEach(function (p) {
      if (!p[3]) { circles.push(null); return; }
      var ci = el('circle', { fill: 'none', 'stroke-dasharray': '4 3', style: 'stroke:var(--info);stroke-width:1.5' });
      plot.appendChild(ci);
      circles.push(ci);
    });
    // Un arrastre o un pellizco no cuenta como toque (no cambia la selección).
    var moved = false;
    cfg.points.forEach(function (p, i) {
      var g = el('g', {});
      g.appendChild(el('circle', { r: 9, style: 'fill:var(--info);stroke:var(--surface);stroke-width:2' }));
      g.appendChild(el('text', { 'text-anchor': 'middle', style: 'font:700 11px Barlow,sans-serif;fill:#0B0D0F;pointer-events:none' }, p[0]));
      // Área de toque de 44 px.
      var hit = el('circle', { r: 14, fill: 'transparent' });
      hit.addEventListener('click', function (e) { e.stopPropagation(); if (moved) return; pick(selected === i ? null : i); });
      g.appendChild(hit);
      plot.appendChild(g);
      dots.push(g);
    });
    svg.addEventListener('click', function () { if (!moved) pick(null); });

    // Controles de zoom, debajo del gráfico a la derecha.
    var wrap = html('div');
    wrap.style.cssText = 'max-width:280px;margin:0 auto';
    wrap.appendChild(svg);
    var bar = html('div');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Zoom del gráfico');
    bar.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:4px';
    function zbtn(label, aria) {
      var b = html('button', label);
      b.type = 'button';
      b.setAttribute('aria-label', aria);
      b.style.cssText = 'min-width:44px;height:44px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font:600 18px Barlow,sans-serif;cursor:pointer';
      return b;
    }
    var minus = zbtn('−', 'Alejar');
    var level = html('span', '1×');
    level.setAttribute('class', 'num');
    level.setAttribute('aria-live', 'polite');
    level.style.cssText = 'min-width:40px;text-align:center;font-size:13px;color:var(--text-2)';
    var plus = zbtn('+', 'Acercar');
    var reset = zbtn('1×', 'Restablecer el zoom');
    reset.style.fontSize = '14px';
    minus.addEventListener('click', function () { zoomTo(view.s / ZOOM_STEP, c, c); });
    plus.addEventListener('click', function () { zoomTo(view.s * ZOOM_STEP, c, c); });
    reset.addEventListener('click', function () { view = { s: 1, tx: 0, ty: 0 }; redraw(); });
    bar.appendChild(minus);
    bar.appendChild(level);
    bar.appendChild(plus);
    bar.appendChild(reset);
    wrap.appendChild(bar);
    box.appendChild(wrap);

    function redraw() {
      // Referencias: dos círculos con su medida, elegidos para lo que se ve a esta escala.
      var ring = RINGS.find(function (r) { return r * 2 >= (ring0 * 2) / view.s; }) || ring0;
      refs.innerHTML = '';
      [ring * 2, ring].forEach(function (r) {
        var rr = r * k * view.s;
        var dec = r >= 1 && r % 1 === 0 ? 0 : (Math.round(r * 10) === r * 10 ? 1 : 2);
        refs.appendChild(el('circle', { cx: X(0), cy: Y(0), r: rr, fill: 'none', style: 'stroke:var(--surface-3)' }));
        refs.appendChild(el('text', { x: X(0) + rr * 0.71 + 2, y: Y(0) - rr * 0.71 - 2, class: 'ax' }, fmt(r, dec) + ' ' + unit));
      });
      axX.setAttribute('x1', 0); axX.setAttribute('x2', size); axX.setAttribute('y1', Y(0)); axX.setAttribute('y2', Y(0));
      axY.setAttribute('y1', 0); axY.setAttribute('y2', size); axY.setAttribute('x1', X(0)); axY.setAttribute('x2', X(0));
      path.setAttribute('points', cfg.points.map(function (p) { return X(p[1]) + ',' + Y(p[2]); }).join(' '));
      cfg.points.forEach(function (p, i) {
        if (circles[i]) {
          circles[i].setAttribute('cx', X(p[1]));
          circles[i].setAttribute('cy', Y(p[2]));
          circles[i].setAttribute('r', p[3] * k * view.s);
        }
        var parts = dots[i].childNodes;
        parts[0].setAttribute('cx', X(p[1])); parts[0].setAttribute('cy', Y(p[2]));
        parts[1].setAttribute('x', X(p[1])); parts[1].setAttribute('y', Y(p[2]) + 4);
        parts[2].setAttribute('cx', X(p[1])); parts[2].setAttribute('cy', Y(p[2]));
      });
      // Con zoom, un dedo desplaza el gráfico en vez de la página.
      svg.style.touchAction = view.s > 1 ? 'none' : 'pan-x pan-y';
      svg.style.cursor = view.s > 1 ? 'grab' : 'pointer';
      level.textContent = (Math.round(view.s * 10) / 10).toLocaleString('es-AR') + '×';
      minus.disabled = view.s <= 1;
      reset.disabled = view.s <= 1;
      plus.disabled = view.s >= ZOOM_MAX;
      [minus, reset, plus].forEach(function (b) { b.style.opacity = b.disabled ? 0.4 : 1; });
    }
    // El gráfico no se puede sacar de su recuadro.
    function clampPan() {
      var m = c * (view.s - 1);
      view.tx = Math.max(-m, Math.min(m, view.tx));
      view.ty = Math.max(-m, Math.min(m, view.ty));
    }
    // Zoom a la escala s, con el punto (vx, vy) del viewBox fijo.
    function zoomTo(s, vx, vy) {
      s = Math.min(ZOOM_MAX, Math.max(1, s));
      var f = s / view.s;
      view.tx = vx - c - (vx - c - view.tx) * f;
      view.ty = vy - c - (vy - c - view.ty) * f;
      view.s = s;
      clampPan();
      redraw();
    }
    function toView(clientX, clientY) {
      var r = svg.getBoundingClientRect();
      return [((clientX - r.left) * size) / r.width, ((clientY - r.top) * size) / r.height];
    }

    // Gestos con Pointer Events: dos punteros = pellizco; uno, con zoom = desplazar.
    var pointers = {}, gesture = null;
    function start() {
      var ids = Object.keys(pointers);
      var a = pointers[ids[0]];
      var g = { s: view.s, tx: view.tx, ty: view.ty, p: toView(a[0], a[1]) };
      if (ids.length >= 2) {
        var b = pointers[ids[1]];
        g.dist = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        var mid = toView((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        // Punto del gráfico (a escala 1, relativo al centro) que queda bajo los dedos.
        g.data = [(mid[0] - c - view.tx) / view.s, (mid[1] - c - view.ty) / view.s];
      }
      return g;
    }
    svg.addEventListener('pointerdown', function (e) {
      if (Object.keys(pointers).length === 0) moved = false;
      pointers[e.pointerId] = [e.clientX, e.clientY];
      gesture = start();
    });
    svg.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId] || !gesture) return;
      pointers[e.pointerId] = [e.clientX, e.clientY];
      var ids = Object.keys(pointers);
      if (ids.length >= 2 && gesture.dist) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var mid = toView((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        var s = Math.min(ZOOM_MAX, Math.max(1, (gesture.s * Math.hypot(a[0] - b[0], a[1] - b[1])) / gesture.dist));
        // El punto que estaba bajo los dedos sigue bajo los dedos.
        view.s = s;
        view.tx = mid[0] - c - gesture.data[0] * s;
        view.ty = mid[1] - c - gesture.data[1] * s;
        clampPan();
        redraw();
        moved = true;
        e.preventDefault();
      } else if (ids.length === 1 && view.s > 1) {
        var p = toView(e.clientX, e.clientY);
        if (!moved && Math.hypot(p[0] - gesture.p[0], p[1] - gesture.p[1]) < 4) return;
        moved = true;
        view.tx = gesture.tx + p[0] - gesture.p[0];
        view.ty = gesture.ty + p[1] - gesture.p[1];
        clampPan();
        redraw();
        svg.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });
    function end(e) {
      if (!pointers[e.pointerId]) return;
      delete pointers[e.pointerId];
      gesture = Object.keys(pointers).length ? start() : null;
      if (!gesture) redraw();
    }
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') end(e); });
    // Desktop: Ctrl + rueda (el pellizco del trackpad llega así) hace zoom en el cursor.
    svg.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      var p = toView(e.clientX, e.clientY);
      zoomTo(view.s * Math.exp(-e.deltaY / 200), p[0], p[1]);
    }, { passive: false });

    // Detalle de la ronda tocada, debajo del gráfico.
    var detail = html('div');
    detail.setAttribute('role', 'status');
    detail.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:8px;padding:10px 12px;border-radius:12px;background:var(--surface-2);min-height:56px';
    box.appendChild(detail);

    // Con selección compartida (Evolución), elegir una ronda avisa a todos los gráficos y cada uno
    // la muestra; si no, se muestra solo acá.
    var group = syncGroup(box);
    var keys = cfg.points.map(function (p) { return roundKey(p[0]); });
    function pick(i) { if (group) broadcast(group, i === null ? null : keys[i]); else select(i); }
    if (group) onSel(group, function (key) { var i = keys.indexOf(key); select(i < 0 ? null : i); });
    var selected = null;
    function select(i) {
      selected = i;
      dots.forEach(function (g, j) {
        var on = i === null ? j === last : j === i;
        var dim = i !== null && j !== i;
        g.setAttribute('opacity', dim ? 0.25 : (on ? 1 : 0.7));
        g.firstChild.setAttribute('r', on ? 11 : 9);
      });
      circles.forEach(function (ci, j) {
        if (!ci) return;
        var dim = i !== null && j !== i;
        ci.setAttribute('opacity', dim ? 0.15 : (i === j ? 1 : 0.55));
        ci.style.strokeWidth = i === j ? '2.5' : '1.5';
      });
      path.setAttribute('opacity', i === null ? 1 : 0.3);
      // El seleccionado va arriba de todo.
      if (i !== null) { if (circles[i]) plot.appendChild(circles[i]); plot.appendChild(dots[i]); }
      detail.innerHTML = '';
      if (i === null) {
        detail.appendChild(html('span', 'Tocá un punto para ver esa ronda. Pellizcá el gráfico para acercarlo.'));
        detail.firstChild.setAttribute('style', 'font-size:13px;color:var(--text-3)');
        return;
      }
      var p = cfg.points[i];
      var text = html('span');
      text.setAttribute('style', 'display:flex;flex-direction:column;gap:2px');
      var t1 = html('span', 'Ronda ' + p[0]);
      t1.setAttribute('style', 'font-weight:600');
      var parts = ['PMI (' + fmt(p[1], d) + '; ' + fmt(p[2], d) + ')'];
      if (p[3] && cfg.measure) parts.push(cfg.measure + ' ' + fmt(cfg.measureIsRadius ? p[3] : p[3] * 2, d));
      var t2 = html('span', parts.join(' · ') + ' ' + unit);
      t2.setAttribute('class', 'num');
      t2.setAttribute('style', 'font-size:13px;color:var(--text-2)');
      text.appendChild(t1);
      text.appendChild(t2);
      detail.appendChild(text);
      var a = document.createElement('a');
      a.href = cfg.href || '#';
      a.textContent = 'Ver análisis';
      a.setAttribute('aria-label', 'Ver análisis de la ronda ' + p[0]);
      a.setAttribute('style', 'font-size:14px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;min-height:44px');
      detail.appendChild(a);
    }
    // Cambiar de métrica o de unidad vuelve a 1×; la selección se mantiene.
    box.resetView = function () { view = { s: 1, tx: 0, ty: 0 }; redraw(); };
    redraw();
    var initial = group ? keys.indexOf(SEL[group]) : -1;
    select(initial < 0 ? null : initial);
  }

  var style = document.createElement('style');
  style.textContent = '.ax{font:500 11px Barlow,sans-serif;fill:var(--text-3);font-variant-numeric:tabular-nums}.ax.on{fill:var(--text);font-weight:700}' +
    '.val{font:600 12px Barlow,sans-serif;fill:var(--text-2);font-variant-numeric:tabular-nums}.val.on{font:700 14px Barlow,sans-serif;fill:var(--text)}';
  document.head.appendChild(style);

  window.mkCharts = function (root) {
    (root || document).querySelectorAll('[data-chart]').forEach(function (box) {
      // Los ocultos se dibujan al mostrarse (necesitan su ancho).
      if (box.dataset.done || box.offsetParent === null) return;
      box.dataset.done = '1';
      var cfg = JSON.parse(box.dataset.chart);
      (cfg.type === 'scatter' ? scatter : chart)(box, cfg);
    });
  };
  window.mkCharts();
})();
