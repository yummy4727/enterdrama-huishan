// 构建脚本：从《回山》正本裁剪 seq 1–368，拷贝/压缩资产，生成音频清单
// 用法：node scripts/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = 'D:/恋爱剧本交友/剧本/回山';
const SCRIPT_JSON = path.join(SRC_DIR, '回山-script_json/script.json');
const ASSET_DIR = path.join(SRC_DIR, '回山-资产');
const OUT_DATA = path.join(ROOT, 'data');
const OUT_ASSETS = path.join(OUT_DATA, 'assets');

const SLICE_END = 368;
// 切片内用到的资产 key
const BACKGROUNDS = ['bg_shop_dusk', 'bg_shop_night', 'bg_store_night', 'bg_courtyard_night'];
const MUSIC = ['bgm_daily', 'bgm_departure', 'bgm_night', 'bgm_uneasy'];

// ---------- 图片压缩（sharp 可用则压 WebP，否则拷原图） ----------
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.warn('⚠ sharp 未安装，图片将拷原图（npm i -D sharp 后重跑可压缩）'); }

async function compressImage(src, destBase) {
  if (!sharp) { fs.copyFileSync(src, destBase + path.extname(src)); return 'data/' + path.relative(OUT_DATA, destBase + path.extname(src)).replaceAll('\\', '/'); }
  const dest = destBase + '.webp';
  await sharp(src).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 78 }).toFile(dest);
  return 'data/' + path.relative(OUT_DATA, dest).replaceAll('\\', '/'); // 页面根相对路径
}

// ---------- 主流程 ----------
const full = JSON.parse(fs.readFileSync(SCRIPT_JSON, 'utf8'));
const def = JSON.parse(fs.readFileSync(path.join(SRC_DIR, '回山-script_json/definition.json'), 'utf8'));
const bySeq = new Map(full.steps.map(s => [s.seq, s]));

// 裁剪切片（文本零改动）
const slice = [];
for (let seq = 1; seq <= SLICE_END; seq++) {
  const step = bySeq.get(seq);
  if (!step) throw new Error(`正本缺 seq ${seq}，裁剪中止`);
  slice.push(step);
}
slice[slice.length - 1].end = true; // seq 368 定格标记

fs.rmSync(OUT_ASSETS, { recursive: true, force: true });
fs.mkdirSync(OUT_ASSETS, { recursive: true });
for (const d of ['audio', 'bg', 'portraits', 'music']) fs.mkdirSync(path.join(OUT_ASSETS, d), { recursive: true });

// 背景（压缩 WebP）
const bgMap = {};
for (const key of BACKGROUNDS) {
  bgMap[key] = await compressImage(path.join(ASSET_DIR, `${key}.png`), path.join(OUT_ASSETS, 'bg', key));
}
// 头像（压缩 WebP）：优先用 assets-src/portraits 重绘版，否则回退正本立绘
const OVERRIDE_DIR = path.join(ROOT, 'assets-src', 'portraits');
const portraits = {};
for (const c of def.characters) {
  const name = c.avatar.split('/').pop(); // 江明.png / 陈惠卿.png
  const base = name.replace('.png', '');
  const override = ['png', 'jpg', 'jpeg', 'webp']
    .map(ext => path.join(OVERRIDE_DIR, `${base}.${ext}`))
    .find(p => fs.existsSync(p));
  const src = override || path.join(ASSET_DIR, name);
  portraits[c.char_id] = await compressImage(src, path.join(OUT_ASSETS, 'portraits', base));
}
// BGM（全拷）
const musicMap = {};
for (const key of MUSIC) {
  fs.copyFileSync(path.join(ASSET_DIR, `${key}.mp3`), path.join(OUT_ASSETS, 'music', `${key}.mp3`));
  musicMap[key] = `data/assets/music/${key}.mp3`;
}

// 音频盘点：narration 按 audio_key 映射；line/prompt 无现成配音 → 记缺口
const manifest = {};   // seq -> "assets/audio/nar_XXXX.mp3"
const missing = [];    // {seq, type, char, text}
const narrationDir = path.join(ASSET_DIR, 'narration');
for (const step of slice) {
  if (step.type === 'narration' && step.audio_key) {
    const src = path.join(narrationDir, `${step.audio_key}.mp3`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(OUT_ASSETS, 'audio', `${step.audio_key}.mp3`));
      manifest[step.seq] = `data/assets/audio/${step.audio_key}.mp3`;
    } else {
      missing.push({ seq: step.seq, type: step.type, char: null, text: step.text, reason: `缺 ${step.audio_key}.mp3` });
    }
  } else if (step.type === 'line' || step.type === 'prompt') {
    missing.push({ seq: step.seq, type: step.type, char: step.char_id, text: step.text, reason: '台词无现成配音，需 TTS 补生成' });
  }
}

// 切片数据（含角色/资产映射 meta）
const sliceData = {
  meta: {
    title: '回山试玩版',
    default_background: bgMap[def.default_background] || bgMap['bg_shop_dusk'],
    characters: Object.fromEntries(def.characters.map(c => [c.char_id, { name: c.name, avatar: portraits[c.char_id] }])),
    backgrounds: bgMap,
    music: musicMap,
  },
  steps: slice,
};

fs.writeFileSync(path.join(OUT_DATA, 'script-slice.json'), JSON.stringify(sliceData, null, 1));
fs.writeFileSync(path.join(OUT_DATA, 'audio-manifest.json'), JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(OUT_DATA, 'audio-missing.json'), JSON.stringify(missing, null, 1));

// ---------- 报告 ----------
const types = {};
slice.forEach(s => types[s.type] = (types[s.type] || 0) + 1);
const branches = slice.filter(s => s.type === 'branch');
console.log('== 构建完成 ==');
console.log(`切片步数: ${slice.length}（seq 1–${SLICE_END}）`);
console.log(`类型分布:`, JSON.stringify(types));
console.log(`branch 步: ${branches.map(b => `${b.seq}(${b.branches.length ? 'choices' : 'AUTO'}→${b.default_goto_seq})`).join(', ')}`);
console.log(`旁白音频覆盖: ${Object.keys(manifest).length} / ${slice.filter(s => s.type === 'narration' && s.audio_key).length}`);
console.log(`待补配音: ${missing.length} 条（台词 ${missing.filter(m => m.type === 'line' || m.type === 'prompt').length} + 旁白缺口 ${missing.filter(m => m.type === 'narration').length}）`);
