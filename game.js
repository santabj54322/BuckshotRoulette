import { Engine, Node, RectNode, CircleNode, TextNode, SpriteNode, loadImage } from './engine.js';
import { clamp, lerp, wait, tween, easeOutQuad, normalizeAngle, insideCircle, shake, knockback } from './utils.js';

/* Constants */
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

export const DEPTH_BG     = 100;
export const DEPTH_TABLE  = 90;
export const DEPTH_ARENA  = 80;
export const DEPTH_ACTORS = 60;
export const DEPTH_GUN    = 40;
export const DEPTH_HANDS  = 30;
export const DEPTH_UI     = 20;
export const DEPTH_FLASH  = 5;

export const CARTRIDGE_CAPACITY = 6;
export const HP_MAX = 10;

/* Assets: You can keep BMP names or change to PNG and update here */
export const ASSETS = {
  dealer_face:  "assets/Dealer2.bmp",
  dealer_hand:  "assets/OppHands2.bmp",
  player_face:  "assets/PlayerFace2.bmp",
  player_hand:  "assets/Hands2.bmp",
  shotgun:      "assets/Shotgun2.bmp",
  bullet_live:  "assets/LiveBullet2.bmp",
  bullet_blank: "assets/BlankBullet2.bmp",
  bullet_concealed: "assets/UnknownBullet2.bmp",
  wooden_floor: "assets/WoodenFloor2.bmp",
  Hand_holding_gun: "assets/ShotgunHands2.bmp",
  bullet_used_live: "assets/BulletliveFired2.bmp",
  textzero: "assets/zero.bmp",
  textone: "assets/one.bmp",
  texttwo: "assets/two.bmp",
  textthree: "assets/three.bmp",
  textfour: "assets/four.bmp",
  textfive: "assets/five.bmp",
  textsix: "assets/six.bmp",
  textseven: "assets/seven.bmp",
  texteight: "assets/eight.bmp",
  textnine: "assets/nine.bmp",
  textten: "assets/ten.bmp",
  textplus: "assets/plus.bmp",
  textdmg: "assets/DMG.bmp",
  youwin: "assets/youwin.bmp",
  youlose: "assets/youlose.bmp"
};

/* Simple loader with fallback rectangles if BMPs fail */
async function safeLoad(url, fallbackSize=[128,128], fill='#666') {
  try {
    const img = await loadImage(url);
    return new SpriteNode(img, img.width, img.height);
  } catch {
    const [w,h] = fallbackSize;
    return new RectNode(w,h, fill, '#999', 2);
  }
}

/* HP Bar */
class HpBar extends Node {
  constructor(width=240, height=24, segments=10) {
    super({depth: DEPTH_UI});
    this.width = width; this.height = height; this.segments = segments;
    this.value = segments; this.max = segments;
    this.onColor = '#50C878'; this.offColor = '#2D3746';
    this.panel = new RectNode(width, height, '#1E2832', '#5A6478', 3);
    this.add(this.panel);

    const gap=4;
    const innerH = height-6;
    const totalGap = gap*(segments-1);
    const baseW = Math.floor((width-totalGap)/segments);
    const remainder = (width-totalGap)-baseW*segments;

    this.cells = [];
    let xLeft = -width/2;
    for (let i=0;i<segments;i++) {
      const cw = baseW + (i<remainder?1:0);
      const cell = new RectNode(cw, innerH, this.onColor, null, 0);
      cell.x = xLeft + cw/2; cell.y = 0;
      this.panel.add(cell);
      this.cells.push(cell);
      xLeft += cw + gap;
    }
  }

  set(value, animate=true, duration=350) {
    value = clamp(value, 0, this.max);
    if (value === this.value) return;
    const prev = this.value;
    const diff = Math.abs(value-prev);
    const perStep = duration / Math.max(1, diff);
    const go = async () => {
      if (value > prev) {
        for (let i=prev;i<value;i++) { this.cells[i].fill = this.onColor; await wait(perStep); }
      } else {
        for (let i=prev-1;i>=value;i--) { this.cells[i].fill = this.offColor; await wait(perStep); }
      }
      this.value = value;
    };
    if (animate) go();
    else {
      for (let i=0;i<this.cells.length;i++) this.cells[i].fill = (i<value?this.onColor:this.offColor);
      this.value = value;
    }
  }
}

