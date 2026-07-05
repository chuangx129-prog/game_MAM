// 匿名快速部署 dist/single.html 到 EdgeOne Pages(免登录,临时链接)
// 用法:node tools/build-single.mjs && node tools/deploy-drop.mjs
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';

const html = readFileSync('dist/index.html', 'utf8');
console.log(`上传体积:${(html.length / 1024 / 1024).toFixed(2)} MB`);

const r1 = await fetch('https://mcp.edgeone.site/get_base_url');
if (!r1.ok) throw new Error(`get_base_url 失败:${r1.status}`);
const { baseUrl } = await r1.json();

const r2 = await fetch(baseUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Installation-ID': randomBytes(8).toString('hex'),
  },
  body: JSON.stringify({ value: html }),
});
const text = await r2.text();
console.log(`HTTP ${r2.status}`);
console.log(text.slice(0, 500));
