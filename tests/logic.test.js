// Run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

// Local-time date in October 2026 (month index 9).
const oct = (day) => new Date(2026, 9, day, 12, 0, 0);

/** A plan with $200 bank, saving $50, and no big spends unless given. */
function plan({ start = 200, saveGoal = 50, cuseStart = 100, cuseSave = 0, big = [], purchases = [], added = [] } = {}) {
  let s = L.createState('2026-10');
  s.sources.bank.start = start;
  s.sources.bank.saveGoal = saveGoal;
  s.sources.cuse.start = cuseStart;
  s.sources.cuse.saveGoal = cuseSave;
  s.setupComplete = true;
  big.forEach((b, i) => { s = L.addBigSpend(s, { id: 'b' + i, name: b.name || 'Thing ' + i, icon: '⭐', amount: b.amount, source: b.source || 'bank' }); if (b.paid) s = L.markBigSpendPaid(s, 'b' + i, oct(2).toISOString()); });
  purchases.forEach((p) => { s = L.recordPurchase(s, Object.assign({ source: 'bank', category: 'food', date: oct(3).toISOString(), choice: 'bought' }, p)); });
  added.forEach((a) => { s = L.addMoney(s, a.source || 'bank', a.amount, oct(4).toISOString()); });
  return s;
}

// ---------- weekly threshold ----------

test('week threshold: days 1–7 are 50%', () => {
  for (let d = 1; d <= 7; d++) assert.equal(L.weekThresholdPercent(d), 50);
  assert.equal(L.weekThreshold(1), 0.5);
});

test('week threshold: days 8–14 are 40%', () => {
  for (let d = 8; d <= 14; d++) assert.equal(L.weekThresholdPercent(d), 40);
});

test('week threshold: days 15–21 are 20%', () => {
  for (let d = 15; d <= 21; d++) assert.equal(L.weekThresholdPercent(d), 20);
});

test('week threshold: day 22 to end of month is 10%', () => {
  for (let d = 22; d <= 31; d++) assert.equal(L.weekThresholdPercent(d), 10);
});

// ---------- money math ----------

test('current, protected and free money', () => {
  const s = plan({ start: 200, saveGoal: 50, big: [{ amount: 60 }] });
  assert.equal(L.currentMoney(s, 'bank'), 200);
  assert.equal(L.protectedMoney(s, 'bank'), 110);
  assert.equal(L.freeMoney(s, 'bank'), 90);
});

test('sources are tracked separately', () => {
  const s = plan({ start: 200, saveGoal: 50, cuseStart: 100, cuseSave: 20, big: [{ amount: 30, source: 'cuse' }], purchases: [{ amount: 10, source: 'cuse' }] });
  assert.equal(L.freeMoney(s, 'bank'), 150);
  assert.equal(L.currentMoney(s, 'cuse'), 90);
  assert.equal(L.freeMoney(s, 'cuse'), 40);
});

test('waited purchases do not lower money', () => {
  const s = plan({ purchases: [{ amount: 40, choice: 'waited' }, { amount: 10 }] });
  assert.equal(L.currentMoney(s, 'bank'), 190);
});

test('paid big spends leave current money and stop being protected', () => {
  const s = plan({ start: 200, saveGoal: 50, big: [{ amount: 60, paid: true }, { amount: 20 }] });
  assert.equal(L.currentMoney(s, 'bank'), 140);
  assert.equal(L.protectedMoney(s, 'bank'), 70);
  assert.equal(L.freeMoney(s, 'bank'), 70);
});

test('added money raises current and free money', () => {
  const s = plan({ start: 200, saveGoal: 50, added: [{ amount: 25.5 }, { amount: 10 }] });
  assert.equal(L.currentMoney(s, 'bank'), 235.5);
  assert.equal(L.freeMoney(s, 'bank'), 185.5);
});

test('cents add up exactly (no floating point drift)', () => {
  const s = plan({ start: 0.3, saveGoal: 0, purchases: [{ amount: 0.1 }, { amount: 0.2 }] });
  assert.equal(L.currentMoney(s, 'bank'), 0);
});

test('free money can be negative', () => {
  const s = plan({ start: 100, saveGoal: 50, big: [{ amount: 80 }] });
  assert.equal(L.freeMoney(s, 'bank'), -30);
});

// ---------- alert levels ----------
// Free money is $100 in all of these (start 150, save 50).

const free100 = () => plan({ start: 150, saveGoal: 50 });

test('green when at or under the threshold (week 2, 40%)', () => {
  assert.equal(L.checkPurchase(free100(), 'bank', 40, oct(10)).level, 'green');
  assert.equal(L.checkPurchase(free100(), 'bank', 1, oct(10)).level, 'green');
});

test('yellow just over the threshold (week 2)', () => {
  const r = L.checkPurchase(free100(), 'bank', 40.01, oct(10));
  assert.equal(r.level, 'yellow');
  assert.equal(r.reason, 'think');
  assert.deepEqual(r.atRisk, []);
});

test('yellow up to 2 × threshold, orange just over it (week 2)', () => {
  assert.equal(L.checkPurchase(free100(), 'bank', 80, oct(10)).level, 'yellow');
  const r = L.checkPurchase(free100(), 'bank', 80.01, oct(10));
  assert.equal(r.level, 'orange');
  assert.equal(r.reason, 'careful');
  assert.equal(r.freeAfter, 19.99);
});

test('orange up to all free money, red stop just over it', () => {
  assert.equal(L.checkPurchase(free100(), 'bank', 100, oct(10)).level, 'orange');
  const r = L.checkPurchase(free100(), 'bank', 100.01, oct(10));
  assert.equal(r.level, 'red');
  assert.equal(r.reason, 'stop');
});

