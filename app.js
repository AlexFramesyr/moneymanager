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

  var SOURCES = L.SOURCES;

  var TILES = [
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
  var ui = { recap: null, buy: null, big: null, got: null, kp: null, seen: {} };

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
  function nowISO() { return new Date().toISOString(); }

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
    var total = 5;
    return '<div class="progress"><p class="progress-text">' + esc(t('stepOf', { n: n, total: total })) + '</p>' +
      '<div class="progress-bar" aria-hidden="true"><span style="width:' + (n / total * 100) + '%"></span></div></div>';
  }

  /** Icon, name, amount and source for a big thing. */
  function itemBody(b) {
    return '<div class="item">' + ic(b.icon, 'item-ic') +
      '<div class="item-main"><p class="item-name">' + esc(b.name) + ' <strong>' + fmt(b.amount) + '</strong></p>' +
      '<p class="item-meta">' + ic(srcIcon(b.source)) + '<span>' + esc(srcName(b.source)) + '</span></p></div></div>';
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
   *      validate(value) -> message|null, onNext(value), onBack }
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
      actions(button('next', t('next'), I.next, { id: 'kp-next', disabled: !valid }) + (o.onBack ? backBtn() : ''));

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

  // ---------- the screens ----------

  var SCREENS = {

    // ----- new month -----
    recap: function () {
      var r = ui.recap;
      var lines = [];
      if (r.savedTotal > 0) lines.push([I.pig, t('recapSaved', { amount: fmt(r.savedTotal) })]);
      if (r.waitedCount === 1) lines.push([I.star, t('recapWaitedOne')]);
      if (r.waitedCount > 1) lines.push([I.star, t('recapWaitedMany', { n: r.waitedCount })]);
      if (!lines.length) lines.push([I.sprout, t('recapFresh')]);
      return {
        title: t('newMonthTitle'),
        html: '<div class="hero">' + ic(I.calendar, 'ic-hero') + '</div>' + h1(t('newMonthTitle')) +
          lines.map(function (l) { return '<p class="big-line">' + ic(l[0]) + '<span>' + esc(l[1]) + '</span></p>'; }).join('') +
          actions(button('start', t('makePlan'), I.start)),
        speak: function () { return speakJoin([t('newMonthTitle')].concat(lines.map(function (l) { return l[1]; }))); },
        actions: { start: function () { ui.recap = null; go('setupBank'); } }
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
        onNext: function (v) { state.sources.cuse.start = v; ui.seen.cuseStart = true; save(); go('setupSaveBank'); }
      });
    },

    setupSaveBank: function () { return saveGoalScreen('bank', 'saveBankTitle', 'setupCuse', 'setupSaveCuse'); },
    setupSaveCuse: function () { return saveGoalScreen('cuse', 'saveCuseTitle', 'setupSaveBank', 'setupBig'); },

    setupBig: function (p) {
      var sugg = state.suggestions || [];
      var mine = state.bigSpends;
      var html = progress(4) + h1(t('bigTitle'));

      if (sugg.length) {
        html += '<h2>' + esc(t('bigLastMonth')) + '</h2><ul class="cards">' + sugg.map(function (s, i) {
          return '<li class="card item-card">' + itemBody(s) +
            button('keep', t('bigKeep'), I.plus, { cls: 'btn-small btn-secondary', data: { i: i }, aria: t('bigKeepLabel', { name: s.name, amount: words(s.amount) }) }) + '</li>';
        }).join('') + '</ul>';
      }
      if (mine.length) {
        html += '<h2 id="yours" tabindex="-1">' + esc(t('bigYours')) + '</h2><ul class="cards">' + mine.map(function (b) {
          return '<li class="card item-card">' + itemBody(b) +
            button('remove', t('bigRemove'), I.remove, { cls: 'btn-small btn-secondary', data: { id: b.id }, aria: t('bigRemoveLabel', { name: b.name, amount: words(b.amount) }) }) + '</li>';
        }).join('') + '</ul>';
      }
      html += '<h2>' + esc(t('bigAdd')) + '</h2><div class="tiles">' + TILES.map(function (tile) {
        return '<button type="button" class="tile" data-act="tile" data-key="' + tile.key + '">' +
          ic(tile.icon, 'tile-ic') + '<span>' + esc(t(tile.text)) + '</span></button>';
      }).join('') + '</div>';
      html += actions(button('done', t('bigDone'), I.check) + backBtn());

      return {
        title: t('bigTitle'),
        html: html,
        focus: p.focus,
        back: function () { go('setupSaveCuse'); },
        speak: function () {
          var parts = [t('bigTitle')];
          if (sugg.length) {
            parts.push(t('bigLastMonth'));
            sugg.forEach(function (s) { parts.push(s.name + ', ' + fmt(s.amount)); });
          }
          if (mine.length) {
            parts.push(t('bigYours'));
            mine.forEach(function (b) { parts.push(b.name + ', ' + fmt(b.amount)); });
          }
          parts.push(t('bigAdd'));
          return speakJoin(parts);
        },
        actions: {
          tile: function (d) {
            var tile = TILES.filter(function (x) { return x.key === d.key; })[0];
            if (tile.key === 'other') { ui.big = { other: true, icon: null, name: '' }; go('bigOtherIcon'); }
            else { ui.big = { name: t(tile.text), icon: tile.icon }; go('bigAmount'); }
          },
          keep: function (d) {
            var s = state.suggestions[Number(d.i)];
            if (!s) return;
            state = L.addBigSpend(state, s);
            state.suggestions.splice(Number(d.i), 1);
            save();
            go('setupBig', { focus: '#yours' });
          },
          remove: function (d) {
            state = L.removeBigSpend(state, d.id);
            save();
            go('setupBig', { focus: '#yours' });
          },
          done: function () {
            go(L.planShortfalls(state).length ? 'planShort' : 'summary');
          }
        }
      };
    },

    bigOtherIcon: function () {
      return {
        title: t('otherPickTitle'),
        html: progress(4) + h1(t('otherPickTitle')) + '<div class="tiles tiles-3">' + OTHER_ICONS.map(function (o, i) {
          return '<button type="button" class="tile tile-icon" data-act="pick" data-i="' + i + '" aria-label="' + esc(t(o.text)) + '">' +
            ic(o.icon, 'tile-ic') + '</button>';
        }).join('') + '</div>' + actions(backBtn()),
        speak: function () { return t('otherPickTitle'); },
        back: function () { go('setupBig'); },
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
        html: progress(4) + h1(t('otherNameTitle')) + '<p class="hint">' + esc(t('otherNameHint')) + '</p>' +
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
      return keypadScreen({
        step: 4, title: t('bigHowMuch'),
        afterTitle: chip(b.icon, b.name),
        speakExtra: [b.name],
        initial: b.amount ? L.amountToKeypad(b.amount) : '',
        onBack: function () { go(b.other ? 'bigOtherName' : 'setupBig'); },
        onNext: function (v) { b.amount = v; go('bigSource'); }
      });
    },

    bigSource: function () {
      var b = ui.big;
      return {
        title: t('bigWhich'),
        html: progress(4) + h1(t('bigWhich')) + chip(b.icon, b.name + ' ' + fmt(b.amount)) +
          '<div class="choices">' + sourceChoice('bank') + sourceChoice('cuse') + '</div>' + actions(backBtn()),
        speak: function () { return speakJoin([t('bigWhich'), b.name + ', ' + fmt(b.amount)]); },
        back: function () { go('bigAmount'); },
        actions: {
          src: function (d) {
            state = L.addBigSpend(state, { name: b.name, icon: b.icon, amount: b.amount, source: d.src });
            ui.big = null;
            save();
            go('setupBig', { focus: '#yours' });
          }
        }
      };
    },

    planShort: function () {
      var shorts = L.planShortfalls(state);
      var lines = shorts.map(function (s) {
        return {
          src: s.source,
          text: t('planShortText', { source: srcLower(s.source) }),
          nums: t('planShortNumbers', { need: fmt(s.need), have: fmt(s.have) })
        };
      });
      return {
        title: t('planShortTitle'),
        html: progress(4) + '<div class="alert-card alert-yellow">' + ic(I.worried, 'alert-ic') + h1(t('planShortTitle')) +
          lines.map(function (l) {
            return '<p class="big-line">' + ic(srcIcon(l.src)) + '<span>' + esc(l.text) + '</span></p><p>' + esc(l.nums) + '</p>';
          }).join('') + '</div>' +
          actions(button('change', t('changeIt'), I.pencil, { cls: 'btn-go' }) + button('keepGoing', t('keepGoing'), I.next, { cls: 'btn-neutral' })),
        speak: function () {
          return speakJoin([t('planShortTitle')].concat(lines.reduce(function (a, l) { return a.concat([l.text, l.nums]); }, [])));
        },
        back: function () { go('setupBig'); },
        actions: {
          change: function () { go('setupBig'); },
          keepGoing: function () { go('summary'); }
        }
      };
    },

    summary: function () {
      var html = progress(5) + h1(t('summaryTitle'), I.check);
      var spoken = [t('summaryTitle')];
      SOURCES.forEach(function (src) {
        var s = L.sourceSummary(state, src);
        html += '<section class="card src-card src-' + src + '" aria-labelledby="sum-' + src + '">' +
          '<h2 id="sum-' + src + '" class="src-title">' + ic(srcIcon(src)) + '<span>' + esc(srcName(src)) + '</span></h2>' +
          row(I.moneyBag, t('rowHave'), fmt(s.current)) +
          row(I.pig, t('rowSave'), fmt(s.protected), t('rowSaveSub')) +
          row(I.smile, t('rowFree'), show(s.free), null, true) + '</section>';
        spoken.push(srcName(src), t('rowHave') + ' ' + fmt(s.current), t('rowSave') + ' ' + fmt(s.protected), t('rowFree') + ' ' + show(s.free));
      });
      html += actions(button('finish', t('goToMoney'), I.home));
      return {
        title: t('summaryTitle'),
        html: html,
        speak: function () { return speakJoin(spoken); },
        back: function () { go('setupBig'); },
        actions: {
          finish: function () {
            state.setupComplete = true;
            state.suggestions = [];
            save();
            go('home');
          }
        }
      };
    },

    // ----- home -----
    home: function () {
      var today = new Date();
      var left = L.daysLeftInMonth(today);
      var daysText = left === 1 ? t('daysLeftOne') : t('daysLeft', { n: left });
      var spoken = [t('homeTitle'), daysText];

      var cards = SOURCES.map(function (src) {
        var s = L.sourceSummary(state, src);
        var st = L.homeStatus(state, src, today);
        var info = { green: [I.check, 'statusGreen'], yellow: [I.warn, 'statusYellow'], red: [I.stopSign, 'statusRed'] }[st];
        spoken.push(srcName(src), t('freeToSpend') + ' ' + show(s.free), t('youHaveShort', { amount: fmt(s.current) }), t(info[1]));
        return '<section class="card src-card src-' + src + '" aria-labelledby="h-' + src + '">' +
          '<h2 id="h-' + src + '" class="src-title">' + ic(srcIcon(src)) + '<span>' + esc(srcName(src)) + '</span></h2>' +
          '<p class="free-label">' + esc(t('freeToSpend')) + '</p>' +
          '<p class="free-amount">' + show(s.free) + '</p>' +
          (s.free < 0 ? '<p class="used-save">' + esc(t('usedSave', { amount: fmt(-s.free) })) + '</p>' : '') +
          '<p class="have">' + esc(t('youHaveShort', { amount: fmt(s.current) })) + '</p>' +
          '<p class="status status-' + st + '"><span class="dot" aria-hidden="true"></span>' + ic(info[0]) +
          '<span>' + esc(t(info[1])) + '</span></p></section>';
      }).join('');

      var big = state.bigSpends.filter(function (b) { return !b.paid; })
        .concat(state.bigSpends.filter(function (b) { return b.paid; }));
      var bigHTML = '';
      if (big.length) {
        bigHTML = '<section class="big-section" aria-labelledby="h-big"><h2 id="h-big">' + esc(t('bigToPay')) + '</h2><ul class="cards">' +
          big.map(function (b) {
            return '<li class="card item-card' + (b.paid ? ' is-paid' : '') + '">' + itemBody(b) +
              (b.paid
                ? '<p class="paid-tag">' + ic(I.check) + '<span>' + esc(t('paidDone')) + '</span></p>'
                : button('paid', t('paidIt'), I.check, { cls: 'btn-small btn-secondary', data: { id: b.id }, aria: t('paidItLabel', { name: b.name, amount: words(b.amount) }) })) +
              '</li>';
          }).join('') + '</ul></section>';
        var unpaid = big.filter(function (b) { return !b.paid; });
        if (unpaid.length) {
          spoken.push(t('bigToPay'));
          unpaid.forEach(function (b) { spoken.push(b.name + ', ' + fmt(b.amount)); });
        }
      }

      var html = (storageOK ? '' : '<p class="msg msg-error">' + ic(I.warn) + '<span>' + esc(t('noSaveWarning')) + '</span></p>') +
        h1(t('homeTitle')) + '<p class="days">' + ic(I.calendar) + '<span>' + esc(daysText) + '</span></p>' +
        '<div class="src-cards">' + cards + '</div>' +
        actions(button('buy', t('buySomething'), I.cart, { cls: 'btn-primary btn-giant' })) +
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
          got: function () { ui.got = {}; go('gotAmount'); },
          list: function () { go('list'); },
          settings: function () { go('settings'); },
          paid: function (d) { go('paidConfirm', { id: d.id }); }
        }
      };
    },

    paidConfirm: function (p) {
      var b = state.bigSpends.filter(function (x) { return x.id === p.id; })[0];
      if (!b) return SCREENS.home();
      return {
        title: t('paidConfirmTitle'),
        html: h1(t('paidConfirmTitle')) + '<div class="card item-card item-card-big">' + itemBody(b) + '</div>' +
          actions(button('yes', t('yesPaid'), I.check, { cls: 'btn-go' }) + button('no', t('noGoBack'), I.back, { cls: 'btn-neutral' })),
        speak: function () { return speakJoin([t('paidConfirmTitle'), b.name + ', ' + fmt(b.amount)]); },
        back: function () { go('home'); },
        actions: {
          yes: function () {
            state = L.markBigSpendPaid(state, b.id, nowISO());
            save();
            go('done', { kind: 'paid', src: b.source });
          },
          no: function () { go('home'); }
        }
      };
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
            b.check = L.checkPurchase(state, b.source, b.amount, new Date());
            if (b.check.level === 'green') {
              recordChoice('bought');
              go('done', { kind: 'green' });
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
      var loseNames = lose.map(function (r) { return r.kind === 'save' ? t('loseSave') : r.name; });
      if (lose.length) {
        loseHTML = '<p class="lose-heading">' + esc(t('loseHeading')) + '</p><ul class="lose-list">' +
          lose.map(function (r, i) {
            return '<li>' + ic(r.kind === 'save' ? I.pig : r.icon) + '<span>' + esc(loseNames[i]) + '</span></li>';
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
            else { recordChoice('bought'); go('done', { kind: 'bought' }); }
          }
        }
      };
    },

    // One extra check after a red alert.
    sure: function () {
      var c = ui.buy.check;
      var first = c.atRisk[0];
      var text, icon;
      if (c.reason === 'notEnough') { text = t('sureNotEnough'); icon = I.warn; }
      else if (first && first.kind === 'bigSpend') { text = t('sureBig', { thing: first.name }); icon = first.icon; }
      else { text = t('sureSave'); icon = I.pig; }
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
          buy: function () { recordChoice('bought'); go('done', { kind: 'bought' }); }
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
            state = L.addMoney(state, d.src, g.amount, nowISO());
            ui.got = null;
            save();
            go('done', { kind: 'got', src: d.src });
          }
        }
      };
    },

    // ----- What I bought -----
    list: function (p) {
      var items = state.purchases.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
      var waited = items.filter(function (x) { return x.choice === 'waited'; }).length;
      var count = waited === 0 ? t('waitedNone') : waited === 1 ? t('waitedOne') : t('waitedMany', { n: waited });
      var spoken = [t('listTitle'), items.length ? count : t('listEmpty')];

      var listHTML = items.length ? '<ul class="cards">' + items.map(function (x) {
        var cat = catInfo(x.category);
        var thing = t(cat.text);
        var isWait = x.choice === 'waited';
        spoken.push(thing + ', ' + fmt(x.amount) + ', ' + L.formatShortDate(x.date) + (isWait ? ', ' + t('youWaited') : ''));
        return '<li class="card item-card buy-card' + (isWait ? ' is-waited' : '') + '">' +
          '<div class="item">' + ic(cat.icon, 'item-ic') + '<div class="item-main">' +
          '<p class="item-name">' + esc(thing) + ' <strong>' + fmt(x.amount) + '</strong></p>' +
          '<p class="item-meta">' + ic(srcIcon(x.source)) + '<span>' + esc(srcName(x.source)) + '</span></p>' +
          '<p class="item-meta"><span aria-hidden="true">' + esc(L.formatShortDate(x.date)) + '</span>' +
          '<span class="sr-only">' + esc(L.formatLongDate(x.date)) + '</span></p>' +
          (isWait ? '<p class="waited-tag">' + ic(I.star) + '<span>' + esc(t('youWaited')) + '</span></p>' : '') +
          '</div></div>' +
          button('remove', t('bigRemove'), I.remove, {
            cls: 'btn-small btn-secondary', data: { id: x.id },
            aria: t('removeLabel', { thing: thing, amount: words(x.amount), date: L.formatLongDate(x.date) })
          }) + '</li>';
      }).join('') + '</ul>' : '<p class="big-line">' + esc(t('listEmpty')) + '</p>';

      return {
        title: t('listTitle'),
        html: h1(t('listTitle'), I.list) +
          (items.length ? '<p class="count-line">' + (waited ? ic(I.star) : '') + '<span>' + esc(count) + '</span></p>' : '') +
          listHTML + actions(homeBtn()),
        speak: function () { return speakJoin(spoken); },
        back: function () { go('home'); },
        actions: { remove: function (d) { go('removeConfirm', { id: d.id }); } }
      };
    },

    removeConfirm: function (p) {
      var x = state.purchases.filter(function (y) { return y.id === p.id; })[0];
      if (!x) return SCREENS.list({});
      var cat = catInfo(x.category);
      return {
        title: t('removeTitle'),
        html: h1(t('removeTitle')) + '<div class="card item-card item-card-big">' +
          itemBody({ icon: cat.icon, name: t(cat.text), amount: x.amount, source: x.source }) + '</div>' +
          actions(button('keep', t('noKeep'), I.check, { cls: 'btn-go' }) + button('yes', t('yesRemove'), I.remove, { cls: 'btn-neutral' })),
        speak: function () { return speakJoin([t('removeTitle'), t(cat.text) + ', ' + fmt(x.amount)]); },
        back: function () { go('list'); },
        actions: {
          keep: function () { go('list'); },
          yes: function () {
            state = L.removePurchase(state, x.id);
            save();
            go('list');
            announce(t('removedText'), false);
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

  function saveGoalScreen(src, titleKey, backTo, nextTo) {
    var have = L.currentMoney(state, src);
    var seenKey = src + 'Save';
    return keypadScreen({
      step: 3, title: t(titleKey), icon: I.pig, allowZero: true,
      afterTitle: '<div class="hint-box">' + ic(I.pig) + '<div><p>' + esc(t('saveHint')) + '</p><p>' + esc(t('saveHint2')) + '</p></div></div>' +
        '<p class="have-line">' + ic(srcIcon(src)) + '<span>' + esc(t('youHave', { amount: fmt(have) })) + '</span></p>',
      speakExtra: [t('saveHint'), t('saveHint2'), t('youHave', { amount: fmt(have) })],
      initial: initialFor(seenKey, state.sources[src].saveGoal),
      validate: function (v) { return L.saveGoalOk(v, have) ? null : t('saveTooMuch'); },
      onBack: function () { go(backTo); },
      onNext: function (v) { state.sources[src].saveGoal = v; ui.seen[seenKey] = true; save(); go(nextTo); }
    });
  }

  function recordChoice(choice) {
    var b = ui.buy;
    state = L.recordPurchase(state, {
      amount: b.amount,
      source: b.source,
      category: b.category,
      date: nowISO(),
      hadAlert: b.check.level === 'green' ? 'none' : b.check.level,
      choice: choice
    });
    save();
  }

  // ---------- start ----------

  function boot(saved) {
    var r = L.startMonth(saved, new Date());
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
    if (state.month !== L.monthKey(new Date())) boot(state);
    else if (current && current.name === 'home') go('home');
  });

  document.querySelector('.brand-name').textContent = t('appName');
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
