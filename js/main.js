/* ===========================
   utils.js (merged)
   =========================== */

function normalize_angle(a) {
  a = a % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function ease_out_quad(t) {
  return 1 - (1 - t) * (1 - t);
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function Color(tuple) {
  const r = Math.round(tuple[0]);
  const g = Math.round(tuple[1]);
  const b = Math.round(tuple[2]);
  return `rgb(${r},${g},${b})`;
}

function inside_circle(px, py, cx, cy, r) {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function move_to(obj, x, y) {
  obj.moveTo(x, y);
}

function get_xy(obj) {
  return obj.getWorldXY();
}

function node_of(o) {
  return o;
}

/* ===========================
   engine.js (merged)
   =========================== */

class Node {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.rotation = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.depth = 0; // lower = in front
    this.children = [];
    this.parent = null;
    this.visible = true;
  }

  add(child) {
    if (!child || child === this || child.parent === this) return;
    if (child.parent) child.parent.remove(child);
    this.children.push(child);
    child.parent = this;
  }

  remove(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) {
      this.children.splice(i, 1);
      child.parent = null;
    }
  }

  contents() { return this.children.slice(); }
  setDepth(d) { this.depth = d; }
  moveTo(x, y) { this.x = x; this.y = y; }
  move(dx, dy) { this.x += dx; this.y += dy; }
  rotate(deg) { this.rotation = normalize_angle(this.rotation + deg); }
  scale(s) { this.scaleX *= s; this.scaleY *= s; }
  setScale(sx, sy) { this.scaleX = sx; this.scaleY = sy; }

  getLocalMatrix() {
    const rad = this.rotation * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const a = cos * this.scaleX;
    const b = sin * this.scaleX;
    const c = -sin * this.scaleY;
    const d = cos * this.scaleY;
    const e = this.x;
    const f = this.y;
    return [a, b, c, d, e, f];
  }

  static mul(m1, m2) {
    const [a1,b1,c1,d1,e1,f1] = m1;
    const [a2,b2,c2,d2,e2,f2] = m2;
    return [
      a1*a2 + c1*b2,
      b1*a2 + d1*b2,
      a1*c2 + c1*d2,
      b1*c2 + d1*d2,
      a1*e2 + c1*f2 + e1,
      b1*e2 + d1*f2 + f1
    ];
  }

  getWorldMatrix() {
    let m = this.getLocalMatrix();
    let p = this.parent;
    while (p) {
      m = Node.mul(p.getLocalMatrix(), m);
      p = p.parent;
    }
    return m;
  }

  getWorldXY() {
    const m = this.getWorldMatrix();
    return [m[4], m[5]];
  }

  draw(ctx) {
    if (!this.visible) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);
    ctx.scale(this.scaleX, this.scaleY);
    this._drawSelf(ctx);
    const cs = this.children.slice().sort((a,b) => b.depth - a.depth);
    for (const c of cs) c.draw(ctx);
    ctx.restore();
  }

  _drawSelf(ctx) {}
}

class Layer extends Node {
  constructor() { super(); }
}

class Rectangle extends Node {
  constructor(w, h) {
    super();
    this.w = w;
    this.h = h;
    this.fill = '#000';
    this.border = '#000';
    this.borderWidth = 0; // default no border
  }
  setFillColor(c) { this.fill = c; }
  setBorderColor(c) { this.border = c; }
  setBorderWidth(w) { this.borderWidth = w; }
  _drawSelf(ctx) {
    const w = this.w, h = this.h;
    if (this.fill) {
      ctx.fillStyle = this.fill;
      ctx.fillRect(-w/2, -h/2, w, h);
    }
    if (this.borderWidth > 0) {
      ctx.lineWidth = this.borderWidth;
      ctx.strokeStyle = this.border;
      ctx.strokeRect(-w/2, -h/2, w, h);
    }
  }
}

class Circle extends Node {
  constructor(r) {
    super();
    this.r = r;
    this.fill = '#000';
    this.border = '#000';
    this.borderWidth = 0; // default no border
  }
  setFillColor(c) { this.fill = c; }
  setBorderColor(c) { this.border = c; }
  setBorderWidth(w) { this.borderWidth = w; }
  _drawSelf(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    if (this.fill) {
      ctx.fillStyle = this.fill;
      ctx.fill();
    }
    if (this.borderWidth > 0) {
      ctx.lineWidth = this.borderWidth;
      ctx.strokeStyle = this.border;
      ctx.stroke();
    }
  }
}

class Renderer {
  constructor(canvas, stage) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stage = stage;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.ctx.save();
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.translate(this.canvas.width/2, this.canvas.height/2);
      this.ctx.scale(1, -1);
      this.stage.draw(this.ctx);
      this.ctx.restore();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }
}

window.Engine = { Node, Layer, Rectangle, Circle, Renderer };

/* ===========================
   bmp.js (merged)
   =========================== */

const BMP_CACHE = new Map();

async function fetchArrayBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return await res.arrayBuffer();
}

function parseBMP(buf) {
  const data = new DataView(buf);
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

  return { width, height, bpp, topDown, data: rgb, alpha };
}

async function loadBMP(url) {
  if (BMP_CACHE.has(url)) return BMP_CACHE.get(url);
  const buf = await fetchArrayBuffer(url);
  const img = parseBMP(buf);
  BMP_CACHE.set(url, img);
  return img;
}

async function preloadBMPS(urls) {
  await Promise.all(urls.map(loadBMP));
}

function load_bmp_to_Image(path) {
  const img = BMP_CACHE.get(path);
  if (!img) throw new Error(`BMP not preloaded: ${path}`);
  return img;
}

window.BMP = { loadBMP, preloadBMPS, load_bmp_to_Image, BMP_CACHE };

/* ===========================
   mosaic.js (merged)
   =========================== */