test('red stop up to current money, not enough just over it', () => {
  assert.equal(L.checkPurchase(free100(), 'bank', 150, oct(10)).reason, 'stop');
  const r = L.checkPurchase(free100(), 'bank', 150.01, oct(10));
  assert.equal(r.level, 'red');
  assert.equal(r.reason, 'notEnough');
  assert.equal(r.currentAfter, -0.01);
});

test('week 1 (50%): yellow over $50, never orange (2 × 50% = all free money)', () => {
  assert.equal(L.checkPurchase(free100(), 'bank', 50, oct(1)).level, 'green');
  assert.equal(L.checkPurchase(free100(), 'bank', 50.01, oct(7)).level, 'yellow');
  assert.equal(L.checkPurchase(free100(), 'bank', 100, oct(7)).level, 'yellow');
  assert.equal(L.checkPurchase(free100(), 'bank', 100.01, oct(7)).level, 'red');
});

test('week 3 (20%): yellow over $20, orange over $40', () => {
  assert.equal(L.checkPurchase(free100(), 'bank', 20, oct(15)).level, 'green');
  assert.equal(L.checkPurchase(free100(), 'bank', 20.01, oct(15)).level, 'yellow');
  assert.equal(L.checkPurchase(free100(), 'bank', 40.01, oct(21)).level, 'orange');
});

test('week 4 (10%): yellow over $10, orange over $20', () => {
  assert.equal(L.checkPurchase(free100(), 'bank', 10, oct(22)).level, 'green');
  assert.equal(L.checkPurchase(free100(), 'bank', 10.01, oct(22)).level, 'yellow');
  assert.equal(L.checkPurchase(free100(), 'bank', 20, oct(31)).level, 'yellow');
  assert.equal(L.checkPurchase(free100(), 'bank', 20.01, oct(31)).level, 'orange');
});

test('the same purchase gets stricter as the month goes on', () => {
  const levels = [1, 8, 15, 22].map((d) => L.checkPurchase(free100(), 'bank', 45, oct(d)).level);
  assert.deepEqual(levels, ['green', 'yellow', 'orange', 'orange']);
});

test('threshold math is exact for awkward cents', () => {
  // free = 33.33, 10% = 3.333 → 3.33 is green, 3.34 is yellow
  const s = plan({ start: 33.33, saveGoal: 0 });
  assert.equal(L.checkPurchase(s, 'bank', 3.33, oct(25)).level, 'green');
  assert.equal(L.checkPurchase(s, 'bank', 3.34, oct(25)).level, 'yellow');
});

test('negative free money always gives red', () => {
  const s = plan({ start: 100, saveGoal: 50, big: [{ amount: 80 }] }); // free −30
  for (const day of [1, 10, 18, 28]) {
    const r = L.checkPurchase(s, 'bank', 0.01, oct(day));
    assert.equal(r.level, 'red');
    assert.equal(r.reason, 'stop');
  }
});

test('zero free money: any purchase is red', () => {
  const s = plan({ start: 50, saveGoal: 50 });
  assert.equal(L.checkPurchase(s, 'bank', 1, oct(3)).level, 'red');
});

test('zero current money: any purchase is not enough', () => {
  const s = plan({ start: 0, saveGoal: 0 });
  assert.equal(L.checkPurchase(s, 'bank', 1, oct(3)).reason, 'notEnough');
});

test('check uses only the chosen source', () => {
  const s = plan({ start: 150, saveGoal: 50, cuseStart: 10 });
  assert.equal(L.checkPurchase(s, 'bank', 30, oct(10)).level, 'green');
  assert.equal(L.checkPurchase(s, 'cuse', 30, oct(10)).reason, 'notEnough');
});

// ---------- what a red purchase would hurt ----------

test('red stop names the big spend first, then savings', () => {
  const s = plan({ start: 200, saveGoal: 50, big: [{ name: 'Concert', amount: 60 }] }); // free 90
  const r = L.checkPurchase(s, 'bank', 100, oct(10));
  assert.equal(r.reason, 'stop');
  assert.deepEqual(r.atRisk.map((x) => [x.kind, x.name, x.short]), [['bigSpend', 'Concert', 10]]);
});

test('red stop with multiple big spends goes in list order, then savings', () => {
  const s = plan({ start: 300, saveGoal: 50, big: [{ name: 'Concert', amount: 60 }, { name: 'Gift', amount: 40 }] }); // free 150
  const r = L.checkPurchase(s, 'bank', 240, oct(10)); // 90 over
  assert.deepEqual(r.atRisk.map((x) => [x.kind, x.name || 'save', x.short]), [
    ['bigSpend', 'Concert', 60], ['bigSpend', 'Gift', 30]
  ]);
  const r2 = L.checkPurchase(s, 'bank', 280, oct(10)); // 130 over
  assert.deepEqual(r2.atRisk.map((x) => [x.kind, x.short]), [['bigSpend', 60], ['bigSpend', 40], ['save', 30]]);
});

test('red stop with no big spends names savings', () => {
  const r = L.checkPurchase(free100(), 'bank', 120, oct(10));
  assert.deepEqual(r.atRisk, [{ kind: 'save', amount: 50, short: 20 }]);
});

test('paid big spends are never listed as at risk', () => {
  const s = plan({ start: 200, saveGoal: 50, big: [{ name: 'Concert', amount: 60, paid: true }] }); // current 140, free 90
  const r = L.checkPurchase(s, 'bank', 100, oct(10));
  assert.deepEqual(r.atRisk.map((x) => x.kind), ['save']);
});

