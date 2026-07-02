// ============ 程序生成占位美术 ============
// 所有贴图键在此集中生成。后续替换真实美术时:
// 在 preload 里 load.image 同名键即可,游戏逻辑零改动。

function generateArt(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // --- 蛋仔风小人:椭圆蛋身 + 高光 + 表情 ---
  function blob(key, w, h, color, opts = {}) {
    g.clear();
    // 影子
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(w / 2, h - 5, w * 0.66, 9);
    // 蛋身
    g.fillStyle(color, 1);
    g.fillEllipse(w / 2, h / 2 - 2, w - 6, h - 10);
    // 高光
    g.fillStyle(0xffffff, 0.28);
    g.fillEllipse(w / 2 - w * 0.17, h * 0.27, w * 0.24, h * 0.16);
    const ey = h * 0.42;
    if (opts.sleep) {
      // 闭眼(横线)
      g.fillStyle(0x333344, 1);
      g.fillRect(w / 2 - w * 0.24, ey, w * 0.14, 2.5);
      g.fillRect(w / 2 + w * 0.10, ey, w * 0.14, 2.5);
    } else {
      g.fillStyle(0x333344, 1);
      g.fillCircle(w / 2 - w * 0.15, ey, w * 0.06);
      g.fillCircle(w / 2 + w * 0.15, ey, w * 0.06);
    }
    // 腮红
    g.fillStyle(0xff8899, 0.5);
    g.fillCircle(w / 2 - w * 0.27, h * 0.52, w * 0.07);
    g.fillCircle(w / 2 + w * 0.27, h * 0.52, w * 0.07);
    if (opts.hair) { // 呆毛
      g.fillStyle(opts.hair, 1);
      g.fillEllipse(w / 2, h * 0.13, w * 0.16, h * 0.1);
    }
    g.generateTexture(key, w, h);
  }

  // --- 圆角矩形家具 ---
  function rrect(key, w, h, color, r = 10, topColor = null) {
    g.clear();
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, w, h, r);
    if (topColor) { // 被子/台面
      g.fillStyle(topColor, 1);
      g.fillRoundedRect(4, 4, w - 8, h - 8, r * 0.7);
    }
    g.fillStyle(0xffffff, 0.08);
    g.fillRoundedRect(0, 0, w, h * 0.35, { tl: r, tr: r, bl: 0, br: 0 });
    g.generateTexture(key, w, h);
  }

  // 角色
  blob('girl', 40, 46, 0xffc2d4, { hair: 0xd46a8a });
  blob('girlSleep', 40, 46, 0xffc2d4, { sleep: true, hair: 0xd46a8a });
  blob('mom', 58, 64, 0xc9a7eb, { sleep: true });
  blob('momAwake', 58, 64, 0xc9a7eb, {});
  blob('dad', 54, 60, 0xa7c7eb, {});
  blob('cat', 30, 26, 0x9aa0ad, { sleep: true });

  // 家具
  rrect('momBed', 200, 150, 0x574a86, 14, 0x6f5fae);   // 大床(紫被子)
  rrect('dadBed', 180, 150, 0x6e5a3c, 14, 0x9a8153);   // 爸爸床(暖色)
  rrect('wardrobe', 70, 120, 0x7a5c3e, 8);
  rrect('toilet', 60, 70, 0xd8dae6, 16);
  rrect('sink', 38, 60, 0xb9c0cf, 8);
  rrect('couch', 190, 80, 0x3f5c4a, 16, 0x53775f);
  rrect('tv', 170, 44, 0x1a1a22, 6, 0x2c3a55);
  rrect('counter', 320, 56, 0x565a6e, 8, 0x6a6e84);
  rrect('fridge', 64, 96, 0xb6bec9, 10);
  rrect('lamp', 36, 36, 0xffdd88, 18);
  rrect('pillowGirl', 44, 30, 0xffe3ec, 10);           // 女儿枕头
  rrect('pillowMom', 50, 32, 0xe6d4f7, 10);
  rrect('mat', 64, 44, 0x8a6f8f, 12);                  // 床边地垫

  // 玩具(小黄鸭风)
  g.clear();
  g.fillStyle(0xffc94d, 1); g.fillCircle(10, 11, 8);
  g.fillStyle(0xff8c42, 1); g.fillCircle(15, 10, 3.5);
  g.fillStyle(0x333344, 1); g.fillCircle(8, 8, 1.6);
  g.generateTexture('toy', 20, 20);

  // 光晕(同心圆近似径向渐变)
  g.clear();
  for (let i = 10; i >= 1; i--) {
    g.fillStyle(0xffe9b0, 0.028 * (11 - i));
    g.fillCircle(80, 80, i * 8);
  }
  g.generateTexture('glow', 160, 160);

  // 噪音波纹(空心圆)
  g.clear();
  g.lineStyle(3, 0xffffff, 0.8);
  g.strokeCircle(32, 32, 28);
  g.generateTexture('ripple', 64, 64);

  // 牛奶杯(放床头用)
  g.clear();
  g.fillStyle(0xfff4e0, 1); g.fillRoundedRect(2, 4, 12, 13, 3);
  g.fillStyle(0xffffff, 0.6); g.fillRect(4, 6, 8, 3);
  g.generateTexture('cup', 16, 18);

  // 客厅收纳篮(装毯子)
  g.clear();
  g.fillStyle(0x8a6a48, 1); g.fillRoundedRect(0, 10, 46, 26, 8);
  g.fillStyle(0xd98f6a, 1); g.fillEllipse(23, 12, 38, 14);   // 露出的毯子
  g.fillStyle(0xe8a87c, 1); g.fillEllipse(23, 10, 26, 8);
  g.generateTexture('basket', 46, 38);

  // 毯子(盖在妈妈身上)
  g.clear();
  g.fillStyle(0xd98f6a, 0.95); g.fillRoundedRect(0, 0, 74, 96, 14);
  g.fillStyle(0xe8a87c, 0.9); g.fillRoundedRect(6, 8, 62, 12, 6);
  g.generateTexture('blanket', 74, 96);

  // 小熊
  g.clear();
  g.fillStyle(0xc98a4b, 1);
  g.fillCircle(8, 6, 5); g.fillCircle(24, 6, 5);       // 耳朵
  g.fillEllipse(16, 16, 26, 22);                        // 头
  g.fillStyle(0xf0c894, 1); g.fillEllipse(16, 19, 12, 9);
  g.fillStyle(0x333344, 1); g.fillCircle(11, 13, 2); g.fillCircle(21, 13, 2);
  g.generateTexture('teddy', 32, 28);

  g.destroy();
}
