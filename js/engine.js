import { rad, makeCenteredCoord } from './utils.js'; 

export class Node {
  constructor({x=0,y=0,rot=0,scale=1,depth=0,visible=true}={}) {
    this.x = x; this.y = y;
    this.rot = rot; this.scale = scale;
    this.depth = depth;
    this.visible = visible;
    this.parent = null;
    this.children = [];
    this.drawSelf = null;
  }
  add(child) { child.parent = this; this.children.push(child); }
  remove(child) {
    const i = this.children.indexOf(child);
    if (i>=0) this.children.splice(i,1);
    child.parent = null;
  }
}
export class RectNode extends Node {
  constructor(w, h, fill='#888', stroke=null, lineWidth=1, options={}) {
    super(options);
    this.w = w; this.h = h;
    this.fill = fill; this.stroke = stroke;
    this.lineWidth = lineWidth;
  }
  drawSelfImpl(ctx) {
    ctx.beginPath();
    ctx.rect(-this.w/2, -this.h/2, this.w, this.h);
    if (this.fill) {
      ctx.fillStyle = this.fill;
      ctx.fill();
    }
    if (this.stroke) {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.lineWidth;
      ctx.stroke();
    }
  }
}
export class CircleNode extends Node {
  constructor(r, fill='#888', stroke=null, lineWidth=1, options={}) {
    super(options);
    this.r = r; this.fill = fill; this.stroke = stroke; this.lineWidth = lineWidth;
  }
  drawSelfImpl(ctx) {
    ctx.beginPath();
    ctx.arc(0,0,this.r,0,Math.PI*2);
    if (this.fill) { ctx.fillStyle = this.fill; ctx.fill(); }
    if (this.stroke) { ctx.strokeStyle = this.stroke; ctx.lineWidth = this.lineWidth; ctx.stroke(); }
  }
}
export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.root = new Node();
    this._running = false;
    this._toCanvas = makeCenteredCoord(canvas.width, canvas.height);
  }
  start() {
    if (this._running) return;
    this._running = true;
    const loop = () => {
      if (!this._running) return;
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop() { this._running = false; }
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const list = [];
    this._collect(this.root, {x:0,y:0,rot:0,scale:1}, list);
    list.sort((a,b) => b.depth - a.depth);
    for (const item of list) this._drawItem(item);
  }
  _collect(node, wt, out) {
    if (!node.visible) return;
    const ww = wt.scale * node.scale;
    const wr = wt.rot + node.rot;
    const wx = wt.x + node.x * wt.scale;
    const wy = wt.y + node.y * wt.scale;
    out.push({node, x:wx, y:wy, rot:wr, scale:ww, depth: node.depth});
    for (const c of node.children) this._collect(c, {x:wx,y:wy,rot:wr,scale:ww}, out);
  }
  _drawItem({node, x, y, rot, scale}) {
    if (!node.drawSelfImpl && !node.drawSelf) return;
    const ctx = this.ctx;
    ctx.save();
    const [cx, cy] = this._toCanvas(x, y);
    ctx.translate(cx, cy);
    ctx.rotate(rad(rot));
    ctx.scale(scale, scale);
    if (node.drawSelf) node.drawSelf(ctx);
    else node.drawSelfImpl(ctx);
    ctx.restore();
  }
}