function mosaic_layer_from_image(img, scale, sizefactor=1.0, alpha=1.0, fading=null) {
  if (!Number.isInteger(scale) || scale <= 0) throw new Error("scale must be a positive integer");
  if (!(typeof sizefactor === 'number') || sizefactor <= 0) throw new Error("sizefactor must be a positive number");

  const w = img.width, h = img.height;
  const S = sizefactor;
  const layer = new Layer();
  const data = img.data;

  function getPixel(x, y) {
    const idx = 3 * (y * w + x);
    return [data[idx], data[idx+1], data[idx+2]];
  }

  for (let y0 = 0; y0 < h; y0 += scale) {
    const y1 = Math.min(y0 + scale, h);
    for (let x0 = 0; x0 < w; x0 += scale) {
      const x1 = Math.min(x0 + scale, w);
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const [r,g,b] = getPixel(xx, yy);
          sr += r; sg += g; sb += b; n++;
        }
      }
      if (n === 0) continue;
      let r = Math.floor(sr / n), g = Math.floor(sg / n), b = Math.floor(sb / n);
      if (r + g + b === 0) continue;

      const bw = (x1 - x0) * S;
      const bh = (y1 - y0) * S;
      const sq = new Rectangle(bw, bh);

      // ensure no border for mosaic rectangles (BMP image tiles)
      sq.setBorderWidth(0);

      let fadingmult = 1;
      if (fading !== null) {
        const [fx_end, fy_end, fx_pow, fy_pow] = fading;
        const cx_pix = 0.5 * (x0 + x1);
        const cy_pix = 0.5 * (y0 + y1);
        const nx = Math.abs(cx_pix - 0.5 * w) / (0.5 * w);
        const ny = Math.abs(cy_pix - 0.5 * h) / (0.5 * h);
        const fx = Math.max(0.0, 1.0 - (nx / Math.max(fx_end, 1e-9))) ** Math.max(fx_pow, 0.0);
        const fy = Math.max(0.0, 1.0 - (ny / Math.max(fy_end, 1e-9))) ** Math.max(fy_pow, 0.0);
        fadingmult = fx * fy;
      }
      r = Math.max(0, Math.min(255, Math.floor(r * alpha * fadingmult)));
      g = Math.max(0, Math.min(255, Math.floor(g * alpha * fadingmult)));
      b = Math.max(0, Math.min(255, Math.floor(b * alpha * fadingmult)));
      sq.setFillColor(Color([r,g,b]));

      const cx = (-w / 2 + (x0 + x1) / 2) * S;
      const cy = ( h / 2 - (y0 + y1) / 2) * S;
      sq.moveTo(cx, cy);
      layer.add(sq);
    }
  }

  return layer;
}

window.Mosaic = { mosaic_layer_from_image };

/* ===========================
   game.js (merged)
   =========================== */

const CANVAS_W = 1280, CANVAS_H = 720;
const CARTRIDGE_CAPACITY = 6;
const HP_MAX = 10;

const DEPTH_BG     = 100;
const DEPTH_TABLE  = 90;
const DEPTH_ARENA  = 80;
const DEPTH_ACTORS = 60;
const DEPTH_GUN    = 40;
const DEPTH_HANDS  = 30;
const DEPTH_UI     = 20;
const DEPTH_FLASH  = 5;

// Centralized tuning for all animation and timing parameters
const TUNING = {
  move: { duration: 0.28, steps: 18 },
  shake: { magnitude: 8, duration: 0.25, freq: 30 },
  knockback: { distance: 40, duration: 0.25, steps: 18 },
  gun: {
    rotateDuration: 0.16,
    rotateStepDeg: 6,
    pickupRotateDuration: 0.09,
    rigToHandMoveDuration: 0.12,
    returnToIdleDuration: 0.25,
    nudgeDuration: 0.10,
    handsReturnDuration: 0.20,
    kickbackDelayMS: 120,
    muzzleFlashFrameDelayMS: 60
  },
  hpbar: { totalDuration: 0.45 },
  bulletShell: { thrownVel: 10, scale: 20, iterDelayMS: 25, depth: 70 },
  loadBullet: { duration: 0.35, steps: 20 },
  ai: { thinkDelayMS: 700 },
  round: { previewDelayMS: 1200 },
  particles: { dt: 0.02, gravity: 500, life: 0.3 },
  clickParticles: { size: [9,9], vel: 1000, drag: 0.85, num: 15, randomness: 0, spread: 360, depth: 10 }
};

const ASSETS = {
  "dealer_face":  "assets/Dealer2.bmp",
  "dealer_hand":  "assets/OppHands2.bmp",
  "player_face":  "assets/PlayerFace2.bmp",
  "player_hand":  "assets/Hands2.bmp",
  "shotgun":      "assets/Shotgun2.bmp",
  "bullet_live":  "assets/LiveBullet2.bmp",
  "bullet_blank": "assets/BlankBullet2.bmp",
  "bullet_concealed": "assets/UnknownBullet2.bmp",
  "wooden_floor": "assets/WoodenFloor2.bmp",
  "Hand_holding_gun": "assets/ShotgunHands2.bmp",
  "bullet_used_live": "assets/BulletliveFired2.bmp",
  "textzero": "assets/zero.bmp",
  "textone": "assets/one.bmp",
  "texttwo": "assets/two.bmp",
  "textthree": "assets/three.bmp",
  "textfour": "assets/four.bmp",
  "textfive": "assets/five.bmp",
  "textsix": "assets/six.bmp",
  "textseven": "assets/seven.bmp",
  "texteight": "assets/eight.bmp",
  "textnine": "assets/nine.bmp",
  "textten": "assets/ten.bmp",
  "textplus": "assets/plus.bmp",
  "textdmg": "assets/DMG.bmp",
  "youwin": "assets/youwin.bmp",
  "youlose": "assets/youlose.bmp"
};

const STATE = {};

class Animator {
  static ease_out_quad(t) { return ease_out_quad(t); }

