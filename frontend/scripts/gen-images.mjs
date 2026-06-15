// Dependency-free raster image generator for Welkora brand assets.
// Renders logo512.png and og-image.png from scratch (no external libraries).
// Run:  node scripts/gen-images.mjs
import zlib from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const SS = 2; // supersampling factor for anti-aliasing

// ---------- 5x7 bitmap font (uppercase + punctuation we use) ----------
const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "·": ["00000", "00000", "01100", "01100", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

// ---------- canvas ----------
function makeCanvas(w, h) {
  return { w: w * SS, h: h * SS, lw: w, lh: h, data: new Uint8ClampedArray(w * SS * h * SS * 4) };
}

function blendDev(c, dx, dy, col, a) {
  if (dx < 0 || dy < 0 || dx >= c.w || dy >= c.h || a <= 0) return;
  const i = (dy * c.w + dx) * 4;
  const ia = 1 - a;
  c.data[i] = col[0] * a + c.data[i] * ia;
  c.data[i + 1] = col[1] * a + c.data[i + 1] * ia;
  c.data[i + 2] = col[2] * a + c.data[i + 2] * ia;
  c.data[i + 3] = Math.max(c.data[i + 3], a * 255);
}

// Fill a logical rectangle; colFn(lx, ly) -> [r,g,b] , optional alpha
function fillRect(c, x, y, w, h, colFn, alpha = 1) {
  const x0 = Math.round(x * SS), y0 = Math.round(y * SS);
  const x1 = Math.round((x + w) * SS), y1 = Math.round((y + h) * SS);
  for (let dy = y0; dy < y1; dy++) {
    for (let dx = x0; dx < x1; dx++) {
      const col = typeof colFn === "function" ? colFn(dx / SS, dy / SS) : colFn;
      blendDev(c, dx, dy, col, alpha);
    }
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpCol(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

// multi-stop gradient along diagonal (t = (x+y)/(lw+lh))
function gradientFn(stops, lw, lh) {
  return (lx, ly) => {
    const t = Math.min(1, Math.max(0, (lx + ly) / (lw + lh)));
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
        return lerpCol(c0, c1, (t - t0) / (t1 - t0));
      }
    }
    return stops[stops.length - 1][1];
  };
}

function fillRoundedRect(c, x, y, w, h, r, colFn, alpha = 1) {
  const x0 = Math.round(x * SS), y0 = Math.round(y * SS);
  const x1 = Math.round((x + w) * SS), y1 = Math.round((y + h) * SS);
  const rr = r * SS;
  for (let dy = y0; dy < y1; dy++) {
    for (let dx = x0; dx < x1; dx++) {
      // distance to nearest corner center for rounding
      let cx = Math.min(Math.max(dx, x0 + rr), x1 - rr);
      let cy = Math.min(Math.max(dy, y0 + rr), y1 - rr);
      const ddx = dx - cx, ddy = dy - cy;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      const cov = Math.min(1, Math.max(0, rr + 0.5 - dist));
      if (cov <= 0) continue;
      const col = typeof colFn === "function" ? colFn(dx / SS, dy / SS) : colFn;
      blendDev(c, dx, dy, col, alpha * cov);
    }
  }
}

// scanline polygon fill (points in logical coords)
function fillPolygon(c, pts, col, alpha = 1) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  const y0 = Math.floor(minY * SS), y1 = Math.ceil(maxY * SS);
  for (let dy = y0; dy < y1; dy++) {
    const yl = dy / SS;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= yl && b[1] > yl) || (b[1] <= yl && a[1] > yl)) {
        xs.push(a[0] + ((yl - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const dx0 = Math.round(xs[k] * SS), dx1 = Math.round(xs[k + 1] * SS);
      for (let dx = dx0; dx < dx1; dx++) blendDev(c, dx, dy, col, alpha);
    }
  }
}

// lucide "Zap" bolt within a box (logical)
function drawBolt(c, x, y, size, col, alpha = 1) {
  const P = [[13, 2], [3, 14], [12, 14], [11, 22], [21, 10], [12, 10], [13, 2]];
  const pts = P.map(([px, py]) => [x + (px / 24) * size, y + (py / 24) * size]);
  fillPolygon(c, pts, col, alpha);
}

function textWidth(text, scale) { return text.length * (5 + 1) * scale - scale; }

function drawText(c, x, y, text, scale, col, alpha = 1) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] || FONT[" "];
    for (let row = 0; row < 7; row++) {
      for (let coli = 0; coli < 5; coli++) {
        if (g[row][coli] === "1") {
          fillRect(c, cx + coli * scale, y + row * scale, scale, scale, col, alpha);
        }
      }
    }
    cx += (5 + 1) * scale;
  }
}

