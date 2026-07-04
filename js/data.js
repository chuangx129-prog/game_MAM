// ============ 全局配置与关卡数据 ============
// 所有坐标基于世界尺寸 960x672(俯视户型图)。美术替换时只需改 art.js 的贴图键。

const CFG = {
  VIEW_W: 960, VIEW_H: 540,          // 相机视口
  WORLD_W: 960, WORLD_H: 672,        // 世界大小
  NIGHT_MINUTES: 450,                 // 23:00 → 6:30,1 游戏分钟 = 1 现实秒
  WALK_SPEED: 115, RUN_SPEED: 185,
  SLEEP_RATE: 0.28,                   // 每秒睡眠增长(%)
  // 踢腿间隔 [最短,最长] ms(按妈妈睡眠状态;高频=核心紧张感)
  KICK_GAPS: { deep: [3000, 5200], light: [2300, 4000], almost: [1600, 2900] },
  BLADDER_RATE: 0.10,                 // 每秒憋尿增长
  WAKE_DECAY: 1.2,                    // 安静时吵醒值每秒回落
  KICK_DMG: 30,
  DODGE_WINDOW: 900,                  // 闪避窗口 ms
  DODGE_WINDOW_TEDDY: 1250,           // 抱小熊时
  ICE_COOLDOWN: 120000,               // 冰激凌冷却 ms
  // 暴怒追逐
  CHASE_HUNT_SPEED: 150,              // 追人速度(走路115/跑步185之间:走路躲不掉,得跑)
  CHASE_WANDER_SPEED: 105,            // 游荡搜索速度
  CHASE_RETURN_SPEED: 130,            // 消气回房速度
  CATCH_DIST: 42,                     // 抓住判定距离
  VISION_LEN: 205,                    // 视野长度
  VISION_HALF: 0.62,                  // 视野半角(弧度,约35°)
  CHASE_GIVEUP: 9000,                 // 多久没看到人就放弃 ms
  KNOCK_MS: 3400,                     // 砸爸爸房门的时长 ms
  WAKE_AFTER_CHASE: 35,               // 追完回去睡,吵醒值重置为
  // 喷火暴走(起夜发现马桶没冲):比跑步还快,只能躲
  FURY_SPEED: 192,                    // 暴走追击速度(玩家跑步185,跑不掉!)
  FURY_GIVEUP: 18000,                 // 暴走追丢放弃时间(普通的×2)
  FURY_DURATION: 32000,               // 暴走硬上限,烧完自动消气
  DAD_FLEE_SPEED: 118,                // 爸爸逃命速度
  DAD_ABANDON_AT: 3,                  // 同一藏身点连续被抓 N 次,爸爸就再也不躲那儿(跨晚记忆)
};

// 妈妈追逐用的导航图(节点在门洞/房间中心,保证连线不穿墙)
const NAV = {
  nodes: {
    momC:       { x: 195, y: 160 },
    momDoor:    { x: 192, y: 318 },
    hallC:      { x: 480, y: 320 },
    hallE:      { x: 736, y: 318 },
    bath:       { x: 475, y: 170 },
    dadKnock:   { x: 736, y: 284 },   // 爸爸房门口(平时她进不去)
    dadC:       { x: 745, y: 150 },   // 爸爸房间内(只有喷火暴走时会杀进去)
    livingDoor: { x: 245, y: 424 },
    livingC:    { x: 300, y: 540 },
    livingE:    { x: 395, y: 585 },
    kitchenDoor:{ x: 688, y: 424 },
    kitchenC:   { x: 700, y: 540 },
    kitchenE:   { x: 858, y: 480 },
  },
  edges: [
    ['momC', 'momDoor'], ['momDoor', 'hallC'], ['momDoor', 'livingDoor'],
    ['hallC', 'bath'], ['hallC', 'hallE'], ['hallE', 'dadKnock'], ['dadKnock', 'dadC'], ['hallE', 'kitchenDoor'],
    ['livingDoor', 'livingC'], ['livingC', 'livingE'],
    ['kitchenDoor', 'kitchenC'], ['kitchenC', 'kitchenE'],
  ],
};

