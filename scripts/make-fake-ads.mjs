// 本地合成两张古风修仙假广告素材（自制占位，非真实广告网络）→ assets-src/fake-promo/
// 用法：node scripts/make-fake-ads.mjs
// 设计：banner（横条，玩法引流）+ rewarded（竖屏全屏，结算页激励视频位）
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSET = 'D:/恋爱剧本交友/剧本/回山/回山-资产';
const OUT = path.join(ROOT, 'assets-src', 'fake-promo');
fs.mkdirSync(OUT, { recursive: true });

const PAPER = '#f6f1e5', GOLD = '#d9bc7f', CINNABAR = '#a83c2e', INK = 'rgba(28,24,19,';
const FONT = 'SimSun, Microsoft YaHei, serif'; // SVG 属性内不能带双引号

// ---------- 1) 底部 banner：1080×200，后院夜景横条 + 引流语 + CTA ----------
{
  const W = 1080, H = 200;
  const base = await sharp(path.join(ASSET, 'bg_courtyard_night.png'))
    .resize(W, H, { fit: 'cover', position: 'attention' })
    .toBuffer();
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- 压暗渐变：左深右浅，保证文字可读 -->
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${INK}.88)"/><stop offset=".55" stop-color="${INK}.55)"/><stop offset="1" stop-color="${INK}.25)"/>
  </linearGradient></defs>
  <!-- 朱砂描边细框（古风广告味） -->
  <rect x="7" y="7" width="${W - 14}" height="${H - 14}" fill="none" stroke="${CINNABAR}" stroke-opacity=".65" stroke-width="2"/>
  <!-- 左：印章方块「入戏」 -->
  <rect x="30" y="52" width="96" height="96" fill="${CINNABAR}"/>
  <rect x="35" y="57" width="86" height="86" fill="none" stroke="${PAPER}" stroke-opacity=".5" stroke-width="2"/>
  <text x="78" y="112" text-anchor="middle" font-family="${FONT}" font-size="42" font-weight="bold" fill="${PAPER}">入戏</text>
  <!-- 中：主文案（品牌句） -->
  <text x="160" y="98" font-family="${FONT}" font-size="46" font-weight="bold" fill="${PAPER}">入一场戏，等一个你。</text>
  <text x="162" y="148" font-family="${FONT}" font-size="28" fill="${GOLD}">双人对局 · 百种剧本 · 声临其境</text>
  <!-- 右：CTA 按钮 -->
  <rect x="830" y="66" width="212" height="68" rx="6" fill="${CINNABAR}"/>
  <rect x="834" y="70" width="204" height="60" rx="4" fill="none" stroke="${PAPER}" stroke-opacity=".35" stroke-width="2"/>
  <text x="936" y="112" text-anchor="middle" font-family="${FONT}" font-size="34" font-weight="bold" fill="${PAPER}">立即开演</text>
</svg>`);
  await sharp(base).composite([{ input: overlay }]).jpeg({ quality: 84 }).toFile(path.join(OUT, 'banner.jpg'));
}

// ---------- 2) 激励视频全屏图：1080×1920（9:16），惠卿立绘 + 剧情卡悬念 + CTA ----------
{
  const W = 1080, H = 1920;
  const base = await sharp(path.join(ASSET, 'bg_courtyard_night.png'))
    .resize(W, H, { fit: 'cover' })
    .modulate({ brightness: 0.72 }) // 压暗做夜色底
    .toBuffer();
  // 惠卿立绘：取上半身，放右侧偏下
  const figure = await sharp(path.join(ASSET, '陈惠卿.png'))
    .resize(880, 1174, { fit: 'cover', position: 'top' })
    .toBuffer();
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- 顶部/底部压暗渐变 -->
  <rect width="${W}" height="${H}" fill="url(#v)"/>
  <defs>
    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK}.78)"/><stop offset=".32" stop-color="${INK}.1)"/>
      <stop offset=".62" stop-color="${INK}.12)"/><stop offset="1" stop-color="${INK}.88)"/>
    </linearGradient>
  </defs>
  <!-- 顶部：广告标识行（品牌句） -->
  <text x="540" y="112" text-anchor="middle" font-family="${FONT}" font-size="34" letter-spacing="8" fill="${GOLD}">— 入戏 App · 入一场戏，等一个你。—</text>
  <!-- 主标题区 -->
  <text x="540" y="238" text-anchor="middle" font-family="${FONT}" font-size="78" font-weight="bold" fill="${PAPER}">回 山</text>
  <text x="540" y="310" text-anchor="middle" font-family="${FONT}" font-size="36" letter-spacing="6" fill="${GOLD}">完整版已上线</text>
  <text x="540" y="412" text-anchor="middle" font-family="${FONT}" font-size="42" fill="${PAPER}" fill-opacity=".95">她还没有等到他的答案</text>
  <!-- 卖点行 -->
  <text x="540" y="1620" text-anchor="middle" font-family="${FONT}" font-size="40" fill="${PAPER}">双真分支 · 五种尾声 · 全程配音</text>
  <text x="540" y="1682" text-anchor="middle" font-family="${FONT}" font-size="34" fill="${GOLD}">试玩之外，还有七幕等你演完</text>
  <!-- 底部 CTA 按钮 -->
  <rect x="140" y="1746" width="800" height="104" rx="8" fill="${CINNABAR}"/>
  <rect x="146" y="1752" width="788" height="92" rx="6" fill="none" stroke="${PAPER}" stroke-opacity=".4" stroke-width="3"/>
  <text x="540" y="1814" text-anchor="middle" font-family="${FONT}" font-size="46" font-weight="bold" fill="${PAPER}">免费开演《回山》</text>
</svg>`);
  await sharp(base)
    .composite([
      { input: figure, left: (W - 880) / 2, top: 560 },
      { input: overlay },
    ])
    .jpeg({ quality: 84 })
    .toFile(path.join(OUT, 'rewarded.jpg'));
}

console.log('已生成 assets-src/fake-promo/banner.jpg 与 rewarded.jpg');