test('big spends on the other source are never listed', () => {
  const s = plan({ start: 150, saveGoal: 50, big: [{ name: 'Laundry', amount: 20, source: 'cuse' }] });
  const r = L.checkPurchase(s, 'bank', 120, oct(10));
  assert.deepEqual(r.atRisk.map((x) => x.kind), ['save']);
});

test('negative free money: the gap counts toward what is hurt', () => {
  const s = plan({ start: 100, saveGoal: 50, big: [{ name: 'Concert', amount: 80 }] }); // free −30
  const r = L.checkPurchase(s, 'bank', 5, oct(10));
  assert.deepEqual(r.atRisk.map((x) => [x.name, x.short]), [['Concert', 35]]);
});

test('green, yellow and orange have no at-risk list', () => {
  for (const amt of [10, 50, 90]) assert.deepEqual(L.checkPurchase(free100(), 'bank', amt, oct(10)).atRisk, []);
});

// ---------- setup checks ----------

test('save goal must be no more than what you have', () => {
  assert.equal(L.saveGoalOk(200, 200), true);
  assert.equal(L.saveGoalOk(0, 0), true);
  assert.equal(L.saveGoalOk(200.01, 200), false);
});

test('plan shortfalls flag a source where save + big spends is too much', () => {
  const s = plan({ start: 100, saveGoal: 50, cuseStart: 40, big: [{ amount: 60 }, { amount: 30, source: 'cuse' }] });
  assert.deepEqual(L.planShortfalls(s), [{ source: 'bank', need: 110, have: 100, short: 10 }]);
  assert.deepEqual(L.planShortfalls(plan()), []);
});

// ---------- home status ----------

test('home status: green when on pace, yellow when behind, red when low', () => {
  // planned free = 100. On Oct 16, 16 days left → expected (16−1)/31 ≈ 0.48
  assert.equal(L.homeStatus(free100(), 'bank', oct(16)), 'green');
  const behind = plan({ start: 150, saveGoal: 50, purchases: [{ amount: 62 }] }); // 38% left
  assert.equal(L.homeStatus(behind, 'bank', oct(16)), 'yellow');
  const low = plan({ start: 150, saveGoal: 50, purchases: [{ amount: 80 }] }); // 20% left
  assert.equal(L.homeStatus(low, 'bank', oct(16)), 'red');
  const none = plan({ start: 50, saveGoal: 50 });
  assert.equal(L.homeStatus(none, 'bank', oct(1)), 'red');
});

test('home status: spending a little on day 1 is still green', () => {
  const s = plan({ start: 150, saveGoal: 50, purchases: [{ amount: 3 }] });
  assert.equal(L.homeStatus(s, 'bank', oct(1)), 'green');
});

// ---------- calendar and month rollover ----------

test('month key and days left', () => {
  assert.equal(L.monthKey(oct(5)), '2026-10');
  assert.equal(L.monthKey(new Date(2027, 0, 1)), '2027-01');
  assert.equal(L.daysLeftInMonth(oct(5)), 27);
  assert.equal(L.daysLeftInMonth(oct(31)), 1);
  assert.equal(L.daysInMonth(2028, 2), 29);
  assert.equal(L.daysInMonth(2026, 2), 28);
});

test('startMonth: no saved data starts a fresh plan', () => {
  const r = L.startMonth(null, oct(5));
  assert.equal(r.state.month, '2026-10');
  assert.equal(r.state.setupComplete, false);
  assert.equal(r.recap, null);
  assert.equal(r.changed, true);
});

test('startMonth: same month keeps everything', () => {
  const s = plan();
  const r = L.startMonth(s, oct(30));
  assert.equal(r.state, s);
  assert.equal(r.changed, false);
});

test('startMonth: new month archives, gives a recap, and suggests big spends', () => {
  let s = plan({ start: 200, saveGoal: 50, big: [{ name: 'Concert', amount: 60 }], purchases: [{ amount: 20 }, { amount: 15, choice: 'waited' }, { amount: 5, choice: 'waited' }] });
  s.settings.autoRead = false;
  const r = L.startMonth(s, new Date(2026, 10, 1));
  assert.equal(r.state.month, '2026-11');
  assert.equal(r.state.setupComplete, false);
  assert.deepEqual(r.state.purchases, []);
  assert.deepEqual(r.state.bigSpends, []);
  assert.equal(r.state.history.length, 1);
  assert.equal(r.state.history[0].month, '2026-10');
  assert.deepEqual(r.recap, { month: '2026-10', savedTotal: 280, waitedCount: 2, waitedTotal: 20 });
  assert.deepEqual(r.state.suggestions, [{ name: 'Concert', icon: '⭐', amount: 60, source: 'bank' }]);
  assert.equal(r.state.settings.autoRead, false);
});

test('startMonth: December rolls over to January', () => {
  const s = plan();
  s.month = '2026-12';
  const r = L.startMonth(s, new Date(2027, 0, 1));
  assert.equal(r.state.month, '2027-01');
  assert.equal(r.state.history[0].month, '2026-12');
});

test('startMonth: unfinished old setup gives no recap and nothing archived', () => {
  let s = L.createState('2026-09');
  s = L.addBigSpend(s, { name: 'Bus', icon: '🚌', amount: 15, source: 'cuse' });
  const r = L.startMonth(s, oct(2));
  assert.equal(r.recap, null);
  assert.equal(r.state.history.length, 0);
  assert.equal(r.state.suggestions[0].name, 'Bus');
});

