/*
 * Money Buddy – "Read to me".
 * Uses the phone's built-in voice (Web Speech API). If the phone has no voice,
 * MBSpeech.supported is false and the app hides the 🔊 button.
 */
(function (root) {
  'use strict';

  var synth = root.speechSynthesis;
  var supported = !!(synth && root.SpeechSynthesisUtterance);
  var RATE = 0.9; // a little slower than normal
  var voice = null;
  var sayCuse = 'Kyooz';
  var emojiRe = null;
  try { emojiRe = new RegExp('[\\p{Extended_Pictographic}\\u{1F1E6}-\\u{1F1FF}\\u200D\\uFE0F\\u20E3]', 'gu'); } catch (e) { emojiRe = null; }

  function pickVoice() {
    try {
      var voices = synth.getVoices() || [];
      voice = voices.find(function (v) { return /^en[-_]US/i.test(v.lang) && v.localService; }) ||
        voices.find(function (v) { return /^en[-_]US/i.test(v.lang); }) ||
        voices.find(function (v) { return /^en/i.test(v.lang); }) || null;
    } catch (e) { voice = null; }
  }

  if (supported) {
    pickVoice();
    try {
      if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
      else synth.onvoiceschanged = pickVoice;
    } catch (e) { /* older browsers */ }
  }

  /** Removes emojis and fixes words the voice says wrong. */
  function clean(text) {
    var out = String(text || '');
    if (emojiRe) out = out.replace(emojiRe, '');
    out = out.replace(/['’]Cuse/g, sayCuse);
    out = out.replace(/−\$/g, 'minus $');
    return out.replace(/\s+/g, ' ').trim();
  }

  /** Splits into sentences so long screens are not cut off. */
  function sentences(text) {
    return (text.match(/[^.!?]+[.!?]*/g) || []).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  var speaking = false;
  var turn = 0; // so a stopped reading cannot end a newer one

  /**
   * Reads text out loud. Stops anything already being read.
   * opts.onEnd runs when this reading finishes.
   */
  function speak(text, opts) {
    opts = opts || {};
    if (!supported) return false;
    stop();
    var parts = sentences(clean(text));
    if (!parts.length) return false;
    var myTurn = ++turn;
    speaking = true;
    parts.forEach(function (part, i) {
      var u = new root.SpeechSynthesisUtterance(part);
      u.rate = RATE;
      u.lang = 'en-US';
      if (voice) u.voice = voice;
      if (i === parts.length - 1) {
        u.onend = u.onerror = function () {
          if (myTurn !== turn) return;
          speaking = false;
          if (opts.onEnd) opts.onEnd();
        };
      }
      synth.speak(u);
    });
    return true;
  }

  function stop() {
    if (!supported) return;
    speaking = false;
    turn++;
    try { synth.cancel(); } catch (e) { /* ignore */ }
  }

  function isSpeaking() {
    return speaking;
  }

  function setCuseSaying(word) {
    if (word) sayCuse = word;
  }

  root.MBSpeech = {
    supported: supported,
    speak: speak,
    stop: stop,
    isSpeaking: isSpeaking,
    clean: clean,
    setCuseSaying: setCuseSaying
  };
})(self);
