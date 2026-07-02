// 把 sound/*.mp3 打包成 sound/bgm-data.js(base64 内嵌,file:// 直开也能播放)
// 用法:在项目根目录运行  node tools/pack-audio.mjs
import { readdirSync, readFileSync, writeFileSync } from 'fs';

// 中文文件名 → 游戏内音频键名(新音频在这里登记)
const NAME_MAP = {
  '追逐': 'bgm_chase',
  '跳舞': 'bgm_dance',
  '冲马桶': 'sfx_flush',
  '猫叫': 'sfx_meow',
};

const map = {};
for (const f of readdirSync('sound')) {
  if (!f.toLowerCase().endsWith('.mp3')) continue;
  const base = f.replace(/\.mp3$/i, '');
  const key = NAME_MAP[base] || ('sfx_' + base.replace(/[^\w一-龥]+/g, '_'));
  map[key] = readFileSync('sound/' + f).toString('base64');
  console.log(`${f} -> ${key} (${(map[key].length / 1024 / 1024 * 0.75).toFixed(2)} MB)`);
}
writeFileSync('sound/bgm-data.js', 'window.AUDIO_B64 = ' + JSON.stringify(map) + ';\n');
console.log('已生成 sound/bgm-data.js,键:', Object.keys(map).join(', '));
