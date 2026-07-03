// ============ 启动 ============
// 高清适配:画布按设备像素比放大(iPad/手机视网膜屏不再模糊),
// 相机同步 zoom,所有游戏逻辑坐标保持 960x540 不变。
// 上限 2 倍防止低端机渲染压力过大;调试可用 ?dpr=1/2 强制指定。
const DPR = (() => {
  const q = new URLSearchParams(location.search).get('dpr');
  const raw = q ? parseFloat(q) : (window.devicePixelRatio || 1);
  return Math.min(2, Math.max(1, Math.round(raw)));
})();
CFG.DPR = DPR;

// 所有文字按 DPR 分辨率渲染(否则相机放大后字是糊的)
const _textFactory = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (x, y, str, style) {
  const t = _textFactory.call(this, x, y, str, style);
  t.setResolution(DPR);
  return t;
};

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0b1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: CFG.VIEW_W * DPR,
    height: CFG.VIEW_H * DPR,
  },
  physics: { default: 'arcade' },
  input: { activePointers: 3 },
  // 场景顺序即渲染顺序:UI 最后 = 永远在最上层
  scene: [TitleScene, GameScene, UIScene],
});