/* Cartridge Tray */
class CartridgeTray extends Node {
  constructor(capacity=6) {
    super({depth: DEPTH_UI});
    this.capacity = capacity;
    const bg = new RectNode(280, 140, '#233232', '#506E6E', 3);
    bg.x = -CANVAS_W*0.25; bg.y = -10;
    this.add(bg);
    this.slotsLayer = new Node();
    this.add(this.slotsLayer);

    const left = bg.x - 100;
    const y = bg.y;
    const spacing = 40;
    this.slots = [];
    for (let i=0;i<capacity;i++) {
      const ring = new CircleNode(14, '#141E1E', '#78A0A0', 2);
      ring.x = left + i*spacing; ring.y = y;
      this.slotsLayer.add(ring);
      this.slots.push({anchor:ring, icon:null, type:null, concealed:false});
    }
  }

  clear_icons(engine) {
    for (const s of this.slots) {
      if (s.icon) { if (s.icon.parent) s.icon.parent.remove(s.icon); s.icon=null; }
      s.type=null; s.concealed=false;
    }
  }

  async show_preview(types, engine) {
    if (types.length > this.slots.length) throw new Error('Too many bullets');
    this.clear_icons(engine);
    for (let i=0;i<types.length;i++) {
      const kind = types[i];
      const slot = this.slots[i];
      const img = await safeLoad(kind==='live'?ASSETS.bullet_live:ASSETS.bullet_blank, [28,28], kind==='live'?'#CC3333':'#AAAAAA');
      img.depth = DEPTH_UI-1;
      img.x = slot.anchor.x; img.y = slot.anchor.y;
      this.slotsLayer.add(img);
      slot.icon = img; slot.type = kind; slot.concealed=false;
    }
  }

