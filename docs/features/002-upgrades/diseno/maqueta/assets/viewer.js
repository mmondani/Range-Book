// Visor de la foto del blanco de la maqueta: recuadro de proporción fija y zoom propio con los
// botones Acercar / Alejar / Ver la foto entera. En la app, además, dos dedos acercan y desplazan,
// Ctrl + rueda acerca donde está el cursor y, con la foto más grande que el recuadro, un dedo o el
// mouse la desplazan (ver pantallas.md → Análisis). La implementación real está en src/lib/zoom.ts.
(function () {
  var ICONS = {
    in: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path><path d="M11 8v6"></path><path d="M8 11h6"></path>',
    out: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path><path d="M8 11h6"></path>',
    full: '<path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path>'
  };

  function button(label, icon) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ov-btn';
    b.setAttribute('aria-label', label);
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[icon] + '</svg>';
    return b;
  }

  // Arma el visor dentro de `frame` (.tgt) y devuelve el contenedor de la foto (.tgt-content),
  // donde van la foto y sus superposiciones, en porcentajes de la foto.
  window.mkViewer = function (frame) {
    var content = document.createElement('div');
    content.className = 'tgt-content';
    frame.appendChild(content);

    var controls = document.createElement('div');
    controls.className = 'ov-right';
    var zoomIn = button('Acercar', 'in');
    var zoomOut = button('Alejar', 'out');
    var full = button('Ver la foto entera', 'full');
    controls.appendChild(zoomIn);
    controls.appendChild(zoomOut);
    controls.appendChild(full);
    frame.appendChild(controls);

    // La foto arranca cubriendo el recuadro (1); entera, mide lo que entra a lo ancho.
    var zoom = 1;
    function whole() { return Math.min(1, frame.clientWidth / frame.clientHeight || 1); }
    function apply() {
      content.style.setProperty('--zoom', zoom);
      var atWhole = zoom <= whole() + 0.001;
      zoomOut.disabled = atWhole;
      full.hidden = atWhole;
      zoomIn.disabled = zoom >= 10;
    }
    zoomIn.addEventListener('click', function () { zoom = Math.min(10, zoom * 2); apply(); });
    zoomOut.addEventListener('click', function () { zoom = Math.max(whole(), zoom / 2); apply(); });
    full.addEventListener('click', function () { zoom = whole(); apply(); });
    window.addEventListener('resize', apply);
    apply();
    return content;
  };
})();
