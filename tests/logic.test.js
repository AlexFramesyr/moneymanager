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
  for (const bad of [null, 5, 'x', [], {}, { version: 2, month: '2026-10' }, { version: 1, month: 'October' }]) {
    assert.equal(L.sanitizeState(bad), null);
  }
});

test('sanitizeState keeps good data and drops bad entries', () => {
  const s = L.sanitizeState({
    version: 1, month: '2026-10', setupComplete: true,
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