// 房间区域(内部地板范围)
const ROOMS = {
  mom:     { x: 12,  y: 12,  w: 366, h: 238, name: '妈妈卧室', floor: 0x2e2a4a },
  bath:    { x: 390, y: 12,  w: 180, h: 238, name: '卫生间',   floor: 0x2a3a44 },
  dad:     { x: 582, y: 12,  w: 366, h: 238, name: '爸爸卧室', floor: 0x5a4a33 },
  hall:    { x: 12,  y: 262, w: 936, h: 116, name: '走廊',     floor: 0x262238 },
  living:  { x: 12,  y: 390, w: 462, h: 270, name: '客厅',     floor: 0x2c3040 },
  kitchen: { x: 486, y: 390, w: 462, h: 270, name: '厨房',     floor: 0x30343c },
};

// 墙体碰撞矩形 {x,y,w,h}(左上角坐标)
const WALLS = [
  // 外墙
  { x: 0, y: 0, w: 960, h: 12 }, { x: 0, y: 660, w: 960, h: 12 },
  { x: 0, y: 0, w: 12, h: 672 }, { x: 948, y: 0, w: 12, h: 672 },
  // 上排房间隔断
  { x: 378, y: 0, w: 12, h: 262 }, { x: 570, y: 0, w: 12, h: 262 },
  // 上排/走廊之间(留门洞:妈妈房 160-224,卫生间 448-512,爸爸房 704-768)
  { x: 0, y: 250, w: 160, h: 12 }, { x: 224, y: 250, w: 224, h: 12 },
  { x: 512, y: 250, w: 192, h: 12 }, { x: 768, y: 250, w: 192, h: 12 },
  // 走廊/下排之间(留门洞:客厅 208-272,厨房 656-720)
  { x: 0, y: 378, w: 208, h: 12 }, { x: 272, y: 378, w: 384, h: 12 },
  { x: 720, y: 378, w: 240, h: 12 },
  // 客厅/厨房隔断
  { x: 474, y: 390, w: 12, h: 270 },
];

// 家具:tex 为贴图键(art.js 生成),solid 是否有碰撞,emoji 为装饰标签
const FURNITURE = [
  { tex: 'momBed',   x: 40,  y: 50,  w: 200, h: 150, solid: true },
  { tex: 'wardrobe', x: 300, y: 20,  w: 70,  h: 120, solid: true, emoji: '🚪', label: '衣柜' },
  { tex: 'toilet',   x: 445, y: 30,  w: 60,  h: 70,  solid: true, emoji: '🚽' },
  { tex: 'sink',     x: 525, y: 30,  w: 38,  h: 60,  solid: true },
  { tex: 'dadBed',   x: 610, y: 50,  w: 180, h: 150, solid: true },
  { tex: 'lamp',     x: 900, y: 30,  w: 36,  h: 36,  solid: false, emoji: '💡' },
  { tex: 'couch',    x: 60,  y: 440, w: 190, h: 80,  solid: true, emoji: '🛋' },
  { tex: 'tv',       x: 140, y: 612, w: 170, h: 44,  solid: true, emoji: '📺' },
  { tex: 'counter',  x: 500, y: 600, w: 320, h: 56,  solid: true, emoji: '🍲' },
  { tex: 'fridge',   x: 880, y: 400, w: 64,  h: 96,  solid: true, emoji: '🧊' },
];

// 床位坐标
const BED = {
  momSlot:   { x: 95,  y: 125 },   // 妈妈躺的位置
  girlSlot:  { x: 190, y: 125 },   // 女儿睡觉位置
  matSlot:   { x: 285, y: 190 },   // 床边地垫(闪避滚落点/下床点)
};

// 妈妈起夜巡逻路径点
const PATROL_PATH = [
  { x: 180, y: 210 }, { x: 192, y: 320 }, { x: 470, y: 320 }, { x: 472, y: 150 },
];