test('recap never counts negative money as saved', () => {
  const s = plan({ start: 10, saveGoal: 0, purchases: [{ amount: 30 }] });
  assert.equal(L.monthRecap(s).savedTotal, 100); // bank −20 counts as 0, cuse 100
});

// ---------- state changes are pure ----------

test('state changes return a new object and leave the old one alone', () => {
  const s = plan();
  const before = JSON.stringify(s);
  const t = L.recordPurchase(s, { amount: 5, source: 'bank', category: 'food', date: oct(5).toISOString() });
  assert.notEqual(t, s);
  assert.equal(JSON.stringify(s), before);
  assert.equal(t.purchases.length, 1);
  assert.equal(L.removePurchase(t, t.purchases[0].id).purchases.length, 0);
});

test('remove big spend', () => {
  const s = plan({ big: [{ amount: 10 }, { amount: 20 }] });
  assert.deepEqual(L.removeBigSpend(s, 'b0').bigSpends.map((b) => b.id), ['b1']);
});

// ---------- corrupted storage ----------

test('sanitizeState rejects junk', () => {
  for (const bad of [null, 5, 'x', [], {}, { version: 3, month: '2026-10' }, { version: 2, month: 'October' },
    { version: 1, month: '2026-10' } /* v1 must go through migrate() first */]) {
    assert.equal(L.sanitizeState(bad), null);
  }
});

test('sanitizeState keeps good data and drops bad entries', () => {
  const s = L.sanitizeState({
    version: 2, month: '2026-10', setupComplete: true,
    sources: { bank: { start: '200', added: [{ amount: 5 }, { amount: -3 }, null], saveGoal: -10 }, cuse: null },
    bigSpends: [{ id: 'a', name: 'Concert', icon: '🎟️', amount: 60, source: 'bank' }, { amount: 5, source: 'wallet' }],
    purchases: [{ id: 'p', amount: 4, source: 'cuse', category: 'food', date: '2026-10-02T00:00:00Z', choice: 'bought', hadAlert: 'purple' }, { amount: 'abc', source: 'bank', choice: 'bought' }],
    settings: { autoRead: false }
  });
  assert.equal(s.sources.bank.start, 200);
  assert.equal(s.sources.bank.saveGoal, 0);
  assert.deepEqual(s.sources.bank.added.map((a) => a.amount), [5]);
  assert.equal(s.sources.cuse.start, 0);
  assert.equal(s.bigSpends.length, 1);
  assert.equal(s.purchases.length, 1);
  assert.equal(s.purchases[0].hadAlert, 'none');
  assert.equal(s.settings.autoRead, false);
  assert.equal(s.setupComplete, true);
});

test('a saved state survives a JSON round trip unchanged', () => {
  const s = plan({ big: [{ amount: 60 }], purchases: [{ amount: 5 }], added: [{ amount: 10 }] });
  assert.deepEqual(L.sanitizeState(JSON.parse(JSON.stringify(s))), s);
});

// ---------- keypad ----------

const type = (keys) => keys.reduce((t, k) => L.pressKey(t, k), '');

test('keypad: digits, decimal point and delete', () => {
  assert.equal(type(['1', '2', '.', '5']), '12.5');
  assert.equal(type(['1', '2', 'back']), '1');
  assert.equal(type(['back']), '');
  assert.equal(type(['.', '5']), '0.5');
});

test('keypad: at most 2 decimals and one point', () => {
  assert.equal(type(['1', '.', '2', '3', '4']), '1.23');
  assert.equal(type(['1', '.', '.', '2']), '1.2');
});

test('keypad: no leading zeros', () => {
  assert.equal(type(['0', '0', '7']), '7');
  assert.equal(type(['0', '.', '0', '7']), '0.07');
});

test('keypad: max is 9999.99', () => {
  assert.equal(type(['9', '9', '9', '9', '9']), '9999');
  assert.equal(type(['9', '9', '9', '9', '.', '9', '9']), '9999.99');
  assert.equal(L.pressKey('1234', '5'), '1234');
});

test('keypad value', () => {
  assert.ok(Number.isNaN(L.keypadValue('')));
  assert.equal(L.keypadValue('0.'), 0);
  assert.equal(L.keypadValue('12.5'), 12.5);
  assert.equal(L.amountToKeypad(12.5), '12.50');
  assert.equal(L.amountToKeypad(200), '200');
  assert.equal(L.amountToKeypad(0), '');
});

// ---------- formatting ----------

test('formatMoney', () => {
  assert.equal(L.formatMoney(12), '$12');
  assert.equal(L.formatMoney(12.5), '$12.50');
  assert.equal(L.formatMoney(1234.05), '$1,234.05');
  assert.equal(L.formatMoney(-5), '−$5');
  assert.equal(L.formatMoney(0), '$0');
});

test('moneyWords', () => {
  assert.equal(L.moneyWords(120), '120 dollars');
  assert.equal(L.moneyWords(1), '1 dollar');
  assert.equal(L.moneyWords(12.5), '12 dollars and 50 cents');
  assert.equal(L.moneyWords(0.01), '1 cent');
  assert.equal(L.moneyWords(0), '0 dollars');
});

test('formatShortDate', () => {
  assert.equal(L.formatShortDate(new Date(2026, 9, 5, 9).toISOString()), 'Mon, Oct 5');
  assert.equal(L.formatLongDate(new Date(2026, 9, 5, 9).toISOString()), 'Monday, October 5');
  assert.equal(L.formatShortDate('nope'), '');
});

// =====================================================================
// Version 2: fixing money, undo, removing entries, dated big spends
// =====================================================================

const ISO = (day) => oct(day).toISOString();