  static async animate_move(obj, sx, sy, ex, ey, duration=TUNING.move.duration, steps=TUNING.move.steps, islst=false) {
    if (islst) {
      const n = obj.length;
      if (!(sx.length === n && sy.length === n && ex.length === n && ey.length === n))
        throw new Error("Length mismatch in animate_move (islst)");
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        for (let k = 0; k < n; k++) obj[k].moveTo(lerp(sx[k], ex[k], t), lerp(sy[k], ey[k], t));
        await sleep(duration * 1000 / steps);
      }
    } else {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        obj.moveTo(lerp(sx, ex, t), lerp(sy, ey, t));
        await sleep(duration * 1000 / steps);
      }
    }
  }

  static async animate_move_pt(obj, ex, ey, duration=TUNING.move.duration, steps=TUNING.move.steps, islst=false) {
    if (islst) {
      const n = obj.length;
      if (!(ex.length === n && ey.length === n)) throw new Error("Length mismatch animate_move_pt (islst)");
      const sx = new Array(n), sy = new Array(n);
      for (let k = 0; k < n; k++) {
        const [wx, wy] = obj[k].getWorldXY();
        sx[k] = wx; sy[k] = wy;
      }
      await Animator.animate_move(obj, sx, sy, ex, ey, duration, steps, true);
    } else {
      const [sx, sy] = obj.getWorldXY();
      await Animator.animate_move(obj, sx, sy, ex, ey, duration, steps, false);
    }
  }

  static async shake(layer, magnitude=TUNING.shake.magnitude, duration=TUNING.shake.duration, freq=TUNING.shake.freq) {
    const [ox, oy] = layer.getWorldXY();
    const steps = Math.max(1, Math.floor(duration * freq));
    for (let i = 0; i < steps; i++) {
      const dx = Math.random() * (2*magnitude) - magnitude;
      const dy = Math.random() * (2*magnitude) - magnitude;
      layer.moveTo(ox + dx, oy + dy);
      await sleep(duration * 1000 / steps);
    }
    layer.moveTo(ox, oy);
  }

  static async knockback(layer, direction='up', distance=TUNING.knockback.distance, duration=TUNING.knockback.duration, steps=TUNING.knockback.steps) {
    const [ox, oy] = layer.getWorldXY();
    let dx = 0, dy = 0;
    if (direction === 'up') dy = distance;
    else if (direction === 'down') dy = -distance;
    else if (direction === 'left') dx = -distance;
    else dx = distance;
    for (let i = 1; i <= steps; i++) {
      const t = Animator.ease_out_quad(i / steps);
      layer.moveTo(ox + dx * t, oy + dy * t);
      await sleep(duration * 1000 / steps);
    }
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      layer.moveTo(ox + dx * (1 - t), oy + dy * (1 - t));
      await sleep(duration * 1000 / steps);
    }
    layer.moveTo(ox, oy);
  }
}

class Particles {
  constructor(clr, size, pos, vel, drag, num, randomness,
              direction='up', spread=40, gravity=500, life=1.0, depth=50, dt=0.02) {
    this.dt = dt;
    this.gravity = gravity;
    this.drag = Math.max(0.0, Math.min(0.9999, drag));
    this.max_time = life;
    this.elapsed = 0.0;
    this.depth = depth;
    const color = Array.isArray(clr) ? Color(clr) : clr;

    let base_theta = 0;
    if (direction === 'up') base_theta = -Math.PI/2;
    else if (direction === 'down') base_theta = Math.PI/2;
    else if (direction === 'left') base_theta = Math.PI;
    else base_theta = 0;

    const [x0, y0] = pos;
    this.items = [];
    for (let i = 0; i < num; i++) {
      const s = (Array.isArray(size) ? (Math.random() * (size[1]-size[0]) + size[0]) : size);
      const rect = new Rectangle(s, s);
      rect.setBorderWidth(0); // no border for particle quads
      rect.setFillColor(color);
      rect.moveTo(x0, y0);
      rect.setDepth(this.depth);

      const theta = base_theta + (Math.PI/180 * spread) * (Math.random() - 0.5) * 2.0;
      const speed = vel * (1.0 + (Math.random() - 0.5) * randomness);
      const vx = Math.cos(theta) * speed;
      const vy = Math.sin(theta) * speed;
      const spin = (Math.random() - 0.5) * 360.0;
      STATE.stage.add(rect);
      this.items.push({ node: rect, x: x0, y: y0, vx, vy, vrot: spin });
    }
    this.v_stop = 10.0;
  }

  step() {
    let any_moving = false;
    for (const p of this.items) {
      const node = p.node;
      if (!node) continue;
      p.vx *= this.drag;
      p.vy = p.vy * this.drag - this.gravity * this.dt; // y-up: downward gravity negative
      p.x += p.vx * this.dt;
      p.y += p.vy * this.dt;
      node.moveTo(p.x, p.y);
      if (Math.abs(p.vrot) > 1) node.rotate(p.vrot * this.dt);
      if (Math.hypot(p["vx"], p["vy"]) > this.v_stop) any_moving = true;
    }
    this.elapsed += this.dt;
    if (this.elapsed >= this.max_time) any_moving = false;
    return any_moving;
  }

  async move() {
    while (this.step()) await sleep(this.dt * 1000);
    for (const p of this.items) {
      const node = p.node;
      if (node) {
        try { STATE.stage.remove(node); } catch {}
        p.node = null;
      }
    }
  }
}

class HpBar {
  constructor(width=240, height=24, segments=10) {
    this.node = new Layer();
    const panel = new Rectangle(width, height);
    panel.setFillColor(Color([30,30,40]));
    panel.setBorderColor(Color([90,100,120]));
    panel.setBorderWidth(3);
    move_to(panel, 0, 0);
    this.node.add(panel);

    const cells_layer = new Layer();
    this.node.add(cells_layer);

    const gap = 4;
    const inner_h = height - 6;
    const total_gap = gap * (segments - 1);
    const base_w = Math.floor((width - total_gap) / segments);
    const remainder = (width - total_gap) - base_w * segments;

    this.cells = [];
    let x = -width / 2.0;
    this.on_color = Color([80,200,120]);
    this.off_color = Color([45,55,70]);
    for (let i = 0; i < segments; i++) {
      const cw = base_w + (i < remainder ? 1 : 0);
      const cell = new Rectangle(cw, inner_h);
      cell.setBorderWidth(0); // no borders on bar segments
      cell.setFillColor(this.on_color);
      const cx = x + cw / 2.0;
      move_to(cell, cx, 0);
      cells_layer.add(cell);
      this.cells.push(cell);
      x += cw + gap;
    }
    this.value = segments;
    this.max = segments;
  }