  async conceal_and_shuffle(engine) {
    const items = this.slots.filter(s => s.icon);
    const types = items.map(s => s.type);
    // shuffle
    for (let i=types.length-1;i>0;i--) {
      const j = Math.floor(Math.random()*(i+1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    for (let k=0;k<items.length;k++) {
      const s = items[k];
      if (s.icon && s.icon.parent) s.icon.parent.remove(s.icon);
      const icon = await safeLoad(ASSETS.bullet_concealed, [28,28], '#444');
      icon.depth = DEPTH_UI-1;
      icon.x = s.anchor.x; icon.y = s.anchor.y;
      this.slotsLayer.add(icon);
      s.icon = icon;
      s.type = types[k];
      s.concealed = true;
    }
  }

  take_leftmost(engine) {
    for (const s of this.slots) {
      if (s.icon) {
        const kind = s.type;
        const start = {x:s.anchor.x, y:s.anchor.y};
        if (s.icon.parent) s.icon.parent.remove(s.icon);
        s.icon = null; s.type=null; s.concealed=false;
        return [kind, start];
      }
    }
    return [null, null];
  }
}

/* Particles */
class Particles {
  constructor(engine, opts) {
    this.engine = engine;
    this.opts = Object.assign({
      clr: '#fff',
      size: [6, 10],
      pos: {x:0,y:0},
      vel: 800,
      drag: 0.85,
      num: 15,
      spread: Math.PI*2,
      gravity: 0,
      life: 300,
      depth: DEPTH_FLASH
    }, opts||{});
    this.items = [];
  }
  async play() {
    const {
      clr, size, pos, vel, drag, num, spread, gravity, life, depth
    } = this.opts;
    for (let i=0;i<num;i++) {
      const s = (Array.isArray(size)? (size[0] + Math.random()*(size[1]-size[0])) : size);
      const n = new RectNode(s,s, clr, null, 0, {depth});
      n.x = pos.x; n.y = pos.y;
      this.engine.root.add(n);
      const a = (Math.random()*spread);
      const sp = vel * (1 + (Math.random()-0.5)*0.5);
      this.items.push({n, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp});
    }
    const start = performance.now();
    let last = start;
    return new Promise(resolve => {
      const step = (now) => {
        const dt = (now - last)/1000; last = now;
        this.items.forEach(p => {
          p.vx *= drag; p.vy = p.vy*drag + gravity*dt;
          p.n.x += p.vx*dt; p.n.y += p.vy*dt;
          p.n.rot += 360*dt*(Math.random()-0.5);
        });
        if (now - start < life) requestAnimationFrame(step);
        else {
          this.items.forEach(p => p.n.parent && p.n.parent.remove(p.n));
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }
}

/* Game State + Builders */
export class Game {
  constructor(canvas) {
    this.engine = new Engine(canvas);
    this.state = {
      turn: 'player',
      stack: 0,
      player_hp: HP_MAX,
      dealer_hp: HP_MAX,
      round_types: [],
      preview_types: [],
      busy: false,
      chambered: null,
      prev: null,
      prevshooter: null,
      game_over: false
    };
    this.assets = {}; // loaded sprite nodes cache as needed
    this.nodes = {};  // references to important nodes
  }

  async init() {
    const e = this.engine;

    // Background
    const bg = new RectNode(CANVAS_W*2, CANVAS_H*2, '#172626', null, 0, {depth: DEPTH_BG});
    e.root.add(bg);

    // Table
    const ringOuter = new CircleNode(140, '#193C2D', '#288C5A', 6, {depth: DEPTH_TABLE});
    const ringInner = new CircleNode(80, '#193C2D', '#1E7850', 3, {depth: DEPTH_TABLE});
    e.root.add(ringOuter); e.root.add(ringInner);

    // Actors
    const playerLayer = new Node({depth: DEPTH_ACTORS});
    const dealerLayer = new Node({depth: DEPTH_ACTORS});
    playerLayer.y = -CANVAS_H*0.28; dealerLayer.y = CANVAS_H*0.28;
    e.root.add(playerLayer); e.root.add(dealerLayer);

    const playerFace = await safeLoad(ASSETS.player_face, [180,180], '#334');
    const dealerFace = await safeLoad(ASSETS.dealer_face, [180,180], '#343');
    playerLayer.add(playerFace);
    dealerLayer.add(dealerFace);

    // Hands (optional decorative)
    const handsLayer = new Node({depth: DEPTH_HANDS});
    const playerHand = await safeLoad(ASSETS.player_hand, [200,80], '#223');
    const dealerHand = await safeLoad(ASSETS.dealer_hand, [200,80], '#232');
    playerHand.y = -CANVAS_H*0.12;
    dealerHand.y = CANVAS_H*0.12;
    handsLayer.add(playerHand); handsLayer.add(dealerHand);
    e.root.add(handsLayer);

    // Gun rig
    const gun = await safeLoad(ASSETS.shotgun, [320,64], '#444');
    gun.depth = DEPTH_GUN;
    e.root.add(gun);

    // Cartridge tray
    const tray = new CartridgeTray(CARTRIDGE_CAPACITY);
    e.root.add(tray);

    // DMG Text
    const dmgText = new TextNode('DMG + 0', '28px sans-serif', '#9cf', {depth: DEPTH_UI});
    dmgText.x = 120; dmgText.y = 120; dmgText.rot = 45;
    e.root.add(dmgText);

    // HP bars
    const hpPlayer = new HpBar();
    hpPlayer.x = CANVAS_W*0.16; hpPlayer.y = -CANVAS_H*0.30;
    const hpDealer = new HpBar();
    hpDealer.x = -CANVAS_W*0.16; hpDealer.y = CANVAS_H*0.30;
    e.root.add(hpPlayer); e.root.add(hpDealer);

    // Save refs
    this.nodes = {
      playerLayer, dealerLayer, handsLayer, playerHand, dealerHand, gun, tray, dmgText, hpPlayer, hpDealer
    };
    this.state.player_hand_idle_y = playerHand.y;
    this.state.dealer_hand_idle_y = dealerHand.y;

    this.updateDamageBox(false);

    await this.startNewRound();
    e.start();
  }

  updateDamageBox(swag=false) {
    const n = clamp(this.state.stack, 0, 10);
    this.nodes.dmgText.text = `DMG + ${n}`;
    if (!swag) return;
    const t = this.nodes.dmgText;
    const s0 = t.scale || 1;
    const bump = 1 + (this.state.stack*0.02 + 0.06);
    (async ()=>{
      await tween(t, {scale: s0*bump}, 80);
      await tween(t, {scale: s0}, 80);
    })();
  }

  async startNewRound() {
    let live=0, blanks=0;
    for (let i=0;i<CARTRIDGE_CAPACITY;i++) {
      const r = Math.floor(Math.random()*7);
      if (r<=1) live++;
      else if (r>=4) blanks++;
    }
    const types = new Array(live).fill('live').concat(new Array(blanks).fill('blank'));
    this.state.preview_types = types.slice();
    await this.nodes.tray.show_preview(types, this.engine);
    await wait(1500);
    await this.nodes.tray.conceal_and_shuffle(this.engine);

    // round_types snapshot for dealer logic
    const tmp = [];
    for (const s of this.nodes.tray.slots) if (s.icon) tmp.push(s.type);
    this.state.round_types = tmp;
    this.state.chambered = null;
    await this.preload_next_bullet();
  }

  take_next_bullet() {
    const [k, start] = this.nodes.tray.take_leftmost(this.engine);
    if (k == null) return [null, null];
    if (this.state.round_types.length) this.state.round_types.shift();
    return [k, start];
  }

  async hp_damage(who, amount) {
    if (who === 'player') {
      this.state.player_hp = Math.max(0, this.state.player_hp - amount);
      this.nodes.hpPlayer.set(this.state.player_hp, true, 350);
      await shake(this.nodes.playerLayer, 10, 250, 40);
      await knockback(this.nodes.playerLayer, 'up', 40, 250, 18);
    } else {
      this.state.dealer_hp = Math.max(0, this.state.dealer_hp - amount);
      this.nodes.hpDealer.set(this.state.dealer_hp, true, 350);
      await shake(this.nodes.dealerLayer, 10, 250, 40);
      await knockback(this.nodes.dealerLayer, 'down', 40, 250, 18);
    }
  }

  async bullet_move_to_gun(start, kind='concealed', duration=350) {
    let sprite;
    if (kind==='live') sprite = await safeLoad(ASSETS.bullet_live, [30,30], '#C33');
    else if (kind==='blank') sprite = await safeLoad(ASSETS.bullet_blank, [30,30], '#AAA');
    else sprite = await safeLoad(ASSETS.bullet_concealed, [30,30], '#444');
    sprite.depth = DEPTH_UI-2;
    sprite.x = start.x; sprite.y = start.y;
    this.engine.root.add(sprite);
    const gx = this.nodes.gun.x, gy = this.nodes.gun.y;
    await tween(sprite, {x: gx, y: gy}, duration, easeOutQuad);
    if (sprite.parent) sprite.parent.remove(sprite);
  }

  async preload_next_bullet() {
    if (this.state.game_over) return;
    if (this.state.player_hp<=0 || this.state.dealer_hp<=0) return;
    if (this.state.chambered != null) return;

    this.state.busy = true;
    const [kind, start] = this.take_next_bullet();
    if (kind == null) { this.state.busy = false; return; }
    await this.bullet_move_to_gun(start, 'concealed', 350);
    this.state.chambered = kind;

    if (this.state.prev != null) {
      // simple "throw used bullet" effect: particles
      const p = new Particles(this.engine, {pos:{x:0,y:0}, num:12, vel:700, life:200, clr:'#CCB27A'});
      await p.play();
      this.state.prev = null;
    }
    this.state.busy = false;
  }

  async rotate_barrel_to(targetDeg, duration=180) {
    const curr = this.nodes.gun.rot||0;
    const delta = normalizeAngle(targetDeg - curr);
    if (Math.abs(delta) < 1e-3) return;
    await tween(this.nodes.gun, {rot: curr+delta}, duration);
  }

  async hand_reach_and_pick(handNode, towards='up', duration=100) {
    // Move hands a bit and rotate gun up/down
    const origY = handNode.y;
    const ny = towards==='up' ? origY+10 : origY-10;
    await tween(handNode, {y: ny}, duration);
    const deg = (towards==='up') ? 90 : -90;
    await this.rotate_barrel_to(deg, 100);
  }

  async return_gun_to_idle(duration=200) {
    await tween(this.nodes.gun, {x:0, y:0}, duration);
    await this.rotate_barrel_to(0, 180);
  }

  async animate_player_choice_and_shoot(shooter, target) {
    if (this.state.busy) return;
    this.state.busy = true;

    if (this.state.chambered == null) {
      await this.preload_next_bullet();
      if (this.state.chambered == null) {
        await this.return_gun_to_idle(200);
        this.state.busy = false;
        await this.startNewRound();
        return;
      }
    }

    // aim hands + rotate gun
    if (shooter === 'player') {
      await this.hand_reach_and_pick(this.nodes.playerHand, 'up', 100);
    } else {
      await this.hand_reach_and_pick(this.nodes.dealerHand, 'down', 100);
    }
    const desired = (target==='dealer') ? 180 : 0;
    await this.rotate_barrel_to(desired, 180);

    // Fire
    const kind = this.state.chambered;
    this.state.prev = kind;
    this.state.prevshooter = shooter;
    this.state.chambered = null;

    const offset = (target==='dealer') ? 14 : -14;
    await tween(this.nodes.gun, {y: this.nodes.gun.y - offset}, 80);
    await tween(this.nodes.gun, {y: this.nodes.gun.y + offset}, 80);

    if (kind === 'live') {
      // muzzle flash: quick particles
      const p = new Particles(this.engine, {pos:{x:this.nodes.gun.x,y:this.nodes.gun.y+(target==='dealer'?240:-240)}, num:16, vel:900, life:120, clr:'#FFD580'});
      await p.play();

      const dmg = 1 + Math.min(10, this.state.stack);
      await this.hp_damage(target, dmg);

      if (this.state.player_hp<=0 || this.state.dealer_hp<=0) {
        this.state.game_over = true;
        this.state.busy = false;
        return;
      }
      this.state.stack = 0;
      this.updateDamageBox(false);
      this.state.turn = (shooter==='player') ? 'dealer' : 'player';
    } else {
      // blank
      if (shooter === target) {
        this.state.stack = clamp(this.state.stack+1, 0, 10);
        this.updateDamageBox(true);
      } else {
        this.state.turn = (shooter==='player') ? 'dealer' : 'player';
      }
    }

    // reset
    await this.return_gun_to_idle(200);
    await tween(this.nodes.playerHand, {y: this.state.player_hand_idle_y}, 200);
    await tween(this.nodes.dealerHand, {y: this.state.dealer_hand_idle_y}, 200);

    // If no bullets left and no one dead, start next round, else preload next
    if (this.state.player_hp<=0 || this.state.dealer_hp<=0) {
      this.state.game_over = true;
      this.state.busy = false;
      return;
    }
    const leftAny = this.nodes.tray.slots.some(s => s.icon);
    if (!leftAny) await this.startNewRound();
    else await this.preload_next_bullet();

    this.state.busy = false;
  }

  async player_turn(clickPromise) {
    const pos = await clickPromise; // {x,y}
    const p = {x:this.nodes.playerLayer.x, y:this.nodes.playerLayer.y};
    const d = {x:this.nodes.dealerLayer.x, y:this.nodes.dealerLayer.y};
    if (insideCircle(pos.x, pos.y, p.x, p.y, 90)) {
      const fx = this.nodes.playerLayer.x, fy = this.nodes.playerLayer.y;
      const burst = new Particles(this.engine, {pos:{x:fx,y:fy}, clr:'#fff', num:15, vel:1000, life:300, gravity:0});
      burst.play();
      await this.animate_player_choice_and_shoot('player', 'player');
    } else if (insideCircle(pos.x, pos.y, d.x, d.y, 90)) {
      const fx = this.nodes.dealerLayer.x, fy = this.nodes.dealerLayer.y;
      const burst = new Particles(this.engine, {pos:{x:fx,y:fy}, clr:'#fff', num:15, vel:1000, life:300, gravity:0});
      burst.play();
      await this.animate_player_choice_and_shoot('player', 'dealer');
    }
  }

  async dealer_turn() {
    await wait(500);
    let live=0, blank=0;
    for (const t of this.state.round_types) (t==='live'?live++:blank++);
    if (this.state.chambered==='live') live++;
    else if (this.state.chambered==='blank') blank++;

    const target = (live>blank) ? 'player' : 'dealer';
    await this.animate_player_choice_and_shoot('dealer', target);
  }

  // End banner
  async showBanner() {
    const winner = (this.state.dealer_hp<=0) ? 'player' : 'dealer';
    const text = new TextNode(winner==='player'?'YOU WIN':'YOU LOSE', '64px sans-serif', winner==='player'?'#8f8':'#f88', {depth: DEPTH_UI-10});
    text.x = 0; text.y = 0;
    this.engine.root.add(text);
    return winner;
  }
}
