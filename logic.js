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

  var SCHEMA_VERSION = 2;
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

  function indexById(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
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

  // ---------- day keys ("YYYY-MM-DD", the phone's local day) ----------
  // A day key must never go through new Date("YYYY-MM-DD"): that reads it as
  // UTC midnight, which is the evening before in Syracuse.

  /** "YYYY-MM-DD" in the phone's local time. */
  function dayKey(date) {
    return monthKey(date) + '-' + pad2(date.getDate());
  }

  /** Local noon on that day (noon so daylight saving can never move it). */
  function parseDayKey(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }

  function isDayKey(x) {
    if (typeof x !== 'string') return false;
    var d = parseDayKey(x);
    return !!d && dayKey(d) === x;
  }

  /** Whole days from one day key to another (tomorrow = 1). */
  function daysBetween(fromKey, toKey) {
    return Math.round((parseDayKey(toKey) - parseDayKey(fromKey)) / 86400000);
  }

  /** The days of a "YYYY-MM" month. lead = blank cells before day 1 (Sunday first). */
  function monthGrid(month) {
    var y = Number(month.slice(0, 4));
    var m = Number(month.slice(5, 7));
    var days = [];
    for (var d = 1; d <= daysInMonth(y, m); d++) days.push({ day: d, key: month + '-' + pad2(d) });
    return { year: y, month: m, lead: new Date(y, m - 1, 1).getDay(), days: days };
  }

  // ---------- money per source ----------

  function sourceOf(state, source) {
    return (state.sources && state.sources[source]) || { start: 0, added: [], adjustments: [], saveGoal: 0 };
  }

  /** Start money plus money added plus fixes. */
  function haveCents(s) {
    return toCents(s.start) + sumCents(s.added || []) + sumCents(s.adjustments || []);
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
    return haveCents(s) -
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
    var plannedFree = haveCents(s) - toCents(s.saveGoal) - sumCents(allBig);
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
      out.push({ kind: 'bigSpend', id: b.id, name: b.name, icon: b.icon, date: b.date || null, amount: fromCents(c), short: fromCents(take) });
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
      var have = haveCents(s);
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
        bank: { start: 0, added: [], adjustments: [], saveGoal: 0 },
        cuse: { start: 0, added: [], adjustments: [], saveGoal: 0 }
      },
      bigSpends: [],
      purchases: [],
      suggestions: opts.suggestions || [],
      history: opts.history || [],
      settings: Object.assign({ autoRead: true, calendarView: null }, opts.settings || {})
    };
  }

  function addMoney(state, source, amount, dateISO, id) {
    var next = clone(state);
    next.sources[source].added.push({ id: id || makeId(), amount: fromCents(toCents(amount)), date: dateISO });
    return next;
  }

  /** How far the app's number is from the real one (+ means the app is too low). */
  function adjustmentNeeded(state, source, realAmount) {
    return fromCents(toCents(realAmount) - currentCents(state, source));
  }

  /**
   * "Fix my money": saves only the difference, so past entries stay as they were.
   * Nothing is saved when the number is already right.
   */
  function addAdjustment(state, source, realAmount, dateISO, id) {
    var next = clone(state);
    var diff = toCents(realAmount) - currentCents(state, source);
    if (diff !== 0) next.sources[source].adjustments.push({ id: id || makeId(), amount: fromCents(diff), date: dateISO });
    return next;
  }

  function setSaveGoal(state, source, amount) {
    var next = clone(state);
    next.sources[source].saveGoal = fromCents(toCents(amount));
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
      date: isDayKey(item.date) ? item.date : null,
      paid: false,
      paidDate: null,
      notYetOn: null
    });
    return next;
  }

  /** changes may hold amount and/or date (date null = "I don't know"). */
  function updateBigSpend(state, id, changes) {
    var next = clone(state);
    next.bigSpends.forEach(function (b) {
      if (b.id !== id) return;
      if ('amount' in changes) b.amount = fromCents(toCents(changes.amount));
      if ('date' in changes) { b.date = isDayKey(changes.date) ? changes.date : null; b.notYetOn = null; }
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

  /** "Not paid yet": for a big spend marked paid by mistake. */
  function unmarkBigSpendPaid(state, id) {
    var next = clone(state);
    next.bigSpends.forEach(function (b) {
      if (b.id === id) { b.paid = false; b.paidDate = null; }
    });
    return next;
  }

  /** "Not yet" on a reminder: don't ask again until tomorrow. */
  function setNotYet(state, id, todayKey) {
    var next = clone(state);
    next.bigSpends.forEach(function (b) {
      if (b.id === id) b.notYetOn = todayKey;
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

  function removeAdded(state, source, id) {
    var next = clone(state);
    next.sources[source].added = next.sources[source].added.filter(function (a) { return a.id !== id; });
    return next;
  }

  function removeAdjustment(state, source, id) {
    var next = clone(state);
    next.sources[source].adjustments = next.sources[source].adjustments.filter(function (a) { return a.id !== id; });
    return next;
  }

  // ---------- "What I bought": purchases, money in, and fixes ----------

  /** Everything in one list, newest first. kind is 'purchase', 'added' or 'adjustment'. */
  function activityList(state) {
    var out = (state.purchases || []).map(function (p) { return Object.assign({ kind: 'purchase' }, p); });
    SOURCES.forEach(function (src) {
      var s = sourceOf(state, src);
      (s.added || []).forEach(function (a) { out.push({ kind: 'added', id: a.id, amount: a.amount, source: src, date: a.date }); });
      (s.adjustments || []).forEach(function (a) { out.push({ kind: 'adjustment', id: a.id, amount: a.amount, source: src, date: a.date }); });
    });
    return out.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      if (a.x.date !== b.x.date) return a.x.date < b.x.date ? 1 : -1;
      return b.i - a.i;
    }).map(function (o) { return o.x; });
  }

  /** What removing an entry does to "You have": 'up', 'down' or 'none'. */
  function removalEffect(entry) {
    if (entry.kind === 'purchase') return entry.choice === 'bought' ? 'up' : 'none';
    if (entry.kind === 'added') return 'down';
    var c = toCents(entry.amount);
    return c > 0 ? 'down' : c < 0 ? 'up' : 'none';
  }

  function entryList(state, entry) {
    if (entry.kind === 'purchase') return state.purchases;
    return state.sources[entry.source][entry.kind === 'added' ? 'added' : 'adjustments'];
  }

  function removeEntry(state, entry) {
    if (entry.kind === 'purchase') return removePurchase(state, entry.id);
    if (entry.kind === 'added') return removeAdded(state, entry.source, entry.id);
    return removeAdjustment(state, entry.source, entry.id);
  }

  // ---------- undo ----------
  // Each undo note says how to reverse exactly one change, and touches only
  // that one entry, so it can never wipe out anything else.
  //   { type: 'purchase', id }                  – take back a purchase
  //   { type: 'added', source, id }             – take back "I got money"
  //   { type: 'adjustment', source, id }        – take back "Fix my money"
  //   { type: 'saveGoal', source, before }      – put the old save goal back
  //   { type: 'bigSpend', id, before, index }   – put a big spend back the way it was
  //   { type: 'restore', kind, source, record, index } – put a removed entry back

  /** Call BEFORE changing, adding (new id) or removing a big spend. */
  function bigSpendUndo(state, id) {
    var i = indexById(state.bigSpends, id);
    return { type: 'bigSpend', id: id, before: i === -1 ? null : clone(state.bigSpends[i]), index: i };
  }

  /** Call BEFORE removing an entry from "What I bought". */
  function removeUndo(state, entry) {
    var list = entryList(state, entry);
    var i = indexById(list, entry.id);
    return { type: 'restore', kind: entry.kind, source: entry.source, record: i === -1 ? null : clone(list[i]), index: i };
  }

  function saveGoalUndo(state, source) {
    return { type: 'saveGoal', source: source, before: sourceOf(state, source).saveGoal };
  }

  function putBack(list, record, index) {
    if (indexById(list, record.id) !== -1) return;
    list.splice(Math.max(0, Math.min(index, list.length)), 0, record);
  }

  function undo(state, u) {
    if (!u) return state;
    if (u.type === 'purchase') return removePurchase(state, u.id);
    if (u.type === 'added') return removeAdded(state, u.source, u.id);
    if (u.type === 'adjustment') return removeAdjustment(state, u.source, u.id);
    if (u.type === 'saveGoal') return setSaveGoal(state, u.source, u.before);
    var next = clone(state);
    if (u.type === 'bigSpend') {
      var i = indexById(next.bigSpends, u.id);
      if (!u.before) { if (i !== -1) next.bigSpends.splice(i, 1); }
      else if (i !== -1) next.bigSpends[i] = clone(u.before);
      else putBack(next.bigSpends, clone(u.before), u.index);
    } else if (u.type === 'restore' && u.record) {
      putBack(entryList(next, u), clone(u.record), u.index);
    }
    return next;
  }

  // ---------- dated big spends ----------

  function bigSpendsOn(state, key) {
    return (state.bigSpends || []).filter(function (b) { return b.date === key; });
  }

  function byDate(a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  }

  /**
   * Home screen reminders for unpaid big spends with a day.
   *   dueToday – the day is today
   *   overdue  – the day has passed (the money stays protected)
   *   soon     – 1 to 3 days away: [{ item, days }]
   * "Not yet" hides dueToday and overdue ones until tomorrow.
   */
  function reminders(state, todayKey) {
    var r = { dueToday: [], overdue: [], soon: [] };
    (state.bigSpends || []).filter(function (b) { return !b.paid && isDayKey(b.date); }).sort(byDate).forEach(function (b) {
      var asked = b.notYetOn === todayKey;
      var days = daysBetween(todayKey, b.date);
      if (days === 0) { if (!asked) r.dueToday.push(b); }
      else if (days < 0) { if (!asked) r.overdue.push(b); }
      else if (days <= 3) r.soon.push({ item: b, days: days });
    });
    return r;
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

  /** Like money(), but a fix can be negative. */
  function signedMoney(x) {
    var n = Number(x);
    if (!Number.isFinite(n)) return 0;
    return n < 0 ? -money(-n) : money(n);
  }

  function str(x, fallback) {
    return typeof x === 'string' ? x.slice(0, 60) : fallback;
  }

  function dayOrNull(x) {
    return isDayKey(x) ? x : null;
  }

  // ---------- upgrading old saved data ----------

  /** v1 → v2 for one month of data (the live month or an archived one). Changes m in place. */
  function upgradeMonthV1(m) {
    if (m.sources && typeof m.sources === 'object') {
      SOURCES.forEach(function (src) {
        var s = m.sources[src];
        if (!s || typeof s !== 'object') return;
        if (Array.isArray(s.added)) {
          s.added = s.added.map(function (a) {
            return a && typeof a === 'object' && typeof a.id !== 'string' ? Object.assign({ id: makeId() }, a) : a;
          });
        }
        if (!Array.isArray(s.adjustments)) s.adjustments = [];
      });
    }
    if (Array.isArray(m.bigSpends)) {
      m.bigSpends.forEach(function (b) {
        if (!b || typeof b !== 'object') return;
        if (!('date' in b)) b.date = null;
        if (!('notYetOn' in b)) b.notYetOn = null;
      });
    }
  }

  /**
   * Brings saved data from an older version of the app up to this one.
   * Never drops anything: version 1 data only gains new, empty fields
   * (ids for "I got money", empty fixes, no day on big spends).
   * Data that is already current, or unknown, is returned as it is.
   */
  function migrate(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== 1) return raw;
    var next = clone(raw);
    upgradeMonthV1(next);
    if (Array.isArray(next.history)) {
      next.history.forEach(function (h) { if (h && typeof h === 'object') upgradeMonthV1(h); });
    }
    next.version = 2;
    return next;
  }

  /**
   * Returns a clean copy of saved data, or null if it is unusable.
   * Bad single entries are dropped instead of failing the whole file.
   * Run migrate() first for data from an older version.
   */
  function sanitizeState(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.version !== SCHEMA_VERSION) return null;
    if (typeof raw.month !== 'string' || !/^\d{4}-\d{2}$/.test(raw.month)) return null;

    var s = createState(raw.month, {
      settings: raw.settings && typeof raw.settings === 'object' ? {
        autoRead: raw.settings.autoRead !== false,
        calendarView: raw.settings.calendarView === 'grid' || raw.settings.calendarView === 'list' ? raw.settings.calendarView : null
      } : undefined
    });
    s.setupComplete = raw.setupComplete === true;

    SOURCES.forEach(function (src) {
      var r = raw.sources && raw.sources[src];
      if (!r || typeof r !== 'object') return;
      s.sources[src].start = money(r.start);
      s.sources[src].saveGoal = money(r.saveGoal);
      s.sources[src].added = Array.isArray(r.added) ? r.added.filter(function (a) {
        return a && Number(a.amount) > 0;
      }).map(function (a) { return { id: str(a.id, makeId()), amount: money(a.amount), date: str(a.date, '') }; }) : [];
      s.sources[src].adjustments = Array.isArray(r.adjustments) ? r.adjustments.filter(function (a) {
        return a && signedMoney(a.amount) !== 0;
      }).map(function (a) { return { id: str(a.id, makeId()), amount: signedMoney(a.amount), date: str(a.date, '') }; }) : [];
    });

    var cleanBig = function (b) {
      return {
        id: str(b.id, makeId()),
        name: str(b.name, 'Big thing'),
        icon: str(b.icon, '⭐'),
        amount: money(b.amount),
        source: b.source,
        date: dayOrNull(b.date),
        paid: b.paid === true,
        paidDate: b.paid === true ? str(b.paidDate, null) : null,
        notYetOn: dayOrNull(b.notYetOn)
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

  /** A Date from a full ISO time or a "YYYY-MM-DD" day key (read as a local day). */
  function toDate(x) {
    var d = isDayKey(x) ? parseDayKey(x) : new Date(x);
    return isNaN(d.getTime()) ? null : d;
  }

  /** "Mon, Oct 5" in local time. Takes an ISO time or a day key. */
  function formatShortDate(x) {
    var d = toDate(x);
    if (!d) return '';
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  /** "Monday, October 5" – for screen readers. */
  function formatLongDate(x) {
    var d = toDate(x);
    if (!d) return '';
    return DAYS_LONG[d.getDay()] + ', ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getDate();
  }

  /** "Oct 12" */
  function formatMonthDay(x) {
    var d = toDate(x);
    return d ? MONTHS[d.getMonth()] + ' ' + d.getDate() : '';
  }

  /** "October 12" */
  function formatMonthDayLong(x) {
    var d = toDate(x);
    return d ? MONTHS_LONG[d.getMonth()] + ' ' + d.getDate() : '';
  }

  /** "October 2026" from "2026-10" */
  function formatMonthYear(month) {
    var d = parseDayKey(month + '-01');
    return d ? MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear() : '';
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
    dayKey: dayKey,
    parseDayKey: parseDayKey,
    isDayKey: isDayKey,
    daysBetween: daysBetween,
    monthGrid: monthGrid,
    makeId: makeId,
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
    adjustmentNeeded: adjustmentNeeded,
    addAdjustment: addAdjustment,
    setSaveGoal: setSaveGoal,
    addBigSpend: addBigSpend,
    updateBigSpend: updateBigSpend,
    removeBigSpend: removeBigSpend,
    markBigSpendPaid: markBigSpendPaid,
    unmarkBigSpendPaid: unmarkBigSpendPaid,
    setNotYet: setNotYet,
    recordPurchase: recordPurchase,
    removePurchase: removePurchase,
    removeAdded: removeAdded,
    removeAdjustment: removeAdjustment,
    activityList: activityList,
    removalEffect: removalEffect,
    removeEntry: removeEntry,
    bigSpendUndo: bigSpendUndo,
    removeUndo: removeUndo,
    saveGoalUndo: saveGoalUndo,
    undo: undo,
    bigSpendsOn: bigSpendsOn,
    reminders: reminders,
    monthRecap: monthRecap,
    startMonth: startMonth,
    migrate: migrate,
    sanitizeState: sanitizeState,
    pressKey: pressKey,
    keypadValue: keypadValue,
    amountToKeypad: amountToKeypad,
    formatMoney: formatMoney,
    moneyWords: moneyWords,
    formatShortDate: formatShortDate,
    formatLongDate: formatLongDate,
    formatMonthDay: formatMonthDay,
    formatMonthDayLong: formatMonthDayLong,
    formatMonthYear: formatMonthYear
  };
});