  setDepth(d) { this.node.setDepth(d); }
  moveTo(x,y) { this.node.moveTo(x,y); }

  set(value, animate=true, duration=TUNING.hpbar.totalDuration) {
    value = Math.max(0, Math.min(this.max, value));
    const prev = this.value;
    if (value === prev) return;
    if (!animate) {
      this.cells.forEach((c, i) => c.setFillColor(i < value ? this.on_color : this.off_color));
      this.value = value;
      return;
    }
    const diff = Math.abs(value - prev);
    if (diff === 0) return;
    const per_step = duration / diff;
    const apply = async () => {
      if (value > prev) {
        for (let i = prev; i < value; i++) {
          this.cells[i].setFillColor(this.on_color);
          await sleep(per_step * 1000);
        }
      } else {
        for (let i = prev - 1; i >= value; i--) {
          this.cells[i].setFillColor(this.off_color);
          await sleep(per_step * 1000);
        }
      }
      this.value = value;
    };
    apply();
  }
}

class CartridgeTray {
  constructor(capacity=6) {
    this.node = new Layer();
    this.capacity = capacity;
    this.node.setDepth(DEPTH_UI);
    const bg = new Rectangle(280, 140);
    bg.setFillColor(Color([35,50,50]));
    bg.setBorderColor(Color([80,110,110]));
    bg.setBorderWidth(3);
    move_to(bg, -CANVAS_W * 0.25, -10);
    this.node.add(bg);

    this.slots_layer = new Layer();
    this.node.add(this.slots_layer);

    const [cx, cy] = [bg.x, bg.y];
    const left = cx - 100;
    const y = cy;
    const spacing = 40;
    this.slots = [];
    for (let i = 0; i < this.capacity; i++) {
      const ring = new Circle(14);
      ring.setFillColor(Color([20,30,30]));
      ring.setBorderColor(Color([120,160,160]));
      ring.setBorderWidth(2);
      move_to(ring, left + i * spacing, y);
      this.slots_layer.add(ring);
      this.slots.push({ anchor: ring, icon: null, type: null, concealed: false });
    }
  }

  setDepth(d) { this.node.setDepth(d); }
  moveTo(x,y) { this.node.moveTo(x,y); }

  clear_icons() {
    for (const s of this.slots) {
      if (s.icon) {
        this.slots_layer.remove(s.icon);
        s.icon = null;
      }
      s.type = null;
      s.concealed = false;
    }
  }

  show_preview(types) {
    if (types.length > this.slots.length) throw new Error("Too many bullets for the tray");
    this.clear_icons();
    for (let i = 0; i < types.length; i++) {
      const kind = types[i];
      let icon;
      if (kind === 'live') {
        icon = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["bullet_live"]), 4, 0.8);
      } else {
        icon = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["bullet_blank"]), 4, 0.8);
      }
      const [ax, ay] = sxy(this.slots[i].anchor);
      move_to(icon, ax, ay);
      this.slots_layer.add(icon);
      this.slots[i].icon = icon;
      this.slots[i].type = kind;
      this.slots[i].concealed = false;
    }

    function sxy(node) { return node.getWorldXY(); }
  }

  conceal_and_shuffle() {
    const items = this.slots.filter(s => s.icon !== null);
    const types = items.map(s => s.type);
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      if (s.icon) this.slots_layer.remove(s.icon);
      const icon = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["bullet_concealed"]), 4, 0.8);
      const [ax, ay] = s.anchor.getWorldXY();
      move_to(icon, ax, ay);
      this.slots_layer.add(icon);
      s.icon = icon;
      s.type = types[i];
      s.concealed = true;
    }
  }

  take_leftmost() {
    for (const s of this.slots) {
      if (s.icon) {
        const kind = s.type;
        const [ax, ay] = s.anchor.getWorldXY();
        this.slots_layer.remove(s.icon);
        s.icon = null; s.type = null; s.concealed = false;
        return [kind, [ax, ay]];
      }
    }
    return [null, null];
  }
}

function build_table_layer() {
  const table = new Layer();
  table.setDepth(DEPTH_TABLE);

  const ring_outer = new Circle(140);
  ring_outer.setBorderColor(Color([40,140,90]));
  ring_outer.setBorderWidth(6); 
  ring_outer.setFillColor(Color([25,60,45]));
  move_to(ring_outer, 0, 0);
  table.add(ring_outer);

  const ring_inner = new Circle(80);
  ring_inner.setBorderColor(Color([30,120,80]));
  ring_inner.setBorderWidth(3);
  ring_inner.setFillColor(Color([25,60,45]));
  move_to(ring_inner, 0, 0);
  table.add(ring_inner);
  return table;
}

function build_number_layer() {
  const layer = new Layer();
  layer.setDepth(DEPTH_UI);
  const t_dmg = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["textdmg"]),1,6);
  const t_plus = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["textplus"]),1,6);
  const t_zero = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["textzero"]),1,6);
  layer.add(t_dmg);
  layer.add(t_plus);
  layer.add(t_zero);
  t_plus.moveTo(85, 0);
  t_zero.moveTo(120,0);
  move_to(layer, 120, 120);
  layer.rotate(-45);
  return layer;
}

