// 启动：加载数据 → 轻触首屏（解锁音频）→ 进播放器；有存档则轻触后从断点续播
import { Player } from './player.js';
import { readStore, writeStore } from './storage.js';
import { showEndscreen } from './endscreen.js';

const els = {
  app: document.getElementById('app'),
  bgA: document.getElementById('bgA'),
  bgB: document.getElementById('bgB'),
  bgFallback: document.getElementById('bgFallback'),
  tapGate: document.getElementById('tapGate'),
  dialog: document.getElementById('dialog'),
  avatarWrap: document.querySelector('.avatar-wrap'),
  avatar: document.getElementById('avatar'),
  charName: document.getElementById('charName'),
  charText: document.getElementById('charText'),
  clickHint: document.getElementById('clickHint'),
  choices: document.getElementById('choices'),
  endscreen: document.getElementById('endscreen'),
  endChoice1: document.getElementById('endChoice1'),
  endChoice2: document.getElementById('endChoice2'),
  endCta: document.getElementById('endCta'),
  replay: document.getElementById('replay'),
};
Player.bindDom(els);

const [data, manifest] = await Promise.all([
  fetch('data/script-slice.json').then(r => r.json()),
  fetch('data/audio-manifest.json').then(r => r.json()),
]);
const player = new Player(data, {
  manifest,
  onStep: (step) => writeStore({ seq: step.seq }), // 每步渲染前记录进度
  onEnd: () => showEndscreen(els, data),           // seq 368 台词播完定格 → 结算页
});

// 首屏背景先铺上
els.bgA.src = data.meta.default_background;
els.bgA.onload = () => els.bgA.classList.add('show');

let started = false;
const beginFrom = (seq) => {
  if (started) return;
  started = true;
  els.tapGate.classList.add('hidden');
  // start() 链在本次点击手势内同步执行：BGM 与首句配音的首次 play() 均在手势中，完成音频解锁
  player.start(seq);
};

// ?seq=N 调试跳转（仅验收用）：跳过轻触直接落到指定步（无声）
const debugSeq = Number(new URLSearchParams(location.search).get('seq'));
if (debugSeq && player.bySeq.has(debugSeq)) {
  started = true;
  els.tapGate.classList.add('hidden');
  player.start(debugSeq);
} else {
  // 断点恢复：有存档直接从断点续播（不询问），印章文案改为「继续剧情」
  const saved = readStore();
  if (saved.seq && player.bySeq.has(saved.seq)) {
    document.querySelector('.tap-seal span:last-child').textContent = '继续剧情';
    els.tapGate.addEventListener('click', () => beginFrom(saved.seq));
  } else {
    els.tapGate.addEventListener('click', () => beginFrom());
  }
}

// 全局点击 = 补全当前句 / 跳下一句（选择按钮自带 stopPropagation）
document.getElementById('app').addEventListener('click', (e) => {
  if (!started) return;
  if (!els.choices.classList.contains('hidden')) return;
  player.advance();
});
