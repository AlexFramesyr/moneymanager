/*
 * Money Buddy – screens and buttons.
 * Plain JavaScript, no framework. Each screen is a function that returns:
 *   { title, html, speak, actions, back, focus, alertText, keypad, mount }
 * All words come from copy.js. All money math comes from logic.js.
 */
(function () {
  'use strict';

  var L = window.MBLogic;
  var Store = window.MBStorage;
  var Voice = window.MBSpeech;
  var COPY = window.MB_COPY;

  var TEXT = {};
  COPY.sections.forEach(function (s) { Object.assign(TEXT, s.items); });
  var I = COPY.icons;
  Voice.setCuseSaying(TEXT.sayCuse);

  var main = document.getElementById('screen');
  var readBtn = document.getElementById('read-btn');
  var srPolite = document.getElementById('sr-polite');
  var srAlert = document.getElementById('sr-alert');
  var undoBar = document.getElementById('undo-bar');
  var undoBtn = document.getElementById('undo-btn');
  var undoWhat = document.getElementById('undo-what');

  var SOURCES = L.SOURCES;
  var UNDO_MS = 5000; // keep in step with undo-shrink in styles.css

  var TILES = [
    { key: 'savings', text: 'tileSavings', icon: I.pig },
    { key: 'concert', text: 'tileConcert', icon: I.concert },
    { key: 'laundry', text: 'tileLaundry', icon: I.laundry },
    { key: 'gift', text: 'tileGift', icon: I.gift },
    { key: 'food', text: 'tileFood', icon: I.food },
    { key: 'bus', text: 'tileBus', icon: I.bus },
    { key: 'clothes', text: 'tileClothes', icon: I.clothes },
    { key: 'phone', text: 'tilePhone', icon: I.phone },
    { key: 'other', text: 'tileOther', icon: I.other }
  ];

  var OTHER_ICONS = [
    { icon: I.oGift, text: 'otherIconGift' }, { icon: I.oGame, text: 'otherIconGame' },
    { icon: I.oMovie, text: 'otherIconMovie' }, { icon: I.oHair, text: 'otherIconHair' },
    { icon: I.oDoctor, text: 'otherIconDoctor' }, { icon: I.oPet, text: 'otherIconPet' },
    { icon: I.oSchool, text: 'otherIconSchool' }, { icon: I.oHome, text: 'otherIconHome' },
    { icon: I.oCar, text: 'otherIconCar' }, { icon: I.oTrip, text: 'otherIconTrip' },
    { icon: I.oMusic, text: 'otherIconMusic' }, { icon: I.oStar, text: 'otherIconStar' }
  ];

  var CATEGORIES = [
    { key: 'food', text: 'catFood', icon: I.catFood },
    { key: 'fun', text: 'catFun', icon: I.catFun },
    { key: 'clothes', text: 'catClothes', icon: I.catClothes },
    { key: 'stuff', text: 'catStuff', icon: I.catStuff },
    { key: 'travel', text: 'catTravel', icon: I.catTravel },
    { key: 'other', text: 'catOther', icon: I.catOther }
  ];

  var state = null;     // the saved plan
  var current = null;   // the screen on show
  var storageOK = true;
  var reading = false;
  var guard = false;    // extra history entry so the phone's Back button stays in the app
  var ignorePop = false;
  var ui = { recap: null, buy: null, big: null, got: null, kp: null, seen: {}, undo: null, calAuto: null };

  // ---------- what day it is ----------

  // Testing only: on localhost, ?today=2026-10-25 pretends it is that day.
  var testDay = (function () {
    try {
      if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return null;
      var m = /[?&]today=(\d{4}-\d{2}-\d{2})(&|$)/.exec(location.search);
      return m && L.isDayKey(m[1]) ? m[1] : null;
    } catch (e) { return null; }
  })();

  /** Now – or, while testing, the test day at the current time of day. */
  function today() {
    var now = new Date();
    if (!testDay) return now;
    var d = L.parseDayKey(testDay);
    d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    return d;
  }
  function todayKey() { return L.dayKey(today()); }

  // ---------- small helpers ----------

  function t(key, vars) {
    var s = TEXT[key];
    if (s == null) {
      if (window.console) console.warn('Money Buddy: missing text "' + key + '"');
      return key;
    }
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ic(emoji, cls) {
    return '<span class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + emoji + '</span>';
  }

  var fmt = L.formatMoney;
  var words = L.moneyWords;
  function show(n) { return fmt(Math.max(0, n)); } // free money is never shown below $0

  function srcName(s) { return t(s === 'bank' ? 'bankName' : 'cuseName'); }
  function srcLower(s) { return t(s === 'bank' ? 'bankLower' : 'cuseLower'); }
  function srcIcon(s) { return s === 'bank' ? I.bank : I.cuse; }
  function catInfo(key) {
    return CATEGORIES.filter(function (c) { return c.key === key; })[0] || CATEGORIES[CATEGORIES.length - 1];
  }
  function nowISO() { return today().toISOString(); }

  /** Like t(), but for HTML: the words are escaped, and vars are put in as HTML. */
  function tHtml(key, vars) {
    var s = esc(t(key));
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; });
  }

  /** "🎟️ Concert" as HTML (the picture is hidden from screen readers). */
  function thingHtml(b) {
    return '<span class="keep">' + ic(b.icon) + '<span>' + esc(b.name) + '</span></span>';
  }

  function findBig(id) {
    return state.bigSpends.filter(function (b) { return b.id === id; })[0] || null;
  }

  /** "+$5" / "−$5" for a fix. */
  function signed(amount) {
    return (amount > 0 ? '+' : '') + fmt(amount);
  }
  function signedWords(amount) {
    return (amount > 0 ? t('plusWord') + ' ' : '') + words(amount);
  }

  /** Go back to a screen saved as { name, params }. */
  function goTo(where) {
    if (where && SCREENS[where.name]) go(where.name, where.params || {});
    else go('home');
  }

  function speakJoin(parts) {
    return parts.filter(Boolean).map(function (p) {
      p = String(p).trim();
      return /[.!?:]$/.test(p) ? p : p + '.';
    }).join(' ');
  }

  function save() {
    storageOK = Store.save(state);
  }

  function announce(text, urgent) {
    var el = urgent ? srAlert : srPolite;
    el.textContent = '';
    setTimeout(function () { el.textContent = text; }, 80);
  }

  // ---------- building blocks ----------

  function h1(text, emoji) {
    return '<h1 tabindex="-1">' + (emoji ? ic(emoji, 'ic-title') : '') + '<span>' + esc(text) + '</span></h1>';
  }

  function button(act, label, emoji, o) {
    o = o || {};
    var attrs = ' data-act="' + act + '"';
    if (o.data) Object.keys(o.data).forEach(function (k) { attrs += ' data-' + k + '="' + esc(o.data[k]) + '"'; });
    if (o.aria) attrs += ' aria-label="' + esc(o.aria) + '"';
    if (o.disabled) attrs += ' aria-disabled="true"';
    if (o.id) attrs += ' id="' + o.id + '"';
    return '<button type="button" class="btn ' + (o.cls || 'btn-primary') + '"' + attrs + '>' +
      (emoji ? ic(emoji) : '') + '<span class="btn-text">' + esc(label) + '</span></button>';
  }

  function backBtn() { return button('back', t('back'), I.back, { cls: 'btn-back' }); }
  function homeBtn() { return button('home', t('goHome'), I.home); }
  function actions(inner, cls) { return '<div class="actions' + (cls ? ' ' + cls : '') + '">' + inner + '</div>'; }

  function progress(n) {
    var total = 3;
    return '<div class="progress"><p class="progress-text">' + esc(t('stepOf', { n: n, total: total })) + '</p>' +
      '<div class="progress-bar" aria-hidden="true"><span style="width:' + (n / total * 100) + '%"></span></div></div>';
  }

  /**
   * Icon, name, amount, source and day for a big thing.
   * Uses only <span>s so it can also sit inside a button.
   */
  function itemBody(b) {
    return '<span class="item">' + ic(b.icon, 'item-ic') +
      '<span class="item-main"><span class="item-name">' + esc(b.name) + ' <strong>' + fmt(b.amount) + '</strong></span>' +
      '<span class="item-meta">' + ic(srcIcon(b.source)) + '<span>' + esc(srcName(b.source)) + '</span></span>' +
      (b.date ? '<span class="item-meta">' + ic(I.calendar) + '<span aria-hidden="true">' + esc(L.formatShortDate(b.date)) + '</span>' +
        '<span class="sr-only">' + esc(L.formatLongDate(b.date)) + '</span></span>' : '') +
      '</span></span>';
  }

  /**
   * A big spend card on Home or a day screen. The top part is one big button
   * that opens "Change this big thing"; "I paid it" is a separate button
   * (never inside the first one).
   */
  function bigCard(b, from) {
    return '<li class="card item-card big-card' + (b.paid ? ' is-paid' : '') + '">' +
      '<button type="button" class="item-btn" data-act="editBig" data-id="' + esc(b.id) + '" data-from="' + esc(from) + '">' +
      itemBody(b) + '<span class="edit-hint">' + ic(I.pencil) + '<span>' + esc(t('change')) + '</span></span></button>' +
      (b.savings ? '' : b.paid
        ? '<p class="paid-tag">' + ic(I.check) + '<span>' + esc(t('paidDone')) + '</span></p>'
        : button('paid', t('paidIt'), I.check, { cls: 'btn-small btn-secondary', data: { id: b.id, from: from }, aria: t('paidItLabel', { name: b.name, amount: words(b.amount) }) })) +
      '</li>';
  }

  /** Words a screen reader and "Read to me" say for one big spend. */
  function bigSpoken(b) {
    return b.name + ', ' + words(b.amount) + ', ' + srcLower(b.source) + (b.paid ? ', ' + t('paidDone') : '');
  }

  // Where "from" (a short code kept on buttons) sends you back to.
  function fromWhere(code) {
    if (code && code.indexOf('day:') === 0) return { name: 'day', params: { key: code.slice(4) } };
    if (code === 'calendar') return { name: 'calendar' };
    return { name: 'home' };
  }

  function chip(emoji, text) {
    return '<p class="chip">' + (emoji ? ic(emoji) : '') + '<span>' + esc(text) + '</span></p>';
  }

  function sourceChoice(src, sub, aria) {
    return '<button type="button" class="choice choice-' + src + '" data-act="src" data-src="' + src + '"' +
      (aria ? ' aria-label="' + esc(aria) + '"' : '') + '>' + ic(srcIcon(src), 'choice-ic') +
      '<span class="choice-text"><span class="choice-name">' + esc(srcName(src)) + '</span>' +
      (sub ? '<span class="choice-sub">' + esc(sub) + '</span>' : '') + '</span></button>';
  }

  function row(emoji, label, value, sub, strong) {
    return '<div class="row' + (strong ? ' row-strong' : '') + '">' + ic(emoji, 'row-ic') +
      '<span class="row-label">' + esc(label) + (sub ? '<span class="row-sub">' + esc(sub) + '</span>' : '') + '</span>' +
      '<span class="row-value">' + value + '</span></div>';
  }

  // ---------- screen changes ----------

  function go(name, params) {
    params = params || {};
    stopReading();
    srPolite.textContent = '';
    srAlert.textContent = '';
    var def = SCREENS[name](params);
    current = Object.assign({ name: name, params: params, actions: {} }, def);
    if (current.back && !current.actions.back) current.actions.back = current.back;
    if (!current.actions.home) current.actions.home = function () { go('home'); };

    main.className = 'screen screen-' + name;
    main.innerHTML = def.html;
    document.title = def.title ? def.title + ' – ' + t('appName') : t('appName');
    window.scrollTo(0, 0);

    var target = (def.focus && main.querySelector(def.focus)) || main.querySelector('h1');
    if (target) target.focus();
    if (def.mount) def.mount();

    if (def.alertText) {
      announce(typeof def.alertText === 'function' ? def.alertText() : def.alertText, true);
      if (state.settings.autoRead !== false) readScreen();
    }
    updateGuard();
  }

  // ---------- "Oops! Undo" ----------
  // The bar shows for 5 seconds each time it pops up, then goes away.
  // "❌ Remove" in "What I bought" is always there as a backup.

  var undoTimer = null;

  /** u: an undo note from logic.js. what: words saying what will be undone. */
  function offerUndo(u, what, said) {
    ui.undo = { u: u };
    undoWhat.textContent = what;
    undoBar.hidden = false;
    document.body.classList.add('has-undo');
    startUndoTimer();
    announce(speakJoin([said, what, t('undoReady')]), false);
  }

  /** Starts the 5 seconds from the beginning. */
  function startUndoTimer() {
    clearTimeout(undoTimer);
    undoBar.classList.remove('is-ticking');
    void undoBar.offsetWidth; // restart the shrinking line
    undoBar.classList.add('is-ticking');
    undoTimer = setTimeout(hideUndo, UNDO_MS);
  }

  function hideUndo() {
    clearTimeout(undoTimer);
    var hadFocus = undoBar.contains(document.activeElement);
    ui.undo = null;
    undoBar.hidden = true;
    undoBar.classList.remove('is-ticking');
    document.body.classList.remove('has-undo');
    if (hadFocus) {
      var h = main.querySelector('h1');
      if (h) h.focus();
    }
  }

  undoBtn.addEventListener('click', function () {
    if (!ui.undo) return;
    state = L.undo(state, ui.undo.u);
    save();
    hideUndo();
    // Lists can show the change right away; other screens may now be out of date.
    var stay = current && ['home', 'list', 'calendar', 'day', 'settings'].indexOf(current.name) !== -1;
    if (stay) go(current.name, current.params);
    else go('home');
    announce(t('undoDone'), false);
  });

  function updateGuard() {
    try {
      if (current.back && !guard) {
        history.pushState({ moneyBuddy: true }, '');
        guard = true;
      } else if (!current.back && guard) {
        guard = false;
        ignorePop = true;
        history.back();
      }
    } catch (e) { /* history not available */ }
  }

  window.addEventListener('popstate', function () {
    if (ignorePop) { ignorePop = false; return; }
    guard = false;
    if (current && current.back) current.back();
  });

  main.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el || !current) return;
    var fn = current.actions[el.getAttribute('data-act')];
    if (fn) fn(el.dataset, el);
  });

  // ---------- read to me ----------

  function setReading(on) {
    reading = on;
    readBtn.querySelector('.ic').textContent = on ? I.stop : I.read;
    readBtn.querySelector('.read-label').textContent = on ? t('stopReading') : t('readToMe');
  }

  function readScreen() {
    if (!Voice.supported || !current) return;
    var text = typeof current.speak === 'function' ? current.speak() : current.speak;
    if (Voice.speak(text, { onEnd: function () { setReading(false); } })) setReading(true);
  }

  function stopReading() {
    Voice.stop();
    if (reading) setReading(false);
  }

  readBtn.addEventListener('click', function () {
    if (reading) stopReading();
    else readScreen();
  });

  // ---------- keypad ----------

  var KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

  function keyLabel(k) {
    if (k === 'back') return t('keyDelete');
    if (k === '.') return t('keyPoint');
    return k;
  }

  function withCommas(text) {
    var parts = text.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  function amountInner(text) {
    var empty = !text;
    var spoken = empty ? t('keypadEmpty') : words(L.keypadValue(text));
    return '<span class="sr-only">' + esc(t('amountLabel', { amount: spoken })) + '</span>' +
      '<span class="amount-visual' + (empty ? ' is-empty' : '') + '" aria-hidden="true">$' +
      (empty ? '0' : esc(withCommas(text))) + '</span>';
  }

  function kpValid(text, allowZero) {
    var v = L.keypadValue(text);
    return !isNaN(v) && (allowZero ? v >= 0 : v > 0);
  }

  /**
   * A screen with the big number pad.
   * o: { title, icon, step, afterTitle, speakExtra[], allowZero, initial,
   *      nextLabel, nextIcon, validate(value) -> message|null, onNext(value), onBack }
   */
  function keypadScreen(o) {
    var text = o.initial || '';
    ui.kp = { text: text, o: o };
    var valid = kpValid(text, o.allowZero);
    var hint = o.allowZero ? t('typeNumberOrZero') : t('typeNumber');

    var html = (o.step ? progress(o.step) : '') + h1(o.title, o.icon) + (o.afterTitle || '') +
      '<div class="amount-box"><p class="amount" id="kp-amount">' + amountInner(text) + '</p></div>' +
      '<div class="keypad" role="group" aria-label="' + esc(t('keypadLabel')) + '">' +
      KEYS.map(function (k) {
        return '<button type="button" class="key' + (k === 'back' ? ' key-back' : '') + '" data-act="key" data-key="' + k +
          '" aria-label="' + esc(keyLabel(k)) + '">' + (k === 'back' ? ic(I.backspace) : '<span aria-hidden="true">' + k + '</span>') + '</button>';
      }).join('') + '</div>' +
      '<p id="kp-hint" class="kp-hint"' + (valid ? ' hidden' : '') + '>' + esc(hint) + '</p>' +
      '<div id="kp-error" class="msg msg-error" hidden></div>' +
      actions(button('next', o.nextLabel || t('next'), o.nextIcon || I.next, { id: 'kp-next', disabled: !valid }) + (o.onBack ? backBtn() : ''));

    return {
      title: o.title,
      html: html,
      keypad: true,
      back: o.onBack,
      speak: function () {
        return speakJoin([o.title].concat(o.speakExtra || [])
          .concat(ui.kp.text ? [fmt(L.keypadValue(ui.kp.text))] : [hint]));
      },
      actions: {
        key: function (d) { kpPress(d.key); },
        next: kpNext
      }
    };
  }

  function kpPress(key) {
    var kp = ui.kp;
    kp.text = L.pressKey(kp.text, key);
    var valid = kpValid(kp.text, kp.o.allowZero);
    document.getElementById('kp-amount').innerHTML = amountInner(kp.text);
    var next = document.getElementById('kp-next');
    if (valid) next.removeAttribute('aria-disabled'); else next.setAttribute('aria-disabled', 'true');
    document.getElementById('kp-hint').hidden = valid;
    document.getElementById('kp-error').hidden = true;
    announce(t('keypadSays', {
      key: keyLabel(key),
      amount: kp.text ? words(L.keypadValue(kp.text)) : t('keypadEmpty')
    }), false);
  }

  function kpNext() {
    var kp = ui.kp;
    var v = L.keypadValue(kp.text);
    if (!kpValid(kp.text, kp.o.allowZero)) {
      var hintEl = document.getElementById('kp-hint');
      hintEl.hidden = false;
      announce(hintEl.textContent, true);
      return;
    }
    if (kp.o.validate) {
      var err = kp.o.validate(v);
      if (err) {
        var box = document.getElementById('kp-error');
        box.innerHTML = ic(I.warn) + '<span>' + esc(err) + '</span>';
        box.hidden = false;
        announce(err, true);
        return;
      }
    }
    kp.o.onNext(v);
  }

  // A real keyboard works too (helpful on a computer).
  document.addEventListener('keydown', function (e) {
    if (!current || !current.keypad || e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT') return;
    var key = null;
    if (/^[0-9]$/.test(e.key)) key = e.key;
    else if (e.key === '.' || e.key === 'Decimal') key = '.';
    else if (e.key === 'Backspace') key = 'back';
    else if (e.key === 'Enter' && tag !== 'BUTTON') { e.preventDefault(); kpNext(); return; }
    if (key) { e.preventDefault(); kpPress(key); }
  });

  /** What to show in the keypad when coming back to a step. */
  function initialFor(key, amount) {
    if (amount > 0) return L.amountToKeypad(amount);
    return ui.seen[key] ? '0' : '';
  }

  // ---------- calendar ----------
  // Every day is a real button, in date order, so VoiceOver and TalkBack
  // swipes go 1, 2, 3 … The weekday row and empty cells are hidden from them.
  // (role="grid" is not used: it needs arrow keys and works badly with swipes.)

  var MIN_CELL = 48; // px

  /** 'grid' or 'list': the student's choice, or what fits this phone. */
  function calView() {
    return state.settings.calendarView || ui.calAuto || 'grid';
  }

  /** Screen reader words for one day, e.g. "October 12. Concert, 60 dollars, bank money." */
  function dayLabel(key, items, o) {
    var parts = [L.formatMonthDayLong(key)];
    if (o.isToday) parts.push(t('calToday'));
    if (o.past) parts.push(t('calPast'));
    items.forEach(function (b) { parts.push(bigSpoken(b)); });
    if (!items.length && !o.past && o.mode === 'view') parts.push(t('calNothing'));
    return speakJoin(parts);
  }

  /**
   * The month as a 7-column grid.
   * mode 'view': every day opens its day screen.
   * mode 'pick': only today and later can be picked; past days are faded.
   */
  function calendarGrid(mode) {
    var g = L.monthGrid(state.month);
    var tk = todayKey();
    var html = '<div class="cal" id="cal">' +
      '<div class="cal-head" aria-hidden="true">' + t('calWeekdays').split(' ').map(function (w) {
        return '<span>' + esc(w) + '</span>';
      }).join('') + '</div><div class="cal-grid">';
    for (var i = 0; i < g.lead; i++) html += '<span class="cal-blank" aria-hidden="true"></span>';
    g.days.forEach(function (d) {
      var items = L.bigSpendsOn(state, d.key);
      var isToday = d.key === tk;
      var past = d.key < tk;
      var off = mode === 'pick' && past;
      html += '<button type="button" class="cal-day' + (isToday ? ' is-today' : '') + (past ? ' is-past' : '') +
        (off ? ' is-off' : '') + (items.length ? ' has-items' : '') + '" data-act="day" data-key="' + d.key + '"' +
        (off ? ' aria-disabled="true"' : '') +
        ' aria-label="' + esc(dayLabel(d.key, items, { isToday: isToday, past: off, mode: mode })) + '">' +
        '<span class="cal-num" aria-hidden="true">' + d.day + '</span>' +
        (items.length ? '<span class="cal-icons" aria-hidden="true">' + items.slice(0, 2).map(function (b) {
          return b.paid ? I.check : b.icon;
        }).join('') + (items.length > 2 ? '+' : '') + '</span>' : '') +
        (isToday ? '<span class="cal-today" aria-hidden="true">' + esc(t('calToday')) + '</span>' : '') +
        '</button>';
    });
    return html + '</div></div>';
  }

  /** Picking a day as a list: every day from today to the end of the month. */
  function pickList() {
    var tk = todayKey();
    return '<ul class="cards day-pick">' + L.monthGrid(state.month).days.filter(function (d) { return d.key >= tk; }).map(function (d) {
      var isToday = d.key === tk;
      return '<li>' + '<button type="button" class="btn btn-secondary btn-day' + (isToday ? ' is-today' : '') + '" data-act="day" data-key="' + d.key + '"' +
        ' aria-label="' + esc(speakJoin([L.formatLongDate(d.key)].concat(isToday ? [t('calToday')] : []))) + '">' +
        ic(I.calendar) + '<span class="btn-text">' + esc(L.formatShortDate(d.key)) + '</span>' +
        (isToday ? '<span class="today-tag">' + esc(t('calToday')) + '</span>' : '') + '</button></li>';
    }).join('') + '</ul>';
  }

  /** The "List" view of My calendar: only days that have big spends, as big cards. */
  function calendarList() {
    var tk = todayKey();
    var keys = [];
    state.bigSpends.forEach(function (b) { if (b.date && keys.indexOf(b.date) === -1) keys.push(b.date); });
    keys.sort();
    if (!keys.length) return '<p class="big-line">' + ic(I.calendar) + '<span>' + esc(t('calListEmpty')) + '</span></p>';
    return '<ul class="cards">' + keys.map(function (key) {
      var items = L.bigSpendsOn(state, key);
      var isToday = key === tk;
      return '<li><button type="button" class="card day-card' + (isToday ? ' is-today' : '') + '" data-act="day" data-key="' + key + '"' +
        ' aria-label="' + esc(dayLabel(key, items, { isToday: isToday, mode: 'view' })) + '">' +
        '<span class="day-card-date" aria-hidden="true">' + ic(I.calendar) + '<span>' + esc(L.formatShortDate(key)) + '</span>' +
        (isToday ? '<span class="today-tag">' + esc(t('calToday')) + '</span>' : '') + '</span>' +
        items.map(function (b) {
          return '<span class="day-card-item" aria-hidden="true">' + ic(b.paid ? I.check : b.icon) +
            '<span>' + esc(b.name) + ' <strong>' + fmt(b.amount) + '</strong></span></span>';
        }).join('') + '</button></li>';
    }).join('') + '</ul>';
  }

  /** "📅 Month / 📋 List" switch. */
  function viewToggle() {
    var v = calView();
    return '<div class="cal-toggle" role="group" aria-label="' + esc(t('calViewLabel')) + '">' +
      ['grid', 'list'].map(function (k) {
        return '<button type="button" class="btn btn-secondary btn-toggle" data-act="view" data-view="' + k + '" aria-pressed="' + (v === k) + '">' +
          ic(k === 'grid' ? I.calendar : I.list) + '<span class="btn-text">' + esc(t(k === 'grid' ? 'calMonth' : 'calList')) + '</span></button>';
      }).join('') + '</div>';
  }

  /**
   * After a grid is shown: if its days are under 48px (a small phone or big
   * text), switch to List – unless the student picked Month themselves.
   */
  function checkGridFits(rerender) {
    if (state.settings.calendarView || calView() !== 'grid') return;
    var cell = main.querySelector('.cal-day');
    if (!cell) return;
    var rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    if (cell.getBoundingClientRect().width < Math.max(MIN_CELL, 3 * rootPx)) {
      ui.calAuto = 'list';
      rerender();
    }
  }

  function setView(v, rerender) {
    state.settings.calendarView = v;
    save();
    rerender();
    var btn = main.querySelector('[data-act="view"][data-view="' + v + '"]');
    if (btn) btn.focus();
  }

  // ---------- the screens ----------

  var SCREENS = {

    // ----- new month -----
    // The first open of a new month: celebrate what was saved, then ask about new money.
    recap: function () {
      var r = ui.recap;
      var saved = r.savedTotal > 0;
      var line = saved ? t('recapSaved', { amount: fmt(r.savedTotal) }) : t('recapFresh');
      return {
        title: t('newMonthTitle'),
        html: '<div class="done">' + ic(saved ? I.party : I.sprout, 'ic-hero' + (saved ? ' pop' : '')) + h1(t('newMonthTitle')) +
          '<p class="big-line"><span>' + esc(line) + '</span></p>' +
          '<h2>' + esc(t('newMonthGot')) + '</h2></div>' +
          actions(button('got', t('newMonthYes'), I.cash) + button('skip', t('newMonthNo'), I.next, { cls: 'btn-secondary' })),
        speak: function () { return speakJoin([t('newMonthTitle'), line, t('newMonthGot')]); },
        actions: {
          got: function () { ui.recap = null; ui.got = {}; go('gotAmount'); },
          skip: function () { ui.recap = null; go('home'); }
        }
      };
    },

    // ----- setup -----
    welcome: function () {
      return {
        title: t('welcomeTitle'),
        html: '<div class="hero">' + ic(I.wave, 'ic-hero') + '</div>' + h1(t('welcomeTitle')) +
          '<p class="lead">' + esc(t('welcomeText')) + '</p>' + actions(button('start', t('start'), I.start)),
        speak: function () { return speakJoin([t('welcomeTitle'), t('welcomeText')]); },
        actions: { start: function () { go('setupBank'); } }
      };
    },

    setupBank: function () {
      return keypadScreen({
        step: 1, title: t('bankTitle'), icon: I.bank, allowZero: true,
        initial: initialFor('bankStart', state.sources.bank.start),
        onBack: function () { go('welcome'); },
        onNext: function (v) { state.sources.bank.start = v; ui.seen.bankStart = true; save(); go('setupCuse'); }
      });
    },

    setupCuse: function () {
      return keypadScreen({
        step: 2, title: t('cuseTitle'), icon: I.cuse, allowZero: true,
        initial: initialFor('cuseStart', state.sources.cuse.start),
        onBack: function () { go('setupBank'); },
        onNext: function (v) { state.sources.cuse.start = v; ui.seen.cuseStart = true; save(); go('summary'); }
      });
    },

    // ----- adding a big spend (from Home or a day screen) -----
    // Big things from last month come first, with "Keep", then the pictures.
    bigPick: function () {
      var b = ui.big;
      if (!b) return SCREENS.home();
      var sugg = state.suggestions || [];
      var html = h1(t('bigPickTitle')) + (b.presetDate ? chip(I.calendar, L.formatShortDate(b.presetDate)) : '');
      if (sugg.length) {
        html += '<h2>' + esc(t('bigLastMonth')) + '</h2><ul class="cards">' + sugg.map(function (s, i) {
          return '<li class="card item-card">' + itemBody(s) +
            button('keep', t('bigKeep'), I.plus, { cls: 'btn-small btn-secondary', data: { i: i }, aria: t('bigKeepLabel', { name: s.name, amount: words(s.amount) }) }) + '</li>';
        }).join('') + '</ul><h2>' + esc(t('bigNew')) + '</h2>';
      }
      return {
        title: t('bigPickTitle'),
        html: html + tilesHTML() + actions(backBtn()),
        speak: function () {
          var parts = [t('bigPickTitle'), b.presetDate ? L.formatLongDate(b.presetDate) : null];
          if (sugg.length) {
            parts.push(t('bigLastMonth'));
            sugg.forEach(function (s) { parts.push(s.name + ', ' + fmt(s.amount)); });
            parts.push(t('bigNew'));
          }
          return speakJoin(parts.concat(TILES.map(function (x) { return t(x.text); })));
        },
        back: function () { ui.big = null; goTo(fromWhere(b.from)); },
        actions: {
          tile: function (d) { pickTile(d.key, { presetDate: b.presetDate, from: b.from }); },
          keep: function (d) {
            var s = sugg[Number(d.i)];
            if (!s) return;
            state.suggestions.splice(Number(d.i), 1);
            ui.big = Object.assign({}, s, { presetDate: b.presetDate, from: b.from });
            finishBig(b.presetDate || null);
          }
        }
      };
    },

    bigOtherIcon: function () {
      return {
        title: t('otherPickTitle'),
        html: h1(t('otherPickTitle')) + '<div class="tiles tiles-3">' + OTHER_ICONS.map(function (o, i) {
          return '<button type="button" class="tile tile-icon" data-act="pick" data-i="' + i + '" aria-label="' + esc(t(o.text)) + '">' +
            ic(o.icon, 'tile-ic') + '</button>';
        }).join('') + '</div>' + actions(backBtn()),
        speak: function () { return t('otherPickTitle'); },
        back: function () { go('bigPick'); },
        actions: {
          pick: function (d) {
            ui.big.icon = OTHER_ICONS[Number(d.i)].icon;
            go('bigOtherName');
          }
        }
      };
    },

    bigOtherName: function () {
      function nextStep() {
        var v = document.getElementById('other-name').value.trim();
        ui.big.name = v.slice(0, 30) || t('tileOther');
        go('bigAmount');
      }
      return {
        title: t('otherNameTitle'),
        html: h1(t('otherNameTitle')) + '<p class="hint">' + esc(t('otherNameHint')) + '</p>' +
          '<div class="field-row">' + ic(ui.big.icon, 'field-ic') +
          '<div class="field-wrap"><label for="other-name" class="field-label">' + esc(t('otherNameLabel')) + '</label>' +
          '<input id="other-name" class="field" type="text" maxlength="30" autocomplete="off" autocapitalize="sentences" enterkeyhint="next" value="' +
          esc(ui.big.name && ui.big.name !== t('tileOther') ? ui.big.name : '') + '"></div></div>' +
          actions(button('next', t('next'), I.next) + backBtn()),
        speak: function () { return speakJoin([t('otherNameTitle'), t('otherNameHint')]); },
        back: function () { go('bigOtherIcon'); },
        mount: function () {
          document.getElementById('other-name').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); nextStep(); }
          });
        },
        actions: { next: nextStep }
      };
    },

    bigAmount: function () {
      var b = ui.big;
      if (!b) return SCREENS.home();
      return keypadScreen({
        title: t(b.savings ? 'savingsHowMuch' : 'bigHowMuch'),
        afterTitle: chip(b.icon, b.name),
        speakExtra: [b.name],
        initial: b.amount ? L.amountToKeypad(b.amount) : '',
        onBack: function () { go(b.other ? 'bigOtherName' : 'bigPick'); },
        onNext: function (v) { b.amount = v; go('bigSource'); }
      });
    },

    bigSource: function () {
      var b = ui.big;
      if (!b) return SCREENS.home();
      return {
        title: t('bigWhich'),
        html: h1(t('bigWhich')) + chip(b.icon, b.name + ' ' + fmt(b.amount)) +
          '<div class="choices">' + sourceChoice('bank') + sourceChoice('cuse') + '</div>' + actions(backBtn()),
        speak: function () { return speakJoin([t('bigWhich'), b.name + ', ' + fmt(b.amount)]); },
        back: function () { go('bigAmount'); },
        actions: {
          src: function (d) {
            b.source = d.src;
            // Savings has no day. Coming from a day screen, the day is already picked.
            if (b.savings || b.presetDate) finishBig(b.presetDate || null);
            else go('bigDate');
          }
        }
      };
    },

    // "When will you buy it? 📅" – for a new big spend (ui.big),
    // or for "📅 Change day" on one that exists (p.editId).
    bigDate: function (p) {
      var editing = p.editId ? findBig(p.editId) : null;
      var b = editing || ui.big;
      if (!b) return SCREENS.home();
      var from = p.from || 'home';
      var view = calView();
      function rerender() { go('bigDate', p); }

      function choose(key) {
        if (!editing) { finishBig(key); return; }
        if ((editing.date || null) === key) { goTo(fromWhere(from)); return; }
        var u = L.bigSpendUndo(state, editing.id);
        state = L.updateBigSpend(state, editing.id, { date: key });
        save();
        goTo(fromWhere(from));
        offerUndo(u, t('undoChanged', { thing: editing.name }));
      }

      return {
        title: t('bigDateTitle'),
        html: h1(t('bigDateTitle'), I.calendar) +
          chip(b.icon, b.name + ' ' + fmt(b.amount)) +
          // "I don't know" comes first, so a screen reader user does not have to swipe past every day.
          actions(button('unknown', t('dontKnow'), I.next, { cls: 'btn-secondary' })) +
          '<h2 class="cal-month">' + esc(L.formatMonthYear(state.month)) + '</h2>' +
          viewToggle() + (view === 'list' ? pickList() : calendarGrid('pick')) +
          actions(backBtn()),
        speak: function () { return speakJoin([t('bigDateTitle'), b.name + ', ' + fmt(b.amount), t('dontKnow'), L.formatMonthYear(state.month)]); },
        back: function () {
          if (editing) go('bigEdit', { id: editing.id, from: from });
          else go('bigSource');
        },
        mount: function () { if (view === 'grid') checkGridFits(rerender); },
        actions: {
          unknown: function () { choose(null); },
          day: function (d, el) {
            if (el.getAttribute('aria-disabled') === 'true') return;
            choose(d.key);
          },
          view: function (d) { setView(d.view, rerender); }
        }
      };
    },

    // Right after adding a big thing, if big things now cost more than the money there is.
    planShort: function (p) {
      var b = findBig(p.id);
      if (!b) return SCREENS.home();
      var sum = L.sourceSummary(state, b.source);
      var text = t('planShortText', { source: srcLower(b.source) });
      var nums = t('planShortNumbers', { need: fmt(sum.protected), have: fmt(sum.current) });
      var from = fromWhere(p.from);
      return {
        title: t('planShortTitle'),
        html: '<div class="alert-card alert-yellow">' + ic(I.worried, 'alert-ic') + h1(t('planShortTitle')) +
          '<p class="big-line">' + ic(srcIcon(b.source)) + '<span>' + esc(text) + '</span></p><p>' + esc(nums) + '</p></div>' +
          actions(button('change', t('changeIt'), I.pencil, { cls: 'btn-go' }) + button('keepGoing', t('keepGoing'), I.next, { cls: 'btn-neutral' })),
        speak: function () { return speakJoin([t('planShortTitle'), text, nums]); },
        back: function () { goTo(from); },
        actions: {
          change: function () { go('bigEdit', { id: b.id, from: p.from }); },
          keepGoing: function () { goTo(from); }
        }
      };
    },

    summary: function () {
      var html = progress(3) + h1(t('summaryTitle'), I.check);
      var spoken = [t('summaryTitle')];
      SOURCES.forEach(function (src) {
        var s = L.sourceSummary(state, src);
        html += '<section class="card src-card src-' + src + '" aria-labelledby="sum-' + src + '">' +
          '<h2 id="sum-' + src + '" class="src-title">' + ic(srcIcon(src)) + '<span>' + esc(srcName(src)) + '</span></h2>' +
          row(I.moneyBag, t('rowHave'), fmt(s.current)) +
          (s.protected > 0 ? row(I.calendar, t('rowBig'), fmt(s.protected), t('rowBigSub')) : '') +
          row(I.smile, t('rowFree'), show(s.free), null, true) + '</section>';
        spoken.push(srcName(src), t('rowHave') + ' ' + fmt(s.current));
        if (s.protected > 0) spoken.push(t('rowBig') + ' ' + fmt(s.protected));
        spoken.push(t('rowFree') + ' ' + show(s.free));
      });
      html += '<p class="big-line">' + ic(I.plus) + '<span>' + esc(t('summaryBigHint')) + '</span></p>';
      spoken.push(t('summaryBigHint'));
      html += actions(button('finish', t('goToMoney'), I.home));
      return {
        title: t('summaryTitle'),
        html: html,
        speak: function () { return speakJoin(spoken); },
        back: function () { go('setupCuse'); },
        actions: {
          finish: function () {
            state.setupComplete = true;
            save();
            go('home');
          }
        }
      };
    },

    // ----- home -----
    home: function () {
      var now = today();
      var left = L.daysLeftInMonth(now);
      var daysText = left === 1 ? t('daysLeftOne') : t('daysLeft', { n: left });
      var spoken = [t('homeTitle')];

      // Reminders come right after the title: focus starts on the title,
      // so screen reader users reach them first.
      var r = L.reminders(state, todayKey());
      var remindHTML = r.dueToday.map(function (b) {
        spoken.push(t('remindToday', { thing: b.name, amount: fmt(b.amount) }));
        return remindCard(b, 'remind-today', ic(I.bell, 'remind-ic') +
          '<span>' + tHtml('remindToday', { thing: thingHtml(b), amount: '<strong>' + fmt(b.amount) + '</strong>' }) + '</span>', '');
      }).join('') + r.overdue.map(function (b) {
        spoken.push(t('remindPast', { thing: b.name }), t('remindWasOn', { date: L.formatShortDate(b.date) }));
        return remindCard(b, 'remind-past', '<span>' + tHtml('remindPast', { thing: thingHtml(b) }) + '</span>',
          '<p class="remind-sub">' + ic(I.calendar) + '<span aria-hidden="true">' + esc(t('remindWasOn', { date: L.formatShortDate(b.date) })) + '</span>' +
          '<span class="sr-only">' + esc(t('remindWasOn', { date: L.formatLongDate(b.date) })) + '</span></p>');
      }).join('');
      var soonHTML = r.soon.length ? '<ul class="soon-list">' + r.soon.map(function (s) {
        var key = s.days === 1 ? 'remindTomorrow' : 'remindSoon';
        spoken.push(t(key, { thing: s.item.name, n: s.days }));
        return '<li>' + ic(I.calendar) + '<span>' + tHtml(key, { thing: thingHtml(s.item), n: s.days }) + '</span></li>';
      }).join('') + '</ul>' : '';
      spoken.push(daysText);

      var cards = SOURCES.map(function (src) {
        var s = L.sourceSummary(state, src);
        var st = L.homeStatus(state, src, now);
        var info = { green: [I.check, 'statusGreen'], yellow: [I.warn, 'statusYellow'], red: [I.stopSign, 'statusRed'] }[st];
        spoken.push(srcName(src), t('freeToSpend') + ' ' + show(s.free), t('youHaveShort', { amount: fmt(s.current) }), t(info[1]));
        return '<section class="card src-card src-' + src + '" aria-labelledby="h-' + src + '">' +
          '<h2 id="h-' + src + '" class="src-title">' + ic(srcIcon(src)) + '<span>' + esc(srcName(src)) + '</span></h2>' +
          '<p class="free-label">' + esc(t('freeToSpend')) + '</p>' +
          '<p class="free-amount">' + show(s.free) + '</p>' +
          (s.free < 0 ? '<p class="short-by">' + esc(t('shortBy', { amount: fmt(-s.free) })) + '</p>' : '') +
          '<p class="have">' + esc(t('youHaveShort', { amount: fmt(s.current) })) + '</p>' +
          '<p class="status status-' + st + '"><span class="dot" aria-hidden="true"></span>' + ic(info[0]) +
          '<span>' + esc(t(info[1])) + '</span></p>' +
          '<div class="src-actions">' +
          button('fix', t('fixMoney'), I.pencil, { cls: 'btn-small btn-secondary', data: { src: src }, aria: t('fixMoneyLabel', { source: srcName(src) }) }) +
          '</div></section>';
      }).join('');

      // Unpaid first (soonest day first, no day last), then paid.
      var unpaid = state.bigSpends.filter(function (b) { return !b.paid; }).map(function (b, i) { return { b: b, i: i }; })
        .sort(function (x, y) {
          var a = x.b.date || '9999', c = y.b.date || '9999';
          return a < c ? -1 : a > c ? 1 : x.i - y.i;
        }).map(function (o) { return o.b; });
      var big = unpaid.concat(state.bigSpends.filter(function (b) { return b.paid; }));
      var bigHTML = '<section class="big-section" aria-labelledby="h-big"><h2 id="h-big">' + esc(t('bigToPay')) + '</h2>' +
        (big.length ? '<ul class="cards">' + big.map(function (b) { return bigCard(b, 'home'); }).join('') + '</ul>'
          : '<p class="big-line">' + esc(t('bigNone')) + '</p>') +
        actions(button('addBig', t('addBig'), I.plus, { cls: 'btn-secondary' })) + '</section>';
      if (unpaid.length) {
        spoken.push(t('bigToPay'));
        unpaid.forEach(function (b) { spoken.push(b.name + ', ' + fmt(b.amount)); });
      }

      var html = (storageOK ? '' : '<p class="msg msg-error">' + ic(I.warn) + '<span>' + esc(t('noSaveWarning')) + '</span></p>') +
        h1(t('homeTitle')) + remindHTML + soonHTML +
        '<p class="days">' + ic(I.calendar) + '<span>' + esc(daysText) + '</span></p>' +
        '<div class="src-cards">' + cards + '</div>' +
        actions(button('buy', t('buySomething'), I.cart, { cls: 'btn-primary btn-giant' }) +
          button('calendar', t('myCalendar'), I.calendar, { cls: 'btn-secondary btn-calendar' })) +
        bigHTML +
        actions(button('got', t('gotMoney'), I.cash, { cls: 'btn-secondary' }) +
          button('list', t('whatIBought'), I.list, { cls: 'btn-secondary' }) +
          (Voice.supported ? button('settings', t('settings'), I.gear, { cls: 'btn-secondary' }) : ''), 'actions-secondary');

      return {
        title: t('homeTitle'),
        html: html,
        speak: function () { return speakJoin(spoken); },
        actions: {
          buy: function () { ui.buy = {}; go('buyAmount'); },
          calendar: function () { go('calendar'); },
          addBig: function () { ui.big = { from: 'home' }; go('bigPick'); },
          got: function () { ui.got = {}; go('gotAmount'); },
          list: function () { go('list'); },
          settings: function () { go('settings'); },
          fix: function (d) { go('fixMoney', { src: d.src }); },
          paid: function (d) { go('paidConfirm', { id: d.id, from: d.from }); },
          editBig: function (d) { go('bigEdit', { id: d.id, from: d.from }); },
          // The banner already asks "Did you pay it?", so Yes counts as the answer.
          remindYes: function (d) {
            var b = findBig(d.id);
            if (!b) return;
            var u = L.bigSpendUndo(state, b.id);
            state = L.markBigSpendPaid(state, b.id, nowISO());
            save();
            go('done', { kind: 'paid', src: b.source });
            offerUndo(u, t('undoPaid', { thing: b.name }));
          },
          remindNo: function (d) {
            state = L.setNotYet(state, d.id, todayKey());
            save();
            go('home');
            announce(t('notYetDone'), false);
          }
        }
      };
    },

    paidConfirm: function (p) {
      var b = findBig(p.id);
      if (!b) return SCREENS.home();
      var from = fromWhere(p.from);
      return {
        title: t('paidConfirmTitle'),
        html: h1(t('paidConfirmTitle')) + '<div class="card item-card item-card-big">' + itemBody(b) + '</div>' +
          actions(button('yes', t('yesPaid'), I.check, { cls: 'btn-go' }) + button('no', t('noGoBack'), I.back, { cls: 'btn-neutral' })),
        speak: function () { return speakJoin([t('paidConfirmTitle'), b.name + ', ' + fmt(b.amount)]); },
        back: function () { goTo(from); },
        actions: {
          yes: function () {
            var u = L.bigSpendUndo(state, b.id);
            state = L.markBigSpendPaid(state, b.id, nowISO());
            save();
            go('done', { kind: 'paid', src: b.source });
            offerUndo(u, t('undoPaid', { thing: b.name }));
          },
          no: function () { goTo(from); }
        }
      };
    },

    // ----- My calendar -----
    calendar: function () {
      var view = calView();
      var undated = state.bigSpends.filter(function (b) { return !b.date && !b.savings; });
      var spoken = [t('calTitle'), L.formatMonthYear(state.month)];
      state.bigSpends.filter(function (b) { return b.date; }).slice().sort(function (a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      }).forEach(function (b) { spoken.push(L.formatMonthDayLong(b.date) + ', ' + bigSpoken(b)); });
      if (undated.length) {
        spoken.push(t('calNoDay'));
        undated.forEach(function (b) { spoken.push(bigSpoken(b)); });
      }
      function rerender() { go('calendar'); }
      return {
        title: t('calTitle'),
        html: h1(t('calTitle'), I.calendar) +
          '<h2 class="cal-month">' + esc(L.formatMonthYear(state.month)) + '</h2>' +
          viewToggle() + (view === 'list' ? calendarList() : calendarGrid('view')) +
          (undated.length ? '<section aria-labelledby="h-noday"><h2 id="h-noday">' + esc(t('calNoDay')) + '</h2><ul class="cards">' +
            undated.map(function (b) { return bigCard(b, 'calendar'); }).join('') + '</ul></section>' : '') +
          actions(homeBtn()),
        speak: function () { return speakJoin(spoken); },
        back: function () { go('home'); },
        mount: function () { if (view === 'grid') checkGridFits(rerender); },
        actions: {
          day: function (d) { go('day', { key: d.key }); },
          view: function (d) { setView(d.view, rerender); },
          paid: function (d) { go('paidConfirm', { id: d.id, from: 'calendar' }); },
          editBig: function (d) { go('bigEdit', { id: d.id, from: 'calendar' }); }
        }
      };
    },

    day: function (p) {
      var key = p.key;
      if (!L.isDayKey(key)) return SCREENS.calendar();
      var items = L.bigSpendsOn(state, key);
      var tk = todayKey();
      var from = 'day:' + key;
      var canAdd = key >= tk && key.slice(0, 7) === state.month;
      var spoken = [L.formatLongDate(key)];
      if (key === tk) spoken.push(t('calToday'));
      if (items.length) items.forEach(function (b) { spoken.push(bigSpoken(b)); });
      else spoken.push(t('dayNothing'));
      return {
        title: L.formatLongDate(key),
        html: h1(L.formatLongDate(key), I.calendar) +
          (key === tk ? chip(null, t('calToday')) : '') +
          (items.length ? '<ul class="cards">' + items.map(function (b) { return bigCard(b, from); }).join('') + '</ul>'
            : '<p class="big-line">' + esc(t('dayNothing')) + '</p>') +
          actions((canAdd ? button('add', t('dayAdd'), I.plus) : '') + backBtn()),
        speak: function () { return speakJoin(spoken); },
        back: function () { go('calendar'); },
        actions: {
          add: function () {
            ui.big = { presetDate: key, from: from };
            go('bigPick');
          },
          paid: function (d) { go('paidConfirm', { id: d.id, from: from }); },
          editBig: function (d) { go('bigEdit', { id: d.id, from: from }); }
        }
      };
    },

    // ----- Change a big thing -----
    bigEdit: function (p) {
      var b = findBig(p.id);
      var from = p.from || 'home';
      if (!b) return SCREENS.home();
      function done(u, what) {
        save();
        goTo(fromWhere(from));
        offerUndo(u, what);
      }
      return {
        title: t('bigEditTitle'),
        html: h1(t('bigEditTitle'), I.pencil) + '<div class="card item-card item-card-big' + (b.paid ? ' is-paid' : '') + '">' + itemBody(b) +
          (b.paid ? '<p class="paid-tag">' + ic(I.check) + '<span>' + esc(t('paidDone')) + '</span></p>' : '') + '</div>' +
          actions(button('amount', t('changeAmount'), I.pencil, { cls: 'btn-secondary' }) +
            (b.savings ? '' : button('day', t('changeDay'), I.calendar, { cls: 'btn-secondary' })) +
            (b.paid ? button('unpay', t('notPaidYet'), I.undo, { cls: 'btn-secondary' }) : '') +
            button('remove', t('bigRemove'), I.remove, { cls: 'btn-secondary' }) +
            backBtn()),
        speak: function () {
          return speakJoin([t('bigEditTitle'), bigSpoken(b), b.date ? L.formatLongDate(b.date) : null, t('changeAmount')]
            .concat(b.savings ? [] : [t('changeDay')]).concat(b.paid ? [t('notPaidYet')] : []).concat([t('bigRemove')]));
        },
        back: function () { goTo(fromWhere(from)); },
        actions: {
          amount: function () { go('bigEditAmount', { id: b.id, from: from }); },
          day: function () { go('bigDate', { editId: b.id, from: from }); },
          unpay: function () {
            var u = L.bigSpendUndo(state, b.id);
            state = L.unmarkBigSpendPaid(state, b.id);
            done(u, t('undoNotPaid', { thing: b.name }));
          },
          remove: function () { go('bigRemoveConfirm', { id: b.id, from: from }); }
        }
      };
    },

    bigEditAmount: function (p) {
      var b = findBig(p.id);
      if (!b) return SCREENS.home();
      return keypadScreen({
        title: t(b.savings ? 'savingsHowMuch' : 'bigHowMuch'),
        afterTitle: chip(b.icon, b.name),
        speakExtra: [b.name],
        initial: L.amountToKeypad(b.amount),
        nextLabel: t('save'), nextIcon: I.check,
        onBack: function () { go('bigEdit', p); },
        onNext: function (v) {
          var from = fromWhere(p.from);
          if (v === b.amount) { goTo(from); return; }
          var u = L.bigSpendUndo(state, b.id);
          state = L.updateBigSpend(state, b.id, { amount: v });
          save();
          goTo(from);
          offerUndo(u, t('undoChanged', { thing: b.name }));
        }
      });
    },

    bigRemoveConfirm: function (p) {
      var b = findBig(p.id);
      if (!b) return SCREENS.home();
      var title = t('bigRemoveTitle', { thing: b.name, amount: fmt(b.amount) });
      var effect = b.paid ? t('removeBigUp') : t('removeBigFree');
      return {
        title: title,
        html: '<h1 tabindex="-1"><span>' + tHtml('bigRemoveTitle', { thing: thingHtml(b), amount: fmt(b.amount) }) + '</span></h1>' +
          '<div class="card item-card item-card-big">' + itemBody(b) + '</div>' +
          '<p class="big-line">' + ic(I.moneyBag) + '<span>' + esc(effect) + '</span></p>' +
          actions(button('keep', t('noKeep'), I.check, { cls: 'btn-go' }) + button('yes', t('yesRemove'), I.remove, { cls: 'btn-neutral' })),
        speak: function () { return speakJoin([title, effect]); },
        back: function () { go('bigEdit', p); },
        actions: {
          keep: function () { go('bigEdit', p); },
          yes: function () {
            var u = L.bigSpendUndo(state, b.id);
            state = L.removeBigSpend(state, b.id);
            save();
            goTo(fromWhere(p.from));
            offerUndo(u, t('undoRemoved', { thing: b.name }), t('removedText'));
          }
        }
      };
    },

    // ----- Fix my money -----
    fixMoney: function (p) {
      var src = p.src;
      var cur = L.currentMoney(state, src);
      return keypadScreen({
        title: t(src === 'bank' ? 'fixBankTitle' : 'fixCuseTitle'), icon: srcIcon(src), allowZero: true,
        afterTitle: '<p class="have-line">' + ic(I.pencil) + '<span>' + esc(t('fixAppSays', { amount: fmt(cur) })) + '</span></p>',
        speakExtra: [t('fixAppSays', { amount: fmt(cur) })],
        initial: cur > 0 ? L.amountToKeypad(cur) : '0',
        nextLabel: t('save'), nextIcon: I.check,
        onBack: function () { go('home'); },
        onNext: function (v) {
          if (L.adjustmentNeeded(state, src, v) === 0) { go('home'); announce(t('fixSame'), false); return; }
          var id = L.makeId();
          state = L.addAdjustment(state, src, v, nowISO(), id);
          save();
          go('done', { kind: 'fixed', src: src });
          offerUndo({ type: 'adjustment', source: src, id: id }, t('undoFixed', { source: srcLower(src) }));
        }
      });
    },

    // ----- I want to buy something -----
    buyAmount: function () {
      ui.buy = ui.buy || {};
      return keypadScreen({
        title: t('buyHowMuch'), icon: I.cart,
        initial: ui.buy.amount ? L.amountToKeypad(ui.buy.amount) : '',
        onBack: function () { go('home'); },
        onNext: function (v) { ui.buy = { amount: v }; go('buySource'); }
      });
    },

    buySource: function () {
      var b = ui.buy;
      var spoken = [t('payWith'), fmt(b.amount)];
      var choices = SOURCES.map(function (src) {
        var free = L.freeMoney(state, src);
        spoken.push(srcName(src) + ', ' + t('freeUnder', { amount: show(free) }));
        return sourceChoice(src, t('freeUnder', { amount: show(free) }),
          t('payWithLabel', { source: srcName(src), amount: words(Math.max(0, free)) }));
      }).join('');
      return {
        title: t('payWith'),
        html: h1(t('payWith')) + chip(I.cart, fmt(b.amount)) + '<div class="choices">' + choices + '</div>' + actions(backBtn()),
        speak: function () { return speakJoin(spoken); },
        back: function () { go('buyAmount'); },
        actions: { src: function (d) { b.source = d.src; go('buyCategory'); } }
      };
    },

    buyCategory: function () {
      var b = ui.buy;
      return {
        title: t('whatIsIt'),
        html: h1(t('whatIsIt')) + chip(srcIcon(b.source), fmt(b.amount) + ' · ' + srcName(b.source)) +
          '<div class="tiles">' + CATEGORIES.map(function (c) {
            return '<button type="button" class="tile" data-act="cat" data-key="' + c.key + '">' +
              ic(c.icon, 'tile-ic') + '<span>' + esc(t(c.text)) + '</span></button>';
          }).join('') + '</div>' + actions(backBtn()),
        speak: function () {
          return speakJoin([t('whatIsIt')].concat(CATEGORIES.map(function (c) { return t(c.text); })));
        },
        back: function () { go('buySource'); },
        actions: {
          cat: function (d) {
            b.category = d.key;
            b.check = L.checkPurchase(state, b.source, b.amount, today());
            if (b.check.level === 'green') {
              boughtIt('green');
            } else {
              go('alert');
            }
          }
        }
      };
    },

    alert: function () {
      var b = ui.buy;
      var c = b.check;
      var cat = catInfo(b.category);
      var thing = t(cat.text);
      var cls, icon, title, lines, lose = [];

      if (c.level === 'yellow') {
        cls = 'alert-yellow'; icon = I.warn; title = t('yellowTitle'); lines = [t('yellowText')];
      } else if (c.level === 'orange') {
        cls = 'alert-orange'; icon = I.warn; title = t('orangeTitle');
        lines = [t('orangeText'), t('orangeLeft', { amount: show(c.freeAfter) })];
      } else if (c.reason === 'stop') {
        cls = 'alert-red'; icon = I.stopSign; title = t('stopTitle'); lines = [t('stopText')]; lose = c.atRisk;
      } else {
        cls = 'alert-red'; icon = I.stopSign; title = t('notEnoughTitle');
        lines = [t('notEnoughText', { amount: show(c.current) })];
      }

      var itemLine = '<p class="alert-item"><span class="keep">' + ic(cat.icon) + '<span>' + esc(thing) + '</span></span>' +
        '<span class="sep" aria-hidden="true">·</span><strong>' + fmt(b.amount) + '</strong>' +
        '<span class="sep" aria-hidden="true">·</span><span class="keep">' + ic(srcIcon(b.source)) + '<span>' + esc(srcName(b.source)) + '</span></span></p>';

      var loseHTML = '';
      var loseNames = lose.map(function (r) {
        return r.date ? t('loseOnDay', { name: r.name, date: L.formatMonthDay(r.date) }) : r.name;
      });
      if (lose.length) {
        loseHTML = '<p class="lose-heading">' + esc(t('loseHeading')) + '</p><ul class="lose-list">' +
          lose.map(function (r, i) {
            return '<li>' + ic(r.icon) + '<span>' + esc(loseNames[i]) + '</span></li>';
          }).join('') + '</ul>';
      }

      function spokenText() {
        return speakJoin([title].concat(lines)
          .concat(lose.length ? [t('loseHeading')].concat(loseNames) : [])
          .concat([t('itemLine', { thing: thing, amount: fmt(b.amount), source: srcName(b.source) })]));
      }

      return {
        title: title,
        html: '<div class="alert-card ' + cls + '">' + ic(icon, 'alert-ic') + h1(title) + itemLine +
          lines.map(function (l) { return '<p class="alert-text">' + esc(l) + '</p>'; }).join('') + loseHTML + '</div>' +
          actions(button('wait', t('wait'), I.hand, { cls: 'btn-go', id: 'wait-btn' }) +
            button('buy', t('buyAnyway'), I.cart, { cls: 'btn-neutral' })),
        focus: '#wait-btn',
        alertText: spokenText,
        speak: spokenText,
        back: function () { go('buyCategory'); },
        mount: function () {
          if (c.level === 'red' && navigator.vibrate) {
            try { navigator.vibrate([150, 100, 150]); } catch (e) { /* not supported */ }
          }
        },
        actions: {
          wait: function () { recordChoice('waited'); go('done', { kind: 'waited' }); },
          buy: function () {
            if (c.level === 'red') go('sure');
            else boughtIt('bought');
          }
        }
      };
    },

    // One extra check after a red alert.
    sure: function () {
      var c = ui.buy.check;
      var first = c.atRisk[0];
      var text, icon;
      if (c.reason !== 'notEnough' && first) { text = t('sureBig', { thing: first.name }); icon = first.icon; }
      else { text = t('sureNotEnough'); icon = I.warn; }
      function spokenText() { return speakJoin([t('sureTitle'), text]); }
      return {
        title: t('sureTitle'),
        html: '<div class="alert-card alert-red">' + ic(I.stopSign, 'alert-ic') + h1(t('sureTitle')) +
          '<p class="big-line">' + ic(icon) + '<span>' + esc(text) + '</span></p></div>' +
          actions(button('wait', t('noWait'), I.hand, { cls: 'btn-go', id: 'wait-btn' }) +
            button('buy', t('yesBuy'), I.cart, { cls: 'btn-neutral' })),
        focus: '#wait-btn',
        alertText: spokenText,
        speak: spokenText,
        back: function () { go('alert'); },
        actions: {
          wait: function () { recordChoice('waited'); go('done', { kind: 'waited' }); },
          buy: function () { boughtIt('bought'); }
        }
      };
    },

    // ----- happy endings -----
    done: function (p) {
      var b = ui.buy || {};
      var icon, title, lines, celebrate = false;
      var cat = b.category ? catInfo(b.category) : null;
      var src = p.src || b.source;
      var freeLine = src ? t('freeLeft', { amount: show(L.freeMoney(state, src)) }) : null;

      if (p.kind === 'green') {
        icon = I.check; title = t('greenTitle'); celebrate = true;
        lines = [t('greenText', { thing: t(cat.text), amount: fmt(b.amount) }), freeLine];
      } else if (p.kind === 'waited') {
        icon = I.star; title = t('waitedTitle'); celebrate = true;
        lines = [t('waitedText', { amount: fmt(b.amount) })];
      } else if (p.kind === 'bought') {
        icon = I.note; title = t('boughtTitle');
        lines = [freeLine];
      } else if (p.kind === 'paid') {
        icon = I.check; title = t('paidDoneTitle'); celebrate = true;
        lines = [t('paidDoneText'), freeLine];
      } else if (p.kind === 'fixed') {
        icon = I.check; title = t('fixedTitle');
        lines = [t('gotNow', { amount: fmt(L.currentMoney(state, src)) }), freeLine];
      } else {
        icon = I.party; title = t('gotDoneTitle'); celebrate = true;
        lines = [t('gotDoneText'), t('gotNow', { amount: fmt(L.currentMoney(state, src)) })];
      }

      return {
        title: title,
        html: '<div class="done">' + ic(icon, 'ic-hero' + (celebrate ? ' pop' : '')) + h1(title) +
          lines.filter(Boolean).map(function (l) { return '<p class="big-line"><span>' + esc(l) + '</span></p>'; }).join('') +
          '</div>' + actions(homeBtn()),
        speak: function () { return speakJoin([title].concat(lines)); },
        back: function () { go('home'); }
      };
    },

    // ----- I got money -----
    gotAmount: function () {
      ui.got = ui.got || {};
      return keypadScreen({
        title: t('gotHowMuch'), icon: I.cash,
        initial: ui.got.amount ? L.amountToKeypad(ui.got.amount) : '',
        onBack: function () { go('home'); },
        onNext: function (v) { ui.got = { amount: v }; go('gotSource'); }
      });
    },

    gotSource: function () {
      var g = ui.got;
      var spoken = [t('gotWhere'), fmt(g.amount)];
      var choices = SOURCES.map(function (src) {
        var have = L.currentMoney(state, src);
        spoken.push(srcName(src));
        return sourceChoice(src, t('youHaveShort', { amount: fmt(have) }), t('gotHaveLabel', { source: srcName(src), amount: words(have) }));
      }).join('');
      return {
        title: t('gotWhere'),
        html: h1(t('gotWhere')) + chip(I.cash, fmt(g.amount)) + '<div class="choices">' + choices + '</div>' + actions(backBtn()),
        speak: function () { return speakJoin(spoken); },
        back: function () { go('gotAmount'); },
        actions: {
          src: function (d) {
            var id = L.makeId();
            state = L.addMoney(state, d.src, g.amount, nowISO(), id);
            ui.got = null;
            save();
            go('done', { kind: 'got', src: d.src });
            offerUndo({ type: 'added', source: d.src, id: id }, t('undoGot', { amount: fmt(g.amount) }));
          }
        }
      };
    },

    // ----- What I bought -----
    list: function () {
      var items = L.activityList(state);
      var waited = items.filter(function (x) { return x.kind === 'purchase' && x.choice === 'waited'; }).length;
      var count = waited === 0 ? t('waitedNone') : waited === 1 ? t('waitedOne') : t('waitedMany', { n: waited });
      var spoken = [t('listTitle'), items.length ? count : t('listEmpty')];

      var listHTML = items.length ? '<ul class="cards">' + items.map(function (x) {
        var e = entryInfo(x);
        var isWait = x.kind === 'purchase' && x.choice === 'waited';
        spoken.push(e.name + ', ' + e.shown + ', ' + L.formatShortDate(x.date) + (isWait ? ', ' + t('youWaited') : ''));
        return '<li class="card item-card buy-card' + (isWait ? ' is-waited' : '') + (x.kind !== 'purchase' ? ' is-' + x.kind : '') + '">' +
          '<div class="item">' + ic(e.icon, 'item-ic') + '<div class="item-main">' +
          '<p class="item-name">' + esc(e.name) + ' <strong>' + esc(e.shown) + '</strong></p>' +
          '<p class="item-meta">' + ic(srcIcon(x.source)) + '<span>' + esc(srcName(x.source)) + '</span></p>' +
          '<p class="item-meta"><span aria-hidden="true">' + esc(L.formatShortDate(x.date)) + '</span>' +
          '<span class="sr-only">' + esc(L.formatLongDate(x.date)) + '</span></p>' +
          (isWait ? '<p class="waited-tag">' + ic(I.star) + '<span>' + esc(t('youWaited')) + '</span></p>' : '') +
          '</div></div>' +
          button('remove', t('bigRemove'), I.remove, {
            cls: 'btn-small btn-secondary', data: { kind: x.kind, id: x.id },
            aria: t('removeLabel', { thing: e.name, amount: e.spokenAmount, date: L.formatLongDate(x.date) })
          }) + '</li>';
      }).join('') + '</ul>' : '<p class="big-line">' + esc(t('listEmpty')) + '</p>';

      return {
        title: t('listTitle'),
        html: h1(t('listTitle'), I.list) +
          (items.length ? '<p class="count-line">' + (waited ? ic(I.star) : '') + '<span>' + esc(count) + '</span></p>' : '') +
          listHTML + actions(homeBtn()),
        speak: function () { return speakJoin(spoken); },
        back: function () { go('home'); },
        actions: { remove: function (d) { go('removeConfirm', { kind: d.kind, id: d.id }); } }
      };
    },

    // "Remove $12 Food? Your money will go back up."
    removeConfirm: function (p) {
      var x = L.activityList(state).filter(function (y) { return y.kind === p.kind && y.id === p.id; })[0];
      if (!x) return SCREENS.list({});
      var e = entryInfo(x);
      var title = x.kind === 'purchase' ? t('removeTitle', { amount: e.shown, thing: e.name })
        : x.kind === 'added' ? t('removeGotTitle', { amount: e.shown })
        : t('removeFixTitle', { amount: e.shown });
      var effect = { up: t('removeUp'), down: t('removeDown'), none: t('removeNone') }[L.removalEffect(x)];
      return {
        title: title,
        html: '<div class="hero">' + ic(e.icon, 'ic-hero') + '</div>' + h1(title) +
          '<p class="big-line">' + ic(I.moneyBag) + '<span>' + esc(effect) + '</span></p>' +
          actions(button('keep', t('noKeep'), I.check, { cls: 'btn-go' }) + button('yes', t('yesRemove'), I.remove, { cls: 'btn-neutral' })),
        speak: function () { return speakJoin([title, effect]); },
        back: function () { go('list'); },
        actions: {
          keep: function () { go('list'); },
          yes: function () {
            var u = L.removeUndo(state, x);
            state = L.removeEntry(state, x);
            save();
            go('list');
            offerUndo(u, t('undoRemoved', { thing: e.name + ', ' + e.shown }), t('removedText'));
          }
        }
      };
    },

    // ----- settings -----
    settings: function (p) {
      var on = state.settings.autoRead !== false;
      return {
        title: t('settingsTitle'),
        html: h1(t('settingsTitle'), I.gear) +
          '<button type="button" class="switch" role="switch" aria-checked="' + on + '" data-act="toggle">' +
          ic(I.read, 'switch-ic') + '<span class="switch-label">' + esc(t('autoRead')) + '</span>' +
          '<span class="switch-state" aria-hidden="true"><span class="switch-knob"></span>' + esc(on ? t('on') : t('off')) + '</span></button>' +
          actions(homeBtn()),
        speak: function () { return speakJoin([t('settingsTitle'), t('autoRead') + ': ' + (on ? t('on') : t('off'))]); },
        back: function () { go('home'); },
        focus: p.toggled ? '.switch' : null,
        actions: {
          toggle: function () {
            state.settings.autoRead = !on;
            save();
            go('settings', { toggled: true });
          }
        }
      };
    }
  };

  /** Saves the purchase on screen. Returns its id. */
  function recordChoice(choice) {
    var b = ui.buy;
    var id = L.makeId();
    state = L.recordPurchase(state, {
      id: id,
      amount: b.amount,
      source: b.source,
      category: b.category,
      date: nowISO(),
      hadAlert: b.check.level === 'green' ? 'none' : b.check.level,
      choice: choice
    });
    save();
    return id;
  }

  /** "Buy it" (green, or after an alert): save it, say so, and offer Undo. */
  function boughtIt(kind) {
    var b = ui.buy;
    var id = recordChoice('bought');
    go('done', { kind: kind });
    offerUndo({ type: 'purchase', id: id }, t('undoBought', { thing: t(catInfo(b.category).text), amount: fmt(b.amount) }));
  }

  // ----- adding a big spend -----

  function tilesHTML() {
    return '<div class="tiles">' + TILES.map(function (tile) {
      return '<button type="button" class="tile" data-act="tile" data-key="' + tile.key + '">' +
        ic(tile.icon, 'tile-ic') + '<span>' + esc(t(tile.text)) + '</span></button>';
    }).join('') + '</div>';
  }

  /** ctx: { presetDate, from } */
  function pickTile(key, ctx) {
    var tile = TILES.filter(function (x) { return x.key === key; })[0];
    if (!tile) return;
    if (tile.key === 'other') { ui.big = Object.assign({ other: true, icon: null, name: '' }, ctx); go('bigOtherIcon'); }
    else { ui.big = Object.assign({ name: t(tile.text), icon: tile.icon, savings: tile.key === 'savings' }, ctx); go('bigAmount'); }
  }

  /** Last step of adding a big spend. date is a day key or null ("I don't know"). */
  function finishBig(date) {
    var b = ui.big;
    var pot = b.savings ? L.savingsFor(state, b.source) : null;
    var id = pot ? pot.id : L.makeId();
    var u = L.bigSpendUndo(state, id);
    var item = { id: id, name: b.name, icon: b.icon, amount: b.amount, source: b.source, date: date };
    state = b.savings ? L.addSavings(state, item) : L.addBigSpend(state, item);
    ui.big = null;
    save();
    if (L.freeMoney(state, b.source) < 0) go('planShort', { id: id, from: b.from });
    else goTo(fromWhere(b.from));
    offerUndo(u, b.savings ? t('undoSaved', { amount: fmt(b.amount) }) : t('undoAdded', { thing: b.name }));
  }

  /** A reminder banner on Home with "✅ Yes" and "Not yet". */
  function remindCard(b, cls, textHtml, subHtml) {
    return '<div class="remind ' + cls + '">' +
      '<p class="remind-text">' + textHtml + '</p>' + subHtml +
      '<div class="remind-actions">' +
      button('remindYes', t('yes'), I.check, { cls: 'btn-go', data: { id: b.id }, aria: t('remindYesLabel', { name: b.name }) }) +
      button('remindNo', t('notYet'), I.later, { cls: 'btn-neutral', data: { id: b.id }, aria: t('remindNotYetLabel', { name: b.name }) }) +
      '</div></div>';
  }

  /** Picture, name and amount for one entry in "What I bought". */
  function entryInfo(x) {
    if (x.kind === 'purchase') {
      var cat = catInfo(x.category);
      return { icon: cat.icon, name: t(cat.text), shown: fmt(x.amount), spokenAmount: words(x.amount) };
    }
    if (x.kind === 'added') {
      return { icon: I.cash, name: t('gotEntry'), shown: fmt(x.amount), spokenAmount: words(x.amount) };
    }
    return {
      icon: I.pencil, name: t(x.source === 'bank' ? 'fixedBank' : 'fixedCuse'),
      shown: signed(x.amount), spokenAmount: signedWords(x.amount)
    };
  }

  // ---------- start ----------

  function boot(saved) {
    if (ui.undo) hideUndo(); // a new month: last month's undo no longer makes sense
    var r = L.startMonth(saved, today());
    state = r.state;
    ui.recap = r.recap;
    if (r.changed) save();
    if (ui.recap) go('recap');
    else if (!state.setupComplete) go('welcome');
    else go('home');
  }

  // If the app stays open into a new day or month.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !state) return;
    if (state.month !== L.monthKey(today())) boot(state);
    else if (current && current.name === 'home') go('home');
  });

  document.querySelector('.brand-name').textContent = t('appName');
  document.getElementById('undo-label').textContent = t('undoButton');
  if (testDay) {
    var tag = document.createElement('p');
    tag.className = 'test-day';
    tag.innerHTML = ic(I.test) + '<span>' + esc(t('testDay', { date: L.formatShortDate(testDay) })) + '</span>';
    document.querySelector('.topbar').classList.add('has-test');
    document.querySelector('.topbar').appendChild(tag);
  }
  if (Voice.supported) {
    readBtn.hidden = false;
    setReading(false);
  }
  storageOK = Store.available();
  boot(Store.load());

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is a bonus */ });
    });
  }
})();