function build_actors_and_hands() {
  const dealer_layer = new Layer(); dealer_layer.setDepth(DEPTH_ACTORS);
  const player_layer = new Layer(); player_layer.setDepth(DEPTH_ACTORS);
  const hands_layer  = new Layer(); hands_layer.setDepth(DEPTH_HANDS);

  move_to(player_layer, 0, -CANVAS_H * 0.28);
  move_to(dealer_layer, 0,  CANVAS_H * 0.28);

  const player_face = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["player_face"]), 4);
  move_to(player_face, 0, 0);
  player_layer.add(player_face);

  const dealer_face = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["dealer_face"]), 4);
  move_to(dealer_face, 0, 0);
  dealer_layer.add(dealer_face);

  const player_hand = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["player_hand"]), 4);
  move_to(player_hand, 0, -CANVAS_H*0.12);
  hands_layer.add(player_hand);

  const dealer_hand = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["dealer_hand"]), 4);
  move_to(dealer_hand, 0,  CANVAS_H*0.12);
  hands_layer.add(dealer_hand);

  return { dealer_layer, player_layer, hands_layer, dealer_face, player_face, dealer_hand, player_hand };
}

function build_shotgun_rig(rig=null) {
  if (rig === null) {
    rig = new Layer();
    rig.setDepth(DEPTH_GUN);
    rig.angle = 0;
    rig.gun_only = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["shotgun"]), 4, 1.5);
    move_to(rig.gun_only, 0, 0);
    rig.add(rig.gun_only);
    rig.gun_with_hands = null;
    return rig;
  }
  if (rig.gun_with_hands) {
    try { rig.remove(rig.gun_with_hands); } catch {}
  }
  if (!rig.gun_only) {
    rig.gun_only = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["shotgun"]), 4, 1.5);
    move_to(rig.gun_only, 0, 0);
  }
  if (!rig.contents().includes(rig.gun_only)) {
    rig.add(rig.gun_only);
  }
  return rig;
}

function build_shotgunhand_rig(rig) {
  if (rig.gun_only) {
    try { rig.remove(rig.gun_only); } catch {}
  }
  if (!rig.gun_with_hands) {
    rig.gun_with_hands = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["Hand_holding_gun"]), 4, 1.5);
    move_to(rig.gun_with_hands, 0, 0);
  }
  if (!rig.contents().includes(rig.gun_with_hands)) {
    rig.add(rig.gun_with_hands);
  }
}

async function rotate_barrel_to(rig, target_deg, duration=TUNING.gun.rotateDuration, step_deg=TUNING.gun.rotateStepDeg) {
  if (typeof rig.angle !== 'number') rig.angle = 0;
  const target = normalize_angle(target_deg);
  let delta = normalize_angle(target - rig.angle);
  if (Math.abs(delta) < 1e-6) return;

  const steps = Math.max(1, Math.ceil(Math.abs(delta) / step_deg));
  const per = duration / steps;
  const step = delta / steps;

  for (let i = 0; i < steps; i++) {
    rig.rotate(step);
    rig.angle = normalize_angle(rig.angle + step);
    await sleep(per * 1000);
  }

  const residual = normalize_angle(target - rig.angle);
  if (Math.abs(residual) > 0.01) {
    rig.rotate(residual);
    rig.angle = normalize_angle(rig.angle + residual);
  }
}

async function hand_reach_and_pick(hand, gun_rig, towards='up', duration=TUNING.gun.handReachDuration) {
  const [hx, hy] = get_xy(hand);
  await Animator.animate_move(hand, hx, hy, 0, 0, duration, TUNING.move.steps, false);
  build_shotgunhand_rig(gun_rig);
  for (const drawable of hand.contents()) {
    try { hand.remove(drawable); } catch {}
  }
  if (towards === 'up') await rotate_barrel_to(gun_rig, 180, TUNING.gun.pickupRotateDuration);
  else await rotate_barrel_to(gun_rig, 0, TUNING.gun.pickupRotateDuration);
  await Animator.animate_move_pt(gun_rig, hx, hy, TUNING.gun.rigToHandMoveDuration, TUNING.move.steps, false);
}

async function return_gun_to_idle(gun_rig, duration=TUNING.gun.returnToIdleDuration) {
  await Animator.animate_move_pt(gun_rig, 0, 0, duration, TUNING.move.steps, false);
  await rotate_barrel_to(gun_rig, 0);
  if (gun_rig.gun_with_hands) {
    try { gun_rig.remove(gun_rig.gun_with_hands); } catch {}
  }
  if (!gun_rig.gun_only) {
    gun_rig.gun_only = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["shotgun"]), 4, 1.5);
    move_to(gun_rig.gun_only, 0, 0);
  }
   if (!gun_rig.contents().includes(gun_rig.gun_only)) {
     gun_rig.add(gun_rig.gun_only);
   }
}

async function die_motion(obj, direction='left', duration=0.8, steps=24, shift=0) {
  const deg = (direction === 'left') ? -90 : 90;
  const per = duration / steps;
  const dx_step = shift === 0 ? 0 : ((direction === 'left' ? -shift : shift) / steps);
  for (let i = 0; i < steps; i++) {
    obj.rotate(deg / steps);
    const [ox, oy] = obj.getWorldXY();
    move_to(obj, ox + dx_step, oy);
    await sleep(per * 1000);
  }
}

async function throw_used_bullet(btype, shooter, stage) {
  let usedbullet = null;
  if (btype === "blank") {
    usedbullet = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["bullet_blank"]), 8, 0.5, 0.5);
  } else if (btype === "live") {
    usedbullet = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["bullet_used_live"]), 8, 0.5, 0.5);
  }
  if (!usedbullet) return;

  move_to(usedbullet, 0, 0);
  stage.add(usedbullet);
  usedbullet.setDepth(TUNING.bulletShell.depth);
  const thrownvel = TUNING.bulletShell.thrownVel;
  const scale = TUNING.bulletShell.scale;
  const angleparam = Math.random()/5 + 0.55;
  for (let i = 2*thrownvel; i > 0; i--) {
    let temp = -1;
    if (shooter === "player") temp *= -1;
    usedbullet.move(temp*i/2/5*angleparam*scale, -temp*i/2/5*(1-angleparam)*scale);
    usedbullet.rotate(angleparam*6*i);
    await sleep(TUNING.bulletShell.iterDelayMS);
  }
  // Do NOT remove used bullet shells; leave them on the table.
}

