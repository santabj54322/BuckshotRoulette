/* Utilities and compatibility helpers */

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
  // tuple is [r,g,b] or (r,g,b), returns CSS rgb string
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

/* Center-origin helpers (engine Nodes already use y-up coordinates) */
function move_to(obj, x, y) {
  obj.moveTo(x, y);
}

function get_xy(obj) {
  // return world xy
  return obj.getWorldXY();
}

function node_of(o) {
  return o; // in this engine we use Node directly
}
