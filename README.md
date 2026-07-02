# 妈妈的无影脚 🦵

H5 夜间潜行生存小游戏:躲开妈妈的无影脚,攒够睡眠撑到天亮。
设计文档见 [DESIGN.md](DESIGN.md)。

**🎮 在线试玩(手机直接打开,建议横屏):https://chuangx129-prog.github.io/game_MAM/**

## 怎么玩

- **手机/平板**:浏览器打开即玩(建议横屏)。左侧任意位置按住拖动 = 摇杆;右下大按钮 = 互动/闪避
- **电脑调试**:WASD/方向键移动,空格或 E 互动,Shift 跑步

## 本地运行

需要联网(Phaser 走 CDN)。**最简单:双击桌面的「妈妈的无影脚」快捷方式**——
它运行 [启动游戏.vbs](启动游戏.vbs):有 Node 就后台拉起 `http-server`(端口 8830,窗口隐藏)并打开浏览器;
没有 Node 自动降级为直接打开 index.html。图标 = `icon.jpeg`(转出的 `icon.ico` 给快捷方式,同时是网页 favicon)。

手动方式:

```bash
# 方式一:直接双击 index.html(Chrome/Edge 可直接玩)
# 方式二:起个静态服务器
npx http-server -p 8830 -c-1
# 然后访问 http://localhost:8830
```

## 发布分享

纯静态文件,拖进 GitHub Pages / Vercel / Netlify / 任意静态托管即可,
把链接发给家人,手机点开就能玩,无需下载。

## 文件结构(为美术替换做的准备)

| 文件 | 职责 |
|---|---|
| `js/data.js` | 所有数值、户型坐标、商店、文案 —— 调平衡只改这里 |
| `js/art.js` | **占位美术全部在此生成**;换真实美术时用 `load.image('同名键', 'xxx.png')` 覆盖即可,逻辑零改动 |
| `js/sfx.js` | WebAudio 合成占位音效 |
| `js/GameScene.js` | 核心玩法(移动/噪音/踢腿QTE/巡逻/任务/商店逻辑) |
| `js/UIScene.js` | HUD、虚拟摇杆、弹窗 |
| `js/TitleScene.js` | 标题画面 |

## 音频资产(`sound/` 目录)

已接入:`追逐.mp3` = 暴怒追逐 BGM(循环,音量 0.55);`冲马桶.mp3` = 冲水音效(自己冲水 + 妈妈起夜)。

**接入流程**(新音频三步):
1. mp3 放进 `sound/`,在 [tools/pack-audio.mjs](tools/pack-audio.mjs) 的 `NAME_MAP` 里登记"中文名 → 键名"
2. 项目根目录运行 `node tools/pack-audio.mjs`(重新生成 base64 内嵌包 `sound/bgm-data.js`,这样双击 file:// 直开也能播放)
3. 游戏逻辑里 `this.sound.play('键名')`;找不到键会自动回退 [sfx.js](js/sfx.js) 合成音效

候选清单:踢腿预警、闪避成功、挨踢、捡星星、猫叫、砸门、清晨鸟叫、平时的夜晚环境音。
改动 JS 后记得把 index.html 里的 `?v=N` 版本号 +1,防止浏览器用旧缓存。

## 贴图键清单(给 Codex 出美术资产用)

角色:`girl` `girlSleep` `mom` `momAwake` `dad` `cat`(蛋仔风 Q 弹小人,俯视微侧)
家具:`momBed` `dadBed` `wardrobe` `toilet` `sink` `couch` `tv` `counter` `fridge` `lamp` `pillowGirl` `pillowMom` `mat`
道具:`toy` `teddy` `glow` `ripple`
