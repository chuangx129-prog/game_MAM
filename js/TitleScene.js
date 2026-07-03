// ============ 标题画面 ============
class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  preload() {
    // 真实音频从 sound/bgm-data.js 的 base64 解码(file:// 直开也能播放)
    // 解码失败或不支持 WebAudio 时,游戏自动回退到合成音效
    try {
      if (window.AUDIO_B64 && this.sound.decodeAudio) {
        for (const [key, b64] of Object.entries(window.AUDIO_B64)) {
          if (!this.cache.audio.exists(key)) this.sound.decodeAudio(key, b64);
        }
      }
    } catch (e) { console.warn('音频解码失败,将使用合成音效:', e); }
  }

  create() {
    // 高清适配:相机放大 DPR 倍,逻辑坐标仍按 960x540 布局
    this.cameras.main.setZoom(CFG.DPR).centerOn(480, 270);
    if (!this.textures.exists('girl')) generateArt(this);

    this.add.rectangle(480, 270, 960, 540, 0x141228);
    // 星星点点的夜空
    for (let i = 0; i < 40; i++) {
      const s = this.add.circle(
        Phaser.Math.Between(10, 950), Phaser.Math.Between(10, 530),
        Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.15, 0.6));
      this.tweens.add({
        targets: s, alpha: 0.1, duration: Phaser.Math.Between(800, 2200),
        yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 1500),
      });
    }
    this.add.text(480, 60, '🌙', { fontSize: '44px' }).setOrigin(0.5);

    this.add.text(480, 140, '妈妈的无影脚', {
      fontSize: '56px', color: '#ffd166', fontFamily: 'sans-serif',
      stroke: '#4a2c5e', strokeThickness: 10,
    }).setOrigin(0.5);
    this.add.text(480, 196, '—— 女儿的求生之夜 ——', {
      fontSize: '18px', color: '#c9c4de', fontFamily: 'sans-serif',
    }).setOrigin(0.5);

    // 小剧场:妈妈踢,女儿飞
    const mom = this.add.image(420, 292, 'mom');
    const leg = this.add.text(460, 292, '🦵', { fontSize: '30px' }).setOrigin(0.5);
    const girl = this.add.image(540, 292, 'girl');
    this.tweens.add({
      targets: leg, x: 500, duration: 300, yoyo: true, repeat: -1, repeatDelay: 1400, ease: 'Quad.In',
    });
    this.tweens.add({
      targets: girl, x: 580, angle: 30, duration: 300, yoyo: true, repeat: -1,
      repeatDelay: 1400, delay: 150, ease: 'Quad.Out',
    });
    this.tweens.add({ targets: mom, scaleY: 1.04, duration: 900, yoyo: true, repeat: -1 });

    this.add.text(480, 372,
      '躲开妈妈的无影脚,攒够【睡眠】撑到天亮\n红⚠️ = 真踢,快按【躲】!黄💤 = 只是翻身\n爸爸的房间亮着灯,有冰激凌 🍦',
      { fontSize: '16px', color: '#e8e4f8', align: 'center', lineSpacing: 8, fontFamily: 'sans-serif' },
    ).setOrigin(0.5);

    // 开始按钮
    const btn = this.add.container(480, 462);
    const g = this.add.graphics();
    g.fillStyle(0x8a5fd6, 1); g.fillRoundedRect(-130, -30, 260, 60, 16);
    const label = this.add.text(0, 0, '🌙 开始今晚', { fontSize: '24px', color: '#fff', fontFamily: 'sans-serif' }).setOrigin(0.5);
    btn.add([g, label]);
    btn.setSize(260, 60).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: btn, scale: 1.05, duration: 600, yoyo: true, repeat: -1 });
    btn.on('pointerdown', () => {
      SFX.unlock();
      try {
        if (!this.sys.game.device.os.desktop && !this.scale.isFullscreen) this.scale.startFullscreen();
      } catch (e) { /* iOS 不支持全屏,忽略 */ }
      this.scene.launch('UI');
      this.scene.start('Game');
    });

    this.add.text(480, 520, '📱 建议横屏游玩  |  💻 桌面:WASD/方向键移动,空格互动,Shift 跑', {
      fontSize: '13px', color: '#8a84a8', fontFamily: 'sans-serif',
    }).setOrigin(0.5);
  }
}
