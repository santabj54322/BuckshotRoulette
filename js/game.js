/* Port of game logic to JS, mimicking original functions and names */

const CANVAS_W = 1280, CANVAS_H = 720;
const CARTRIDGE_CAPACITY = 6;
const HP_MAX = 10;

// Depth ordering (lower = in front)
const DEPTH_BG     = 100;
const DEPTH_TABLE  = 90;
const DEPTH_ARENA  = 80;
const DEPTH_ACTORS = 60;
const DEPTH_GUN    = 40;
const DEPTH_HANDS  = 30;
const DEPTH_UI     = 20;
const DEPTH_FLASH  = 5;

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

  static async animate_move(obj, sx, sy, ex, ey, duration=0.3, steps=18, islst=false) {
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

  static async animate_move_pt(obj, ex, ey, duration=0.3, steps=18, islst=false) {
    if (islst) {
      const n = obj.length;
      if (!(ex.length === n && ey.length === n)) throw new Error("Length mismatch animate_move_pt (islst)");
      const sx = new Array(n), sy = new Array(n);
      for (let k = 0; k < n; k++) {
        const [wx, wy] = obj[k].getWorldXY();
        // convert to local? use world same since parent is stage
        sx[k] = wx;
        sy[k] = wy;
      }
      await Animator.animate_move(obj, sx, sy, ex, ey, duration, steps, true);
    } else {
      const [sx, sy] = obj.getWorldXY();
      await Animator.animate_move(obj, sx, sy, ex, ey, duration, steps, false);
    }
  }

  static async shake(layer, magnitude=8, duration=0.25, freq=30) {
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

  static async knockback(layer, direction='up', distance=40, duration=0.25, steps=18) {
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
      rect.setBorderWidth(0);
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
      p.vy = p.vy * this.drag - this.gravity * this.dt; // y-up: gravity downward is negative
      p.x += p.vx * this.dt;
      p.y += p.vy * this.dt;
      node.moveTo(p.x, p.y);
      if (Math.abs(p.vrot) > 1) node.rotate(p.vrot * this.dt);
      if (Math.hypot(p.vx, p.vy) > this.v_stop) any_moving = true;
    }
    this.elapsed += this.dt;
    if (this.elapsed >= this.max_time) any_moving = false;
    return any_moving;
  }

  async move() {
    while (this.step()) {
      await sleep(this.dt * 1000);
    }
    // cleanup
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
      cell.setBorderWidth(0);
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

  set(value, animate=true, duration=0.35) {
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
    // shuffle
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

/* Scene builders */
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
  layer.rotate(45);
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

async function rotate_barrel_to(rig, target_deg, duration=0.18, step_deg=6) {
  if (typeof rig.angle !== 'number') rig.angle = 0;
  let curr = normalize_angle(rig.angle);
  const target = normalize_angle(target_deg);
  let delta = normalize_angle(target - curr);
  if (Math.abs(delta) < 1e-6) return;

  const steps = Math.max(1, Math.ceil(Math.abs(delta) / step_deg));
  const per = duration / steps;
  const step = delta / steps;

  for (let i = 0; i < steps; i++) {
    rig.rotate(step);
    rig.angle = normalize_angle(rig.angle);
    await sleep(per * 1000);
  }

  const residual = normalize_angle(target - rig.angle);
  if (Math.abs(residual) > 0.01) {
    rig.rotate(residual);
    rig.angle = normalize_angle(rig.angle);
  }
}

async function hand_reach_and_pick(hand, gun_rig, towards='up', duration=0.25) {
  const [hx, hy] = get_xy(hand);
  await Animator.animate_move(hand, hx, hy, 0, 0, duration, 10, false);
  build_shotgunhand_rig(gun_rig);
  for (const drawable of hand.contents()) {
    try { hand.remove(drawable); } catch {}
  }
  if (towards === 'up') await rotate_barrel_to(gun_rig, 90, 0.09);
  else await rotate_barrel_to(gun_rig, -90, 0.09);
  const [gx, gy] = get_xy(gun_rig);
  await Animator.animate_move_pt(gun_rig, hx, hy, 0.09, 6, false);
}

async function return_gun_to_idle(gun_rig, duration=0.25) {
  await Animator.animate_move_pt(gun_rig, 0, 0, duration, 12, false);
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
  usedbullet.setDepth(70);
  const thrownvel = 10;
  const scale = 20;
  const angleparam = Math.random()/5 + 0.55;
  for (let i = 2*thrownvel; i > 0; i--) {
    let temp = -1;
    if (shooter === "player") temp *= -1;
    usedbullet.move(temp*i/2/5*angleparam*scale, -temp*i/2/5*(1-angleparam)*scale);
    usedbullet.rotate(angleparam*6*i);
    await sleep(0.15*100);
  }
  try { stage.remove(usedbullet); } catch {}
}

function build_background() {
  const img = BMP.load_bmp_to_Image(ASSETS["wooden_floor"]);
  const layer = Mosaic.mosaic_layer_from_image(img, 3, 9, 1, [0.6, 1, 0.4, 0.5]);
  layer.setDepth(DEPTH_BG);
  return layer;
}

async function bullet_move_to_gun(stage, start_xy, gun_layer, img_kind='concealed', duration=0.35, steps=20) {
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
  await bullet_move_to_gun(STATE.stage, start_xy, STATE.gun_rig, 'concealed', 0.35, 20);
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
    await Animator.shake(target, 10, 0.25, 40);
    await Animator.knockback(target, 'up', 40, 0.25, 18);
  } else {
    const target = STATE.dealer_layer;
    STATE.dealer_hp = Math.max(0, STATE.dealer_hp - amount);
    STATE.hp_dealer.set(STATE.dealer_hp, true);
    await Animator.shake(target, 10, 0.25, 40);
    await Animator.knockback(target, 'down', 40, 0.25, 18);
  }
}

async function animate_player_choice_and_shoot(shooter, target) {
  STATE.busy = true;

  if (STATE.chambered == null) {
    await preload_next_bullet();
    if (STATE.chambered == null) {
      await return_gun_to_idle(STATE.gun_rig);
      await Animator.animate_move_pt(STATE.player_hand, 0, STATE.player_hand_idle_y, 0.1, 6, false);
      await Animator.animate_move_pt(STATE.dealer_hand, 0, STATE.dealer_hand_idle_y, 0.1, 6, false);
      await start_new_round();
      STATE.busy = false;
      return;
    }
  }

  if (shooter === 'player') {
    const [hx, hy] = get_xy(STATE.player_hand);
    const ny = (target === 'dealer') ? hy + 10 : hy - 10;
    await Animator.animate_move_pt([STATE.gun_rig, STATE.player_hand], [0, 0], [ny, ny], 0.1, 12, true);
  } else {
    const [hx, hy] = get_xy(STATE.dealer_hand);
    const ny = (target === 'dealer') ? hy + 10 : hy - 10;
    await Animator.animate_move_pt([STATE.gun_rig, STATE.dealer_hand], [0, 0], [ny, ny], 0.1, 12, true);
  }

  const desired = (target === 'dealer') ? 180 : 0;
  await rotate_barrel_to(STATE.gun_rig, desired);

  const kind = STATE.chambered;
  STATE.prev = kind;
  STATE.prevshooter = shooter;
  STATE.chambered = null;

  const [gx, gy] = get_xy(STATE.gun_rig);
  const offset = (target === 'dealer') ? 14 : -14;

  if (kind === 'live') {
    move_to(STATE.gun_rig, gx + 0, gy - offset);
    await sleep(100);
    move_to(STATE.gun_rig, gx, gy);

    for (const i of [1, 4]) {
      const size = (i !== 1) ? 8 : 24;
      const firePath = `assets/Fire${i}2.bmp`; // "assets/Fire"+str(i)+"2.bmp"
      // Load on demand if not preloaded
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
      await sleep(50);
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
    await sleep(100);
    move_to(STATE.gun_rig, gx, gy);
    if (shooter === target) {
      STATE.stack = Math.min(10, STATE.stack + 1);
      update_damage_box(true);
    } else {
      STATE.turn = (shooter === 'player') ? 'dealer' : 'player';
    }
  }

  await return_gun_to_idle(STATE.gun_rig);
  await Animator.animate_move_pt(STATE.player_hand, 0, STATE.player_hand_idle_y, 0.2, 12, false);
  await Animator.animate_move_pt(STATE.dealer_hand, 0, STATE.dealer_hand_idle_y, 0.2, 12, false);

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
      const p = new Particles([255,255,255], [9,9], [fx,fy], 1000, 0.85, 15, 0, 'up', 360, 0, 0.3, 10, 0.02);
      await p.move();
      await animate_player_choice_and_shoot('player', 'player');
      break;
    } else if (inside_circle(x, y, dx, dy, 90)) {
      const [fx, fy] = STATE.dealer_layer.getWorldXY();
      const p = new Particles([255,255,255], [9,9], [fx,fy], 1000, 0.85, 15, 0, 'up', 360, 0, 0.3, 10, 0.02);
      await p.move();
      await animate_player_choice_and_shoot('player', 'dealer');
      break;
    }
  }
}

async function dealer_turn() {
  await sleep(500);
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
  await sleep(1500);
  STATE.cartridge.conceal_and_shuffle();
  const tmp = [];
  for (const s of STATE.cartridge.slots) if (s.icon) tmp.push(s.type);
  STATE.round_types = tmp;
  STATE.chambered = null;
  await preload_next_bullet();
}

/* Init and main loop */
function init_game(reuse_canvas=false) {
  if (!reuse_canvas || !STATE.canvas) {
    STATE.canvas = document.getElementById('gameCanvas');
    STATE.canvas.style.background = Color([15,25,25]);
    STATE.canvas.title = "Buckshot Roulette (2D)";
  }

  STATE.stage = new Layer();
  move_to(STATE.stage, 0, 0); // root at center (renderer sets transform)
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
    await return_gun_to_idle(STATE.gun_rig, 0.2);

    if (STATE.turn === 'player') {
      const [, hy] = get_xy(STATE.player_hand);
      const towards = (hy < 0) ? 'up' : 'down';
      await hand_reach_and_pick(STATE.player_hand, STATE.gun_rig, towards, 0.1);
      await player_turn();
    } else {
      const [, hy] = get_xy(STATE.dealer_hand);
      const towards = (hy < 0) ? 'up' : 'down';
      await hand_reach_and_pick(STATE.dealer_hand, STATE.gun_rig, towards, 0.1);
      await dealer_turn();
    }
  }

  let banner, winner;
  if (STATE.dealer_hp <= 0) {
    await die_motion(STATE.dealer_layer, 'right', 0.8);
    await die_motion(STATE.dealer_hand, 'right', 0.6);
    banner = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["youwin"]), 1, 20);
    winner = 'player';
  } else {
    await die_motion(STATE.player_layer, 'left', 0.8);
    await die_motion(STATE.player_hand, 'left', 0.6);
    banner = Mosaic.mosaic_layer_from_image(BMP.load_bmp_to_Image(ASSETS["youlose"]), 1, 20);
    winner = 'dealer';
  }

  banner.setDepth(15);
  move_to(banner, 0, 0);
  STATE.stage.add(banner);
  STATE.game_over = true;
  return winner;
}

window.Game = {
  init_game,
  run_game,
  start_new_round,
  preload_next_bullet
};
