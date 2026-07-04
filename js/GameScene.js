// ============ 核心玩法场景 ============
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }
  ui() { return this.scene.get('UI'); }

  create() {
    // ---- 一夜的全部状态(重开即重置) ----
    this.S = {
      hp: 100, sleep: 0, wake: 0, stars: 0, bladder: 35, minute: 0,
      sleeping: false, hidden: false, patrol: false, over: false, reason: null,
      chase: false, chasePhase: null,       // 暴怒追逐:hunt 追/wander 搜/knock 砸门/beaten 打爸爸/return 回房
      fury: false,                          // 喷火暴走(起夜发现马桶没冲)
      combo: 0, dodges: 0, kicks: 0, ice: 0, escapes: 0,
      kickSlow: 1,                          // 踢腿间隔倍率(安眠计划↑,踩玩具↓)
      calm: 1,                              // 噪音影响倍率(床头牛奶后 0.75)
      plan: { teddy: false, milk: false, blanket: false },   // 安眠计划三步
      buffs: { milkUntil: 0, milkX: 1.5, iceUntil: 0, slippers: false, shield: 0 },   // milkX:牛奶倍率(厨房1.5/爸爸牌3)
      flags: { catFood: false, catFed: false, teddyFound: false, couchTries: 0,
               milkUsed: false, momMilk: false, blanket: false, toys: 0, trips: 0,
               bladderWarned: false, sleepFull: false, wakeWarned: false,
               unflushed: false },           // 没冲马桶的"罪证"(妈妈起夜发现=喷火暴走)
      iceReadyAt: 0,
    };
    this.channel = null; this.tele = null; this.near = null;
    this.lastNoise = 0; this.stepAcc = 0; this.prevRoom = 'mom';
    this.momFacing = Math.PI; this.momPath = null; this.momPathGoal = null;
    this.lastSeen = null; this.lastSeenAt = 0; this.knockT0 = 0; this.lastKnock = 0;
    this.dadState = 'bed'; this.dadHideSpot = null; this.dadPath = null;
    this.playerHideSpot = null; this.furyEndAt = 0; this.lastFireAt = 0;
    this.dadMem = this.loadDadMem();   // 跨晚记忆:各藏身点被连续抓到的次数
    // 一晚 4 次起夜窗口(约 23:55 / 1:20 / 2:50 / 4:30 前后浮动)
    this.patrolTimes = [
      Phaser.Math.Between(45, 75), Phaser.Math.Between(130, 170),
      Phaser.Math.Between(220, 260), Phaser.Math.Between(315, 350),
    ];
    // 爸爸的精神小伙时刻(随机 4 次,每次 10 秒)
    this.danceTimes = [
      Phaser.Math.Between(25, 90), Phaser.Math.Between(110, 200),
      Phaser.Math.Between(230, 320), Phaser.Math.Between(350, 430),
    ];
    this.S.dance = false;

    // 物理世界边界 = 地图大小(默认是画布 960x540,会在客厅/厨房下方形成空气墙!)
    this.physics.world.setBounds(0, 0, CFG.WORLD_W, CFG.WORLD_H);

    this.buildWorld();
    this.buildActors();
    this.buildInteractables();

    // 相机(zoom 乘 DPR 实现高清渲染,逻辑坐标不变)
    this.cameras.main.setBounds(0, 0, CFG.WORLD_W, CFG.WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.2 * CFG.DPR);

    // 键盘(桌面调试用)
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SHIFT,SPACE,E');
    this.cursors = this.input.keyboard.createCursorKeys();

    // 时钟:1 秒 = 1 游戏分钟
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickMinute() });
    // 猫叫检查
    this.time.addEvent({ delay: 45000, loop: true, callback: () => this.catMeow() });
    // 妈妈的呼噜气泡
    this.time.addEvent({ delay: 4000, loop: true, callback: () => {
      if (!this.S.patrol && !this.S.over) this.floatText(this.mom.x + 16, this.mom.y - 30, '💤', '#cdb9ff', 18);
    }});

    // 开场教学
    TUTORIAL.forEach((t, i) => this.time.delayedCall(600 + i * 2600, () => {
      if (!this.S.over) this.ui().toast(t);
    }));
  }

  // ================= 场景搭建 =================
  buildWorld() {
    // 地板 + 房间名
    for (const r of Object.values(ROOMS)) {
      this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, r.floor).setDepth(0);
      this.add.text(r.x + r.w / 2, r.y + r.h / 2, r.name,
        { fontSize: '22px', color: '#ffffff', fontFamily: 'sans-serif' })
        .setOrigin(0.5).setAlpha(0.12).setDepth(1);
    }
    // 墙体
    this.solidObjs = [];
    for (const w of WALLS) {
      const r = this.add.rectangle(w.x + w.w / 2, w.y + w.h / 2, w.w, w.h, 0x3d3a5e).setDepth(5);
      this.physics.add.existing(r, true);
      this.solidObjs.push(r);
    }
    // 家具
    for (const f of FURNITURE) {
      const img = this.add.image(f.x + f.w / 2, f.y + f.h / 2, f.tex).setDepth(3);
      if (f.solid) { this.physics.add.existing(img, true); this.solidObjs.push(img); }
      if (f.emoji) this.add.text(f.x + f.w / 2, f.y + f.h / 2, f.emoji,
        { fontSize: '26px' }).setOrigin(0.5).setDepth(4);
    }
    // 床上细节:枕头 + 床边地垫
    this.add.image(BED.momSlot.x, 82, 'pillowMom').setDepth(4);
    this.add.image(BED.girlSlot.x, 82, 'pillowGirl').setDepth(4);
    this.add.image(BED.matSlot.x, BED.matSlot.y, 'mat').setDepth(2);

    // 爸爸房间的暖光(唯一亮灯的房间)
    this.add.image(765, 130, 'glow').setScale(3.4).setAlpha(0.5).setDepth(2);
    this.add.image(918, 48, 'glow').setScale(1.2).setAlpha(0.6).setDepth(2);

    // 地上的玩具(噪音陷阱)
    this.toyObjs = TOYS.map(t => {
      const img = this.physics.add.staticImage(t.x, t.y, 'toy').setDepth(6);
      img.picked = false; img.lastSqueak = 0; img.tripped = false;
      return img;
    });

    // 安眠计划道具:客厅角落的毯子篮 / 床头牛奶杯(拿到后才显示)
    this.basketImg = this.add.image(62, 618, 'basket').setDepth(6);
    this.cupImg = this.add.image(148, 82, 'cup').setDepth(13).setVisible(false);
    this.blanketImg = this.add.image(BED.momSlot.x, BED.momSlot.y + 8, 'blanket').setDepth(12).setVisible(false);
  }

  buildActors() {
    // 女儿
    this.player = this.physics.add.sprite(BED.matSlot.x, BED.matSlot.y + 6, 'girl').setDepth(10);
    this.player.body.setSize(26, 18).setOffset(7, 26);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.solidObjs);
    // 身边微光(夜里能看清自己)
    this.pGlow = this.add.image(this.player.x, this.player.y, 'glow').setScale(1.1).setAlpha(0.22).setDepth(2);

    // 妈妈(睡在床左侧)
    this.mom = this.add.image(BED.momSlot.x, BED.momSlot.y, 'mom').setDepth(11);
    // 预警气泡
    this.cue = this.add.text(this.mom.x + 46, this.mom.y - 40, '', { fontSize: '38px' })
      .setOrigin(0.5).setDepth(30).setVisible(false);

    // 爸爸(在自己房间,永远醒着陪你)
    this.dad = this.add.image(700, 110, 'dad').setDepth(11);
    // 猫(手里有猫粮时头顶出现❗)
    this.cat = this.add.image(390, 612, 'cat').setDepth(9);
    this.catAlert = this.add.text(390, 584, '❗', { fontSize: '20px' }).setOrigin(0.5).setDepth(30).setVisible(false);
    // 爸爸逃命时的哭哭脸
    this.dadCry = this.add.text(0, 0, '😭', { fontSize: '20px' }).setOrigin(0.5).setDepth(30).setVisible(false);
    // 妈妈的视野扇形(追逐时显示)
    this.coneG = this.add.graphics().setDepth(36);
    // 夜店彩灯(爸爸跳舞时的灯光层,盖在爸爸房间上)
    this.discoG = this.add.graphics().setDepth(7);
    // 小熊(找到后跟随)
    this.teddyImg = this.add.image(0, 0, 'teddy').setVisible(false).setDepth(12);
    // 随身道具图标(猫粮/牛奶/毯子,跟在头顶,一眼看出拿没拿)
    this.carryIcons = this.add.text(0, 0, '', { fontSize: '17px' }).setOrigin(0.5).setDepth(30);

    // 踩玩具
    this.physics.add.overlap(this.player, this.toyObjs, (pl, toy) => {
      if (toy.picked || pl.body.speed < 30) return;
      const now = this.time.now;
      if (now - toy.lastSqueak < 1500) return;
      toy.lastSqueak = now;
      SFX.ding();
      this.addNoise(toy.x, toy.y, 15);
      this.ui().toast('⚠ 踩到玩具了!吱——');
      this.tweens.add({ targets: toy, y: toy.y - 8, duration: 90, yoyo: true });
    });
  }

  buildInteractables() {
    const S = this.S;
    this.inter = [
      { x: 258, y: 172, r: 62, label: '🛏 上床睡觉',
        enabled: () => !S.patrol && !S.chase, act: () => this.enterBed() },
      { x: 475, y: 138, r: 58,
        label: () => (S.flags.unflushed && S.bladder < 25) ? '🚽 回去补冲(销毁证据)' : '🚽 上厕所',
        enabled: () => S.bladder >= 25 || S.flags.unflushed,
        act: () => (S.flags.unflushed && S.bladder < 25) ? this.lateFlush() : this.useToilet() },
      { x: 335, y: 178, r: 55, label: '🚪 躲进衣柜',
        act: () => this.hideAt(335, 92, 'wardrobe') },
      { x: 85, y: 548, r: 52, label: '🛋 躲到沙发后',
        act: () => this.hideAt(150, 416, 'couch') },
      { x: 235, y: 548, r: 52, label: '🔍 翻找沙发缝',
        enabled: () => !S.flags.teddyFound, act: () => this.searchCouch() },
      { x: 390, y: 612, r: 74, label: () => (S.flags.catFood && !S.flags.catFed) ? '🐟 喂猫' : '🐱 摸摸猫',
        act: () => this.petCat() },
      { x: 848, y: 452, r: 58, label: '🧊 翻冰箱',
        act: () => this.openFridge() },
      { x: 640, y: 566, r: 62,
        label: () => (S.plan.teddy && !S.flags.momMilk) ? '🥛 给妈妈热一杯牛奶' : '🥛 微波炉热牛奶(自己喝)',
        enabled: () => (S.plan.teddy && !S.flags.momMilk) || !S.flags.milkUsed,
        act: () => (S.plan.teddy && !S.flags.momMilk) ? this.heatMomMilk() : this.heatMilk() },
      { x: 700, y: 135, r: 95, label: '🍦 找爸爸换道具',
        act: () => this.ui().openShop() },
      // ---- 安眠计划:妈妈床边的三步操作 ----
      { x: 95, y: 208, r: 64,
        label: () => {
          if (S.flags.teddyFound && !S.plan.teddy) return '🧸 把小熊塞给妈妈';
          if (S.plan.teddy && S.flags.momMilk && !S.plan.milk) return '🥛 把牛奶放到床头';
          return '🛌 给妈妈盖上毯子';
        },
        enabled: () => !S.patrol && !S.chase && (
          (S.flags.teddyFound && !S.plan.teddy) ||
          (S.plan.teddy && S.flags.momMilk && !S.plan.milk) ||
          (S.plan.milk && S.flags.blanket && !S.plan.blanket)),
        act: () => this.planStep() },
      // 客厅角落收纳篮里的毯子
      { x: 62, y: 615, r: 60, label: '🧺 拿走篮子里的毯子',
        enabled: () => S.plan.milk && !S.flags.blanket,
        act: () => {
          S.flags.blanket = true;
          this.basketImg.setAlpha(0.45);
          SFX.star();
          this.floatText(this.player.x, this.player.y - 32, '🧺 毯子 GET!', '#7bed9f', 20);
          this.ui().toast('🧺 抱起软软的毯子…(轻轻盖到妈妈身上)');
        } },
    ];
    // 每个玩具都是可捡的
    for (const toy of this.toyObjs) {
      this.inter.push({
        x: toy.x, y: toy.y, r: 46, label: '🧸 捡起玩具',
        enabled: () => !toy.picked,
        act: () => {
          toy.picked = true; toy.setVisible(false); toy.body.enable = false;
          S.flags.toys++; S.stars++;
          SFX.star();
          this.floatText(this.player.x, this.player.y - 30, '+1⭐', '#ffd166');
          if (S.flags.toys >= TOYS.length) this.ui().toast('🧹 玩具全部收好!走廊安全了');
        },
      });
    }
  }

  // ================= 每帧更新 =================
  update(time, delta) {
    const S = this.S;
    if (!S || S.over) return;
    const dt = delta / 1000;
    const now = time;

    // ---- 移动 ----
    const ui = this.ui();
    let jx = 0, jy = 0;
    if (ui && ui.joy && !ui.modalOpen) { jx = ui.joy.x; jy = ui.joy.y; }
    const K = this.keys, C = this.cursors;
    if (K) {
      if (K.A.isDown || C.left.isDown) jx = -1;
      if (K.D.isDown || C.right.isDown) jx = 1;
      if (K.W.isDown || C.up.isDown) jy = -1;
      if (K.S.isDown || C.down.isDown) jy = 1;
      if (Phaser.Input.Keyboard.JustDown(K.SPACE) || Phaser.Input.Keyboard.JustDown(K.E)) this.doAction();
    }
    const len = Math.hypot(jx, jy);

    if (S.sleeping || S.hidden || this.channel) {
      this.player.body.setVelocity(0, 0);
      if (this.channel && len > 0.35) this.cancelChannel();
    } else if (len > 0.15) {
      const run = len > 0.85 || (K && K.SHIFT.isDown);
      const sp = run ? CFG.RUN_SPEED : CFG.WALK_SPEED;
      this.player.body.setVelocity(jx / len * sp, jy / len * sp);
      this.stepAcc += sp * dt;
      if (this.stepAcc >= 44) {
        this.stepAcc = 0;
        let str = run ? 6 : 1.0;
        if (S.buffs.slippers) str *= 0.5;
        if (run) SFX.step();
        this.addNoise(this.player.x, this.player.y, str, run);
      }
    } else {
      this.player.body.setVelocity(0, 0);
    }
    this.pGlow.setPosition(this.player.x, this.player.y);
    if (S.plan.teddy) {
      this.teddyImg.setVisible(true).setPosition(this.mom.x + 24, this.mom.y + 10);  // 小熊在妈妈怀里
    } else if (S.flags.teddyFound) {
      this.teddyImg.setVisible(!S.hidden).setPosition(this.player.x + 17, this.player.y - 15);
    }
    this.catAlert.setVisible(S.flags.catFood && !S.flags.catFed);
    // 爸爸逃命/躲藏时头顶挂着哭哭脸
    const dadScared = this.dadState === 'flee' || this.dadState === 'hidden' || this.dadState === 'beaten';
    this.dadCry.setVisible(dadScared).setPosition(this.dad.x + 4, this.dad.y - 38);

    // 头顶的随身道具图标
    const carry = [];
    if (S.flags.catFood && !S.flags.catFed) carry.push('🐟');
    if (S.flags.momMilk && !S.plan.milk) carry.push('🍼');
    if (S.flags.blanket && !S.plan.blanket) carry.push('🧺');
    this.carryIcons.setText(carry.join(''))
      .setVisible(carry.length > 0 && !S.hidden)
      .setPosition(this.player.x, this.player.y - 36);

    // ---- 起夜时踩到没收拾的玩具:妈妈更烦躁,踢腿变快 ----
    if (S.patrol && !this.patrolTripped) {
      for (const toy of this.toyObjs) {
        if (toy.picked || toy.tripped) continue;
        if (Phaser.Math.Distance.Between(this.mom.x, this.mom.y, toy.x, toy.y) < 30) {
          toy.tripped = true; this.patrolTripped = true;
          S.flags.trips++; S.kickSlow *= 0.85;
          SFX.ding(); this.vibrate(120);
          this.tweens.add({ targets: this.mom, angle: 14, duration: 90, yoyo: true, repeat: 1 });
          this.floatText(toy.x, toy.y - 20, '💥 吱!!', '#ff8899', 22);
          this.ui().toast('💥 妈妈踩到玩具了!她变得更烦躁…(踢腿变快)');
          break;
        }
      }
    }

    // ---- 暴怒追逐 ----
    if (S.chase) this.updateChase(dt, time);
    else this.coneG.clear();
    // 爸爸逃命/回房寻路(独立每帧,不受追逐阶段早退影响)
    this.updateDad(dt);

    // ---- 夜店彩灯:爸爸房间蹦迪灯光 ----
    if (S.dance) {
      const t = time / 1000;
      const R = ROOMS.dad;
      const hue = (t * 140) % 360;
      const base = Phaser.Display.Color.HSVToRGB(hue / 360, 0.9, 1).color;
      this.discoG.clear();
      this.discoG.fillStyle(base, 0.13 + 0.07 * Math.sin(t * 9));
      this.discoG.fillRect(R.x, R.y, R.w, R.h);
      for (let i = 0; i < 3; i++) {                 // 三个旋转彩色光斑
        const ang = t * 2.6 + i * 2.09;
        const col = Phaser.Display.Color.HSVToRGB(((hue + i * 120) % 360) / 360, 1, 1).color;
        this.discoG.fillStyle(col, 0.22);
        this.discoG.fillCircle(765 + Math.cos(ang) * 105, 128 + Math.sin(ang) * 68, 34);
      }
    }

    // ---- 进行中的动作(蓄力条) ----
    if (this.channel && now - this.channel.t0 >= this.channel.dur) {
      const c = this.channel; this.channel = null;
      c.cb();
    }

    // ---- 数值 ----
    S.bladder = Math.min(100, S.bladder + CFG.BLADDER_RATE * dt);
    if (S.bladder >= 70 && !S.flags.bladderWarned) {
      S.flags.bladderWarned = true;
      this.ui().toast('💧 好想上厕所…(睡眠效率减半)');
    }
    if (S.sleeping) {
      const rate = CFG.SLEEP_RATE
        * (now < S.buffs.milkUntil ? S.buffs.milkX : 1)
        * (now < S.buffs.iceUntil ? 1.25 : 1)
        * (S.plan.blanket ? 1.5 : 1)
        * (S.bladder >= 70 ? 0.5 : 1);
      S.sleep = Math.min(100, S.sleep + rate * dt);
      if (S.sleep >= 100) return this.endNight('sleepfull');   // 睡饱了直接胜利!
    }
    // 女儿安静睡着时,妈妈的火气消得快(回落×3,起效也更快)
    if (!S.chase) {
      const quietMs = S.sleeping ? 1000 : 2500;
      const decay = CFG.WAKE_DECAY * (S.sleeping ? 3 : 1);
      if (now - this.lastNoise > quietMs) S.wake = Math.max(0, S.wake - decay * dt);
      if (S.wake < 50) S.flags.wakeWarned = false;
    }

    // ---- 房间事件 ----
    const room = this.whichRoom(this.player.x, this.player.y);
    if (room !== this.prevRoom) {
      if (room === 'dad') this.onEnterDad();
      this.prevRoom = room;
    }

    // ---- 巡逻时被撞见:妈妈直接暴怒 ----
    if (S.patrol && !S.hidden && !S.sleeping) {
      if (room === 'mom' || room === 'hall' || room === 'bath') {
        const d = Phaser.Math.Distance.Between(this.mom.x, this.mom.y, this.player.x, this.player.y);
        const sameRoom = this.whichRoom(this.mom.x, this.mom.y) === room;
        if ((sameRoom && d < 260) || d < 170) return this.startChase();
      }
    }

    // ---- 附近可互动物 ----
    this.near = null;
    if (!S.sleeping && !S.hidden && !this.channel) {
      let best = 1e9;
      for (const it of this.inter) {
        if (it.enabled && !it.enabled()) continue;
        const d = Phaser.Math.Distance.Between(it.x, it.y, this.player.x, this.player.y);
        if (d < it.r && d < best) { best = d; this.near = it; }
      }
    }
  }

  // ================= 行动分发(UI 按钮 / 空格) =================
  doAction() {
    const S = this.S;
    if (S.over || this.channel) return;
    const ui = this.ui();
    if (ui && ui.modalOpen) return;
    if (S.sleeping) return this.attemptDodge();
    if (S.hidden) return this.unhide();
    if (this.near) this.near.act();
  }

  // ================= 床上:睡觉与无影脚 =================
  enterBed() {
    const S = this.S;
    S.sleeping = true;
    this.player.body.setVelocity(0, 0);
    this.player.body.enable = false;
    this.player.setTexture('girlSleep').setPosition(BED.girlSlot.x, BED.girlSlot.y).setDepth(12);
    this.scheduleKick();
    if (!this.bedToastShown) {
      this.bedToastShown = true;
      this.ui().toast('😴 睡眠增长中…盯紧妈妈,红色⚠️就按【躲】!');
    }
  }

  leaveBed() {
    const S = this.S;
    if (!S.sleeping) return;
    this.clearKickTimers();
    S.sleeping = false;
    this.player.setTexture('girl').setPosition(BED.matSlot.x, BED.matSlot.y).setDepth(10);
    this.player.body.enable = true;
    this.addNoise(this.player.x, this.player.y, 3, false);
  }

  clearKickTimers() {
    if (this.kickEv) { this.kickEv.remove(false); this.kickEv = null; }
    if (this.teleEv) { this.teleEv.remove(false); this.teleEv = null; }
    this.tele = null;
    this.cue.setVisible(false);
  }

  kickDelay() {
    const st = this.momState();
    const [a, b] = st.name === '熟睡' ? CFG.KICK_GAPS.deep
      : (st.name === '浅睡' ? CFG.KICK_GAPS.light : CFG.KICK_GAPS.almost);
    // 安眠计划让间隔变长,起夜踩到玩具会让间隔变短
    return [a * this.S.kickSlow, b * this.S.kickSlow];
  }

  scheduleKick() {
    const S = this.S;
    if (!S.sleeping || S.over || S.patrol || S.plan.blanket) return;   // 盖上毯子=无影脚封印
    const [a, b] = this.kickDelay();
    this.kickEv = this.time.delayedCall(Phaser.Math.Between(a, b), () => this.doTelegraph());
  }

  doTelegraph() {
    const S = this.S;
    if (!S.sleeping || S.over || S.patrol) return;
    const real = Math.random() < 0.7;
    this.tele = { real, dodged: false };
    this.cue.setText(real ? '⚠️' : '💤').setVisible(true).setScale(0);
    this.tweens.add({ targets: this.cue, scale: 1, duration: 120, ease: 'Back.Out' });
    if (real) { SFX.kickWarn(); this.vibrate(90); } else SFX.fakeWarn();
    // 小熊只有抱在自己怀里才加长闪避窗口(送给妈妈就没了——取舍)
    const hasTeddy = S.flags.teddyFound && !S.plan.teddy;
    const win = real && hasTeddy ? CFG.DODGE_WINDOW_TEDDY : CFG.DODGE_WINDOW;
    this.teleEv = this.time.delayedCall(win, () => this.resolveTele());
  }

  attemptDodge() {
    const now = this.time.now;
    if (this.tele && !this.tele.dodged) {
      this.tele.dodged = true;
      this.rollAnim();
      this.addNoise(this.player.x, this.player.y, 2.5, false);
      if (this.tele.real) SFX.dodge();
    } else if (!this.tele) {
      this.rollAnim();
      this.addNoise(this.player.x, this.player.y, 2.5, false);
      if (now - (this.lastRollToast || 0) > 5000) {
        this.lastRollToast = now;
        this.ui().toast('(没动静…别乱滚,翻身也有声音)');
      }
    }
  }

  rollAnim() {
    this.tweens.add({
      targets: this.player,
      x: BED.matSlot.x, y: BED.matSlot.y, angle: 360,
      duration: 170, yoyo: true, hold: 320,
      onComplete: () => {
        this.player.setAngle(0);
        if (this.S.sleeping) this.player.setPosition(BED.girlSlot.x, BED.girlSlot.y);
      },
    });
  }

  resolveTele() {
    const S = this.S;
    const t = this.tele;
    this.tele = null; this.teleEv = null;
    this.cue.setVisible(false);
    if (!t || !S.sleeping || S.over) return;
    if (t.real) {
      this.kickAnim();
      if (t.dodged) {
        S.dodges++; S.combo++;
        if (S.combo % 3 === 0) {
          S.stars++; SFX.star();
          this.floatText(this.player.x, this.player.y - 30, `连躲x${S.combo} +1⭐`, '#ffd166');
        }
      } else {
        this.hitByKick();
      }
    } else if (t.dodged) {
      this.ui().toast('虚惊一场…妈妈只是翻了个身 😮‍💨');
    }
    this.scheduleKick();
  }

  kickAnim() {
    this.tweens.add({ targets: this.mom, angle: -16, duration: 90, yoyo: true });
    const leg = this.add.text(this.mom.x + 24, this.mom.y, '🦵', { fontSize: '30px' })
      .setOrigin(0.5).setDepth(30);
    this.tweens.add({
      targets: leg, x: BED.girlSlot.x, duration: 130, yoyo: true,
      onComplete: () => leg.destroy(),
    });
  }

  hitByKick() {
    const S = this.S;
    if (S.buffs.shield > 0) {
      S.buffs.shield--;
      this.ui().toast('🛡 替身抱枕替你挨了一脚!');
      this.addNoise(BED.girlSlot.x, BED.girlSlot.y, 4, false);
      return;
    }
    S.hp -= CFG.KICK_DMG; S.combo = 0; S.kicks++;
    SFX.hurt(); this.vibrate(200);
    this.cameras.main.shake(160, 0.008);
    this.floatText(this.player.x, this.player.y - 30, '-30 ❤', '#ff6b7d');
    this.addNoise(BED.girlSlot.x, BED.girlSlot.y, 8);
    if (S.hp <= 0) { S.hp = 0; this.endNight('ko'); }
  }

  // ================= 躲藏 =================
  hideAt(x, y, spot = null) {
    const S = this.S;
    // 喷火暴走时爸爸也在抢藏身点,被他占了就进不去
    if (spot && this.dadHideSpot === spot && (this.dadState === 'flee' || this.dadState === 'hidden')) {
      this.ui().toast('爸爸(缩在里面):满了满了!快去别处!😭');
      return;
    }
    S.hidden = true;
    this.playerHideSpot = spot;
    this.hidePrev = { x: this.player.x, y: this.player.y };
    this.player.body.setVelocity(0, 0);
    this.player.body.enable = false;
    this.player.setAlpha(0.35).setPosition(x, y);
    this.ui().toast('🤫 藏好了(再按一次出来)');
  }

  unhide() {
    const S = this.S;
    S.hidden = false;
    this.playerHideSpot = null;
    this.player.setAlpha(1).setPosition(this.hidePrev.x, this.hidePrev.y);
    this.player.body.enable = true;
  }

  // ================= 各房间任务 =================
  startChannel(label, dur, cb) {
    this.player.body.setVelocity(0, 0);
    this.channel = { label, t0: this.time.now, dur, cb };
  }
  cancelChannel() {
    this.channel = null;
    this.ui().toast('动作被打断了…');
  }

  useToilet() {
    this.startChannel('嘘嘘中…', 3000, () => {
      const S = this.S;
      S.bladder = 0; S.flags.bladderWarned = false;
      this.ui().showChoice('要冲水吗?', '好孩子会冲水(+2⭐),但半夜水声很响…', [
        { label: '冲!我是好孩子 💪', cb: () => {
          this.S.stars += 2; this.S.flags.unflushed = false;
          this.playFlush();
          this.addNoise(475, 65, 25);
          this.ui().toast('哗————!!(+2⭐)');
        }},
        { label: '明早再说 🤫', cb: () => {
          this.S.flags.unflushed = true;
          this.ui().toast('(马桶默默记下了这一切…)');
        }},
      ]);
    });
  }

  // 后悔了可以回来补冲(消除喷火隐患,但半夜水声照样响)
  lateFlush() {
    this.startChannel('鼓起勇气按下冲水…', 1500, () => {
      this.S.flags.unflushed = false;
      this.playFlush();
      this.addNoise(475, 65, 25);
      this.ui().toast('哗——!证据销毁,妈妈起夜不会发现了');
    });
  }

  searchCouch() {
    this.startChannel('翻找沙发缝…', 2000, () => {
      const S = this.S;
      S.flags.couchTries++;
      if (S.flags.couchTries >= 3) {
        S.flags.teddyFound = true; S.stars += 2; SFX.star();
        this.ui().toast('🧸 找到小熊了!抱着它睡,躲踢窗口更长(+2⭐)');
      } else {
        this.ui().toast(['翻出一枚硬币…下面好像还有东西', '翻出爸爸的臭袜子 🤢 再翻翻'][S.flags.couchTries - 1]);
      }
    });
  }

  petCat() {
    const S = this.S;
    if (S.flags.catFood && !S.flags.catFed) {
      S.flags.catFed = true; S.stars += 2;
      this.playMeow(); SFX.star();
      this.ui().toast('🐱 猫猫吃饱睡了(+2⭐,半夜不会叫了)');
    } else if (S.flags.catFed) {
      this.ui().toast('🐱 呼噜呼噜…(它睡得比你好)');
    } else {
      this.playMeow();
      this.ui().toast('🐱 喵呜~(好像饿了…冰箱里有猫粮?)');
    }
  }

  openFridge() {
    const S = this.S;
    if (!S.flags.catFood) {
      this.startChannel('翻找冰箱…', 2000, () => {
        S.flags.catFood = true;
        SFX.star();
        this.floatText(this.player.x, this.player.y - 32, '🐟 猫粮 GET!', '#7bed9f', 20);
        this.ui().toast('🐟 找到猫粮了!拿去喂猫吧');
      });
    } else {
      this.ui().toast('只剩爸爸藏的辣酱和冻饺子…');
    }
  }

  heatMilk() {
    this.startChannel('微波炉运转中…', 3500, () => {
      const S = this.S;
      S.flags.milkUsed = true;
      S.buffs.milkUntil = this.time.now + 120000;
      S.buffs.milkX = 1.5;
      SFX.ding();
      this.addNoise(640, 600, 12);
      this.ui().toast('叮!🥛 喝下热牛奶,睡意上来了(睡眠×1.5)');
    });
  }

  heatMomMilk() {
    this.startChannel('给妈妈热牛奶…', 3500, () => {
      const S = this.S;
      S.flags.momMilk = true;
      SFX.ding();
      this.addNoise(640, 600, 12);
      this.floatText(this.player.x, this.player.y - 32, '🍼 牛奶 GET!', '#7bed9f', 20);
      this.ui().toast('叮!🍼 妈妈的牛奶好了(轻轻端到她床头去)');
    });
  }

  // ================= 安眠计划:治好妈妈的无影脚 =================
  planStep() {
    const S = this.S;
    if (S.flags.teddyFound && !S.plan.teddy) {
      this.startChannel('轻轻把小熊塞进妈妈怀里…', 4000, () => {
        S.plan.teddy = true;
        S.kickSlow *= 1.4;
        this.addNoise(BED.momSlot.x, BED.momSlot.y, 5, false);
        SFX.star();
        this.floatText(this.mom.x, this.mom.y - 36, '🧸💗', '#ffd166', 24);
        this.ui().toast('🧸 妈妈搂住小熊,眉头舒展开了…(踢腿变慢了!)');
        this.time.delayedCall(2800, () => {
          if (!S.over) this.ui().toast('她小声嘟囔:「暖暖的…」——也许再给她热杯牛奶?🥛');
        });
      });
    } else if (S.plan.teddy && S.flags.momMilk && !S.plan.milk) {
      this.startChannel('把牛奶轻轻放到床头…', 3000, () => {
        S.plan.milk = true;
        S.calm = 0.75;
        S.kickSlow *= 1.25;
        this.cupImg.setVisible(true);
        this.addNoise(BED.momSlot.x, BED.momSlot.y, 4, false);
        SFX.star();
        this.ui().toast('🥛 妈妈迷迷糊糊喝了一口,睡得更沉了(噪音影响↓)');
        this.time.delayedCall(2800, () => {
          if (!S.over) this.ui().toast('咦,她把被子踢开了…是不是有点冷?客厅角落有毯子 🧺');
        });
      });
    } else if (S.plan.milk && S.flags.blanket && !S.plan.blanket) {
      this.startChannel('给妈妈盖好毯子…', 4500, () => {
        S.plan.blanket = true;
        this.clearKickTimers();           // 无影脚封印!
        this.blanketImg.setVisible(true);
        S.wake = Math.max(0, S.wake - 20);
        this.patrolTimes = [];            // 睡得太香,不再起夜
        SFX.icecream();
        this.floatText(this.mom.x, this.mom.y - 40, '💤💤💤', '#cdb9ff', 26);
        this.ui().toast('🌙 妈妈发出幸福的呼噜声——无影脚被封印了!');
        this.time.delayedCall(2800, () => {
          if (!S.over) this.ui().toast('安眠计划完成!今晚可以安心睡觉了(睡眠×1.5,妈妈不再起夜)');
        });
      });
    }
  }

  onEnterDad() {
    const S = this.S, now = this.time.now;
    if (S.fury) { this.ui().toast('房间空荡荡的…爸爸已经跑路了 😭 这里不安全!'); return; }
    if (now >= S.iceReadyAt) {
      S.iceReadyAt = now + CFG.ICE_COOLDOWN;
      S.ice++; S.hp = 100;
      S.wake = S.chase ? S.wake : Math.max(0, S.wake - 30);   // 压惊:大幅消气
      S.buffs.iceUntil = now + 90000;                          // 吃饱了睡得香
      SFX.icecream();
      this.floatText(this.dad.x, this.dad.y - 36, '🍦', '#fff', 30);
      this.floatText(this.player.x, this.player.y - 30, '❤ 回满!', '#7bed9f');
      this.ui().toast('爸爸(小声):嘘——香草味的 🍦(体力回满,妈妈消气,90秒内睡得更香)');
    } else {
      const s = Math.ceil((S.iceReadyAt - now) / 1000);
      this.ui().toast(`爸爸打着小呼噜…(下一个冰激凌 ${s} 秒后)`);
    }
  }

  // ================= 爸爸商店 =================
  buyItem(id) {
    const S = this.S;
    const it = SHOP.find(i => i.id === id);
    if (!it) return { ok: false, msg: '???' };
    if (id === 'shield' && S.buffs.shield >= 2) return { ok: false, msg: '抱枕最多囤 2 个' };
    if (id === 'slippers' && S.buffs.slippers) return { ok: false, msg: '已经穿着毛绒拖鞋了' };
    if (S.stars < it.price) return { ok: false, msg: '⭐不够…去躲几脚、捡捡玩具吧' };
    S.stars -= it.price;
    SFX.buy();
    let msg = '';
    if (id === 'milk') { S.buffs.milkUntil = this.time.now + 120000; S.buffs.milkX = 3; msg = '🥛 爸爸牌就是不一样!困意汹涌(睡眠×3)'; }
    if (id === 'shield') { S.buffs.shield++; msg = `🛡 抱好替身抱枕(现有 ${S.buffs.shield} 个)`; }
    if (id === 'slippers') { S.buffs.slippers = true; msg = '🩴 穿上毛绒拖鞋,脚步轻多了'; }
    if (id === 'tip') { msg = Phaser.Utils.Array.GetRandom(DAD_TIPS); }
    return { ok: true, msg };
  }

  // ================= 噪音系统 =================
  addNoise(x, y, str, ripple = true) {
    const S = this.S;
    if (S.over || S.patrol || S.chase) return;
    const d = Phaser.Math.Distance.Between(x, y, this.mom.x, this.mom.y);
    const fall = Phaser.Math.Clamp(1 - d / 520, 0.12, 1);
    const gain = str * fall * this.momState().mult * this.S.calm;
    S.wake = Math.min(100, S.wake + gain);
    this.lastNoise = this.time.now;
    if (ripple && str >= 2) {
      const img = this.add.image(x, y, 'ripple').setDepth(35).setAlpha(0.65).setScale(0.3);
      this.tweens.add({
        targets: img, scale: 0.5 + str / 12, alpha: 0, duration: 500,
        onComplete: () => img.destroy(),
      });
    }
    if (gain > 3) this.floatText(this.mom.x + 22, this.mom.y - 36, '…!', '#ff9aa2', 18);
    if (S.wake >= 70 && !S.flags.wakeWarned) {
      S.flags.wakeWarned = true;
      this.ui().toast('😟 妈妈皱起眉头…再吵她就要炸了!');
    }
    if (S.wake >= 100) this.startChase();
  }

  catMeow() {
    const S = this.S;
    if (S.over || S.patrol || S.chase || S.flags.catFed || S.minute < 60) return;
    this.playMeow();
    this.tweens.add({ targets: this.cat, y: this.cat.y - 10, duration: 120, yoyo: true });
    this.floatText(this.cat.x, this.cat.y - 24, '🎵 喵嗷——', '#ffd166', 16);
    this.addNoise(this.cat.x, this.cat.y, 10);
  }

  // ================= 时钟与妈妈状态 =================
  tickMinute() {
    const S = this.S;
    if (S.over) return;
    S.minute++;
    if (this.patrolTimes.includes(S.minute) && !S.patrol && !S.chase) this.startPatrol();
    if (this.danceTimes.includes(S.minute) && !S.dance) this.startDance();
    if (S.minute >= CFG.NIGHT_MINUTES) this.endNight('morning');
  }

  // ================= 爸爸的精神小伙时刻 🪩 =================
  startDance() {
    const S = this.S;
    if (S.over || S.dance) return;
    S.dance = true;
    // BGM:真实音频优先,没有就合成迪斯科节拍
    if (this.cache.audio.exists('bgm_dance')) {
      this.danceBgm = this.sound.get('bgm_dance') || this.sound.add('bgm_dance', { loop: true, volume: 0.6 });
      if (!this.danceBgm.isPlaying) this.danceBgm.play();
    } else {
      SFX.startDance();
    }
    // 爸爸舞蹈动作:扭腰 + 蹦跶
    this.danceTw1 = this.tweens.add({ targets: this.dad, angle: { from: -16, to: 16 }, duration: 200, yoyo: true, repeat: -1 });
    this.danceTw2 = this.tweens.add({ targets: this.dad, scaleX: 1.12, scaleY: 0.92, duration: 250, yoyo: true, repeat: -1 });
    // 音符 + 噪音:吵到隔壁的妈妈
    this.danceNoiseEv = this.time.addEvent({ delay: 700, loop: true, callback: () => {
      if (this.S.over) return;
      this.addNoise(765, 130, 14, false);
      this.floatText(this.dad.x + Phaser.Math.Between(-30, 30), this.dad.y - 26,
        Phaser.Utils.Array.GetRandom(['🎵', '🎶', '🕺']), '#ffd166', 20);
    }});
    this.ui().toast('🪩 爸爸的精神小伙时间到了!!(妈妈的吵醒值在涨…)');
    if (this.S.chase) this.ui().toast('⚠ 现在爸爸房间不安全!别进去!');
    this.time.delayedCall(10000, () => this.stopDance());
  }

  stopDance() {
    const S = this.S;
    if (!S.dance) return;
    S.dance = false;
    const bgm = this.sound.get('bgm_dance');
    if (bgm && bgm.isPlaying) bgm.stop();
    SFX.stopDance();
    if (this.danceTw1) { this.danceTw1.remove(); this.danceTw1 = null; }
    if (this.danceTw2) { this.danceTw2.remove(); this.danceTw2 = null; }
    if (this.danceNoiseEv) { this.danceNoiseEv.remove(false); this.danceNoiseEv = null; }
    this.dad.setAngle(0).setScale(1);
    this.discoG.clear();
    if (!S.over) this.ui().toast('😪 爸爸跳累了,躺回床上装睡…');
  }

  // 妈妈破门而入:蹦迪时躲爸爸房间 = 一锅端
  momBreakIn() {
    if (this.breakingIn || this.S.over) return;
    this.breakingIn = true;
    this.stopChaseBgm();
    SFX.knock(); SFX.hurt();
    this.cameras.main.shake(400, 0.02);
    this.floatText(736, 256, '💥💥💥', '#ff5b6e', 36);
    this.tweens.add({ targets: this.mom, x: 700, y: 180, duration: 350, ease: 'Quad.In' });
    this.ui().toast('妈妈一脚踹开房门:「大半夜的蹦什么迪?!」');
    this.time.delayedCall(1000, () => this.endNight('disco'));
  }

  fmtClock() {
    const t = (23 * 60 + this.S.minute) % 1440;
    const h = Math.floor(t / 60), m = t % 60;
    const pre = h >= 23 ? '深夜' : (h < 5 ? '凌晨' : '清晨');
    return `${pre} ${h}:${String(m).padStart(2, '0')}`;
  }

  momState() {
    const m = this.S.minute;
    if (m < 90) return { mult: 0.6, name: '熟睡', icon: '😴' };
    if (m < 180) return { mult: 1.0, name: '浅睡', icon: '😪' };
    if (m < 270) return { mult: 0.6, name: '熟睡', icon: '😴' };
    if (m < 360) return { mult: 1.0, name: '浅睡', icon: '😪' };
    return { mult: 1.4, name: '快醒了', icon: '🫣' };
  }

  // ================= 妈妈起夜巡逻 =================
  startPatrol() {
    const S = this.S;
    S.patrol = true;
    this.patrolTripped = false;   // 每次起夜最多绊一次
    this.clearKickTimers();
    SFX.cough();
    this.ui().toast('❗ 妈妈坐起来了…要去卫生间!快躲好!');
    this.mom.setTexture('momAwake').setAngle(0);
    this.heartEv = this.time.addEvent({ delay: 900, loop: true, callback: () => SFX.heart() });

    // 生成往返路径
    const pts = [...PATROL_PATH];
    const back = [...PATROL_PATH].reverse().slice(1).concat([{ x: BED.momSlot.x, y: BED.momSlot.y }]);
    let prev = { x: this.mom.x, y: this.mom.y };
    const segs = [];
    const mk = (p, extra = {}) => {
      const d = Phaser.Math.Distance.Between(prev.x, prev.y, p.x, p.y);
      segs.push({ x: p.x, y: p.y, duration: Math.max(200, d / 0.09), ...extra });
      prev = p;
    };
    pts.forEach(p => mk(p));
    // 在卫生间待一会儿;如果女儿没冲马桶……她会发现的
    mk({ x: 472, y: 118 }, { duration: 4500, onComplete: () => {
      if (this.S.flags.unflushed && !this.S.over) {
        this.floatText(472, 88, '?!!', '#ff5b6e', 32);
        SFX.kickWarn();
        this.time.delayedCall(450, () => this.startFuryChase());
      } else {
        this.playFlush();
      }
    } });
    back.forEach(p => mk(p));

    this.tweens.chain({
      targets: this.mom,
      tweens: segs,
      onComplete: () => this.endPatrol(),
    });
  }

  endPatrol() {
    const S = this.S;
    if (S.over) return;
    if (this.heartEv) { this.heartEv.remove(false); this.heartEv = null; }
    this.mom.setTexture('mom').setPosition(BED.momSlot.x, BED.momSlot.y);
    S.patrol = false;
    this.ui().toast('😮‍💨 呼…妈妈躺回去了');
    if (S.sleeping) this.scheduleKick();
  }

  // ================= 暴怒追逐 =================
  startChase() {
    const S = this.S;
    if (S.chase || S.over) return;
    // 打断巡逻(巡逻中被撞见也会进入暴怒)
    if (S.patrol) {
      this.tweens.killTweensOf(this.mom);
      if (this.heartEv) { this.heartEv.remove(false); this.heartEv = null; }
      S.patrol = false;
    }
    S.chase = true; S.chasePhase = 'hunt'; S.wake = 100;
    this.clearKickTimers();
    if (S.sleeping) {   // 在床上被吵醒警报吓到:滚下床开跑
      S.sleeping = false;
      this.player.setTexture('girl').setPosition(BED.matSlot.x, BED.matSlot.y).setDepth(10);
      this.player.body.enable = true;
    }
    this.lastSeen = { x: this.player.x, y: this.player.y };
    this.lastSeenAt = this.time.now;
    this.momPath = null; this.momPathGoal = null; this.knockToastShown = false; this.breakingIn = false;
    this.mom.setTexture('momAwake').setAngle(0);
    this.floatText(this.mom.x, this.mom.y - 44, S.fury ? '🔥💢🔥' : '💢💢', '#ff5b6e', 32);
    this.playChaseBgm();
    this.vibrate(300);
    this.ui().toast(S.fury
      ? '🔥 喷火模式:比你跑步还快!只有躲起来才能活!'
      : '😡 妈妈暴怒了!!快跑,或者躲起来!爸爸房间是安全的');
  }

  // ================= 喷火暴走(起夜发现马桶没冲)=================
  startFuryChase() {
    const S = this.S;
    if (S.over || S.chase) return;
    S.flags.unflushed = false;              // 罪证已被发现,消耗掉
    // 巡逻状态直接切暴走
    this.tweens.killTweensOf(this.mom);
    if (this.heartEv) { this.heartEv.remove(false); this.heartEv = null; }
    S.patrol = false;
    S.fury = true;
    this.furyEndAt = this.time.now + CFG.FURY_DURATION;
    this.lastFireAt = 0;
    this.startChase();
    this.mom.setTint(0xff8855);             // 烧红了
    this.dadFlee();                          // 爸爸看势不妙,弃门而逃
    this.ui().toast('🔥🔥 妈妈发现马桶没冲!彻底暴走!!');
  }

  chaseSpeed() { return this.S.fury ? CFG.FURY_SPEED : CFG.CHASE_HUNT_SPEED; }
  giveupMs() { return this.S.fury ? CFG.FURY_GIVEUP : CFG.CHASE_GIVEUP; }

  // 喷火动画:沿面朝方向吐火
  breatheFire(now) {
    if (now - this.lastFireAt < 220) return;
    this.lastFireAt = now;
    const fx = this.mom.x + Math.cos(this.momFacing) * 34 + Phaser.Math.Between(-8, 8);
    const fy = this.mom.y + Math.sin(this.momFacing) * 34 + Phaser.Math.Between(-8, 8);
    const t = this.add.text(fx, fy, '🔥', { fontSize: `${Phaser.Math.Between(18, 30)}px` })
      .setOrigin(0.5).setDepth(34);
    this.tweens.add({
      targets: t,
      x: fx + Math.cos(this.momFacing) * 48, y: fy + Math.sin(this.momFacing) * 48,
      alpha: 0, scale: 1.6, duration: 420,
      onComplete: () => t.destroy(),
    });
  }

  // ---- 爸爸的藏身点记忆(localStorage,跨晚持久) ----
  loadDadMem() {
    try {
      const o = JSON.parse(localStorage.getItem('mam_dadmem_v1') || '{}');
      return { wardrobe: o.wardrobe | 0, couch: o.couch | 0 };
    } catch (e) { return { wardrobe: 0, couch: 0 }; }
  }
  saveDadMem() {
    try { localStorage.setItem('mam_dadmem_v1', JSON.stringify(this.dadMem)); } catch (e) { /* ignore */ }
  }

  // ---- 爸爸逃命三部曲:flee 逃 → hidden 躲 → (被抓 beaten / 平安归位) ----
  dadFlee() {
    const spots = { wardrobe: { x: 335, y: 92 }, couch: { x: 150, y: 416 } };
    const all = Object.keys(spots);
    const distToMom = k => Phaser.Math.Distance.Between(spots[k].x, spots[k].y, this.mom.x, this.mom.y);
    // 候选:没被放弃(连续被抓 < 阈值)且没被女儿占;实在没得选就将就
    let pool = all.filter(s => s !== this.playerHideSpot && (this.dadMem[s] || 0) < CFG.DAD_ABANDON_AT);
    if (!pool.length) pool = all.filter(s => s !== this.playerHideSpot);
    if (!pool.length) pool = all;
    // 逃向离妈妈最远的候选——真正地逃跑,而不是撞向妈妈
    const pick = pool.sort((a, b) => distToMom(b) - distToMom(a))[0];
    this.dadHideSpot = pick;
    this.dadState = 'flee';
    this.dadBlocking = false;
    this.tweens.killTweensOf(this.dad);
    this.dadPath = this.navPath(this.dad.x, this.dad.y, this.nearestNav(spots[pick].x, spots[pick].y));
    this.dadPath.push(spots[pick]);
    // 如果因为另一处被抓怕了而改躲这里,借台词把记忆讲出来
    const other = all.find(s => s !== pick);
    const switched = other && (this.dadMem[other] || 0) >= CFG.DAD_ABANDON_AT;
    this.ui().toast(switched
      ? `爸爸夺门而逃:「${DAD_HIDE_NAMES[other]}被抓怕了,躲${DAD_HIDE_NAMES[pick]}!」😭`
      : '爸爸夺门而逃:「我什么都不知道啊——!」😭');
  }

  // 爸爸沿导航路径移动(逃命 flee / 挨打后回房 return),两者都不穿墙
  updateDad(dt) {
    const st = this.dadState;
    if ((st !== 'flee' && st !== 'return') || !this.dadPath || !this.dadPath.length) return;
    const head = this.dadPath[0], dad = this.dad;
    const dx = head.x - dad.x, dy = head.y - dad.y;
    const d = Math.hypot(dx, dy);
    const speed = st === 'flee' ? CFG.DAD_FLEE_SPEED : CFG.CHASE_RETURN_SPEED;
    if (d > 1) {
      const mv = Math.min(speed * dt, d);
      dad.x += dx / d * mv; dad.y += dy / d * mv;
    }
    if (d < 8) this.dadPath.shift();
    if (!this.dadPath.length) {
      if (st === 'flee') {
        this.dadState = 'hidden';
        dad.setAlpha(0.4);
      } else {   // return:到床,恢复常态
        this.dadState = 'bed';
        this.dadHideSpot = null;
        dad.setAlpha(1).setAngle(0);
        this.floatText(dad.x, dad.y - 34, '😪', '#a7c7eb', 20);
      }
    }
  }

  // 爸爸在明处被逮到:代女受过,追逐就此结束
  dadBeaten() {
    const S = this.S;
    if (S.chasePhase === 'beaten' || S.over) return;
    S.chasePhase = 'beaten';
    this.dadState = 'beaten';
    this.momPath = null;
    // 记忆:这个藏身点(他逃向的目标)又被连续抓到一次
    const spot = this.dadHideSpot;
    let abandoned = false;
    if (spot) {
      this.dadMem[spot] = (this.dadMem[spot] || 0) + 1;
      this.saveDadMem();
      abandoned = this.dadMem[spot] >= CFG.DAD_ABANDON_AT;
    }
    SFX.hurt(); this.vibrate(300);
    this.cameras.main.shake(300, 0.012);
    this.dad.setAngle(90);
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 320, () => {
        if (S.over) return;
        SFX.knock();
        this.floatText(this.dad.x + Phaser.Math.Between(-18, 18), this.dad.y - 26,
          Phaser.Utils.Array.GetRandom(['💥', '👊', '⭐']), '#ff8899', 26);
      });
    }
    this.ui().toast('妈妈逮住了爸爸!「马桶!是!谁!没!冲?!」');
    this.time.delayedCall(1100, () => {
      if (S.over) return;
      this.ui().toast(abandoned
        ? `爸爸:${DAD_HIDE_NAMES[spot]}被抓了${CFG.DAD_ABANDON_AT}次,我再也不躲那儿了!😤`
        : '爸爸:是我是我都是我!😭(女儿,快趁机苟住)');
    });
    this.time.delayedCall(2000, () => {
      if (S.over) return;
      S.chasePhase = 'hunt';   // 解除定格,进入回房流程
      this.beginReturn('😮‍💨 妈妈打完收工,拧着爸爸的耳朵回去了…');
      this.dadRecover(2600);
    });
  }

  dadRecover(delay = 0) {
    this.time.delayedCall(delay, () => {
      if (this.S.over) return;
      this.tweens.killTweensOf(this.dad);
      this.dad.setAlpha(1).setAngle(0);
      this.floatText(this.dad.x, this.dad.y - 34, '😵', '#a7c7eb', 20);
      // 从当前位置(藏身点/挨打处)沿导航图寻路走回自己房间,不穿墙
      this.dadPath = this.navPath(this.dad.x, this.dad.y, 'dadC');
      this.dadPath.push({ x: 700, y: 110 });
      this.dadState = 'return';
    });
  }

  // 追逐 BGM:优先真实音频(sound/追逐.mp3),没加载到就用合成音效
  playChaseBgm() {
    if (this.cache.audio.exists('bgm_chase')) {
      this.chaseBgm = this.sound.get('bgm_chase') || this.sound.add('bgm_chase', { loop: true, volume: 0.55 });
      if (!this.chaseBgm.isPlaying) this.chaseBgm.play();
    } else {
      SFX.startChase();
    }
  }

  stopChaseBgm() {
    const bgm = this.sound.get('bgm_chase');
    if (bgm && bgm.isPlaying) bgm.stop();
    SFX.stopChase();
  }

  // 冲马桶音效:优先真实音频,没有就用合成白噪音
  playFlush() {
    if (this.cache.audio.exists('sfx_flush')) this.sound.play('sfx_flush', { volume: 0.8 });
    else SFX.flush();
  }

  // 猫叫:优先真实音频
  playMeow() {
    if (this.cache.audio.exists('sfx_meow')) this.sound.play('sfx_meow', { volume: 0.7 });
    else SFX.meow();
  }

  updateChase(dt, now) {
    const S = this.S, mom = this.mom, p = this.player;
    this.drawCone();

    // ---- 消气回房 ----
    if (S.chasePhase === 'return') {
      if (this.followMomPath(CFG.CHASE_RETURN_SPEED, dt)) this.finishChase();
      return;
    }
    // ---- 正在教训爸爸:画面定格,后续由 dadBeaten 的定时器推进 ----
    if (S.chasePhase === 'beaten') return;

    // ---- 喷火暴走的每帧逻辑 ----
    if (S.fury) {
      this.breatheFire(now);
      if (now > this.furyEndAt) {
        return this.beginReturn('🔥 妈妈的怒火烧完了…嘟囔着回去睡了');
      }
      // 爸爸在明处被追上:代女受过
      if (this.dadState === 'flee' &&
          Phaser.Math.Distance.Between(mom.x, mom.y, this.dad.x, this.dad.y) < CFG.CATCH_DIST + 8) {
        return this.dadBeaten();
      }
    }

    // ---- 视野侦测 ----
    const see = this.canSee();
    if (see) {
      this.lastSeen = { x: p.x, y: p.y };
      this.lastSeenAt = now;
      if (S.chasePhase === 'wander') { S.chasePhase = 'hunt'; this.floatText(mom.x, mom.y - 40, '❗', '#ff5b6e', 26); }
    }

    // ---- 玩家躲进爸爸房间(喷火暴走时爸爸跑了,这里不再安全!)----
    const pRoom = this.whichRoom(p.x, p.y);
    if (pRoom === 'dad' && !S.fury) {
      // 爸爸在蹦迪:没人堵门,妈妈循声直接破门,一锅端!
      if (S.dance) {
        if (this.momPathGoal !== 'dadKnock') this.setMomPath('dadKnock');
        if (this.followMomPath(this.chaseSpeed(), dt)) this.momBreakIn();
        return;
      }
      this.dadBlockDoor();   // 爸爸下床,堵到门口
      if (S.chasePhase !== 'knock') {
        if (this.momPathGoal !== 'dadKnock') this.setMomPath('dadKnock');
        if (this.followMomPath(this.chaseSpeed(), dt)) {
          S.chasePhase = 'knock'; this.knockT0 = now; this.lastKnock = 0;
        }
      } else {
        if (S.dance) return this.momBreakIn();   // 敲门敲一半爸爸开始蹦迪:直接破门
        if (now - this.lastKnock > 750) {
          this.lastKnock = now;
          SFX.knock();
          this.cameras.main.shake(120, 0.006);
          this.floatText(736, 268, '砰!', '#ff8899', 22);
        }
        if (!this.knockToastShown) {
          this.knockToastShown = true;
          this.ui().toast('妈妈:「开门!」 爸爸(顶着门):「嘘…孩子在我这儿睡呢」');
        }
        if (now - this.knockT0 > CFG.KNOCK_MS) this.beginReturn('😮‍💨 妈妈瞪了一眼门,悻悻地回去了…');
      }
      return;
    }
    if (S.chasePhase === 'knock') S.chasePhase = 'hunt'; // 人跑出来了,接着追

    // ---- 抓捕判定 ----
    if (!S.hidden && Phaser.Math.Distance.Between(mom.x, mom.y, p.x, p.y) < CFG.CATCH_DIST) {
      return this.endNight('caught');
    }

    // ---- 追 / 搜 ----
    if (S.chasePhase === 'hunt') {
      let tgt = see ? p : this.lastSeen;
      // 暴走时谁在明处抓谁(更近者优先)——爸爸可以当"肉盾"
      if (S.fury && this.dadState === 'flee' && this.canSeeAt(this.dad.x, this.dad.y)) {
        const dDad = Phaser.Math.Distance.Between(mom.x, mom.y, this.dad.x, this.dad.y);
        const dTgt = Phaser.Math.Distance.Between(mom.x, mom.y, tgt.x, tgt.y);
        if (!see || dDad < dTgt) { tgt = this.dad; this.lastSeenAt = now; }
      }
      if (this.hasLOS(mom.x, mom.y, tgt.x, tgt.y)) {
        // 看得见目标(或目标点):直线冲
        this.momPathGoal = null;
        const remain = this.momStepToward(tgt.x, tgt.y, this.chaseSpeed(), dt);
        if (!see && tgt !== this.dad && remain < 12) {   // 冲到最后目击点没人:四处游荡搜索
          S.chasePhase = 'wander';
          this.setMomPath(this.randomNavId());
        }
      } else {
        // 隔着墙:沿导航图绕过去
        const goal = this.nearestNav(tgt.x, tgt.y);
        if (this.momPathGoal !== goal || !this.momPath || !this.momPath.length) this.setMomPath(goal);
        this.followMomPath(this.chaseSpeed(), dt);
      }
    } else if (S.chasePhase === 'wander') {
      if (this.followMomPath(CFG.CHASE_WANDER_SPEED, dt)) this.setMomPath(this.randomNavId());
    }

    // ---- 找不到人,放弃 ----
    if (now - this.lastSeenAt > this.giveupMs()) {
      this.beginReturn('😮‍💨 妈妈找累了,嘟囔着回去睡了…');
    }
  }

  beginReturn(msg) {
    const S = this.S;
    if (S.chasePhase === 'return') return;
    S.chasePhase = 'return';
    S.escapes++;
    this.stopChaseBgm();
    this.coneG.clear();
    this.mom.clearTint();
    this.ui().toast(msg);
    this.setMomPath('momC', true);
    // 妈妈走了,爸爸回床上继续睡
    if (this.dadBlocking) this.time.delayedCall(1800, () => this.dadBackToBed());
    if (this.dadState === 'flee' || this.dadState === 'hidden') {
      // 爸爸在藏身点成功躲过(没被抓)——连续被抓计数清零
      if (this.dadHideSpot && (this.dadMem[this.dadHideSpot] || 0) > 0) {
        this.dadMem[this.dadHideSpot] = 0;
        this.saveDadMem();
      }
      this.dadRecover(1800);
    }
  }

  // ---- 爸爸堵门 / 回床 ----
  dadBlockDoor() {
    if (this.dadBlocking) return;
    this.dadBlocking = true;
    this.tweens.killTweensOf(this.dad);
    this.tweens.add({ targets: this.dad, x: 736, y: 226, duration: 500, ease: 'Quad.Out' });
    this.floatText(this.dad.x, this.dad.y - 36, '💪', '#a7c7eb', 26);
    this.ui().toast('爸爸一个鲤鱼打挺下了床:「交给我!」');
  }

  dadBackToBed() {
    if (!this.dadBlocking) return;
    this.dadBlocking = false;
    this.tweens.killTweensOf(this.dad);
    this.tweens.add({ targets: this.dad, x: 700, y: 110, duration: 700, ease: 'Quad.InOut' });
    this.floatText(736, 220, '😪', '#a7c7eb', 20);
  }

  finishChase() {
    const S = this.S;
    S.chase = false; S.chasePhase = null; S.fury = false;
    S.wake = CFG.WAKE_AFTER_CHASE;
    S.flags.wakeWarned = false;
    if (this.dadBlocking) this.dadBackToBed();
    this.mom.clearTint();
    this.mom.setTexture('mom').setPosition(BED.momSlot.x, BED.momSlot.y);
    this.momPath = null; this.momPathGoal = null;
    this.coneG.clear();
    this.ui().toast('🌙 妈妈重新睡着了…(吵醒值重置,小心点)');
  }

  // ---- 妈妈的视野:扇形 + 墙体遮挡 ----
  canSee() {
    return !this.S.hidden && this.canSeeAt(this.player.x, this.player.y);
  }

  canSeeAt(x, y) {
    const mom = this.mom;
    const d = Phaser.Math.Distance.Between(mom.x, mom.y, x, y);
    if (d > CFG.VISION_LEN) return false;
    if (d > 55) {   // 55px 内靠听觉,无视角度
      const ang = Phaser.Math.Angle.Between(mom.x, mom.y, x, y);
      if (Math.abs(Phaser.Math.Angle.Wrap(ang - this.momFacing)) > CFG.VISION_HALF) return false;
    }
    return this.hasLOS(mom.x, mom.y, x, y);
  }

  hasLOS(x1, y1, x2, y2) {
    const d = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    const steps = Math.max(1, Math.ceil(d / 16));
    for (let i = 1; i < steps; i++) {
      const px = x1 + (x2 - x1) * i / steps, py = y1 + (y2 - y1) * i / steps;
      for (const w of WALLS) {
        if (px >= w.x && px <= w.x + w.w && py >= w.y && py <= w.y + w.h) return false;
      }
    }
    return true;
  }

  drawCone() {
    const S = this.S;
    this.coneG.clear();
    if (!S.chase || S.chasePhase === 'return' || S.chasePhase === 'beaten') return;
    this.coneG.fillStyle(S.fury ? 0xff6600 : 0xff2244, S.fury ? 0.18 : 0.13);
    this.coneG.slice(this.mom.x, this.mom.y, CFG.VISION_LEN,
      this.momFacing - CFG.VISION_HALF, this.momFacing + CFG.VISION_HALF, false);
    this.coneG.fillPath();
  }

  // ---- 导航图寻路(BFS)----
  momStepToward(x, y, speed, dt) {
    const mom = this.mom;
    const dx = x - mom.x, dy = y - mom.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return 0;
    const mv = Math.min(speed * dt, d);
    mom.x += dx / d * mv; mom.y += dy / d * mv;
    this.momFacing = Math.atan2(dy, dx);
    return d - mv;
  }

  followMomPath(speed, dt) {
    if (!this.momPath || !this.momPath.length) return true;
    const head = this.momPath[0];
    if (this.momStepToward(head.x, head.y, speed, dt) < 8) this.momPath.shift();
    return this.momPath.length === 0;
  }

  nearestNav(x, y) {
    let best = null, bd = 1e9;
    for (const [id, n] of Object.entries(NAV.nodes)) {
      const d = Phaser.Math.Distance.Between(x, y, n.x, n.y);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  // 通用寻路:从任意点沿导航图走到目标节点(妈妈和逃命的爸爸共用)
  navPath(fromX, fromY, goalId) {
    const nodes = NAV.nodes;
    const adj = {};
    for (const [a, b] of NAV.edges) {
      (adj[a] = adj[a] || []).push(b);
      (adj[b] = adj[b] || []).push(a);
    }
    const start = this.nearestNav(fromX, fromY);
    // BFS
    const prev = { [start]: null };
    const q = [start];
    while (q.length) {
      const cur = q.shift();
      if (cur === goalId) break;
      for (const nb of (adj[cur] || [])) {
        if (!(nb in prev)) { prev[nb] = cur; q.push(nb); }
      }
    }
    const path = [];
    let cur = goalId in prev ? goalId : start;
    while (cur) { path.unshift({ x: nodes[cur].x, y: nodes[cur].y }); cur = prev[cur]; }
    return path;
  }

  setMomPath(goalId, appendBed = false) {
    const path = this.navPath(this.mom.x, this.mom.y, goalId);
    if (appendBed) path.push({ x: BED.momSlot.x, y: BED.momSlot.y });
    this.momPath = path;
    this.momPathGoal = goalId;
  }

  randomNavId() {
    // 游荡不进爸爸房间(dadKnock/dadC 排除)
    const pool = Object.keys(NAV.nodes).filter(id =>
      id !== 'dadKnock' && id !== 'dadC' && id !== this.momPathGoal);
    return Phaser.Utils.Array.GetRandom(pool);
  }

  // ================= 结算 =================
  endNight(reason) {
    const S = this.S;
    if (S.over) return;
    S.over = true; S.reason = reason;
    this.player.body.setVelocity(0, 0);
    this.clearKickTimers();
    this.stopChaseBgm();
    this.stopDance();
    this.coneG.clear();
    this.mom.clearTint();
    if (this.dadCry) this.dadCry.setVisible(false);
    if (this.heartEv) { this.heartEv.remove(false); this.heartEv = null; }
    if (reason === 'caught') {
      this.mom.setTexture('momAwake');
      this.floatText(this.mom.x, this.mom.y - 40, '💢', '#ff5b6e', 34);
      SFX.hurt();
    }
    if (reason === 'ko') SFX.hurt();
    if (reason === 'morning') {
      SFX.star();
      this.add.rectangle(480, 336, 960, 672, 0xffe9b0, 0.18).setDepth(45).setScrollFactor(0);
    }
    this.ui().showEnd(reason);
    this.scene.pause();
  }

  // ================= 工具 =================
  whichRoom(x, y) {
    for (const [k, r] of Object.entries(ROOMS)) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return k;
    }
    return 'hall';
  }

  floatText(x, y, str, color = '#ffffff', size = 22) {
    const t = this.add.text(x, y, str, {
      fontSize: `${size}px`, color, fontFamily: 'sans-serif', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 950, onComplete: () => t.destroy() });
  }

  questLines() {
    const S = this.S;
    // 安眠计划主线:剧情逐步推进
    let plan;
    if (!S.flags.teddyFound)      plan = '① 找到小熊(翻沙发缝)';
    else if (!S.plan.teddy)       plan = '① 把小熊塞给熟睡的妈妈';
    else if (!S.flags.momMilk)    plan = '② 用微波炉给妈妈热牛奶';
    else if (!S.plan.milk)        plan = '② 把牛奶放到妈妈床头';
    else if (!S.flags.blanket)    plan = '③ 拿客厅角落篮子里的毯子';
    else if (!S.plan.blanket)     plan = '③ 给妈妈盖上毯子';
    else                          plan = '完成!无影脚已封印 👑';
    return [
      { t: `🌙 安眠计划:${plan}`, done: S.plan.blanket },
      { t: `🧸 捡玩具 ${S.flags.toys}/${TOYS.length}(妈妈起夜会踩到)`, done: S.flags.toys >= TOYS.length },
      { t: S.flags.catFood ? '🐟 去喂猫(客厅)' : '🐱 喂猫(猫粮在🧊冰箱)', done: S.flags.catFed },
      { t: '🥛 给自己热杯牛奶', done: S.flags.milkUsed },
    ];
  }

  // 综合得分 = 睡眠 + 任务奖励(不再只看睡觉!)
  nightScore() {
    const S = this.S;
    let bonus = 0;
    if (S.plan.teddy) bonus += 8;
    if (S.plan.milk) bonus += 8;
    if (S.plan.blanket) bonus += 10;
    if (S.flags.catFed) bonus += 4;
    if (S.flags.toys >= TOYS.length) bonus += 6;
    if (S.flags.teddyFound) bonus += 2;
    return { total: Math.floor(S.sleep + bonus), bonus };
  }

  vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
  }
}