// 地上的玩具(噪音陷阱,可捡)
const TOYS = [
  { x: 150, y: 225 }, { x: 310, y: 228 }, { x: 360, y: 320 },
  { x: 590, y: 325 }, { x: 790, y: 330 }, { x: 320, y: 470 },
];

// 爸爸商店
const SHOP = [
  { id: 'milk',     name: '🥛 爸爸牌热牛奶', desc: '睡眠速度×3!(120秒)', price: 3, repeat: true },
  { id: 'shield',   name: '🛡 替身抱枕',     desc: '自动挡下一脚(最多囤2个)', price: 4, repeat: true, max: 2 },
  { id: 'slippers', name: '🩴 毛绒拖鞋',     desc: '整晚脚步声减半', price: 6 },
  { id: 'tip',      name: '💡 爸爸的情报',   desc: '一条随机小提示', price: 1, repeat: true },
];

// 爸爸藏身点的中文名(用于记忆提示文案)
const DAD_HIDE_NAMES = { wardrobe: '衣柜', couch: '沙发' };

const DAD_TIPS = [
  '爸爸:你的小熊🧸好像掉进沙发缝里了,多翻几次。',
  '爸爸:猫粮在冰箱里,喂饱猫它半夜就不叫了。',
  '爸爸:半夜冲水动静很大……当个"坏孩子"也没关系。',
  '爸爸:你妈一般 1 点和 4 点起夜,躲好。',
  '爸爸:黄色的💤只是翻身,别自己吓自己。',
  '爸爸:憋尿会睡不好,别硬撑。',
  '爸爸:你妈要是追你,就往我这儿跑,我把门顶住。',
  '爸爸:安安静静睡着的时候,你妈的气消得最快。',
  '爸爸:那只小熊其实是你妈小时候的宝贝…她抱着它一定睡得香。',
  '爸爸:你妈踢人是因为睡不安稳。小熊、热牛奶、毯子…对症下药。',
  '爸爸:地上的玩具收一收,你妈起夜踩到会更暴躁。',
  '爸爸:马桶没冲这种事,你妈起夜要是发现了…神仙都救不了,我也只能跑。',
  '爸爸:她要是喷火了就躲起来!那个速度谁都跑不过!',
];

// 开场教学
const TUTORIAL = [
  '深夜11点…又到了和妈妈斗智斗勇的时间 🌙',
  '左侧摇杆移动|右下按钮互动',
  '上床睡觉才能涨【睡眠】,但小心妈妈的无影脚!',
  '红色⚠️出现就按【躲】!黄色💤只是翻身,别上当',
  '把妈妈吵醒她会暴怒追人!躲起来,或逃进爸爸房间 🚪',
  '睡不着就出去转转——爸爸的房间亮着灯 🍦',
];

// 结局文案
const ENDINGS = {
  morning:   { title: '🌅 天亮了!', color: 0xffd166 },
  sleepfull: { title: '😴 睡饱收工!', color: 0xffd166 },
  ko:        { title: '😵 被踢晕了…', sub: '一记无影脚,你在地板上睡到了天亮。', color: 0xef476f },
  caught:    { title: '💢 被妈妈逮住了!', sub: '「站住!!」……你被拎回床上,结结实实挨了顿训。', color: 0xef476f },
  disco:     { title: '🪩 迪斯科惨案', sub: '妈妈一脚踹开房门——「大半夜的蹦什么迪?!」\n你和爸爸并排跪着挨训,冰激凌也被没收了。', color: 0xef476f },
};

// 按综合得分(睡眠 + 任务奖励)评级
const GRADES = [
  { min: 105, g: 'S+', text: '传说!你不但睡好了,还治好了妈妈 👑' },
  { min: 90, g: 'S', text: '睡美人!今天精神满分 ✨' },
  { min: 75, g: 'A', text: '睡得不错,只打了一个哈欠' },
  { min: 55, g: 'B', text: '还行,课间补了个觉' },
  { min: 40, g: 'C', text: '顶着黑眼圈去上学…' },
  { min: 0,  g: 'D', text: '上课睡着被老师点名 💤' },
];
