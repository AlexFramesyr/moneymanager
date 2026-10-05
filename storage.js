/*
 * Money Buddy – saving on the phone.
 * Everything lives in localStorage under one key, as JSON.
 * Every call is wrapped in try/catch: private browsing, full storage or
 * blocked storage must never crash the app.
 *
 * Upgrading: data from version 1 of the app lives under OLD_KEY. The first
 * time this version opens, it reads that, upgrades it (MBLogic.migrate), and
 * saves the result under KEY. OLD_KEY is never changed or deleted, so it stays
 * as a backup, and an old copy of the app that a phone still has cached can
 * never write over the new data.
 */
(function (root) {
  'use strict';

  var KEY = 'moneyBuddy.v2';
  var OLD_KEY = 'moneyBuddy.v1';
  var BROKEN_KEY = 'moneyBuddy.v2.broken';

  function ls() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  /** Parse, upgrade and check saved text. Returns a clean state or null. */
  function read(raw) {
    var L = root.MBLogic;
    try {
      var clean = L.sanitizeState(L.migrate(JSON.parse(raw)));
      if (!clean) keepBroken(raw);
      return clean;
    } catch (e) {
      keepBroken(raw);
      return null;
    }
  }

  /** Returns a clean saved state, or null (nothing saved, or unreadable). */
  function load() {
    var store = ls();
    if (!store) return null;
    var raw = null;
    try { raw = store.getItem(KEY); } catch (e) { return null; }
    if (raw) return read(raw);

    // Nothing saved by this version yet: upgrade data from version 1, if any.
    var old = null;
    try { old = store.getItem(OLD_KEY); } catch (e) { return null; }
    if (!old) return null;
    var upgraded = read(old);
    if (upgraded) save(upgraded);
    return upgraded;
  }

  /** Keeps a copy of unreadable data so a helper could recover it later. */
  function keepBroken(raw) {
    try { ls().setItem(BROKEN_KEY, raw); } catch (e) { /* nothing more we can do */ }
  }

  /** Returns true if it saved. */
  function save(state) {
    var store = ls();
    if (!store) return false;
    try {
      store.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  /** True if this browser lets us save at all. */
  function available() {
    var store = ls();
    if (!store) return false;
    try {
      store.setItem(KEY + '.test', '1');
      store.removeItem(KEY + '.test');
      return true;
    } catch (e) {
      return false;
    }
  }

  root.MBStorage = { KEY: KEY, OLD_KEY: OLD_KEY, load: load, save: save, available: available };
})(self);
