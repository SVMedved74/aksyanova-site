/* Дневник между сессиями.
   Всё хранится в localStorage этого браузера, на сервер ничего не уходит.
   Формат: { v: 1, entries: { "ГГГГ-ММ-ДД": { mood, energy, tension, feelings: [], note, topic, demo? } }, lastSession } */
(function () {
  'use strict';

  var KEY = 'aksyanova-dnevnik-v1';
  var TG_URL = 'https://t.me/Elenaross8';
  var WA_URL = 'https://wa.me/79104343523';
  var FEELINGS = ['спокойствие', 'радость', 'интерес', 'надежда', 'благодарность', 'усталость',
    'тревога', 'раздражение', 'грусть', 'обида', 'растерянность', 'злость'];
  var METRICS = [
    { key: 'mood', label: 'Настроение' },
    { key: 'energy', label: 'Силы' },
    { key: 'tension', label: 'Напряжение' }
  ];
  var LIST_STEP = 10;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Хранилище ---------- */

  var canStore = true;
  var state = load();

  function load() {
    var empty = { v: 1, entries: {}, lastSession: '' };
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return empty;
      var data = JSON.parse(raw);
      if (!data || typeof data.entries !== 'object') return empty;
      data.lastSession = data.lastSession || '';
      return data;
    } catch (e) {
      canStore = false;
      return empty;
    }
  }

  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      canStore = true;
    } catch (e) {
      canStore = false;
    }
    $('storage-warning').hidden = canStore;
  }

  /* ---------- Даты (местное время, без UTC-сдвигов) ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(k, n) { var d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); }
  function today() { return toKey(new Date()); }
  function short(k) { var p = k.split('-'); return p[2] + '.' + p[1]; }

  var WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа',
    'сентября', 'октября', 'ноября', 'декабря'];
  function long(k) {
    var d = fromKey(k);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + WEEKDAYS[d.getDay()];
  }

  function sortedKeys() { return Object.keys(state.entries).sort(); }
  function between(from, to) { return sortedKeys().filter(function (k) { return k >= from && k <= to; }); }

  function avg(keys, metric) {
    if (!keys.length) return null;
    var s = 0;
    keys.forEach(function (k) { s += state.entries[k][metric]; });
    return s / keys.length;
  }
  function fmt(n) { return n.toFixed(1).replace('.', ','); }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  /* ---------- Форма записи ---------- */

  var form = $('entry-form');
  var dateInput = $('entry-date');
  var ranges = {};
  METRICS.forEach(function (m) {
    ranges[m.key] = $('f-' + m.key);
    ranges[m.key].addEventListener('input', function () { paintRange(m.key); });
  });

  function paintRange(key) {
    var el = ranges[key];
    $('out-' + key).textContent = el.value;
    el.style.setProperty('--fill', ((el.value - 1) / 9 * 100) + '%');
    el.setAttribute('aria-valuetext', el.value + ' из 10');
  }

  var chipsBox = $('feelings');
  FEELINGS.forEach(function (f) {
    var label = document.createElement('label');
    label.className = 'chip';
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'feeling';
    input.value = f;
    var span = document.createElement('span');
    span.textContent = f;
    label.appendChild(input);
    label.appendChild(span);
    chipsBox.appendChild(label);
  });

  function fillForm(key) {
    var e = state.entries[key];
    METRICS.forEach(function (m) {
      ranges[m.key].value = e ? e[m.key] : 5;
      paintRange(m.key);
    });
    chipsBox.querySelectorAll('input').forEach(function (i) {
      i.checked = !!(e && e.feelings.indexOf(i.value) !== -1);
    });
    $('f-note').value = e ? e.note : '';
    $('f-topic').value = e ? e.topic : '';
    $('delete-btn').hidden = !e;
    $('save-btn').textContent = e ? 'Сохранить изменения' : 'Сохранить запись';
    status('entry-status', e && !e.demo ? 'Запись за ' + long(key) + ' уже есть — можно поправить.' : '');
  }

  dateInput.max = today();
  dateInput.value = today();
  dateInput.addEventListener('change', function () {
    if (!dateInput.value) return;
    if (dateInput.value > today()) dateInput.value = today();
    fillForm(dateInput.value);
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var key = dateInput.value || today();
    var hadDemo = clearDemo();
    state.entries[key] = {
      mood: +ranges.mood.value,
      energy: +ranges.energy.value,
      tension: +ranges.tension.value,
      feelings: Array.prototype.map.call(chipsBox.querySelectorAll('input:checked'), function (i) { return i.value; }),
      note: $('f-note').value.trim(),
      topic: $('f-topic').value.trim()
    };
    save();
    renderAll();
    $('delete-btn').hidden = false;
    $('save-btn').textContent = 'Сохранить изменения';
    status('entry-status', (hadDemo ? 'Пример убрала. ' : '') + 'Сохранено: ' + long(key) + '.');
  });

  $('delete-btn').addEventListener('click', function () {
    var key = dateInput.value;
    if (!state.entries[key]) return;
    if (!window.confirm('Удалить запись за ' + long(key) + '?')) return;
    delete state.entries[key];
    save();
    fillForm(key);
    renderAll();
    status('entry-status', 'Запись удалена.');
  });

  function status(id, text) { $(id).textContent = text; }

  /* ---------- Пример ---------- */

  function hasDemo() {
    return sortedKeys().some(function (k) { return state.entries[k].demo; });
  }
  function clearDemo() {
    var had = false;
    sortedKeys().forEach(function (k) {
      if (state.entries[k].demo) { delete state.entries[k]; had = true; }
    });
    return had;
  }

  $('demo-btn').addEventListener('click', function () {
    var notes = [
      ['Поговорила с братом про маму, опять на повышенных.', 'Как начать разговор с братом, чтобы не скатиться в упрёки'],
      ['', ''], ['Хорошо спала, сделала зарядку.', ''],
      ['Совещание: снова не сказала, что не согласна.', 'Почему молчу на совещаниях'],
      ['', ''], ['Выходной, гуляли с детьми.', ''],
      ['Брат сам позвонил, поговорили спокойнее.', ''], ['', ''],
      ['Много работы, к вечеру без сил.', ''], ['Сказала руководителю про сроки — и ничего страшного.', 'Хочу закрепить: как говорить «нет» без чувства вины'],
      ['', ''], ['', ''], ['Договорились с братом встретиться втроём.', ''], ['Спокойный день.', '']
    ];
    var feel = [['тревога', 'обида'], ['усталость'], ['спокойствие'], ['раздражение', 'тревога'], ['усталость', 'грусть'],
      ['радость', 'спокойствие'], ['надежда'], ['интерес'], ['усталость'], ['интерес', 'радость'],
      ['спокойствие'], ['тревога'], ['надежда', 'благодарность'], ['спокойствие']];
    var mood = [3, 4, 6, 4, 4, 7, 6, 6, 4, 7, 6, 5, 8, 7];
    var energy = [4, 3, 6, 5, 3, 7, 6, 6, 3, 6, 6, 5, 7, 7];
    var tension = [8, 6, 4, 7, 6, 3, 4, 4, 6, 4, 3, 5, 3, 3];
    var start = addDays(today(), -14);
    for (var i = 0; i < 14; i++) {
      var k = addDays(start, i);
      if (state.entries[k]) continue;
      state.entries[k] = { mood: mood[i], energy: energy[i], tension: tension[i], feelings: feel[i],
        note: notes[i][0], topic: notes[i][1], demo: true };
    }
    if (!state.lastSession) state.lastSession = addDays(start, -1);
    save();
    renderAll();
  });

  /* ---------- График ---------- */

  var rangeDays = 14;
  document.querySelectorAll('[data-range]').forEach(function (b) {
    b.addEventListener('click', function () {
      rangeDays = +b.getAttribute('data-range');
      document.querySelectorAll('[data-range]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      renderChart();
    });
  });

  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, text) {
    var n = document.createElementNS(SVGNS, name);
    for (var a in attrs) n.setAttribute(a, attrs[a]);
    if (text != null) n.textContent = text;
    return n;
  }

  function renderChart() {
    var end = today();
    var start = addDays(end, -(rangeDays - 1));
    var keys = between(start, end);
    var enough = keys.length >= 2;

    $('chart-empty').hidden = enough;
    $('chart-wrap').hidden = !enough;
    renderDemoNote();
    if (!enough) return;

    var W = 600, H = 220, L = 26, R = 8, T = 8, B = 26;
    var x = function (k) {
      var i = Math.round((fromKey(k) - fromKey(start)) / 864e5);
      return L + (W - L - R) * i / (rangeDays - 1);
    };
    var y = function (v) { return T + (H - T - B) * (10 - v) / 9; };

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    var desc = METRICS.map(function (m) { return m.label + ' в среднем ' + fmt(avg(keys, m.key)); }).join(', ');
    svg.appendChild(el('title', {}, 'График за ' + rangeDays + ' дней: ' + desc));

    [1, 5, 10].forEach(function (v) {
      svg.appendChild(el('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      svg.appendChild(el('text', { class: 'axis', x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }, v));
    });
    var mid = addDays(start, Math.floor((rangeDays - 1) / 2));
    [[start, 'start'], [mid, 'middle'], [end, 'end']].forEach(function (p) {
      svg.appendChild(el('text', { class: 'axis', x: x(p[0]), y: H - 6, 'text-anchor': p[1] }, short(p[0])));
    });

    var r = rangeDays > 30 ? 2.5 : 3.5;
    METRICS.forEach(function (m) {
      var d = keys.map(function (k, i) { return (i ? 'L' : 'M') + x(k).toFixed(1) + ' ' + y(state.entries[k][m.key]).toFixed(1); }).join(' ');
      svg.appendChild(el('path', { class: 'line line--' + m.key, d: d }));
      keys.forEach(function (k) {
        svg.appendChild(el('circle', { class: 'dot dot--' + m.key, cx: x(k), cy: y(state.entries[k][m.key]), r: r }));
      });
    });

    var box = $('chart');
    box.textContent = '';
    box.appendChild(svg);

    var prev = between(addDays(start, -rangeDays), addDays(start, -1));
    var dl = $('averages');
    dl.textContent = '';
    METRICS.forEach(function (m) {
      var wrap = document.createElement('div');
      wrap.className = 'avg--' + m.key;
      var dt = document.createElement('dt');
      dt.textContent = m.label;
      var dd = document.createElement('dd');
      var a = avg(keys, m.key);
      dd.textContent = fmt(a);
      var delta = document.createElement('span');
      delta.className = 'delta';
      if (prev.length) {
        var diff = a - avg(prev, m.key);
        delta.textContent = Math.abs(diff) < 0.3 ? 'как раньше' : (diff > 0 ? '↑ ' : '↓ ') + fmt(Math.abs(diff)) + ' к прошлому';
      } else {
        delta.textContent = 'в среднем';
      }
      dd.appendChild(delta);
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      dl.appendChild(wrap);
    });
  }

  function renderDemoNote() {
    var note = $('demo-note');
    if (!hasDemo()) { if (note) note.remove(); return; }
    if (note) return;
    note = document.createElement('div');
    note.id = 'demo-note';
    note.className = 'storage-warning';
    note.innerHTML = 'Это пример за две недели. Ваша первая запись его заменит. ';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn--quiet btn--sm';
    b.textContent = 'Убрать пример';
    b.addEventListener('click', function () {
      clearDemo();
      save();
      fillForm(dateInput.value);
      renderAll();
    });
    note.appendChild(b);
    $('chart-wrap').parentNode.insertBefore(note, $('chart-wrap'));
  }

  /* ---------- Сводка к сессии ---------- */

  var lastInput = $('last-session');
  var summary = $('summary-text');
  var summaryEdited = false;
  lastInput.max = today();

  lastInput.addEventListener('change', function () {
    state.lastSession = lastInput.value;
    save();
    summaryEdited = false;
    renderSummary();
  });
  summary.addEventListener('input', function () { summaryEdited = true; });

  function buildSummary() {
    var end = today();
    var from = state.lastSession ? addDays(state.lastSession, 1) : addDays(end, -6);
    var keys = between(from, end);
    var days = Math.round((fromKey(end) - fromKey(from)) / 864e5) + 1;
    var out = [];

    out.push('Елена, здравствуйте! Сводка из дневника ' +
      (state.lastSession ? 'с прошлой сессии (' + short(state.lastSession) + ')' : 'за неделю') + '.');
    if (!keys.length) {
      out.push('', 'За эти дни записей нет.');
      return out.join('\n');
    }
    out.push('Записи за ' + keys.length + ' ' + plural(keys.length, 'день', 'дня', 'дней') + ' из ' + days + '.', '');

    METRICS.forEach(function (m) {
      var line = m.label + ': в среднем ' + fmt(avg(keys, m.key)) + ' из 10';
      if (keys.length >= 4) {
        var half = Math.floor(keys.length / 2);
        var diff = avg(keys.slice(half), m.key) - avg(keys.slice(0, half), m.key);
        if (Math.abs(diff) >= 1) line += (diff > 0 ? ', к концу выросло' : ', к концу снизилось');
        else line += ', без больших перемен';
      }
      out.push(line);
    });

    var count = {};
    keys.forEach(function (k) {
      state.entries[k].feelings.forEach(function (f) { count[f] = (count[f] || 0) + 1; });
    });
    var top = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).slice(0, 4);
    if (top.length) out.push('', 'Чаще всего: ' + top.map(function (f) { return f + ' (' + count[f] + ')'; }).join(', ') + '.');

    if (keys.length >= 3) {
      var score = function (k) { var e = state.entries[k]; return e.mood + e.energy - e.tension; };
      var worst = keys.reduce(function (a, b) { return score(b) < score(a) ? b : a; });
      var best = keys.reduce(function (a, b) { return score(b) > score(a) ? b : a; });
      out.push('', 'Труднее всего: ' + dayLine(worst));
      if (best !== worst) out.push('Лучше всего: ' + dayLine(best));
    }

    var notes = keys.filter(function (k) { return state.entries[k].note; });
    if (notes.length) {
      out.push('', 'Что было важным:');
      notes.forEach(function (k) { out.push('— ' + short(k) + ': ' + state.entries[k].note); });
    }

    var topics = keys.filter(function (k) { return state.entries[k].topic; });
    if (topics.length) {
      out.push('', 'Хочу обсудить:');
      topics.forEach(function (k) { out.push('— ' + state.entries[k].topic); });
    }
    return out.join('\n');
  }

  function dayLine(k) {
    var e = state.entries[k];
    return short(k) + ' (настроение ' + e.mood + ', силы ' + e.energy + ', напряжение ' + e.tension + ')';
  }

  function renderSummary() {
    lastInput.value = state.lastSession || '';
    if (!summaryEdited) summary.value = buildSummary();
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(); });
    }
    return Promise.resolve(legacyCopy());
  }
  function legacyCopy() {
    summary.select();
    try { return document.execCommand('copy'); } catch (e) { return false; }
  }

  $('copy-btn').addEventListener('click', function () {
    copyText(summary.value).then(function (ok) {
      status('summary-status', ok ? 'Скопировано. Вставьте в сообщение Елене.' : 'Не получилось скопировать — выделите текст и скопируйте вручную.');
    });
  });

  $('send-tg').addEventListener('click', function () {
    // Окно открываем сразу, пока жест пользователя «свежий», иначе браузер заблокирует
    var win = window.open(TG_URL, '_blank');
    if (win) win.opener = null;
    copyText(summary.value).then(function (ok) {
      status('summary-status', ok
        ? 'Текст скопирован. В Telegram откройте чат с Еленой и вставьте его.'
        : 'Не получилось скопировать — выделите текст и скопируйте вручную.');
      if (!win) window.location.href = TG_URL;
    });
  });

  $('send-wa').addEventListener('click', function () {
    this.href = WA_URL + '?text=' + encodeURIComponent(summary.value);
  });

  /* ---------- Список записей ---------- */

  var shown = LIST_STEP;

  function renderList() {
    var keys = sortedKeys().reverse();
    var ol = $('entries');
    ol.textContent = '';
    $('entries-empty').hidden = keys.length > 0;
    $('count').textContent = keys.length ? '· ' + keys.length : '';

    keys.slice(0, shown).forEach(function (k) {
      var e = state.entries[k];
      var li = document.createElement('li');
      li.className = 'entry';

      var top = document.createElement('div');
      top.className = 'entry__top';
      var date = document.createElement('span');
      date.className = 'entry__date';
      date.textContent = long(k) + (e.demo ? ' · пример' : '');
      var nums = document.createElement('span');
      nums.className = 'entry__nums';
      nums.innerHTML = '<span class="n-mood">настр. <b>' + e.mood + '</b></span>' +
        '<span class="n-energy">силы <b>' + e.energy + '</b></span>' +
        '<span class="n-tension">напр. <b>' + e.tension + '</b></span>';
      top.appendChild(date);
      top.appendChild(nums);
      li.appendChild(top);

      [['entry__feel', e.feelings.join(', ')], ['entry__note', e.note], ['entry__topic', e.topic]].forEach(function (p) {
        if (!p[1]) return;
        var d = document.createElement('p');
        d.className = p[0];
        d.textContent = p[1];
        li.appendChild(d);
      });

      var edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'entry__edit';
      edit.textContent = 'Изменить';
      edit.addEventListener('click', function () {
        dateInput.value = k;
        fillForm(k);
        $('entry-title').scrollIntoView({ block: 'start' });
        ranges.mood.focus({ preventScroll: true });
      });
      li.appendChild(edit);
      ol.appendChild(li);
    });

    var more = $('entries-more');
    if (more) more.remove();
    if (keys.length > shown) {
      more = document.createElement('button');
      more.type = 'button';
      more.id = 'entries-more';
      more.className = 'btn btn--ghost btn--sm entries-more';
      more.textContent = 'Показать ещё (' + (keys.length - shown) + ')';
      more.addEventListener('click', function () { shown += LIST_STEP; renderList(); });
      ol.parentNode.insertBefore(more, $('entries-empty'));
    }
  }

  /* ---------- Копия, перенос, удаление ---------- */

  $('export-btn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dnevnik-' + today() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    status('tools-status', 'Файл скачан. Храните его там, где его никто не увидит.');
  });

  $('import-input').addEventListener('change', function () {
    var file = this.files && this.files[0];
    var input = this;
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || typeof data.entries !== 'object') throw new Error('format');
        var added = 0;
        Object.keys(data.entries).forEach(function (k) {
          var e = data.entries[k];
          if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !e || typeof e.mood !== 'number') return;
          state.entries[k] = {
            mood: clamp(e.mood), energy: clamp(e.energy), tension: clamp(e.tension),
            feelings: Array.isArray(e.feelings) ? e.feelings.filter(function (f) { return FEELINGS.indexOf(f) !== -1; }) : [],
            note: String(e.note || ''), topic: String(e.topic || '')
          };
          added++;
        });
        if (data.lastSession && (!state.lastSession || data.lastSession > state.lastSession)) state.lastSession = data.lastSession;
        save();
        fillForm(dateInput.value);
        renderAll();
        status('tools-status', 'Загружено записей: ' + added + '.');
      } catch (e) {
        status('tools-status', 'Это не файл дневника. Нужен файл, скачанный кнопкой «Скачать копию».');
      }
      input.value = '';
    };
    reader.readAsText(file);
  });

  function clamp(v) { v = Math.round(+v) || 5; return Math.min(10, Math.max(1, v)); }

  $('wipe-btn').addEventListener('click', function () {
    if (!sortedKeys().length) { status('tools-status', 'Записей и так нет.'); return; }
    if (!window.confirm('Удалить все записи дневника из этого браузера? Вернуть их можно будет только из скачанной копии.')) return;
    state = { v: 1, entries: {}, lastSession: '' };
    save();
    fillForm(dateInput.value);
    renderAll();
    status('tools-status', 'Все записи удалены.');
  });

  /* ---------- Старт ---------- */

  function renderAll() {
    renderChart();
    renderSummary();
    renderList();
  }

  // Проверяем, можно ли вообще писать в хранилище (инкогнито, запреты)
  try {
    window.localStorage.setItem(KEY + '-test', '1');
    window.localStorage.removeItem(KEY + '-test');
  } catch (e) { canStore = false; }
  $('storage-warning').hidden = canStore;

  fillForm(dateInput.value);
  renderAll();
})();
