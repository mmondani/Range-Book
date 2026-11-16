/*
  Spike: exporta sesiones de train.mantisx.com a un JSON para Range Book.
  Se ejecuta como bookmarklet en una página de train.mantisx.com con la sesión iniciada.
  Usa las variables globales user_pk y user_sk que define el template de la página.
  No usar comentarios de línea (//): el bookmarklet se arma en una sola línea.
*/
(async () => {
  const DAY = 24 * 60 * 60 * 1000;
  const CHUNK_DAYS = 31;

  if (location.hostname !== 'train.mantisx.com') {
    alert('Abrí train.mantisx.com con tu sesión iniciada y volvé a tocar el marcador.');
    return;
  }
  if (typeof user_pk === 'undefined' || typeof user_sk === 'undefined') {
    alert('No encontré user_pk / user_sk en esta página. Abrí tu perfil en train.mantisx.com.');
    return;
  }
  const csrf = (document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/) || [])[1];
  if (!csrf) {
    alert('No encontré la cookie csrftoken.');
    return;
  }

  const localDate = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const fromInput = prompt('Exportar sesiones desde (AAAA-MM-DD):', localDate(new Date(Date.now() - 30 * DAY)));
  if (!fromInput) return;
  const toInput = prompt('Exportar sesiones hasta (AAAA-MM-DD, inclusive):', localDate(new Date()));
  if (!toInput) return;
  const from = new Date(fromInput + 'T00:00:00');
  const to = new Date(toInput + 'T23:59:59.999');
  if (isNaN(from) || isNaN(to)) {
    alert('Fecha inválida. Usá el formato AAAA-MM-DD.');
    return;
  }
  if (to < from) {
    alert('La fecha "hasta" es anterior a la fecha "desde".');
    return;
  }

  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;padding:12px 16px;' +
    'background:#111;color:#fff;font:14px sans-serif;border-radius:8px;box-shadow:0 2px 8px #0008';
  document.body.appendChild(box);
  const status = (text) => { box.textContent = 'Range Book · ' + text; };

  const post = async (path, body) => {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRFToken': csrf,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(Object.assign({ user_pk: user_pk, user_secret_key: user_sk }, body))
    });
    if (!res.ok) throw new Error(path + ': HTTP ' + res.status);
    return res.json();
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    const summaries = new Map();
    for (let start = from; start < to; start = new Date(start.getTime() + CHUNK_DAYS * DAY)) {
      const end = new Date(Math.min(start.getTime() + CHUNK_DAYS * DAY, to.getTime()));
      status('buscando sesiones ' + start.toISOString().slice(0, 10) + '…');
      const history = await post('/session-history', {
        profiled_user_pk: user_pk,
        highlights: false,
        type: 'pistol',
        start_date: start.toISOString(),
        end_date: end.toISOString()
      });
      if (!history.success) throw new Error('session-history respondió success=false');
      for (const s of history.sessions || []) summaries.set(s.pk, s);
    }

    const pks = Array.from(summaries.keys());
    const sessions = [];
    for (let i = 0; i < pks.length; i++) {
      status('bajando sesión ' + (i + 1) + ' de ' + pks.length + '…');
      const detail = await post('/get-session', { session_pk: pks[i] });
      if (!detail.session) throw new Error('get-session ' + pks[i] + ' sin "session"');
      sessions.push(detail.session);
      if (i < pks.length - 1) await sleep(1000);
    }

    const file = {
      source: 'mantisx',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      range: { from: from.toISOString(), to: to.toISOString() },
      sessions: sessions
    };
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mantisx-' + fromInput + '_' + toInput + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    status(sessions.length + ' sesiones exportadas.');
    setTimeout(() => box.remove(), 5000);
  } catch (err) {
    status('error: ' + err.message);
    console.error('[Range Book]', err);
  }
})();
