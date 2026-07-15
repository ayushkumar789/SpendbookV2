/**
 * Generates SpendBook PWA icons as real PNGs with zero dependencies.
 * Motif: espresso rounded square · marigold coin · parchment ledger lines.
 * Run: node scripts/generate-icons.js
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ESPRESSO = [34, 26, 17];
const MARIGOLD = [232, 148, 15];
const MARIGOLD_DEEP = [200, 122, 8];
const PARCHMENT = [247, 242, 233];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Signed distance of a rounded rectangle centered at (cx, cy). */
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

function drawIcon(size, { padded }) {
  const rgba = Buffer.alloc(size * size * 4);
  const pad = padded ? size * 0.12 : 0; // maskable safe zone
  const inner = size - pad * 2;
  const cx = size / 2;
  const bgHalf = inner / 2;
  const bgRadius = padded ? inner * 0.5 : inner * 0.225; // circle-ish when maskable
  const coinR = inner * 0.26;
  const coinCx = cx;
  const coinCy = pad + inner * 0.4;
  const lineH = inner * 0.045;
  const lineY1 = pad + inner * 0.68;
  const lineY2 = pad + inner * 0.8;

  const put = (i, rgb, a) => {
    // simple source-over onto existing pixel
    const ea = rgba[i + 3] / 255;
    const na = a + ea * (1 - a);
    if (na <= 0) return;
    for (let c = 0; c < 3; c++) {
      rgba[i + c] = Math.round((rgb[c] * a + rgba[i + c] * ea * (1 - a)) / na);
    }
    rgba[i + 3] = Math.round(na * 255);
  };
  const alpha = (d) => Math.max(0, Math.min(1, 0.5 - d)); // 1px anti-alias

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // background rounded square
      const dBg = sdRoundRect(x + 0.5, y + 0.5, cx, cx, bgHalf, bgHalf, bgRadius);
      put(i, ESPRESSO, alpha(dBg));
      // coin with a subtle bottom shade
      const dCoin = Math.hypot(x + 0.5 - coinCx, y + 0.5 - coinCy) - coinR;
      const shade = (y - (coinCy - coinR)) / (2 * coinR);
      const coinColor = MARIGOLD.map((c, k) => Math.round(c + (MARIGOLD_DEEP[k] - c) * Math.max(0, Math.min(1, shade))));
      put(i, coinColor, alpha(dCoin));
      // inner coin ring (espresso), suggests an embossed rupee coin
      const dRing = Math.abs(Math.hypot(x + 0.5 - coinCx, y + 0.5 - coinCy) - coinR * 0.62) - inner * 0.018;
      if (dCoin < 0) put(i, ESPRESSO, alpha(dRing) * 0.9);
      // ledger lines
      const dL1 = sdRoundRect(x + 0.5, y + 0.5, cx, lineY1, inner * 0.27, lineH / 2, lineH / 2);
      const dL2 = sdRoundRect(x + 0.5, y + 0.5, cx, lineY2, inner * 0.17, lineH / 2, lineH / 2);
      if (dBg < 0) {
        put(i, PARCHMENT, alpha(dL1) * 0.92);
        put(i, PARCHMENT, alpha(dL2) * 0.55);
      }
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  ["icon-192.png", 192, false],
  ["icon-256.png", 256, false],
  ["icon-384.png", 384, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-192.png", 192, true],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
];

for (const [name, size, padded] of targets) {
  fs.writeFileSync(path.join(outDir, name), drawIcon(size, { padded }));
  console.log(`✓ ${name} (${size}×${size})`);
}
console.log("Icons written to public/icons");
