import { Node } from './engine.js';
import { loadBMP } from './bmp.js'; 

class MosaicNode extends Node {
  constructor(squares, options={}) {
    super(options);
    this.squares = squares; // array of {x,y,w,h,fill}
  }
  drawSelfImpl(ctx) {
    // No stroke, no line width — just fill
    ctx.lineWidth = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    for (const s of this.squares) {
      ctx.fillStyle = s.fill;
      ctx.fillRect(s.x - s.w/2, s.y - s.h/2, s.w, s.h);
    }
  }
}

export function mosaicFromBMP(bmp, scale, sizefactor=1.0, alpha=1.0, fading=null, options={}) {
  if (!Number.isInteger(scale) || scale <= 0) throw new Error('scale must be positive integer');
  if (!(typeof sizefactor === 'number') || sizefactor <= 0) throw new Error('sizefactor must be positive number');

  const w = bmp.width, h = bmp.height;
  const S = sizefactor;
  const arr = bmp.data; // RGBA
  const squares = [];

  for (let y0=0; y0<h; y0+=scale) {
    const y1 = Math.min(y0 + scale, h);
    for (let x0=0; x0<w; x0+=scale) {
      const x1 = Math.min(x0 + scale, w);
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let yy=y0; yy<y1; yy++) {
        for (let xx=x0; xx<x1; xx++) {
          const p = (yy*w + xx) * 4;
          const a = arr[p+3];
          let r = arr[p], g = arr[p+1], b = arr[p+2];
          if (a < 128) { r = 0; g = 0; b = 0; }
          sr += r; sg += g; sb += b; n++;
        }
      }
      if (n === 0) continue;
      let r = Math.floor(sr / n);
      let g = Math.floor(sg / n);
      let b = Math.floor(sb / n);
      if ((r + g + b) !== 0) {
        // fading
        let fadingmult = 1;
        if (Array.isArray(fading) && fading.length === 4) {
          const [fx_end, fy_end, fx_pow, fy_pow] = fading;
          const cx_pix = 0.5 * (x0 + x1);
          const cy_pix = 0.5 * (y0 + y1);
          const nx = Math.abs(cx_pix - 0.5 * w) / (0.5 * w);
          const ny = Math.abs(cy_pix - 0.5 * h) / (0.5 * h);
          const fx = Math.max(0, 1 - (nx / Math.max(fx_end, 1e-9))) ** Math.max(fx_pow, 0);
          const fy = Math.max(0, 1 - (ny / Math.max(fy_end, 1e-9))) ** Math.max(fy_pow, 0);
          fadingmult = fx * fy;
        }
        r = Math.max(0, Math.min(255, Math.floor(r * alpha * fadingmult)));
        g = Math.max(0, Math.min(255, Math.floor(g * alpha * fadingmult)));
        b = Math.max(0, Math.min(255, Math.floor(b * alpha * fadingmult)));

        const bw = (x1 - x0) * S;
        const bh = (y1 - y0) * S;
        const cx = (-w / 2 + (x0 + x1) / 2) * S;
        const cy = (h / 2 - (y0 + y1) / 2) * S;

        const fill = `rgb(${r},${g},${b})`;
        squares.push({ x: cx, y: cy, w: bw, h: bh, fill });
      }
    }
  }
  return new MosaicNode(squares, options);
}

export async function mosaicFromURL(url, scale, sizefactor=1.0, alpha=1.0, fading=null, options={}) {
  const bmp = await loadBMP(url);
  return mosaicFromBMP(bmp, scale, sizefactor, alpha, fading, options);
}