// ---------- Fix my money (adjustments) ----------

test('fix my money saves only the difference, as an adjustment', () => {
  const s = plan({ start: 200, saveGoal: 50, purchases: [{ amount: 30 }] }); // app says 170
  assert.equal(L.adjustmentNeeded(s, 'bank', 150), -20);
  const t = L.addAdjustment(s, 'bank', 150, ISO(6), 'fix1');
  assert.deepEqual(t.sources.bank.adjustments, [{ id: 'fix1', amount: -20, date: ISO(6) }]);
  assert.equal(L.currentMoney(t, 'bank'), 150);
  assert.equal(L.freeMoney(t, 'bank'), 100);
  // Nothing in the past was changed.
  assert.equal(t.sources.bank.start, 200);
  assert.deepEqual(t.purchases, s.purchases);
});

test('fix my money can go up, and works on each source alone', () => {
  const s = plan({ start: 200, cuseStart: 100 });
  const t = L.addAdjustment(s, 'cuse', 112.5, ISO(6), 'c1');
  assert.equal(L.currentMoney(t, 'cuse'), 112.5);
  assert.equal(t.sources.cuse.adjustments[0].amount, 12.5);
  assert.equal(L.currentMoney(t, 'bank'), 200);
});

test('fix my money: no change saves nothing', () => {
  const s = plan({ start: 200 });
  assert.equal(L.adjustmentNeeded(s, 'bank', 200), 0);
  assert.deepEqual(L.addAdjustment(s, 'bank', 200, ISO(6)).sources.bank.adjustments, []);
});

test('fix my money: cents stay exact', () => {
  const s = plan({ start: 0.3, purchases: [{ amount: 0.1 }] }); // 0.2
  const t = L.addAdjustment(s, 'bank', 0.3, ISO(6));
  assert.equal(t.sources.bank.adjustments[0].amount, 0.1);
  assert.equal(L.currentMoney(t, 'bank'), 0.3);
});

test('adjustments count in planned free money, home status, shortfalls and the recap', () => {
  let s = plan({ start: 150, saveGoal: 50 });
  s = L.addAdjustment(s, 'bank', 100, ISO(2)); // −50
  assert.equal(L.sourceSummary(s, 'bank').plannedFree, 50);
  assert.equal(L.homeStatus(s, 'bank', oct(2)), 'green'); // 50 of 50 free left
  assert.equal(L.monthRecap(s).savedTotal, 200); // bank 100 + cuse 100
  const short = L.addAdjustment(plan({ start: 100, saveGoal: 50, big: [{ amount: 40 }] }), 'bank', 60, ISO(2));
  assert.deepEqual(L.planShortfalls(short), [{ source: 'bank', need: 90, have: 60, short: 30 }]);
});

test('alerts use the fixed amount', () => {
  const s = L.addAdjustment(free100(), 'bank', 100, ISO(10)); // current 100, free 50
  assert.equal(L.checkPurchase(s, 'bank', 50, oct(10)).level, 'orange');
  assert.equal(L.checkPurchase(s, 'bank', 50.01, oct(10)).reason, 'stop');
});

test('change save goal', () => {
  const s = L.setSaveGoal(plan({ start: 200, saveGoal: 50 }), 'bank', 80);
  assert.equal(s.sources.bank.saveGoal, 80);
  assert.equal(L.freeMoney(s, 'bank'), 120);
});

// ---------- removing entries ----------

test('the money list has purchases, money in and fixes, newest first', () => {
  let s = plan({ purchases: [{ id: 'p1', amount: 12, date: ISO(3) }] });
  s = L.addMoney(s, 'cuse', 20, ISO(5), 'a1');
  s = L.addAdjustment(s, 'bank', 150, ISO(4), 'f1');
  assert.deepEqual(L.activityList(s).map((x) => [x.kind, x.id]), [['added', 'a1'], ['adjustment', 'f1'], ['purchase', 'p1']]);
});

test('removing a purchase puts the money back', () => {
  const s = plan({ start: 200, purchases: [{ id: 'p1', amount: 12 }] });
  const entry = L.activityList(s)[0];
  assert.equal(L.removalEffect(entry), 'up');
  const t = L.removeEntry(s, entry);
  assert.equal(t.purchases.length, 0);
  assert.equal(L.currentMoney(t, 'bank'), 200);
});

test('removing a "waited" entry does not change money', () => {
  const s = plan({ purchases: [{ id: 'w', amount: 40, choice: 'waited' }] });
  const entry = L.activityList(s)[0];
  assert.equal(L.removalEffect(entry), 'none');
  assert.equal(L.currentMoney(L.removeEntry(s, entry), 'bank'), L.currentMoney(s, 'bank'));
});

test('removing "I got money" lowers money', () => {
  const s = L.addMoney(plan({ start: 200 }), 'bank', 25, ISO(4), 'a1');
  const entry = L.activityList(s)[0];
  assert.equal(L.removalEffect(entry), 'down');
  const t = L.removeEntry(s, entry);
  assert.deepEqual(t.sources.bank.added, []);
  assert.equal(L.currentMoney(t, 'bank'), 200);
});

test('removing a fix undoes just that fix', () => {
  let s = plan({ start: 200 });
  s = L.addAdjustment(s, 'bank', 180, ISO(4), 'down');
  s = L.addAdjustment(s, 'bank', 190, ISO(5), 'up');
  const [up, down] = L.activityList(s);
  assert.equal(L.removalEffect(up), 'down');
  assert.equal(L.removalEffect(down), 'up');
  assert.equal(L.currentMoney(L.removeEntry(s, down), 'bank'), 210);
  assert.equal(L.currentMoney(L.removeEntry(s, up), 'bank'), 180);
});