// downsample SS -> 1 and encode PNG
function toPNG(c) {
  const { lw, lh, w, data } = c;
  const out = Buffer.alloc(lh * (1 + lw * 4));
  for (let y = 0; y < lh; y++) {
    out[y * (1 + lw * 4)] = 0; // filter: none
    for (let x = 0; x < lw; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * w + (x * SS + sx)) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3];
        }
      }
      const n = SS * SS;
      const o = y * (1 + lw * 4) + 1 + x * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  const idat = zlib.deflateSync(out, { level: 9 });

  const crcTable = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      let cc = n;
      for (let k = 0; k < 8; k++) cc = cc & 1 ? 0xedb88320 ^ (cc >>> 1) : cc >>> 1;
      t[n] = cc >>> 0;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let cc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) cc = crcTable[(cc ^ buf[i]) & 0xff] ^ (cc >>> 8);
    return (cc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, dataBuf) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(dataBuf.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, dataBuf])), 0);
    return Buffer.concat([len, typeBuf, dataBuf, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lw, 0); ihdr.writeUInt32BE(lh, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const C = {
  blue1: [37, 99, 235], blue2: [29, 78, 216], blue3: [59, 130, 246],
  white: [255, 255, 255], slate900: [15, 23, 42], navy: [30, 58, 138],
  blue200: [191, 219, 254], blue300: [147, 197, 253], slate300: [203, 213, 225],
  slate200: [226, 232, 240], green: [52, 211, 153],
};

// ---------- logo512.png ----------
function buildLogo() {
  const c = makeCanvas(512, 512);
  fillRoundedRect(c, 0, 0, 512, 512, 112, gradientFn([[0, C.blue1], [1, C.blue2]], 512, 512));
  drawBolt(c, 128, 128, 256, C.white);
  writeFileSync(join(PUBLIC_DIR, "logo512.png"), toPNG(c));
  console.log("✓ logo512.png");
}

// ---------- og-image.png (1200x630) ----------
function buildOg() {
  const W = 1200, H = 630;
  const c = makeCanvas(W, H);
  fillRect(c, 0, 0, W, H, gradientFn([[0, C.slate900], [0.55, C.navy], [1, C.blue1]], W, H));
  drawBolt(c, 720, 60, 520, C.white, 0.1); // watermark

  // logo tile
  fillRoundedRect(c, 90, 96, 96, 96, 22, gradientFn([[0, C.blue3], [1, C.blue2]], 200, 200));
  drawBolt(c, 114, 120, 48, C.white);
  drawText(c, 210, 123, "WELKORA", 6, C.white);

  // headline
  drawText(c, 90, 250, "HR-PROZESSE", 9, C.white);
  drawText(c, 90, 330, "AUTOMATISIEREN", 9, C.blue300);

  // subline
  drawText(c, 92, 440, "ONBOARDING · OFFBOARDING · ROLLENWECHSEL", 4, C.slate300);

  // feature chips
  const chips = ["DSGVO-KONFORM", "AUDIT-TRAIL", "TASK-MANAGEMENT"];
  let x = 92;
  for (const t of chips) {
    fillRect(c, x, 528, 14, 14, C.green); // dot
    drawText(c, x + 24, 524, t, 4, C.slate200);
    x += 24 + textWidth(t, 4) + 44;
  }

  // domain
  const dw = textWidth("WELKORA.NET", 4);
  drawText(c, W - 40 - dw, 566, "WELKORA.NET", 4, C.blue200);

  writeFileSync(join(PUBLIC_DIR, "og-image.png"), toPNG(c));
  console.log("✓ og-image.png");
}

buildLogo();
buildOg();
console.log("Done.");
