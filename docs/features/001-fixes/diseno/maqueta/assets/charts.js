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

  function chart(box, cfg) {
    var pts = cfg.points;
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
        hit.addEventListener('pointerenter', function () { setActive(i); });
        hit.addEventListener('click', function () { setActive(i); });
        svg.appendChild(hit);
      });
      function setActive(i) {
        active = i;
        marks.forEach(function (m, j) {
          var on = j === active;
          if (cfg.type === 'line') { m.setAttribute('r', on ? 5.5 : 3.5); m.style.stroke = on ? 'var(--surface)' : ''; m.style.strokeWidth = on ? 2 : 0; }
          else m.setAttribute('opacity', on ? 1 : 0.55);
          labels[j].classList.toggle('on', on);
          // En el eje x se ve la fecha del punto destacado; del resto, una de cada tantas.
          var every = Math.max(1, Math.round(80 / band));
          dates[j].style.display = on || (j % every === 0 && Math.abs(j - active) * band > 60) ? '' : 'none';
          dates[j].classList.toggle('on', on);
        });
      }
      setActive(active);
      scroller.appendChild(svg);
      scroller.scrollLeft = scroller.scrollWidth;
    }
    draw();
    window.addEventListener('resize', draw);
  }

  // Dispersión de los PMI de cada ronda alrededor del centro del blanco (mm, y hacia arriba).
  function scatter(box, cfg) {
    var size = 220, c = size / 2;
    var far = Math.max.apply(null, cfg.points.map(function (p) { return Math.hypot(p[1], p[2]); }));
    var ring = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100].find(function (r) { return r * 2 >= far; }) || 100;
    var k = (c - 18) / (ring * 2);
    var svg = el('svg', { viewBox: '0 0 ' + size + ' ' + size, role: 'img', 'aria-label': cfg.label || '' });
    svg.style.cssText = 'width:100%;max-width:280px;height:auto;display:block;margin:0 auto';
    [ring * 2, ring].forEach(function (r) {
      svg.appendChild(el('circle', { cx: c, cy: c, r: r * k, fill: 'none', style: 'stroke:var(--surface-3)' }));
      svg.appendChild(el('text', { x: c + r * k * 0.71 + 2, y: c - r * k * 0.71 - 2, class: 'ax' }, r.toLocaleString('es-AR') + ' ' + (cfg.unit || 'mm')));
    });
    svg.appendChild(el('line', { x1: 8, x2: size - 8, y1: c, y2: c, style: 'stroke:var(--axis)' }));
    svg.appendChild(el('line', { y1: 8, y2: size - 8, x1: c, x2: c, style: 'stroke:var(--axis)' }));
    var last = cfg.points.length - 1;
    // Recorrido de ronda en ronda, tenue.
    svg.appendChild(el('polyline', { points: cfg.points.map(function (p) { return (c + p[1] * k) + ',' + (c - p[2] * k); }).join(' '), fill: 'none', 'stroke-dasharray': '3 3', style: 'stroke:var(--text-3)' }));
    cfg.points.forEach(function (p, i) {
      var px = c + p[1] * k, py = c - p[2] * k, on = i === last;
      svg.appendChild(el('circle', { cx: px, cy: py, r: on ? 11 : 9, style: 'fill:var(--info);stroke:var(--surface);stroke-width:2', opacity: on ? 1 : 0.7 }));
      svg.appendChild(el('text', { x: px, y: py + 4, 'text-anchor': 'middle', style: 'font:700 11px Barlow,sans-serif;fill:#0B0D0F' }, p[0]));
    });
    box.appendChild(svg);
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