test('remove only takes away the one entry with that id', () => {
  let s = L.addMoney(plan(), 'bank', 5, ISO(4), 'a1');
  s = L.addMoney(s, 'bank', 5, ISO(4), 'a2');
  assert.deepEqual(L.removeAdded(s, 'bank', 'a1').sources.bank.added.map((a) => a.id), ['a2']);
});

// ---------- undo ----------

/** Do something, then undo it: the state must be exactly what it was. */
function assertUndoes(before, after, u) {
  assert.notDeepEqual(after, before);
  assert.deepEqual(L.undo(after, u), before);
}

test('undo a purchase', () => {
  const s = plan();
  const t = L.recordPurchase(s, { id: 'p', amount: 12, source: 'bank', category: 'food', date: ISO(5) });
  assertUndoes(s, t, { type: 'purchase', id: 'p' });
});

test('undo "I got money"', () => {
  const s = plan();
  assertUndoes(s, L.addMoney(s, 'cuse', 20, ISO(5), 'a'), { type: 'added', source: 'cuse', id: 'a' });
});

test('undo "I paid it"', () => {
  const s = plan({ big: [{ amount: 60 }] });
  const u = L.bigSpendUndo(s, 'b0');
  assertUndoes(s, L.markBigSpendPaid(s, 'b0', ISO(5)), u);
});

test('undo "Fix my money"', () => {
  const s = plan();
  assertUndoes(s, L.addAdjustment(s, 'bank', 123, ISO(5), 'f'), { type: 'adjustment', source: 'bank', id: 'f' });
});

test('undo a save goal change', () => {
  const s = plan({ saveGoal: 50 });
  const u = L.saveGoalUndo(s, 'bank');
  assertUndoes(s, L.setSaveGoal(s, 'bank', 75), u);
});

test('undo removing an entry puts it back in the same place', () => {
  const s = plan({ purchases: [{ id: 'p1', amount: 1 }, { id: 'p2', amount: 2 }, { id: 'p3', amount: 3 }] });
  const entry = L.activityList(s).find((x) => x.id === 'p2');
  const u = L.removeUndo(s, entry);
  assertUndoes(s, L.removeEntry(s, entry), u);

  const s2 = L.addAdjustment(L.addMoney(plan(), 'cuse', 9, ISO(2), 'a'), 'cuse', 50, ISO(3), 'f');
  for (const e of L.activityList(s2)) assertUndoes(s2, L.removeEntry(s2, e), L.removeUndo(s2, e));
});

test('undo big spend changes: amount, day, remove, add, not paid yet', () => {
  const s = plan({ big: [{ amount: 60 }, { amount: 20 }, { amount: 5, paid: true }] });
  assertUndoes(s, L.updateBigSpend(s, 'b0', { amount: 70 }), L.bigSpendUndo(s, 'b0'));
  assertUndoes(s, L.updateBigSpend(s, 'b0', { date: '2026-10-12' }), L.bigSpendUndo(s, 'b0'));
  assertUndoes(s, L.removeBigSpend(s, 'b1'), L.bigSpendUndo(s, 'b1'));
  assertUndoes(s, L.unmarkBigSpendPaid(s, 'b2'), L.bigSpendUndo(s, 'b2'));
  const u = L.bigSpendUndo(s, 'new'); // before adding
  assertUndoes(s, L.addBigSpend(s, { id: 'new', name: 'Bus', icon: '🚌', amount: 3, source: 'cuse', date: '2026-10-20' }), u);
});

test('undo only touches its own entry, even after other changes', () => {
  let s = plan();
  s = L.recordPurchase(s, { id: 'p', amount: 12, source: 'bank', category: 'food', date: ISO(5) });
  s = L.addMoney(s, 'bank', 30, ISO(5), 'a'); // happened after the purchase
  const t = L.undo(s, { type: 'purchase', id: 'p' });
  assert.equal(t.purchases.length, 0);
  assert.equal(t.sources.bank.added.length, 1);
});

test('undo twice is harmless', () => {
  const s = plan({ purchases: [{ id: 'p1', amount: 4 }] });
  const e = L.activityList(s)[0];
  const u = L.removeUndo(s, e);
  const back = L.undo(L.removeEntry(s, e), u);
  assert.deepEqual(L.undo(back, u), back); // already back: not added again
  assert.equal(L.undo(s, null), s);
});

// ---------- un-paying a big spend ----------

test('"Not paid yet" puts the money back and protects it again', () => {
  const s = plan({ start: 200, saveGoal: 50, big: [{ amount: 60, paid: true }] });
  assert.equal(L.currentMoney(s, 'bank'), 140);
  const t = L.unmarkBigSpendPaid(s, 'b0');
  assert.equal(t.bigSpends[0].paid, false);
  assert.equal(t.bigSpends[0].paidDate, null);
  assert.equal(L.currentMoney(t, 'bank'), 200);
  assert.equal(L.protectedMoney(t, 'bank'), 110);
  assert.equal(L.freeMoney(t, 'bank'), 90);
});

test('changing a big spend amount changes what is protected', () => {
  const s = L.updateBigSpend(plan({ start: 200, saveGoal: 50, big: [{ amount: 60 }] }), 'b0', { amount: 80.5 });
  assert.equal(s.bigSpends[0].amount, 80.5);
  assert.equal(L.freeMoney(s, 'bank'), 69.5);
});

// ---------- dated big spends ----------

