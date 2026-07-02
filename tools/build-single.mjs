// 把整个游戏打包成单个 HTML(引擎/音频/代码全部内联)
// 用途:免登录快速部署、微信发文件、任何"只能传一个文件"的场合
// 用法:node tools/build-single.mjs  → 产出 dist/single.html
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

let html = readFileSync('index.html', 'utf8');

// 单文件版不带 favicon(省 1MB 体积)
html = html.replace(/<link rel="icon"[^>]*>\s*/, '').replace(/<link rel="apple-touch-icon"[^>]*>\s*/, '');

// 所有本地 <script src> 原地内联;内容里的 </script 要转义,防止提前闭合标签
html = html.replace(/<script src="([^"?]+)(?:\?[^"]*)?"><\/script>/g, (m, src) => {
  const js = readFileSync(src, 'utf8').replace(/<\/script/g, '<\\/script');
  return `<script>\n${js}\n</script>`;
});

mkdirSync('dist', { recursive: true });
writeFileSync('dist/single.html', html);
console.log(`dist/single.html 生成完毕:${(html.length / 1024 / 1024).toFixed(2)} MB`);