function build_background() {
  const img = BMP.load_bmp_to_Image(ASSETS["wooden_floor"]);
  const layer = Mosaic.mosaic_layer_from_image(img, 3, 9, 1, [0.6, 1, 0.4, 0.5]);
  layer.setDepth(DEPTH_BG);
  return layer;
}

async function bullet_move_to_gun(stage, start_xy, gun_layer, img_kind='concealed', duration=TUNING.loadBullet.duration, steps=TUNING.loadBullet.steps) {
  const [bx, by] = start_xy;
  const [gx, gy] = get_xy(gun_layer);
  const chamber = [gx, gy];

  let path = ASSETS['bullet_concealed'];
  if (img_kind === 'live') path = ASSETS['bullet_live'];
  else if (img_kind === 'blank') path = ASSETS['bullet_blank'];

  const icon = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(path), 4);
  move_to(icon, bx, by);
  stage.add(icon);

  for (let i = 1; i <= steps; i++) {
    const t = ease_out_quad(i / steps);
    move_to(icon, lerp(bx, chamber[0], t), lerp(by, chamber[1], t));
    await sleep(duration * 1000 / steps);
  }

  try { stage.remove(icon); } catch {}
}

function update_damage_box(swag=false) {
  const dmg_layer = STATE.dmg_text;
  const cs = dmg_layer.contents();
  if (cs.length > 0) {
    try { dmg_layer.remove(cs[cs.length - 1]); } catch {}
  }
  const nums = ["textzero","textone", "texttwo", "textthree", "textfour","textfive","textsix","textseven","texteight","textnine","textten"];
  const idx = Math.max(0, Math.min(10, STATE.stack));
  const newnum_t = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS[nums[idx]]),1,6);
  dmg_layer.add(newnum_t);
  newnum_t.moveTo(120,0);
  if (swag) {
    const increment = Math.pow(128/125, 4 + STATE.stack);
    (async () => {
      for (let i = 0; i < 2; i++) { dmg_layer.scale(increment); await sleep(50); }
      for (let i = 0; i < 2; i++) { dmg_layer.scale(1/increment); await sleep(50); }
    })();
  }
}

function take_next_bullet() {
  const [kind, start_xy] = STATE.cartridge.take_leftmost();
  if (!kind) return [null, null];
  if (STATE.round_types.length) STATE.round_types.shift();
  return [kind, start_xy];
}

async function preload_next_bullet() {
  if (STATE.game_over) return;
  if (STATE.player_hp <= 0 || STATE.dealer_hp <= 0) return;
  if (STATE.chambered !== null && STATE.chambered !== undefined) return;

  const [kind, start_xy] = take_next_bullet();
  if (!kind) return;

  STATE.busy = true;
  await bullet_move_to_gun(STATE.stage, start_xy, STATE.gun_rig, 'concealed', TUNING.loadBullet.duration, TUNING.loadBullet.steps);
  STATE.chambered = kind;

  if (STATE.prev !== null) {
    await throw_used_bullet(STATE.prev, STATE.prevshooter, STATE.stage);
    STATE.prev = null;
  }
  STATE.busy = false;
}

async function hp_damage(who, amount) {
  if (who === 'player') {
    const target = STATE.player_layer;
    STATE.player_hp = Math.max(0, STATE.player_hp - amount);
    STATE.hp_player.set(STATE.player_hp, true);
    await Animator.shake(target, TUNING.shake.magnitude, TUNING.shake.duration, TUNING.shake.freq);
    await Animator.knockback(target, 'up', TUNING.knockback.distance, TUNING.knockback.duration, TUNING.knockback.steps);
  } else {
    const target = STATE.dealer_layer;
    STATE.dealer_hp = Math.max(0, STATE.dealer_hp - amount);
    STATE.hp_dealer.set(STATE.dealer_hp, true);
    await Animator.shake(target, TUNING.shake.magnitude, TUNING.shake.duration, TUNING.shake.freq);
    await Animator.knockback(target, 'down', TUNING.knockback.distance, TUNING.knockback.duration, TUNING.knockback.steps);
  }
}