test('day keys are local days (never off by one in Syracuse)', () => {
  assert.equal(L.dayKey(new Date(2026, 9, 12, 23, 59)), '2026-10-12');
  assert.equal(L.dayKey(new Date(2026, 9, 12, 0, 1)), '2026-10-12');
  assert.equal(L.formatShortDate('2026-10-12'), 'Mon, Oct 12');
  assert.equal(L.formatLongDate('2026-10-12'), 'Monday, October 12');
  assert.equal(L.formatMonthDay('2026-10-12'), 'Oct 12');
  assert.equal(L.formatMonthDayLong('2026-10-12'), 'October 12');
  assert.equal(L.formatMonthYear('2026-10'), 'October 2026');
  assert.equal(L.isDayKey('2026-02-30'), false);
  assert.equal(L.isDayKey('2026-10-12'), true);
  assert.equal(L.daysBetween('2026-10-30', '2026-11-02'), 3);
  assert.equal(L.daysBetween('2026-03-07', '2026-03-09'), 2); // daylight saving week
});

test('month grid', () => {
  const g = L.monthGrid('2026-10'); // Oct 1 2026 is a Thursday
  assert.equal(g.lead, 4);
  assert.equal(g.days.length, 31);
  assert.deepEqual(g.days[11], { day: 12, key: '2026-10-12' });
  assert.equal(L.monthGrid('2028-02').days.length, 29);
});

test('big spends can have a day, or none', () => {
  let s = L.addBigSpend(plan(), { id: 'c', name: 'Concert', icon: '🎟️', amount: 60, source: 'bank', date: '2026-10-12' });
  s = L.addBigSpend(s, { id: 'l', name: 'Laundry', icon: '🧺', amount: 10, source: 'cuse' });
  s = L.addBigSpend(s, { id: 'x', name: 'Bad', icon: '⭐', amount: 1, source: 'cuse', date: 'Oct 12' });
  assert.deepEqual(s.bigSpends.map((b) => b.date), ['2026-10-12', null, null]);
  assert.deepEqual(L.bigSpendsOn(s, '2026-10-12').map((b) => b.id), ['c']);
  const moved = L.updateBigSpend(s, 'c', { date: null });
  assert.equal(moved.bigSpends[0].date, null);
});

test('dates do not change the alert math, but red alerts include the day', () => {
  const undated = plan({ start: 200, saveGoal: 50, big: [{ name: 'Concert', amount: 60 }] });
  const withDay = L.updateBigSpend(undated, 'b0', { date: '2026-10-12' });
  for (const amt of [20, 50, 89, 90, 100, 200, 201]) {
    const a = L.checkPurchase(undated, 'bank', amt, oct(10));
    const b = L.checkPurchase(withDay, 'bank', amt, oct(10));
    assert.equal(a.level, b.level);
    assert.equal(a.reason, b.reason);
  }
  assert.equal(L.checkPurchase(withDay, 'bank', 100, oct(10)).atRisk[0].date, '2026-10-12');
  assert.equal(L.checkPurchase(undated, 'bank', 100, oct(10)).atRisk[0].date, null);
});

function dated(list) {
  let s = plan({ start: 500 });
  list.forEach((b, i) => {
    s = L.addBigSpend(s, { id: 'd' + i, name: 'Thing ' + i, icon: '⭐', amount: 10, source: 'bank', date: b.date });
    if (b.paid) s = L.markBigSpendPaid(s, 'd' + i, ISO(1));
  });
  return s;
}

test('reminders: due today, in 1–3 days, and overdue', () => {
  const s = dated([
    { date: '2026-10-10' }, // today
    { date: '2026-10-11' }, // tomorrow
    { date: '2026-10-13' }, // in 3 days
    { date: '2026-10-14' }, // in 4 days – not yet
    { date: '2026-10-08' }, // passed, not paid
    { date: '2026-10-07', paid: true }, // passed, paid – nothing
    { date: '2026-10-10', paid: true } // today, paid – nothing
  ]);
  const r = L.reminders(s, '2026-10-10');
  assert.deepEqual(r.dueToday.map((b) => b.id), ['d0']);
  assert.deepEqual(r.soon.map((x) => [x.item.id, x.days]), [['d1', 1], ['d2', 3]]);
  assert.deepEqual(r.overdue.map((b) => b.id), ['d4']);
});

test('an overdue big spend stays protected until it is paid', () => {
  const s = dated([{ date: '2026-10-03' }]); // $50 save goal + $10 big spend
  assert.equal(L.protectedMoney(s, 'bank'), 60);
  assert.equal(L.freeMoney(s, 'bank'), 440);
  assert.equal(L.checkPurchase(s, 'bank', 445, oct(10)).atRisk[0].id, 'd0');
});

test('"Not yet" hides a reminder until tomorrow', () => {
  let s = dated([{ date: '2026-10-10' }, { date: '2026-10-05' }]);
  s = L.setNotYet(s, 'd0', '2026-10-10');
  s = L.setNotYet(s, 'd1', '2026-10-10');
  const r = L.reminders(s, '2026-10-10');
  assert.deepEqual([r.dueToday.length, r.overdue.length], [0, 0]);
  const tomorrow = L.reminders(s, '2026-10-11');
  assert.deepEqual(tomorrow.overdue.map((b) => b.id), ['d1', 'd0']);
  // Picking a new day clears "Not yet".
  assert.equal(L.updateBigSpend(s, 'd0', { date: '2026-10-20' }).bigSpends[0].notYetOn, null);
});

test('next month suggestions do not keep the day', () => {
  const s = dated([{ date: '2026-10-12' }]);
  const r = L.startMonth(s, new Date(2026, 10, 1));
  assert.equal('date' in r.state.suggestions[0], false);
  assert.equal(r.state.history[0].bigSpends[0].date, '2026-10-12');
});

