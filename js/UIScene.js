// ============ HUD / 触屏操控 / 弹窗 ============
class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }
  G() { return this.scene.get('Game'); }

  create() {
    // 高清适配:相机放大 DPR 倍,HUD 逻辑坐标仍按 960x540 布局
    this.cameras.main.setZoom(CFG.DPR).centerOn(480, 270);
    this.joy = { x: 0, y: 0 };
    this.joyState = null;
    this.modalOpen = false;
    this.toastQueue = []; this.toastBusy = false;
    this.input.addPointer(2);

    const T = (x, y, size, origin = [0, 0]) => this.add.text(x, y, '', {
      fontSize: `${size}px`, color: '#ffffff', fontFamily: 'sans-serif',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(...origin).setDepth(10);

    // ---- 左上:时钟 + 任务清单 ----
    this.clockText = T(14, 10, 20);
    this.questTexts = [0, 1, 2, 3].map(i => T(14, 46 + i * 20, 13));

    // ---- 顶部中央:吵醒条 / 睡眠条 ----
    this.bars = this.add.graphics().setDepth(9);
    this.momFace = T(366, 20, 16, [1, 0.5]);
    this.sleepIcon = T(366, 42, 14, [1, 0.5]); this.sleepIcon.setText('😴');
    this.stateText = T(586, 20, 12, [0, 0.5]);
    this.sleepPct = T(586, 42, 12, [0, 0.5]);

    // ---- 右上:资源 ----
    this.rightText = this.add.text(946, 8, '', {
      fontSize: '16px', color: '#ffffff', align: 'right', lineSpacing: 6,
      fontFamily: 'sans-serif', stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(10);

    // ---- 巡逻警报 ----
    this.vig = this.add.graphics().setDepth(15);
    this.patrolText = T(480, 62, 17, [0.5, 0.5]);
    this.patrolText.setColor('#ff8899').setText('❗ 妈妈起来了,快躲好!').setVisible(false);

    // ---- 蓄力进度条 ----
    this.channelLabel = T(480, 276, 15, [0.5, 0.5]);

    // ---- 虚拟摇杆(固定位置,常显,大触发区)----
    // 注意:pointer 坐标是画布物理坐标(逻辑坐标×DPR),这里统一除回逻辑坐标
    this.joyBase = { x: 140, y: 398 };
    this.joyR = 70;    // 摇杆头最大行程
    this.joyG = this.add.graphics().setDepth(20);
    const setJoy = p => {
      let dx = p.x / CFG.DPR - this.joyBase.x, dy = p.y / CFG.DPR - this.joyBase.y;
      const d = Math.hypot(dx, dy);
      if (d > this.joyR) { dx *= this.joyR / d; dy *= this.joyR / d; }
      this.joy = { x: dx / this.joyR, y: dy / this.joyR };
    };
    this.input.on('pointerdown', p => {
      SFX.unlock();
      if (this.modalOpen) return;
      const px = p.x / CFG.DPR, py = p.y / CFG.DPR;
      // 左下大片区域都算摇杆(按到哪都从固定摇杆中心取向量)
      if (px < 470 && py > 225) { this.joyState = { id: p.id }; setJoy(p); }
    });
    this.input.on('pointermove', p => {
      if (this.joyState && p.id === this.joyState.id) setJoy(p);
    });
    const joyEnd = p => {
      if (this.joyState && p.id === this.joyState.id) {
        this.joyState = null; this.joy = { x: 0, y: 0 };
      }
    };
    this.input.on('pointerup', joyEnd);
    this.input.on('pointerupoutside', joyEnd);

    // ---- 行动按钮 ----
    this.btn = this.add.circle(866, 452, 56, 0x8a5fd6, 0.92).setDepth(21).setInteractive();
    this.btn.on('pointerdown', () => {
      if (this.modalOpen) return;
      this.btn.setScale(0.92);
      const g = this.G();
      if (g && g.S) g.doAction();
    });
    this.btn.on('pointerup', () => this.btn.setScale(1));
    this.btnLabel = this.add.text(866, 452, '', {
      fontSize: '15px', color: '#fff', align: 'center', fontFamily: 'sans-serif',
      wordWrap: { width: 94 },
    }).setOrigin(0.5).setDepth(22);

    // ---- 起床按钮(仅睡觉时) ----
    this.wakeBtn = this.add.circle(866, 330, 38, 0x44496e, 0.92).setDepth(21).setInteractive();
    this.wakeBtn.on('pointerdown', () => {
      if (this.modalOpen) return;
      const g = this.G();
      if (g && g.S && g.S.sleeping) g.leaveBed();
    });
    this.wakeLabel = this.add.text(866, 330, '起床', { fontSize: '15px', color: '#fff' })
      .setOrigin(0.5).setDepth(22);

    // ---- 连击提示 ----
    this.comboText = T(866, 384, 14, [0.5, 0.5]);
    this.comboText.setColor('#ffd166');

    // ---- 全屏按钮(iOS 网页不支持全屏 API,自动隐藏)----
    if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
      this.fsBtn = this.add.circle(934, 100, 20, 0x44496e, 0.85).setDepth(21).setInteractive();
      this.add.text(934, 100, '⛶', { fontSize: '18px', color: '#fff' }).setOrigin(0.5).setDepth(22);
      this.fsBtn.on('pointerdown', () => {
        try {
          if (this.scale.isFullscreen) this.scale.stopFullscreen();
          else this.scale.startFullscreen();
        } catch (e) { /* 某些浏览器需要手势链,失败就算了 */ }
      });
    }
  }

  // ================= 每帧刷新 =================
  update(time) {
    const G = this.G();
    if (!G || !G.S) return;
    const S = G.S;

    this.clockText.setText(`🕐 ${G.fmtClock()}`);

    const st = G.momState();
    if (S.chase) {
      this.momFace.setText(S.fury ? '🔥' : '😡');
      this.stateText.setText(S.chasePhase === 'return' ? '消气回房中…'
        : (S.fury ? '喷火暴走!!!' : '暴怒追击!!'));
    } else {
      this.momFace.setText(S.wake < 40 ? st.icon : (S.wake < 70 ? '😟' : '😡'));
      this.stateText.setText(`妈妈·${st.name}`);
    }
    this.sleepPct.setText(`${Math.floor(S.sleep)}%`);

    // 条形图
    const bars = this.bars;
    bars.clear();
    const bar = (x, y, w, h, frac, color) => {
      bars.fillStyle(0x000000, 0.45);
      bars.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);
      if (frac > 0.01) {
        bars.fillStyle(color, 1);
        bars.fillRoundedRect(x, y, Math.max(6, w * frac), h, 3);
      }
    };
    const wakeColor = S.wake < 40 ? 0xf4a261 : (S.wake < 70 ? 0xf07167 : 0xef2d56);
    bar(376, 14, 200, 12, S.wake / 100, wakeColor);
    bar(376, 36, 200, 12, S.sleep / 100, 0x9d7bff);

    // 右上资源
    const buffs = [];
    if (S.buffs.shield > 0) buffs.push(`🛡x${S.buffs.shield}`);
    if (S.buffs.slippers) buffs.push('🩴');
    if (this.time.now < S.buffs.milkUntil) buffs.push('🥛');
    if (this.time.now < S.buffs.iceUntil) buffs.push('🍦');
    // 随身携带的任务道具
    if (S.flags.catFood && !S.flags.catFed) buffs.push('🐟');
    if (S.flags.momMilk && !S.plan.milk) buffs.push('🍼');
    if (S.flags.blanket && !S.plan.blanket) buffs.push('🧺');
    if (S.flags.teddyFound && !S.plan.teddy) buffs.push('🧸');
    if (S.bladder >= 55) buffs.push(`💧${Math.floor(S.bladder)}%`);
    this.rightText.setText(`⭐ ${S.stars}    ❤ ${Math.max(0, Math.ceil(S.hp))}\n${buffs.join('  ')}`);

    // 任务
    G.questLines().forEach((q, i) => {
      const t = this.questTexts[i];
      t.setText((q.done ? '✅ ' : '· ') + q.t);
      t.setColor(q.done ? '#7bed9f' : '#c9c4de');
    });

    // 蓄力条
    if (G.channel) {
      const frac = Phaser.Math.Clamp((this.time.now - G.channel.t0) / G.channel.dur, 0, 1);
      this.channelLabel.setText(G.channel.label);
      bar(380, 292, 200, 14, frac, 0x5ec8d8);
    } else {
      this.channelLabel.setText('');
    }

    // 巡逻 / 暴怒警报
    this.vig.clear();
    const chasing = S.chase && S.chasePhase !== 'return' && !S.over;
    this.patrolText.setVisible((!!S.patrol || chasing) && !S.over);
    if (chasing) {
      // 整个环境闪红光(喷火暴走时是橙色火光,更急促)
      const speed = S.fury ? 70 : 110;
      const color = S.fury ? 0xff5500 : 0xff0022;
      const a = 0.28 + 0.22 * Math.sin(time / speed);
      this.vig.fillStyle(color, (S.fury ? 0.07 : 0.05) + 0.05 * Math.sin(time / speed));
      this.vig.fillRect(0, 0, 960, 540);
      this.vig.lineStyle(16, color, a);
      this.vig.strokeRect(8, 8, 944, 524);
      this.patrolText.setText(S.fury
        ? '🔥 妈妈在喷火!只有躲起来才行!爸爸也在逃命!'
        : '😡 妈妈暴怒了!快跑!爸爸房间是安全的 🚪');
    } else if (S.patrol && !S.over) {
      const a = 0.22 + 0.18 * Math.sin(time / 140);
      this.vig.lineStyle(12, 0xff3355, a);
      this.vig.strokeRect(6, 6, 948, 528);
      this.patrolText.setText('❗ 妈妈起来了,快躲好!');
    }

    // 行动按钮状态
    let label = '·', active = false, color = 0x8a5fd6;
    if (S.over) {
      label = '';
    } else if (S.sleeping) {
      label = '🌀 躲!'; active = true; color = 0xef476f;
    } else if (S.hidden) {
      label = '👀 出来'; active = true;
    } else if (G.channel) {
      label = '⏳';
    } else if (G.near) {
      label = typeof G.near.label === 'function' ? G.near.label() : G.near.label;
      active = true;
    }
    this.btnLabel.setText(label);
    this.btn.setFillStyle(color, active ? 0.92 : 0.4);
    this.wakeBtn.setVisible(S.sleeping && !S.over);
    this.wakeLabel.setVisible(S.sleeping && !S.over);
    this.comboText.setText(S.sleeping && S.combo >= 2 ? `连躲 x${S.combo}` : '');

    // 摇杆(固定位置,常显;按住时高亮)
    this.joyG.clear();
    const jb = this.joyBase, jActive = !!this.joyState;
    this.joyG.fillStyle(0xffffff, jActive ? 0.13 : 0.06);
    this.joyG.fillCircle(jb.x, jb.y, 66);
    this.joyG.lineStyle(2, 0xffffff, jActive ? 0.3 : 0.14);
    this.joyG.strokeCircle(jb.x, jb.y, 66);
    this.joyG.fillStyle(0xffffff, jActive ? 0.4 : 0.18);
    this.joyG.fillCircle(jb.x + this.joy.x * 52, jb.y + this.joy.y * 52, 26);
  }

  // ================= 提示气泡 =================
  toast(msg) {
    this.toastQueue.push(msg);
    this.pumpToast();
  }
  pumpToast() {
    if (this.toastBusy || !this.toastQueue.length) return;
    this.toastBusy = true;
    const msg = this.toastQueue.shift();
    const t = this.add.text(480, 88, msg, {
      fontSize: '17px', color: '#ffffff', fontFamily: 'sans-serif',
      backgroundColor: 'rgba(22,18,44,0.88)', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(60).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: 94, duration: 160 });
    this.time.delayedCall(2100, () => {
      this.tweens.add({
        targets: t, alpha: 0, duration: 240,
        onComplete: () => { t.destroy(); this.toastBusy = false; this.pumpToast(); },
      });
    });
  }

  // ================= 通用按钮 =================
  makeBtn(x, y, w, h, label, cb, color = 0x8a5fd6) {
    const bt = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(color, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.fillStyle(0xffffff, 0.12); g.fillRoundedRect(-w / 2, -h / 2, w, h / 2.4, { tl: 12, tr: 12, bl: 0, br: 0 });
    const tx = this.add.text(0, 0, label, { fontSize: '17px', color: '#fff', fontFamily: 'sans-serif' }).setOrigin(0.5);
    bt.add([g, tx]);
    bt.setSize(w, h);
    bt.setInteractive({ useHandCursor: true });
    bt.on('pointerdown', () => bt.setScale(0.95));
    bt.on('pointerup', () => { bt.setScale(1); if (cb) cb(); });
    return bt;
  }

  panelBg(c, w, h) {
    const g = this.add.graphics();
    g.fillStyle(0x1c1a33, 0.97); g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    g.lineStyle(3, 0x8a5fd6, 0.8); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    c.add(g);
  }

  // ================= 选择弹窗 =================
  showChoice(title, desc, options) {
    this.modalOpen = true;
    const c = this.add.container(480, 270).setDepth(50);
    this.panelBg(c, 470, 220);
    c.add(this.add.text(0, -74, title, { fontSize: '22px', color: '#fff', fontFamily: 'sans-serif' }).setOrigin(0.5));
    c.add(this.add.text(0, -36, desc, {
      fontSize: '15px', color: '#c9c4de', align: 'center', fontFamily: 'sans-serif',
      wordWrap: { width: 420 },
    }).setOrigin(0.5));
    options.forEach((opt, i) => {
      const x = options.length === 1 ? 0 : (i === 0 ? -112 : 112);
      c.add(this.makeBtn(x, 52, 200, 56, opt.label, () => {
        c.destroy(); this.modalOpen = false;
        if (opt.cb) opt.cb();
      }, i === 0 ? 0x8a5fd6 : 0x44496e));
    });
  }

  // ================= 爸爸商店 =================
  openShop() {
    if (this.modalOpen) return;
    this.modalOpen = true;
    const G = this.G();
    const c = this.add.container(480, 270).setDepth(50);
    this.panelBg(c, 580, 400);
    c.add(this.add.text(0, -168, '🍦 爸爸的深夜小卖部', { fontSize: '24px', color: '#fff', fontFamily: 'sans-serif' }).setOrigin(0.5));
    const starT = this.add.text(0, -134, '', { fontSize: '16px', color: '#ffd166', fontFamily: 'sans-serif' }).setOrigin(0.5);
    c.add(starT);
    const refresh = () => starT.setText(`你有 ⭐ x ${G.S.stars}`);
    refresh();

    SHOP.forEach((it, i) => {
      const y = -92 + i * 58;
      c.add(this.add.text(-262, y - 10, `${it.name}   ${it.price}⭐`, {
        fontSize: '17px', color: '#fff', fontFamily: 'sans-serif',
      }).setOrigin(0, 0.5));
      c.add(this.add.text(-262, y + 12, it.desc, {
        fontSize: '12px', color: '#9c96b8', fontFamily: 'sans-serif',
      }).setOrigin(0, 0.5));
      c.add(this.makeBtn(212, y, 96, 44, '兑换', () => {
        const r = G.buyItem(it.id);
        this.toast(r.msg);
        refresh();
      }, 0x3f8f6b));
    });

    c.add(this.makeBtn(0, 158, 220, 50, '关门(轻轻地)🤫', () => {
      c.destroy(); this.modalOpen = false;
    }, 0x44496e));
  }

  // ================= 结算面板 =================
  showEnd(reason) {
    this.modalOpen = true;
    const G = this.G();
    const S = G.S;
    const e = ENDINGS[reason];
    const c = this.add.container(480, 270).setDepth(70);
    this.panelBg(c, 600, 430);
    const isWin = reason === 'morning' || reason === 'sleepfull';
    const title = (isWin && S.plan.blanket) ? '🌅 安眠之夜!' : e.title;
    c.add(this.add.text(0, -168, title, { fontSize: '34px', color: '#fff', fontFamily: 'sans-serif' }).setOrigin(0.5));

    const score = G.nightScore();
    if (isWin) {
      const g = GRADES.find(x => score.total >= x.min);
      c.add(this.add.text(0, -96, g.g, {
        fontSize: '68px', color: '#ffd166', fontFamily: 'sans-serif', stroke: '#000', strokeThickness: 5,
      }).setOrigin(0.5));
      const sub = reason === 'sleepfull' ? '睡眠值拉满,提前下班!剩下的夜晚是妈妈的 💤'
        : (S.plan.blanket ? '你治好了妈妈的无影脚,全家一觉到天亮 💤' : g.text);
      c.add(this.add.text(0, -36, sub, { fontSize: '18px', color: '#c9c4de', fontFamily: 'sans-serif' }).setOrigin(0.5));
    } else {
      const sub = (reason === 'caught' && S.fury)
        ? '「马桶!是!谁!没!冲?!」\n你在火光中被拎了起来……记住:上完要冲水。'
        : e.sub;
      c.add(this.add.text(0, -92, sub, {
        fontSize: '18px', color: '#c9c4de', align: 'center', fontFamily: 'sans-serif',
        wordWrap: { width: 520 },
      }).setOrigin(0.5));
    }

    const stats = [
      `🌙 综合得分 ${score.total}(睡眠 ${Math.floor(S.sleep)} + 任务 ${score.bonus})`,
      `🌀 躲开 ${S.dodges} 脚    🦵 挨了 ${S.kicks} 脚    ❤ 体力 ${Math.max(0, S.hp)}`,
      `⭐ 星星 ${S.stars}    🍦 冰激凌 ${S.ice}    🏃 逃过追击 ${S.escapes} 次`,
    ];
    c.add(this.add.text(0, 42, stats.join('\n'), {
      fontSize: '17px', color: '#fff', align: 'center', lineSpacing: 10, fontFamily: 'sans-serif',
    }).setOrigin(0.5));

    c.add(this.makeBtn(0, 156, 250, 58, '🌙 再来一晚', () => {
      const g = this.scene.get('Game');
      g.scene.resume();
      g.scene.restart();
      this.scene.restart();
    }));
  }
}
