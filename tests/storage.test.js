// Runs storage.js against a pretend localStorage, to check that upgrading
// from version 1 never loses or overwrites a student's saved data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../logic.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'storage.js'), 'utf8');

function fakePhone(items = {}) {
  const data = Object.assign({}, items);
  const localStorage = {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; }
  };
  const self = { localStorage, MBLogic: L };
  vm.runInNewContext(SRC, { self });
  return { Store: self.MBStorage, data };
}

const V1 = JSON.stringify({
  version: 1, month: '2026-10', setupComplete: true,
  sources: {
    bank: { start: 200, added: [{ amount: 25, date: '2026-10-04T16:00:00.000Z' }], saveGoal: 50 },
    cuse: { start: 100, added: [], saveGoal: 0 }
  },
  bigSpends: [{ id: 'b1', name: 'Concert', icon: '🎟️', amount: 60, source: 'bank', paid: false, paidDate: null }],
  purchases: [{ id: 'p1', amount: 12, source: 'bank', category: 'food', date: '2026-10-03T16:00:00.000Z', hadAlert: 'none', choice: 'bought' }],
  suggestions: [], history: [], settings: { autoRead: true }
});

test('storage: v1 data is upgraded and saved under the new key', () => {
  const { Store, data } = fakePhone({ 'moneyBuddy.v1': V1 });
  const s = Store.load();
  assert.ok(s);
  assert.equal(s.version, 2);
  assert.equal(L.currentMoney(s, 'bank'), 213);
  assert.equal(s.bigSpends[0].date, null);
  assert.deepEqual(s.sources.bank.adjustments, []);
  assert.equal('saveGoal' in s.sources.bank, false); // old save goals are dropped
  assert.equal(JSON.parse(data['moneyBuddy.v2']).version, 2);
});

test('storage: the v1 data is never changed or deleted (it stays as a backup)', () => {
  const { Store, data } = fakePhone({ 'moneyBuddy.v1': V1 });
  const s = Store.load();
  Store.save(L.addAdjustment(s, 'bank', 100, '2026-10-06T16:00:00.000Z'));
  assert.equal(data['moneyBuddy.v1'], V1);
});

test('storage: once upgraded, new data wins over the old copy', () => {
  const { Store } = fakePhone({ 'moneyBuddy.v1': V1 });
  Store.save(L.addAdjustment(Store.load(), 'bank', 100, '2026-10-06T16:00:00.000Z'));
  // Opening again reads the v2 data, not the old v1 copy.
  const again = Store.load();
  assert.equal(L.currentMoney(again, 'bank'), 100);
});

test('storage: ids for migrated "I got money" stay the same on every load', () => {
  const { Store } = fakePhone({ 'moneyBuddy.v1': V1 });
  const first = Store.load().sources.bank.added[0].id;
  assert.equal(Store.load().sources.bank.added[0].id, first);
});

test('storage: nothing saved gives null; broken data is kept for a helper', () => {
  assert.equal(fakePhone().Store.load(), null);
  const { Store, data } = fakePhone({ 'moneyBuddy.v1': '{not json' });
  assert.equal(Store.load(), null);
  assert.equal(data['moneyBuddy.v2.broken'], '{not json');
  assert.equal(data['moneyBuddy.v1'], '{not json');
});
