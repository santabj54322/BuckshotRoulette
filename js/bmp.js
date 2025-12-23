/*
  Minimal BMP loader (24-bit and 32-bit BI_RGB, uncompressed) 
  Returns { width, height, data: Uint8ClampedArray RGBA }
*/
export async function loadBMP(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load BMP: ' + url);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  if (dv.getUint8(0) !== 0x42 || dv.getUint8(1) !== 0x4D) throw new Error('Not a BMP (BM missing)');
  const pixelOffset = dv.getUint32(10, true);
  const dibSize = dv.getUint32(14, true);
  if (dibSize < 40) throw new Error('Unsupported BMP DIB header size: ' + dibSize);

  const width = dv.getInt32(18, true);
  const heightSigned = dv.getInt32(22, true);
  const planes = dv.getUint16(26, true);
  const bpp = dv.getUint16(28, true);
  const compression = dv.getUint32(30, true);

  if (planes !== 1) throw new Error('Unsupported BMP planes != 1');
  if (compression !== 0) throw new Error('Unsupported BMP compression (only BI_RGB)');
  if (bpp !== 24 && bpp !== 32) throw new Error('Unsupported BMP bpp: ' + bpp);
  if (width <= 0 || heightSigned === 0) throw new Error('Invalid BMP dimensions');

  const topDown = heightSigned < 0;
  const height = Math.abs(heightSigned);
  const rowBytesRaw = Math.floor((bpp * width + 7) / 8);
  const rowStride = (rowBytesRaw + 3) & ~3;

  const out = new Uint8ClampedArray(width * height * 4);
  for (let row=0; row<height; row++) {
    const srcRow = topDown ? row : (height - 1 - row);
    const base = pixelOffset + srcRow * rowStride;
    if (bpp === 24) {
      for (let x=0; x<width; x++) {
        const b = dv.getUint8(base + 3*x + 0);
        const g = dv.getUint8(base + 3*x + 1);
        const r = dv.getUint8(base + 3*x + 2);
        const p = (row*width + x) * 4;
        out[p+0] = r; out[p+1] = g; out[p+2] = b; out[p+3] = 255;
      }
    } else {
      for (let x=0; x<width; x++) {
        const off = base + 4*x;
        const b = dv.getUint8(off + 0);
        const g = dv.getUint8(off + 1);
        const r = dv.getUint8(off + 2);
        const a = dv.getUint8(off + 3);
        const p = (row*width + x) * 4;
        out[p+0] = r; out[p+1] = g; out[p+2] = b; out[p+3] = a;
      }
    }
  }
  return { width, height, data: out };
}