async function animate_player_choice_and_shoot(shooter, target) {
  STATE.busy = true;

  if (STATE.chambered == null) {
    await preload_next_bullet();
    if (STATE.chambered == null) {
      await return_gun_to_idle(STATE.gun_rig);
      await Animator.animate_move_pt(STATE.player_hand, 0, STATE.player_hand_idle_y, TUNING.gun.handsReturnDuration, TUNING.move.steps, false);
      await Animator.animate_move_pt(STATE.dealer_hand, 0, STATE.dealer_hand_idle_y, TUNING.gun.handsReturnDuration, TUNING.move.steps, false);
      await start_new_round();
      STATE.busy = false;
      return;
    }
  }

  if (shooter === 'player') {
    const [hx, hy] = get_xy(STATE.player_hand);
    const ny = (target === 'dealer') ? hy + 10 : hy - 10;
    await Animator.animate_move_pt([STATE.gun_rig, STATE.player_hand], [0, 0], [ny, ny], TUNING.gun.nudgeDuration, TUNING.move.steps, true);
  } else {
    const [hx, hy] = get_xy(STATE.dealer_hand);
    const ny = (target === 'dealer') ? hy + 10 : hy - 10;
    await Animator.animate_move_pt([STATE.gun_rig, STATE.dealer_hand], [0, 0], [ny, ny], TUNING.gun.nudgeDuration, TUNING.move.steps, true);
  }

  // Fix: correct shotgun aiming direction (dealer=up=+90, player=down=-90)
  const desired = (target === 'dealer') ? 90 : -90;
  await rotate_barrel_to(STATE.gun_rig, desired);

  const kind = STATE.chambered;
  STATE.prev = kind;
  STATE.prevshooter = shooter;
  STATE.chambered = null;

  const [gx, gy] = get_xy(STATE.gun_rig);
  const offset = (target === 'dealer') ? 14 : -14;

  if (kind === 'live') {
    move_to(STATE.gun_rig, gx + 0, gy - offset);
    await sleep(TUNING.gun.kickbackDelayMS);
    move_to(STATE.gun_rig, gx, gy);

    for (const i of [1, 4]) {
      const size = (i !== 1) ? 8 : 24;
      const firePath = `assets/Fire${i}2.bmp`;
      if (!BMP.BMP_CACHE.has(firePath)) {
        try { await BMP.loadBMP(firePath); } catch {}
      }
      const effect = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(firePath), 4, size);
      effect.setDepth(10);
      const where = get_xy(STATE.gun_rig);
      if (target === 'dealer') {
        move_to(effect, where[0], where[1] + 240 + 10*i);
      } else {
        move_to(effect, where[0], where[1] - 240 - 10*i);
        effect.rotate(180);
      }
      STATE.stage.add(effect);
      await sleep(TUNING.gun.muzzleFlashFrameDelayMS);
      try { STATE.stage.remove(effect); } catch {}
    }

    const dmg = 1 + Math.min(10, STATE.stack);
    await hp_damage(target, dmg);

    if (STATE.player_hp <= 0 || STATE.dealer_hp <= 0) {
      STATE.game_over = true;
      STATE.busy = false;
      return;
    }

    STATE.stack = 0;
    update_damage_box();
    STATE.turn = (shooter === 'player') ? 'dealer' : 'player';
  } else {
    move_to(STATE.gun_rig, gx + 0, gy + offset);
    await sleep(TUNING.gun.kickbackDelayMS);
    move_to(STATE.gun_rig, gx, gy);
    if (shooter === target) {
      STATE.stack = Math.min(10, STATE.stack + 1);
      update_damage_box(true);
    } else {
      STATE.turn = (shooter === 'player') ? 'dealer' : 'player';
    }
  }

  await return_gun_to_idle(STATE.gun_rig);
  await Animator.animate_move_pt(STATE.player_hand, 0, STATE.player_hand_idle_y, TUNING.gun.handsReturnDuration, TUNING.move.steps, false);
  await Animator.animate_move_pt(STATE.dealer_hand, 0, STATE.dealer_hand_idle_y, TUNING.gun.handsReturnDuration, TUNING.move.steps, false);

  if (STATE.turn === 'dealer') {
    const player_hand_img = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["player_hand"]), 4);
    STATE.player_hand.add(player_hand_img);
  } else {
    const dealer_hand_img = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["dealer_hand"]), 4);
    STATE.dealer_hand.add(dealer_hand_img);
  }

  if (STATE.player_hp <= 0 || STATE.dealer_hp <= 0) {
    STATE.game_over = true;
    STATE.busy = false;
    return;
  }

  const left_any = STATE.cartridge.slots.some(s => s.icon !== null);
  if (!left_any && STATE.player_hp > 0 && STATE.dealer_hp > 0) {
    await start_new_round();
  } else {
    await preload_next_bullet();
  }

  STATE.busy = false;
}

function get_click_centered_once() {
  return new Promise(res => {
    const handler = (ev) => {
      const rect = STATE.canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const cx = x - CANVAS_W/2;
      const cy = -(y - CANVAS_H/2);
      window.removeEventListener('mousedown', handler);
      res([cx, cy]);
    };
    window.addEventListener('mousedown', handler, { once: true });
  });
}

async function player_turn() {
  while (true) {
    const [x, y] = await get_click_centered_once();
    const [px, py] = STATE.player_layer.getWorldXY();
    const [dx, dy] = STATE.dealer_layer.getWorldXY();
    if (inside_circle(x, y, px, py, 90)) {
      const [fx, fy] = STATE.player_layer.getWorldXY();
      const p = new Particles(
        [255,255,255],
        TUNING.clickParticles.size,
        [fx,fy],
        TUNING.clickParticles.vel,
        TUNING.clickParticles.drag,
        TUNING.clickParticles.num,
        TUNING.clickParticles.randomness,
        'up',
        TUNING.clickParticles.spread,
        0,
        TUNING.particles.life,
        TUNING.clickParticles.depth,
        TUNING.particles.dt
      );
      await p.move();
      await animate_player_choice_and_shoot('player', 'player');
      break;
    } else if (inside_circle(x, y, dx, dy, 90)) {
      const [fx, fy] = STATE.dealer_layer.getWorldXY();
      const p = new Particles(
        [255,255,255],
        TUNING.clickParticles.size,
        [fx,fy],
        TUNING.clickParticles.vel,
        TUNING.clickParticles.drag,
        TUNING.clickParticles.num,
        TUNING.clickParticles.randomness,
        'up',
        TUNING.clickParticles.spread,
        0,
        TUNING.particles.life,
        TUNING.clickParticles.depth,
        TUNING.particles.dt
      );
      await p.move();
      await animate_player_choice_and_shoot('player', 'dealer');
      break;
    }
  }
}

async function dealer_turn() {
  await sleep(TUNING.ai.thinkDelayMS);
  let live = 0, blank = 0;
  for (const i of STATE.round_types) {
    if (i === "live") live++; else blank++;
  }
  if (STATE.chambered === "live") live++;
  else if (STATE.chambered === "blank") blank++;
  const target = (live > blank) ? 'player' : 'dealer';
  await animate_player_choice_and_shoot('dealer', target);
}

async function start_new_round() {
  let live = 0, blanks = 0;
  for (let i = 0; i < CARTRIDGE_CAPACITY; i++) {
    const randy = Math.floor(Math.random() * 7);
    if (0 <= randy && randy <= 1) live += 1;
    else if (4 <= randy && randy <= 6) blanks += 1;
  }
  const types = Array(live).fill('live').concat(Array(blanks).fill('blank'));
  STATE.preview_types = types.slice();
  STATE.cartridge.show_preview(types);
  await sleep(TUNING.round.previewDelayMS);
  STATE.cartridge.conceal_and_shuffle();
  const tmp = [];
  for (const s of STATE.cartridge.slots) if (s.icon) tmp.push(s.type);
  STATE.round_types = tmp;
  STATE.chambered = null;
  await preload_next_bullet();
}

