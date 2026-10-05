// Builds COPY.md from copy.js so the word list never goes out of date.
// Run:  node tools/make-copy-md.js
const fs = require('fs');
const path = require('path');
const COPY = require('../copy.js');

const LIMIT = 6; // words per sentence we aim for

function sentenceWords(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\{\w+\}/g, 'X').split(/\s+/).filter((w) => /[A-Za-z0-9X$]/.test(w)).length);
}

let longCount = 0;
const lines = [];
lines.push('# Money Buddy – every word on screen');
lines.push('');
lines.push('This file is made from `copy.js`. **To change wording, edit `copy.js`** (the words in quotes), then run');
lines.push('`node tools/make-copy-md.js` to refresh this list. If you cannot run that, editing `copy.js` alone is enough — the app reads its words from there.');
lines.push('');
lines.push('- `{curly words}` are filled in by the app (like `{amount}` → `$20`). Keep them as they are.');
lines.push(`- **Words** = words in the longest sentence. ⚠️ marks sentences over ${LIMIT} words, so you can check reading level.`);
lines.push('- Pictures (emojis) are listed at the bottom.');
lines.push('');

const body = [];
for (const section of COPY.sections) {
  body.push(`## ${section.name}`);
  body.push('');
  body.push('| Key | Text | Words |');
  body.push('|---|---|---|');
  for (const [key, text] of Object.entries(section.items)) {
    const max = Math.max(...sentenceWords(text));
    const flag = max > LIMIT ? ' ⚠️' : '';
    if (flag) longCount++;
    body.push(`| \`${key}\` | ${text.replace(/\|/g, '\\|')} | ${max}${flag} |`);
  }
  body.push('');
}

lines.push(`**${longCount} lines** have a sentence longer than ${LIMIT} words.`);
lines.push('');
lines.push(...body);

lines.push('## Pictures');
lines.push('');
lines.push('| Key | Picture |');
lines.push('|---|---|');
for (const [key, icon] of Object.entries(COPY.icons)) lines.push(`| \`${key}\` | ${icon} |`);
lines.push('');

lines.push('## Spoken only');
lines.push('');
lines.push('The 🔊 "Read to me" voice leaves out emojis. It says `sayCuse` in place of "\'Cuse" so the word is said right.');
lines.push('Screen readers (VoiceOver, TalkBack) read the real words and use the labels marked "heard by screen readers".');
lines.push('');

fs.writeFileSync(path.join(__dirname, '..', 'COPY.md'), lines.join('\n'));
console.log(`wrote COPY.md (${longCount} long lines)`);
