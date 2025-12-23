import { Engine, Node, RectNode, CircleNode } from './engine.js'; 
import { clamp, lerp, wait, tween, easeOutQuad, normalizeAngle, insideCircle, shake, knockback } from './utils.js';
import { mosaicFromURL } from './mosaic.js';

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

/* Assets (same names as your Python) */
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

  async show_preview(types) {
    if (types.length > this.slots.length) throw new Error('Too many bullets');
    this.clear_icons();
    for (let i=0;i<types.length;i++) {
      const kind = types[i];
      const icon = await mosaicFromURL(kind==='live'?ASSETS.bullet_live:ASSETS.bullet_blank, 4, 0.8);
      icon.depth = DEPTH_UI-1;
      const slot = this.slots[i];
      icon.x = slot.anchor.x; icon.y = slot.anchor.y;
      this.slotsLayer.add(icon);
      slot.icon = icon; slot.type = kind; slot.concealed=false;
    }
  }
  clear_icons() {
    for (const s of this.slots) {
      if (s.icon) { if (s.icon.parent) s.icon.parent.remove(s.icon); s.icon=null; }
      s.type=null; s.concealed=false;
    }
  }
  async conceal_and_shuffle() {
    const items = this.slots.filter(s => s.icon);
    const types = items.map(s => s.type);
    for (let i=types.length-1;i>0;i--) {
      const j = Math.floor(Math.random()*(i+1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    for (let k=0;k<items.length;k++) {
      const s = items[k];
      if (s.icon && s.icon.parent) s.icon.parent.remove(s.icon);
      const icon = await mosaicFromURL(ASSETS.bullet_concealed, 4, 0.8);
      icon.depth = DEPTH_UI-1;
      icon.x = s.anchor.x; icon.y = s.anchor.y;
      this.slotsLayer.add(icon);
      s.icon = icon; s.type = types[k]; s.concealed = true;
    }
  }
  take_leftmost() {
    for (const s of this.slots) {
      if (s.icon) {
        const kind = s.type;
        const start = {x: s.anchor.x, y: s.anchor.y};
        if (s.icon.parent) s.icon.parent.remove(s.icon);
        s.icon = null; s.type=null; s.concealed=false;
        return [kind, start];
      }
    }
    return [null, null];
  }
}

/* Particles as small rectangles */
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
    this.nodes = {};
  }

  async init() {
    const e = this.engine;

    // Background floor (mosaic + fading)
    const background = await mosaicFromURL(ASSETS.wooden_floor, 3, 9, 1, [0.6, 1, 0.4, 0.5], {depth: DEPTH_BG});
    e.root.add(background);

    // Table rings
    const ringOuter = new CircleNode(140, '#193C2D', '#288C5A', 6, {depth: DEPTH_TABLE});
    const ringInner = new CircleNode(80, '#193C2D', '#1E7850', 3, {depth: DEPTH_TABLE});
    e.root.add(ringOuter); e.root.add(ringInner);

    // Actors layers
    const playerLayer = new Node({depth: DEPTH_ACTORS});
    const dealerLayer = new Node({depth: DEPTH_ACTORS});
    playerLayer.y = -CANVAS_H*0.28; dealerLayer.y = CANVAS_H*0.28;
    e.root.add(playerLayer); e.root.add(dealerLayer);

    // Faces (mosaic)
    const playerFace = await mosaicFromURL(ASSETS.player_face, 4, 1.0);
    const dealerFace = await mosaicFromURL(ASSETS.dealer_face, 4, 1.0);
    playerLayer.add(playerFace);
    dealerLayer.add(dealerFace);

    // Hands layer and images (mosaic)
    const handsLayer = new Node({depth: DEPTH_HANDS});
    const playerHandImg = await mosaicFromURL(ASSETS.player_hand, 4, 1.0);
    const dealerHandImg = await mosaicFromURL(ASSETS.dealer_hand, 4, 1.0);
    playerHandImg.y = -CANVAS_H*0.12;
    dealerHandImg.y =  CANVAS_H*0.12;
    handsLayer.add(playerHandImg); handsLayer.add(dealerHandImg);
    e.root.add(handsLayer);

    // Gun rig with two modes: gun_only and gun_with_hands (mosaic)
    const gunRig = new Node({depth: DEPTH_GUN});
    const gunOnly = await mosaicFromURL(ASSETS.shotgun, 4, 1.5);
    const gunWithHands = await mosaicFromURL(ASSETS.Hand_holding_gun, 4, 1.5);
    gunRig.add(gunOnly);
    gunWithHands.visible = false;
    gunRig.add(gunWithHands);
    e.root.add(gunRig);

    // Cartridge tray
    const tray = new CartridgeTray(CARTRIDGE_CAPACITY);
    e.root.add(tray);

    // DMG text layer using your images only
    const dmgLayer = new Node({depth: DEPTH_UI});
    const dmgLabel = await mosaicFromURL(ASSETS.textdmg, 1, 6);
    const dmgPlus  = await mosaicFromURL(ASSETS.textplus, 1, 6);
    const dmgZero  = await mosaicFromURL(ASSETS.textzero, 1, 6);
    dmgLayer.add(dmgLabel);
    dmgPlus.x = 85; dmgLayer.add(dmgPlus);
    dmgZero.x = 120; dmgLayer.add(dmgZero);
    dmgLayer.x = 120; dmgLayer.y = 120; dmgLayer.rot = 45;
    e.root.add(dmgLayer);

    // HP bars
    const hpPlayer = new HpBar();
    hpPlayer.x = CANVAS_W*0.16; hpPlayer.y = -CANVAS_H*0.30;
    const hpDealer = new HpBar();
    hpDealer.x = -CANVAS_W*0.16; hpDealer.y = CANVAS_H*0.30;
    e.root.add(hpPlayer); e.root.add(hpDealer);

    // Save refs
    this.nodes = {
      background, ringOuter, ringInner,
      playerLayer, dealerLayer, handsLayer,
      playerHandImg, dealerHandImg,
      gunRig, gunOnly, gunWithHands,
      tray, dmgLayer, dmgLabel, dmgPlus,
      dmgNumber: dmgZero, // current number node
      hpPlayer, hpDealer
    };
    this.state.player_hand_idle_y = playerHandImg.y;
    this.state.dealer_hand_idle_y = dealerHandImg.y;

    await this.startNewRound();
    this.engine.start();
  }

  async updateDamageBox(swag=false) {
    // remove current number and add new
    const nums = ["textzero","textone","texttwo","textthree","textfour","textfive","textsix","textseven","texteight","textnine","textten"];
    const idx = clamp(this.state.stack, 0, 10);
    const newNum = await mosaicFromURL(ASSETS[nums[idx]], 1, 6);
    newNum.x = 120;
    const layer = this.nodes.dmgLayer;
    if (this.nodes.dmgNumber && this.nodes.dmgNumber.parent) layer.remove(this.nodes.dmgNumber);
    layer.add(newNum);
    this.nodes.dmgNumber = newNum;

    if (swag) {
      const t = layer;
      const s0 = t.scale || 1;
      const bump = Math.pow(128/125, 4 + this.state.stack); // similar to original
      await tween(t, {scale: s0*bump}, 100);
      await tween(t, {scale: s0}, 100);
    }
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
    await this.nodes.tray.show_preview(types);
    await wait(1500);
    await this.nodes.tray.conceal_and_shuffle();

    const tmp = [];
    for (const s of this.nodes.tray.slots) if (s.icon) tmp.push(s.type);
    this.state.round_types = tmp;
    this.state.chambered = null;

    await this.preload_next_bullet();
    await this.updateDamageBox(false);
  }

  take_next_bullet() {
    const [k, start] = this.nodes.tray.take_leftmost();
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

  async bullet_move_to_gun(start, img_kind='concealed', duration=350) {
    const url = (img_kind==='live')?ASSETS.bullet_live : (img_kind==='blank')?ASSETS.bullet_blank : ASSETS.bullet_concealed;
    const icon = await mosaicFromURL(url, 4, 1.0);
    icon.depth = DEPTH_UI-2;
    icon.x = start.x; icon.y = start.y;
    this.engine.root.add(icon);
    const gx = this.nodes.gunRig.x, gy = this.nodes.gunRig.y;
    await tween(icon, {x: gx, y: gy}, duration, easeOutQuad);
    if (icon.parent) icon.parent.remove(icon);
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
      await this.throw_used_bullet(this.state.prev, this.state.prevshooter);
      this.state.prev = null;
    }
    this.state.busy = false;
  }

  async throw_used_bullet(btype, shooter) {
    let used;
    if (btype === 'blank') used = await mosaicFromURL(ASSETS.bullet_blank, 8, 0.5, 0.5);
    else used = await mosaicFromURL(ASSETS.bullet_used_live, 8, 0.5, 0.5);
    used.depth = 70;
    used.x = 0; used.y = 0;
    this.engine.root.add(used);

    const thrownvel = 10;
    const scale = 20;
    const angleparam = Math.random()/5 + 0.55;
    for (let i=2*thrownvel; i>0; i--) {
      let temp = -1;
      if (shooter === 'player') temp *= -1;
      used.x += temp*i/10*angleparam*scale;
      used.y += -temp*i/10*(1-angleparam)*scale;
      used.rot += angleparam*6*i;
      await wait(15);
    }
    if (used.parent) used.parent.remove(used);
  }

  async rotate_barrel_to(targetDeg, duration=180) {
    const curr = this.nodes.gunRig.rot||0;
    const delta = normalizeAngle(targetDeg - curr);
    if (Math.abs(delta) < 1e-3) return;
    await tween(this.nodes.gunRig, {rot: curr+delta}, duration);
  }

  async hand_reach_and_pick(handNode, towards='up', duration=100) {
    const origY = handNode.y;
    const ny = towards==='up' ? origY+10 : origY-10;
    await tween(handNode, {y: ny}, duration);
    // switch to gun_with_hands sprite
    this.nodes.gunOnly.visible = false;
    this.nodes.gunWithHands.visible = true;
    const deg = (towards==='up') ? 90 : -90;
    await this.rotate_barrel_to(deg, 100);
  }

  async return_gun_to_idle(duration=200) {
    await tween(this.nodes.gunRig, {x:0, y:0}, duration);
    await this.rotate_barrel_to(0, 180);
    // switch back to gun-only sprite
    this.nodes.gunWithHands.visible = false;
    this.nodes.gunOnly.visible = true;
  }

  async muzzle_flash(target) {
    for (const i of [1,4]) {
      const path = `assets/Fire${i}2.bmp`;
      const effect = await mosaicFromURL(path, 4, (i!==1?8:24));
      effect.depth = 10;
      const where = {x: this.nodes.gunRig.x, y: this.nodes.gunRig.y};
      if (target === 'dealer') {
        effect.x = where.x; effect.y = where.y + 240 + 10*i;
      } else {
        effect.x = where.x; effect.y = where.y - 240 - 10*i;
        effect.rot = 180;
      }
      this.engine.root.add(effect);
      await wait(50);
      if (effect.parent) effect.parent.remove(effect);
    }
  }

  async animate_player_choice_and_shoot(shooter, target) {
    if (this.state.busy) return;
    this.state.busy = true;

    if (this.state.chambered == null) {
      await this.preload_next_bullet();
      if (this.state.chambered == null) {
        await this.return_gun_to_idle(200);
        await this.startNewRound();
        this.state.busy = false;
        return;
      }
    }

    if (shooter === 'player') {
      await this.hand_reach_and_pick(this.nodes.playerHandImg, 'up', 100);
    } else {
      await this.hand_reach_and_pick(this.nodes.dealerHandImg, 'down', 100);
    }
    const desired = (target==='dealer') ? 180 : 0;
    await this.rotate_barrel_to(desired, 180);

    const kind = this.state.chambered;
    this.state.prev = kind;
    this.state.prevshooter = shooter;
    this.state.chambered = null;

    const offset = (target==='dealer') ? 14 : -14;
    await tween(this.nodes.gunRig, {y: this.nodes.gunRig.y - offset}, 100);
    await tween(this.nodes.gunRig, {y: this.nodes.gunRig.y + offset}, 100);

    if (kind === 'live') {
      await this.muzzle_flash(target);
      const dmg = 1 + Math.min(10, this.state.stack);
      await this.hp_damage(target, dmg);

      if (this.state.player_hp<=0 || this.state.dealer_hp<=0) {
        this.state.game_over = true;
        this.state.busy = false;
        return;
      }
      this.state.stack = 0;
      await this.updateDamageBox(false);
      this.state.turn = (shooter==='player') ? 'dealer' : 'player';
    } else {
      if (shooter === target) {
        this.state.stack = clamp(this.state.stack+1, 0, 10);
        await this.updateDamageBox(true);
      } else {
        this.state.turn = (shooter==='player') ? 'dealer' : 'player';
      }
    }

    await this.return_gun_to_idle(200);
    await tween(this.nodes.playerHandImg, {y: this.state.player_hand_idle_y}, 200);
    await tween(this.nodes.dealerHandImg, {y: this.state.dealer_hand_idle_y}, 200);

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
    const pos = await clickPromise;
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

  async showBanner() {
    const winner = (this.state.dealer_hp<=0) ? 'player' : 'dealer';
    const url = winner==='player' ? ASSETS.youwin : ASSETS.youlose;
    const banner = await mosaicFromURL(url, 1, 20);
    banner.depth = DEPTH_UI - 10;
    banner.x = 0; banner.y = 0;
    this.engine.root.add(banner);
    return winner;
  }
}
