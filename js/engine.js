/* Minimal scene graph and renderer to mimic cs1graphics behavior */

export class Node {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.rotation = 0; // degrees, CCW
    this.scaleX = 1;
    this.scaleY = 1;
    this.depth = 0; // lower = in front
    this.children = [];
    this.parent = null;
    this.visible = true;
  }

  add(child) {
    if (!child || child === this || child.parent === this) return;
    if (child.parent) {
      child.parent.remove(child);
    }
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

  contents() {
    return this.children.slice();
  }

  setDepth(d) {
    this.depth = d;
  }

  moveTo(x, y) {
    this.x = x;
    this.y = y;
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  rotate(deg) {
    this.rotation = normalize_angle(this.rotation + deg);
  }

  scale(s) {
    this.scaleX *= s;
    this.scaleY *= s;
  }

  setScale(sx, sy) {
    this.scaleX = sx;
    this.scaleY = sy;
  }

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

  // multiply m1 * m2 (2D affine)
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
    // lower depth = draw on top => draw higher depth first, then lower
    const cs = this.children.slice().sort((a,b) => b.depth - a.depth);
    for (const c of cs) c.draw(ctx);
    ctx.restore();
  }

  _drawSelf(ctx) {
    // default: Layer draws nothing
  }
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
    this.borderWidth = 0;
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
    this.borderWidth = 0;
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

/* Renderer */
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
      // center origin + y-up
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
