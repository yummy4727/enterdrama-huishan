// 启动：加载数据 → 轻触首屏（解锁音频）→ 进播放器
import { Player } from './player.js';

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
};
Player.bindDom(els);

const [data, manifest] = await Promise.all([
  fetch('data/script-slice.json').then(r => r.json()),
  fetch('data/audio-manifest.json').then(r => r.json()),
]);
const player = new Player(data, { manifest });

// 首屏背景先铺上
els.bgA.src = data.meta.default_background;
els.bgA.onload = () => els.bgA.classList.add('show');

let started = false;

// ?seq=N 调试跳转（仅验收用）：跳过轻触直接落到指定步（无声）
const debugSeq = Number(new URLSearchParams(location.search).get('seq'));
if (debugSeq && player.bySeq.has(debugSeq)) {
  started = true;
  els.tapGate.classList.add('hidden');
  player.start(debugSeq);
} else {
  els.tapGate.addEventListener('click', () => {
    if (started) return;
    started = true;
    els.tapGate.classList.add('hidden');
    // start() 链在本次点击手势内同步执行：BGM 与首句配音的首次 play() 均在手势中，完成音频解锁
    player.start();
  });
}

// 全局点击 = 补全当前句 / 跳下一句（选择按钮自带 stopPropagation）
document.getElementById('app').addEventListener('click', (e) => {
  if (!started) return;
  if (!els.choices.classList.contains('hidden')) return;
  player.advance();
});
