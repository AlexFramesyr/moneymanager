/*
 * Money Buddy – budgeting math.
 * Pure functions only: no DOM, no storage, no clock (dates are passed in).
 * Works as a plain <script> in the browser (window.MBLogic) and in Node (require).
 *
 * Money is stored in dollars (as in the saved data), but every comparison is
 * done in whole cents so rounding can never move an alert boundary.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MBLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var SOURCES = ['bank', 'cuse'];
  var MAX_AMOUNT = 9999.99;
  var HISTORY_LIMIT = 24;

  // ---------- small helpers ----------

  function toCents(x) {
    var n = Number(x);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  function fromCents(c) {
    return Math.round(c) / 100;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function sumCents(list) {
    return list.reduce(function (s, x) { return s + toCents(x.amount); }, 0);
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function isSource(s) {
    return SOURCES.indexOf(s) !== -1;
  }

  // ---------- calendar ----------

  /** Weekly spending threshold as a whole percent, by day of the month. */
  function weekThresholdPercent(day) {
    if (day <= 7) return 50;
    if (day <= 14) return 40;
    if (day <= 21) return 20;
    return 10;
  }

  function weekThreshold(day) {
    return weekThresholdPercent(day) / 100;
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** "YYYY-MM" in the phone's local time. */
  function monthKey(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1);
  }

  /** month1 is 1–12. */
  function daysInMonth(year, month1) {
    return new Date(year, month1, 0).getDate();
  }

  /** Days left in the month, counting today. Last day of the month = 1. */
  function daysLeftInMonth(date) {
    return daysInMonth(date.getFullYear(), date.getMonth() + 1) - date.getDate() + 1;
  }

  // ---------- money per source ----------

  function sourceOf(state, source) {
    return (state.sources && state.sources[source]) || { start: 0, added: [], saveGoal: 0 };
  }

  function boughtFrom(state, source) {
    return (state.purchases || []).filter(function (p) {
      return p.source === source && p.choice === 'bought';
    });
  }

  function bigSpendsFor(state, source, paid) {
    return (state.bigSpends || []).filter(function (b) {
      return b.source === source && !!b.paid === paid;
    });
  }

  function currentCents(state, source) {
    var s = sourceOf(state, source);
    return toCents(s.start) + sumCents(s.added || []) -
      sumCents(boughtFrom(state, source)) -
      sumCents(bigSpendsFor(state, source, true));
  }

  function protectedCents(state, source) {
    return toCents(sourceOf(state, source).saveGoal) + sumCents(bigSpendsFor(state, source, false));
  }

  function freeCents(state, source) {
    return currentCents(state, source) - protectedCents(state, source);
  }

  function currentMoney(state, source) { return fromCents(currentCents(state, source)); }
  function protectedMoney(state, source) { return fromCents(protectedCents(state, source)); }
  function freeMoney(state, source) { return fromCents(freeCents(state, source)); }

  /**
   * Everything the screens need about one source.
   * plannedFree = money free to spend for the whole month before any purchases.
   */
  function sourceSummary(state, source) {
    var s = sourceOf(state, source);
    var allBig = (state.bigSpends || []).filter(function (b) { return b.source === source; });
    var plannedFree = toCents(s.start) + sumCents(s.added || []) - toCents(s.saveGoal) - sumCents(allBig);
    return {
      current: currentMoney(state, source),
      protected: protectedMoney(state, source),
      free: freeMoney(state, source),
      saveGoal: fromCents(toCents(s.saveGoal)),
      unpaidBig: fromCents(sumCents(bigSpendsFor(state, source, false))),
      plannedFree: fromCents(plannedFree)
    };
  }

  /**
   * Home screen dot. Compares the share of free money left with the share of
   * the month left (not counting today, so today's spending is allowed).
   *   red    – free money is $0 or less, or under half the expected pace
   *   yellow – under 85% of the expected pace
   *   green  – on track
   */
  function homeStatus(state, source, date) {
    var free = freeCents(state, source);
    var sum = sourceSummary(state, source);
    var planned = toCents(sum.plannedFree);
    if (free <= 0 || planned <= 0) return 'red';
    var total = daysInMonth(date.getFullYear(), date.getMonth() + 1);
    var expected = (daysLeftInMonth(date) - 1) / total;
    var ratio = free / planned;
    if (ratio < expected * 0.5) return 'red';
    if (ratio < expected * 0.85) return 'yellow';
    return 'green';
  }

  // ---------- the purchase check ----------

  /**
   * What a purchase would take away. Money beyond free money comes out of
   * unpaid big spends first (in the order they were added), then savings.
   */
  function whatWouldHurt(state, source, amount) {
    // If free money is already negative, that gap counts too.
    var short = toCents(amount) - freeCents(state, source);
    var out = [];
    if (short <= 0) return out;
    bigSpendsFor(state, source, false).forEach(function (b) {
      if (short <= 0) return;
      var c = toCents(b.amount);
      if (c <= 0) return;
      var take = Math.min(short, c);
      out.push({ kind: 'bigSpend', id: b.id, name: b.name, icon: b.icon, amount: fromCents(c), short: fromCents(take) });
      short -= take;
    });
    var goal = toCents(sourceOf(state, source).saveGoal);
    if (short > 0 && goal > 0) {
      out.push({ kind: 'save', amount: fromCents(goal), short: fromCents(Math.min(short, goal)) });
    }
    return out;
  }

  /**
   * Alert level for buying `amount` from `source` on `date`.
   * Checked from most to least severe.
   */
  function checkPurchase(state, source, amount, date) {
    var a = toCents(amount);
    var cur = currentCents(state, source);
    var free = freeCents(state, source);
    var pct = weekThresholdPercent(date.getDate());
    var level, reason;

    if (a > cur) { level = 'red'; reason = 'notEnough'; }
    else if (a > free) { level = 'red'; reason = 'stop'; }
    else if (a * 100 > 2 * pct * free) { level = 'orange'; reason = 'careful'; }
    else if (a * 100 > pct * free) { level = 'yellow'; reason = 'think'; }
    else { level = 'green'; reason = 'ok'; }

    return {
      level: level,
      reason: reason,
      thresholdPercent: pct,
      amount: fromCents(a),
      current: fromCents(cur),
      free: fromCents(free),
      currentAfter: fromCents(cur - a),
      freeAfter: fromCents(free - a),
      atRisk: level === 'red' ? whatWouldHurt(state, source, amount) : []
    };
  }

  // ---------- setup checks ----------

  function saveGoalOk(goal, have) {
    return toCents(goal) <= toCents(have);
  }

  /** Sources where save goal + big spends is more than the money they have. */
  function planShortfalls(state) {
    return SOURCES.map(function (source) {
      var s = sourceOf(state, source);
      var have = toCents(s.start) + sumCents(s.added || []);
      var need = toCents(s.saveGoal) + sumCents((state.bigSpends || []).filter(function (b) { return b.source === source; }));
      return { source: source, need: fromCents(need), have: fromCents(have), short: fromCents(need - have) };
    }).filter(function (r) { return r.short > 0; });
  }

  // ---------- state changes (each returns a new state) ----------

  function createState(month, opts) {
    opts = opts || {};
    return {
      version: SCHEMA_VERSION,
      month: month,
      setupComplete: false,
      sources: {
        bank: { start: 0, added: [], saveGoal: 0 },
        cuse: { start: 0, added: [], saveGoal: 0 }
      },
      bigSpends: [],
      purchases: [],
      suggestions: opts.suggestions || [],
      history: opts.history || [],
      settings: Object.assign({ autoRead: true }, opts.settings || {})
    };
  }

  function addMoney(state, source, amount, dateISO) {
    var next = clone(state);
    next.sources[source].added.push({ amount: fromCents(toCents(amount)), date: dateISO });
    return next;
  }

  function addBigSpend(state, item) {
    var next = clone(state);
    next.bigSpends.push({
      id: item.id || makeId(),
      name: item.name,
      icon: item.icon,
      amount: fromCents(toCents(item.amount)),
      source: item.source,
      paid: false,
      paidDate: null
    });
    return next;
  }

  function removeBigSpend(state, id) {
    var next = clone(state);
    next.bigSpends = next.bigSpends.filter(function (b) { return b.id !== id; });
    return next;
  }

  function markBigSpendPaid(state, id, dateISO) {
    var next = clone(state);
    next.bigSpends.forEach(function (b) {
      if (b.id === id) { b.paid = true; b.paidDate = dateISO; }
    });
    return next;
  }

  function recordPurchase(state, p) {
    var next = clone(state);
    next.purchases.push({
      id: p.id || makeId(),
      amount: fromCents(toCents(p.amount)),
      source: p.source,
      category: p.category,
      date: p.date,
      hadAlert: p.hadAlert || 'none',
      choice: p.choice || 'bought'
    });
    return next;
  }

  function removePurchase(state, id) {
    var next = clone(state);
    next.purchases = next.purchases.filter(function (p) { return p.id !== id; });
    return next;
  }

  /** Money left at the end of the month counts as "saved". */
  function monthRecap(state) {
    var saved = SOURCES.reduce(function (s, src) { return s + Math.max(0, currentCents(state, src)); }, 0);
    var waited = (state.purchases || []).filter(function (p) { return p.choice === 'waited'; });
    return {
      month: state.month,
      savedTotal: fromCents(saved),
      waitedCount: waited.length,
      waitedTotal: fromCents(sumCents(waited))
    };
  }

  /**
   * Called on every app open. Starts fresh if there is no saved state,
   * keeps the state if it is this month, or archives the old month.
   */
  function startMonth(saved, date) {
    var key = monthKey(date);
    if (!saved) return { state: createState(key), recap: null, changed: true };
    if (saved.month === key) return { state: saved, recap: null, changed: false };

    var history = (saved.history || []).slice();
    var recap = null;
    var suggestions;
    if (saved.setupComplete) {
      recap = monthRecap(saved);
      history.push({
        month: saved.month,
        recap: recap,
        sources: clone(saved.sources),
        bigSpends: clone(saved.bigSpends),
        purchases: clone(saved.purchases)
      });
      suggestions = saved.bigSpends.map(function (b) {
        return { name: b.name, icon: b.icon, amount: b.amount, source: b.source };
      });
    } else {
      // An unfinished setup from an old month: keep its ideas, drop the rest.
      suggestions = (saved.suggestions || []).concat(saved.bigSpends.map(function (b) {
        return { name: b.name, icon: b.icon, amount: b.amount, source: b.source };
      }));
    }
    if (history.length > HISTORY_LIMIT) history = history.slice(history.length - HISTORY_LIMIT);
    var state = createState(key, { history: history, settings: saved.settings, suggestions: suggestions });
    return { state: state, recap: recap, changed: true };
  }

  // ---------- loading saved data safely ----------

  function money(x) {
    var n = Number(x);
    if (!Number.isFinite(n) || n < 0) return 0;
    return fromCents(toCents(Math.min(n, MAX_AMOUNT * 100)));
  }

  function str(x, fallback) {
    return typeof x === 'string' ? x.slice(0, 60) : fallback;
  }

  /**
   * Returns a clean copy of saved data, or null if it is unusable.
   * Bad single entries are dropped instead of failing the whole file.
   */
  function sanitizeState(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.version !== SCHEMA_VERSION) return null;
    if (typeof raw.month !== 'string' || !/^\d{4}-\d{2}$/.test(raw.month)) return null;

    var s = createState(raw.month, {
      settings: raw.settings && typeof raw.settings === 'object'
        ? { autoRead: raw.settings.autoRead !== false } : undefined
    });
    s.setupComplete = raw.setupComplete === true;

    SOURCES.forEach(function (src) {
      var r = raw.sources && raw.sources[src];
      if (!r || typeof r !== 'object') return;
      s.sources[src].start = money(r.start);
      s.sources[src].saveGoal = money(r.saveGoal);
      s.sources[src].added = Array.isArray(r.added) ? r.added.filter(function (a) {
        return a && Number(a.amount) > 0;
      }).map(function (a) { return { amount: money(a.amount), date: str(a.date, '') }; }) : [];
    });

    var cleanBig = function (b) {
      return {
        id: str(b.id, makeId()),
        name: str(b.name, 'Big thing'),
        icon: str(b.icon, '⭐'),
        amount: money(b.amount),
        source: b.source,
        paid: b.paid === true,
        paidDate: b.paid === true ? str(b.paidDate, null) : null
      };
    };
    var okBig = function (b) { return b && typeof b === 'object' && isSource(b.source) && Number(b.amount) > 0; };

    s.bigSpends = Array.isArray(raw.bigSpends) ? raw.bigSpends.filter(okBig).map(cleanBig) : [];

    s.suggestions = Array.isArray(raw.suggestions) ? raw.suggestions.filter(okBig).map(function (b) {
      return { name: str(b.name, 'Big thing'), icon: str(b.icon, '⭐'), amount: money(b.amount), source: b.source };
    }) : [];

    var alerts = ['none', 'yellow', 'orange', 'red'];
    s.purchases = Array.isArray(raw.purchases) ? raw.purchases.filter(function (p) {
      return p && typeof p === 'object' && isSource(p.source) && Number(p.amount) > 0 &&
        (p.choice === 'bought' || p.choice === 'waited');
    }).map(function (p) {
      return {
        id: str(p.id, makeId()),
        amount: money(p.amount),
        source: p.source,
        category: str(p.category, 'other'),
        date: str(p.date, new Date(0).toISOString()),
        hadAlert: alerts.indexOf(p.hadAlert) !== -1 ? p.hadAlert : 'none',
        choice: p.choice
      };
    }) : [];

    s.history = Array.isArray(raw.history) ? raw.history.filter(function (h) {
      return h && typeof h === 'object' && typeof h.month === 'string';
    }).slice(-HISTORY_LIMIT) : [];

    return s;
  }

  // ---------- keypad ----------

  /**
   * Applies one keypad press. key is "0"–"9", "." or "back".
   * Returns the new text (unchanged if the key is not allowed).
   */
  function pressKey(text, key) {
    text = text || '';
    if (key === 'back') return text.slice(0, -1);
    if (key === '.') {
      if (text.indexOf('.') !== -1) return text;
      return (text === '' ? '0' : text) + '.';
    }
    if (!/^[0-9]$/.test(key)) return text;

    var dot = text.indexOf('.');
    if (dot !== -1 && text.length - dot - 1 >= 2) return text; // already 2 decimals
    var next = text === '0' ? key : text + key;               // no leading zeros
    var whole = next.split('.')[0];
    if (whole.length > 4) return text;
    if (Number(next) > MAX_AMOUNT) return text;
    return next;
  }

  /** Number typed on the keypad, or NaN if nothing is typed. */
  function keypadValue(text) {
    if (!text) return NaN;
    var n = Number(text);
    return Number.isFinite(n) ? fromCents(toCents(n)) : NaN;
  }

  /** Text to put back into the keypad for an existing amount. */
  function amountToKeypad(amount) {
    var c = toCents(amount);
    if (c <= 0) return '';
    return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2);
  }

  // ---------- formatting ----------

  /** "$12", "$12.50", "$1,234", "−$5". Whole dollars drop the cents. */
  function formatMoney(amount) {
    var c = toCents(amount);
    var neg = c < 0;
    c = Math.abs(c);
    var dollars = Math.floor(c / 100);
    var cents = c % 100;
    var text = '$' + String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (cents ? '.' + pad2(cents) : '');
    return (neg ? '−' : '') + text;
  }

  /** "12 dollars and 50 cents" – used in aria-labels. */
  function moneyWords(amount) {
    var c = toCents(amount);
    var neg = c < 0;
    c = Math.abs(c);
    var d = Math.floor(c / 100);
    var cents = c % 100;
    var parts = [];
    if (d > 0 || cents === 0) parts.push(d + (d === 1 ? ' dollar' : ' dollars'));
    if (cents > 0) parts.push(cents + (cents === 1 ? ' cent' : ' cents'));
    return (neg ? 'minus ' : '') + parts.join(' and ');
  }

  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];

  /** "Mon, Oct 5" in local time. */
  function formatShortDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  /** "Monday, October 5" – for screen readers. */
  function formatLongDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return DAYS_LONG[d.getDay()] + ', ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getDate();
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    SOURCES: SOURCES,
    MAX_AMOUNT: MAX_AMOUNT,
    weekThresholdPercent: weekThresholdPercent,
    weekThreshold: weekThreshold,
    monthKey: monthKey,
    daysInMonth: daysInMonth,
    daysLeftInMonth: daysLeftInMonth,
    currentMoney: currentMoney,
    protectedMoney: protectedMoney,
    freeMoney: freeMoney,
    sourceSummary: sourceSummary,
    homeStatus: homeStatus,
    whatWouldHurt: whatWouldHurt,
    checkPurchase: checkPurchase,
    saveGoalOk: saveGoalOk,
    planShortfalls: planShortfalls,
    createState: createState,
    addMoney: addMoney,
    addBigSpend: addBigSpend,
    removeBigSpend: removeBigSpend,
    markBigSpendPaid: markBigSpendPaid,
    recordPurchase: recordPurchase,
    removePurchase: removePurchase,
    monthRecap: monthRecap,
    startMonth: startMonth,
    sanitizeState: sanitizeState,
    pressKey: pressKey,
    keypadValue: keypadValue,
    amountToKeypad: amountToKeypad,
    formatMoney: formatMoney,
    moneyWords: moneyWords,
    formatShortDate: formatShortDate,
    formatLongDate: formatLongDate
  };
});
