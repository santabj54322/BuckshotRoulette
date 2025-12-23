export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
export function easeInOutCubic(t) {
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
}
export function normalizeAngle(deg) {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;ㄴ
}
export function rad(deg) { return (deg * Math.PI) / 180; }
export function insideCircle(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return (dx*dx + dy*dy) <= r*r;
}

// Global animation speed. 1 = normal, 2 = 2x faster, 0.5 = 2x slower.
let ANIM_SPEED = 1.0;
export function setAnimSpeed(s) { ANIM_SPEED = Math.max(0.001, Number(s) || 1); }
export function getAnimSpeed() { return ANIM_SPEED; }
export function scaleDur(ms) { return ms / ANIM_SPEED; }

export function wait(ms) {
  return new Promise(res => setTimeout(res, scaleDur(ms)));
}

export async function tween(obj, props, duration=300, easing=easeInOutCubic) {
  const dur = scaleDur(duration);
  const start = {};
  const keys = Object.keys(props);
  keys.forEach(k => start[k] = obj[k] ?? 0);
  const startTime = performance.now();
  return new Promise(resolve => {
    function step(now) {
      const t = clamp((now - startTime) / dur, 0, 1);
      const e = easing(t);
      keys.forEach(k => { obj[k] = start[k] + (props[k] - start[k]) * e; });
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

export async function shake(node, magnitude=8, duration=250, freq=30) {
  const actualDur = scaleDur(duration);
  const ox = node.x, oy = node.y;
  const steps = Math.max(1, Math.floor((actualDur/1000) * freq));
  for (let i=0;i<steps;i++) {
    node.x = ox + (Math.random()*2-1)*magnitude;
    node.y = oy + (Math.random()*2-1)*magnitude;
    await wait(actualDur/steps);
  }
  node.x = ox; node.y = oy;
}

export async function knockback(node, direction='up', distance=40, duration=250, steps=18) {
  const actualDur = scaleDur(duration);
  const ox = node.x, oy = node.y;
  let dx=0, dy=0;
  if (direction === 'up') dy = -distance;
  else if (direction === 'down') dy = distance;
  else if (direction === 'left') dx = -distance;
  else dx = distance;
  for (let i=1;i<=steps;i++){
    const t = easeOutQuad(i/steps);
    node.x = ox + dx * t;
    node.y = oy + dy * t;
    await wait(actualDur/steps);
  }
  for (let i=1;i<=steps;i++){
    const t = i/steps;
    node.x = ox + dx * (1 - t);
    node.y = oy + dy * (1 - t);
    await wait(actualDur/steps);
  }
  node.x = ox; node.y = oy;
}
export function makeCenteredCoord(canvasW, canvasH) {
  return function toCanvas(x, y) { return [x + canvasW/2, canvasH/2 - y]; };
}
