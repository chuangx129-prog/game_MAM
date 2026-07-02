// ============ 启动 ============
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0b1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: CFG.VIEW_W,
    height: CFG.VIEW_H,
  },
  physics: { default: 'arcade' },
  input: { activePointers: 3 },
  // 场景顺序即渲染顺序:UI 最后 = 永远在最上层
  scene: [TitleScene, GameScene, UIScene],
});