// ---------- v1 → v2 migration ----------

/** Saved data exactly as version 1 of the app wrote it. */
function v1Data() {
  return {
    version: 1, month: '2026-10', setupComplete: true,
    sources: {
      bank: { start: 200, added: [{ amount: 25, date: '2026-10-04T16:00:00.000Z' }], saveGoal: 50 },
      cuse: { start: 100, added: [], saveGoal: 0 }
    },
    bigSpends: [
      { id: 'b1', name: 'Concert', icon: '🎟️', amount: 60, source: 'bank', paid: false, paidDate: null },
      { id: 'b2', name: 'Laundry', icon: '🧺', amount: 10, source: 'cuse', paid: true, paidDate: '2026-10-02T16:00:00.000Z' }
    ],
    purchases: [{ id: 'p1', amount: 12, source: 'bank', category: 'food', date: '2026-10-03T16:00:00.000Z', hadAlert: 'none', choice: 'bought' }],
    suggestions: [],
    history: [{
      month: '2026-09', recap: { month: '2026-09', savedTotal: 80, waitedCount: 1, waitedTotal: 5 },
      sources: { bank: { start: 90, added: [{ amount: 5, date: '2026-09-09T16:00:00.000Z' }], saveGoal: 10 }, cuse: { start: 0, added: [], saveGoal: 0 } },
      bigSpends: [{ id: 'old', name: 'Bus', icon: '🚌', amount: 15, source: 'cuse', paid: true, paidDate: '2026-09-03T16:00:00.000Z' }],
      purchases: []
    }],
    settings: { autoRead: false }
  };
}

test('migrate v1 → v2: adds empty fixes, ids, and no day – and keeps everything else', () => {
  const raw = v1Data();
  const m = L.migrate(raw);
  assert.equal(m.version, 2);
  assert.deepEqual(m.sources.bank.adjustments, []);
  assert.deepEqual(m.sources.cuse.adjustments, []);
  assert.equal(typeof m.sources.bank.added[0].id, 'string');
  assert.equal(m.sources.bank.added[0].amount, 25);
  assert.deepEqual(m.bigSpends.map((b) => [b.id, b.date, b.paid]), [['b1', null, false], ['b2', null, true]]);
  assert.deepEqual(m.purchases, raw.purchases);
  // Archived months are upgraded too.
  assert.deepEqual(m.history[0].sources.bank.adjustments, []);
  assert.equal(typeof m.history[0].sources.bank.added[0].id, 'string');
  assert.equal(m.history[0].bigSpends[0].date, null);
  assert.deepEqual(m.history[0].recap, raw.history[0].recap);
  // The original object is left alone.
  assert.deepEqual(raw, v1Data());
});

test('migrate v1 → v2: all the money is the same as before', () => {
  const s = L.sanitizeState(L.migrate(v1Data()));
  assert.ok(s);
  assert.equal(s.setupComplete, true);
  assert.equal(L.currentMoney(s, 'bank'), 213); // 200 + 25 − 12
  assert.equal(L.freeMoney(s, 'bank'), 103);    // − 50 save − 60 concert
  assert.equal(L.currentMoney(s, 'cuse'), 90);  // 100 − 10 paid laundry
  assert.equal(s.settings.autoRead, false);
  assert.equal(s.history.length, 1);
  assert.equal(L.activityList(s).length, 2);
  // Migrated "I got money" can be removed like new ones.
  const got = L.activityList(s).find((x) => x.kind === 'added');
  assert.equal(L.currentMoney(L.removeEntry(s, got), 'bank'), 188);
});

test('migrate leaves v2 data and junk alone', () => {
  const s = plan();
  assert.equal(L.migrate(s), s);
  for (const x of [null, 5, 'x', { version: 9 }]) assert.equal(L.migrate(x), x);
});

test('migrate copes with broken v1 entries', () => {
  const raw = v1Data();
  raw.sources.bank.added.push(null, { amount: -3 });
  raw.bigSpends.push(null);
  raw.sources.cuse = null;
  const s = L.sanitizeState(L.migrate(raw));
  assert.ok(s);
  assert.equal(s.sources.bank.added.length, 1);
  assert.equal(s.bigSpends.length, 2);
  assert.equal(s.sources.cuse.start, 0);
});

test('a v2 state survives a JSON round trip unchanged', () => {
  let s = dated([{ date: '2026-10-12' }, { date: '2026-10-03', paid: true }]);
  s = L.addAdjustment(s, 'bank', 470, ISO(6), 'f');
  s = L.addMoney(s, 'cuse', 3, ISO(6), 'a');
  s = L.setNotYet(s, 'd0', '2026-10-12');
  s.settings.calendarView = 'list';
  assert.deepEqual(L.sanitizeState(JSON.parse(JSON.stringify(s))), s);
});

test('sanitizeState drops bad fixes and bad days', () => {
  const raw = JSON.parse(JSON.stringify(plan({ big: [{ amount: 5 }] })));
  raw.sources.bank.adjustments = [{ id: 'ok', amount: -7.5, date: 'x' }, { amount: 0 }, { amount: 'abc' }, null];
  raw.bigSpends[0].date = '2026-13-40';
  raw.settings.calendarView = 'huge';
  const s = L.sanitizeState(raw);
  assert.deepEqual(s.sources.bank.adjustments.map((a) => a.amount), [-7.5]);
  assert.equal(s.bigSpends[0].date, null);
  assert.equal(s.settings.calendarView, null);
});