function init_game(reuse_canvas=false) {
  if (!reuse_canvas || !STATE.canvas) {
    STATE.canvas = document.getElementById('gameCanvas');
    STATE.canvas.style.background = Color([15,25,25]);
    STATE.canvas.title = "Buckshot Roulette (2D)";
  }

  STATE.stage = new Layer();
  move_to(STATE.stage, 0, 0);
  STATE.renderer = new Engine.Renderer(STATE.canvas, STATE.stage);
  STATE.renderer.start();

  STATE.table = build_table_layer();

  const built = build_actors_and_hands();
  STATE.dealer_layer = built.dealer_layer;
  STATE.player_layer = built.player_layer;
  STATE.hands_layer  = built.hands_layer;
  STATE.dealer_face = built.dealer_face;
  STATE.player_face = built.player_face;
  STATE.dealer_hand = built.dealer_hand;
  STATE.player_hand = built.player_hand;

  STATE.gun_rig = build_shotgun_rig(null);
  STATE.cartridge = new CartridgeTray(CARTRIDGE_CAPACITY);
  STATE.background = build_background();

  STATE.dmg_text = build_number_layer();

  STATE.hp_player = new HpBar();
  move_to(STATE.hp_player, CANVAS_W*0.16, -CANVAS_H*0.30);
  STATE.hp_dealer = new HpBar();
  move_to(STATE.hp_dealer, -CANVAS_W*0.16, CANVAS_H*0.30);

  for (const L of [STATE.table, STATE.dealer_layer, STATE.player_layer, STATE.gun_rig,
                   STATE.hands_layer, STATE.cartridge.node, STATE.dmg_text, 
                   STATE.hp_player.node, STATE.hp_dealer.node, STATE.background]) {
    STATE.stage.add(node_of(L));
  }

  STATE.player_hand_idle_y = -CANVAS_H * 0.12;
  STATE.dealer_hand_idle_y =  CANVAS_H * 0.12;

  STATE.turn = 'player';
  STATE.stack = 0;
  STATE.player_hp = HP_MAX;
  STATE.dealer_hp = HP_MAX;
  STATE.round_types = [];
  STATE.preview_types = [];
  STATE.busy = false;
  STATE.chambered = null;
  STATE.prev = null;
  STATE.prevshooter = null;
  STATE.game_over = false;

  update_damage_box();
}

async function run_game() {
  while (!STATE.game_over && STATE.player_hp > 0 && STATE.dealer_hp > 0) {
    if (STATE.busy) {
      await sleep(50);
      continue;
    }
    STATE.gun_rig = build_shotgun_rig(STATE.gun_rig);
    await return_gun_to_idle(STATE.gun_rig, TUNING.gun.returnToIdleDuration);

    if (STATE.turn === 'player') {
      const [, hy] = get_xy(STATE.player_hand);
      const towards = (hy < 0) ? 'up' : 'down';
      await hand_reach_and_pick(STATE.player_hand, STATE.gun_rig, towards, TUNING.gun.handReachDuration);
      await player_turn();
    } else {
      const [, hy] = get_xy(STATE.dealer_hand);
      const towards = (hy < 0) ? 'up' : 'down';
      await hand_reach_and_pick(STATE.dealer_hand, STATE.gun_rig, towards, TUNING.gun.handReachDuration);
      await dealer_turn();
    }
  }

  let banner, winner;
  if (STATE.dealer_hp <= 0) {
    await die_motion(STATE.dealer_layer, 'right', 0.8, 24);
    await die_motion(STATE.dealer_hand, 'right', 0.6, 24);
    banner = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["youwin"]), 1, 20);
    winner = 'player';
  } else {
    await die_motion(STATE.player_layer, 'left', 0.8, 24);
    await die_motion(STATE.player_hand, 'left', 0.6, 24);
    banner = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["youlose"]), 1, 20);
    winner = 'dealer';
  }

  banner.setDepth(15);
  move_to(banner, 0, 0);
  STATE.stage.add(banner);
  STATE.game_over = true;
  return winner;
}

window.Game = { init_game, run_game, start_new_round, preload_next_bullet };

/* ===========================
   main.js (merged)
   =========================== */

(async function main() {
  const allAssetPaths = Object.values(ASSETS);
  const firePaths = ["assets/Fire12.bmp", "assets/Fire42.bmp"];
  const preloadList = allAssetPaths.concat(firePaths);

   try {
     await Promise.all(
       preloadList.map(u =>
         BMP.loadBMP(u).catch(e => {
           console.warn("Skip asset:", u, e.message);
           return null;
         })
       )
     );
   } catch(e) {
     console.warn("Preload finished with some skips.");
   }

  while (true) {
    Game.init_game(false);
    await Game.start_new_round();

    const winner = await Game.run_game();
    console.log((winner === 'player' ? "You" : "Dealer") + " win!");

    const again = await askPlayAgain();
    if (!again) break;
    STATE.stage.children = [];
  }

  function askPlayAgain() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.left = 0;
      overlay.style.top = 0;
      overlay.style.right = 0;
      overlay.style.bottom = 0;
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.background = 'rgba(0,0,0,0.5)';
      overlay.style.zIndex = 9999;

      const box = document.createElement('div');
      box.style.background = '#223';
      box.style.color = '#fff';
      box.style.padding = '16px 20px';
      box.style.border = '2px solid #99b';
      box.style.fontFamily = 'monospace';
      box.style.borderRadius = '8px';
      box.style.textAlign = 'center';
      box.innerHTML = `
        <div style="margin-bottom:10px;">Play Again? (Y/N)</div>
        <div>
          <button id="yesBtn" style="margin-right:8px;">Y</button>
          <button id="noBtn">N</button>
        </div>
      `;
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      const cleanup = (ans) => {
        document.body.removeChild(overlay);
        resolve(ans);
      };
      box.querySelector('#yesBtn').addEventListener('click', () => cleanup(true));
      box.querySelector('#noBtn').addEventListener('click', () => cleanup(false));
      window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'y') cleanup(true);
        if (e.key.toLowerCase() === 'n') cleanup(false);
      }, { once: true });
    });
  }
})();
