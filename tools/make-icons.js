// Draws the Money Buddy icon (a friendly gold coin on green) as PNG and SVG.
// Uses only Node built-ins.  Run:  node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const COLORS = {
  bg: [21, 128, 61],       // green
  rim: [214, 148, 0],      // dark gold
  face: [255, 201, 60],    // gold
  ink: [74, 50, 0],        // eyes and smile
  cheek: [255, 140, 110]
};

// Shapes in coin units (coin radius = 1, center = 0,0).
function paint(u, v) {
  const d = Math.hypot(u, v);
  if (d > 1) return null;
  let c = d > 0.86 ? COLORS.rim : COLORS.face;
  const eye = (ex) => Math.hypot(u - ex, v + 0.2) < 0.12;
  if (eye(-0.33) || eye(0.33)) return COLORS.ink;
  const s = Math.hypot(u, v - 0.0);
  if (v > 0.18 && s > 0.42 && s < 0.54) return COLORS.ink;
  const cheek = (cx) => Math.hypot(u - cx, v - 0.18) < 0.12;
  if (cheek(-0.6) || cheek(0.6)) c = mix(c, COLORS.cheek, 0.55);
  return c;
}

function mix(a, b, t) { return a.map((x, i) => Math.round(x * (1 - t) + b[i] * t)); }

function render(size, coinRadius) {
  const SS = 4;
  const px = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = (x + (sx + 0.5) / SS) / size - 0.5;
          const fy = (y + (sy + 0.5) / SS) / size - 0.5;
          const c = paint(fx / coinRadius, fy / coinRadius) || COLORS.bg;
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (y * size + x) * 3;
      px[i] = Math.round(r / (SS * SS));
      px[i + 1] = Math.round(g / (SS * SS));
      px[i + 2] = Math.round(b / (SS * SS));
    }
  }
  return png(size, px);
}

// ---- minimal PNG writer (RGB, 8-bit) ----
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rows = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 3 + 1)] = 0;
    rgb.copy(rows, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const hex = (c) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');

function svg() {
  const R = 40; // coin radius in a 100×100 box
  const k = (n) => +(n * R).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${hex(COLORS.bg)}"/>
  <g transform="translate(50 50)">
    <circle r="${R}" fill="${hex(COLORS.rim)}"/>
    <circle r="${k(0.86)}" fill="${hex(COLORS.face)}"/>
    <circle cx="${k(-0.6)}" cy="${k(0.18)}" r="${k(0.12)}" fill="${hex(COLORS.cheek)}" opacity="0.55"/>
    <circle cx="${k(0.6)}" cy="${k(0.18)}" r="${k(0.12)}" fill="${hex(COLORS.cheek)}" opacity="0.55"/>
    <circle cx="${k(-0.33)}" cy="${k(-0.2)}" r="${k(0.12)}" fill="${hex(COLORS.ink)}"/>
    <circle cx="${k(0.33)}" cy="${k(-0.2)}" r="${k(0.12)}" fill="${hex(COLORS.ink)}"/>
    <path d="M ${k(-0.44)} ${k(0.18)} A ${k(0.48)} ${k(0.48)} 0 0 0 ${k(0.44)} ${k(0.18)}" fill="none" stroke="${hex(COLORS.ink)}" stroke-width="${k(0.12)}"/>
  </g>
</svg>
`;
}

const jobs = [
  ['icon-192.png', 192, 0.40],
  ['icon-512.png', 512, 0.40],
  ['icon-maskable-512.png', 512, 0.32], // stays inside the 80% safe zone
  ['apple-touch-icon.png', 180, 0.36]
];
for (const [name, size, r] of jobs) {
  fs.writeFileSync(path.join(OUT, name), render(size, r));
  console.log('wrote icons/' + name);
}
fs.writeFileSync(path.join(OUT, 'icon.svg'), svg());
console.log('wrote icons/icon.svg');
