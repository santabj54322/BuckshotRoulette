/* Load uncompressed BMP (24- or 32-bit) into JS object similar to load_bmp_to_Image */

const BMP_CACHE = new Map();

async function fetchArrayBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return await res.arrayBuffer();
}

function parseBMP(buf) {
  const data = new DataView(buf);
  // Header
  if (String.fromCharCode(data.getUint8(0)) !== 'B' || String.fromCharCode(data.getUint8(1)) !== 'M') {
    throw new Error('Not a BMP file (missing BM)');
  }
  const fileSize = data.getUint32(2, true);
  const pixelOffset = data.getUint32(10, true);
  const dibSize = data.getUint32(14, true);
  if (dibSize < 40) throw new Error(`Unsupported BMP DIB header size: ${dibSize}`);

  const width = data.getInt32(18, true);
  const heightSigned = data.getInt32(22, true);
  const planes = data.getUint16(26, true);
  const bpp = data.getUint16(28, true);
  const compression = data.getUint32(30, true);
  const imgSize = data.getUint32(34, true);

  if (planes !== 1) throw new Error('Unsupported BMP: planes != 1');
  if (compression !== 0) throw new Error('Unsupported BMP compression (BI_RGB only)');
  if (bpp !== 24 && bpp !== 32) throw new Error(`Unsupported BMP bit depth: ${bpp} (only 24 and 32 supported)`);
  if (width <= 0 || heightSigned === 0) throw new Error('Invalid BMP dimensions');

  const topDown = heightSigned < 0;
  const height = Math.abs(heightSigned);

  const rowBytesRaw = Math.floor((bpp * width + 7) / 8);
  const rowStride = (rowBytesRaw + 3) & ~3;

  const need = pixelOffset + rowStride * height;
  if (need > buf.byteLength) throw new Error('BMP data truncated');

  // Produce rgb array top-down order: [r,g,b,r,g,b,...]
  const rgb = new Uint8Array(3 * width * height);
  const alpha = new Uint8Array(Math.ceil((width * height) / 8));
  for (let i = 0; i < alpha.length; i++) alpha[i] = 0xFF;

  const u8 = new Uint8Array(buf);
  for (let row = 0; row < height; row++) {
    const srcRow = topDown ? row : (height - 1 - row);
    const base = pixelOffset + srcRow * rowStride;

    if (bpp === 24) {
      for (let x = 0; x < width; x++) {
        const b = u8[base + 3*x + 0];
        const g = u8[base + 3*x + 1];
        const r = u8[base + 3*x + 2];
        const p = row * width + x;
        const i3 = 3 * p;
        rgb[i3] = r;
        rgb[i3 + 1] = g;
        rgb[i3 + 2] = b;
      }
    } else {
      for (let x = 0; x < width; x++) {
        const offset = base + 4*x;
        const b = u8[offset + 0];
        const g = u8[offset + 1];
        const r = u8[offset + 2];
        const a = u8[offset + 3];
        const p = row * width + x;
        const i3 = 3 * p;
        rgb[i3] = r;
        rgb[i3 + 1] = g;
        rgb[i3 + 2] = b;
        if (a >= 128) {
          alpha[p >> 3] |= (1 << (p & 7));
        } else {
          alpha[p >> 3] &= ~(1 << (p & 7));
        }
      }
    }
  }

  return {
    width, height, bpp, topDown, data: rgb, alpha
  };
}

async function loadBMP(url) {
  if (BMP_CACHE.has(url)) return BMP_CACHE.get(url);
  const buf = await fetchArrayBuffer(url);
  const img = parseBMP(buf);
  BMP_CACHE.set(url, img);
  return img;
}

// For compatibility with game code naming
async function preloadBMPS(urls) {
  await Promise.all(urls.map(loadBMP));
}

function load_bmp_to_Image(path) {
  // mimic Python function by returning cached BMP object synchronously
  const img = BMP_CACHE.get(path);
  if (!img) {
    throw new Error(`BMP not preloaded: ${path}`);
  }
  return img;
}

window.BMP = { loadBMP, preloadBMPS, load_bmp_to_Image, BMP_CACHE };
