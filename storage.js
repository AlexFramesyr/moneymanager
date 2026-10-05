/*
 * Money Buddy – saving on the phone.
 * Everything lives in localStorage under one key, as JSON.
 * Every call is wrapped in try/catch: private browsing, full storage or
 * blocked storage must never crash the app.
 */
(function (root) {
  'use strict';

  var KEY = 'moneyBuddy.v1';
  var BROKEN_KEY = 'moneyBuddy.v1.broken';

  function ls() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  /** Returns a clean saved state, or null (nothing saved, or unreadable). */
  function load() {
    var store = ls();
    if (!store) return null;
    var raw = null;
    try {
      raw = store.getItem(KEY);
      if (!raw) return null;
      var clean = root.MBLogic.sanitizeState(JSON.parse(raw));
      if (!clean) keepBroken(raw);
      return clean;
    } catch (e) {
      if (raw) keepBroken(raw);
      return null;
    }
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

  root.MBStorage = { KEY: KEY, load: load, save: save, available: available };
})(self);
