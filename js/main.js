// 启动：加载数据 → 轻触首屏（解锁音频）→ 进播放器；有存档则轻触后从断点续播
import { Player } from './player.js';
import { readStore, writeStore } from './storage.js';
import { showEndscreen } from './endscreen.js';
import { showBanner, hideBanner } from './ads.js';

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
  playControls: document.getElementById('playControls'),
  btnAuto: document.getElementById('btnAuto'),
  btnHome: document.getElementById('btnHome'),
  endscreen: document.getElementById('endscreen'),
  endChoice1: document.getElementById('endChoice1'),
  endChoice2: document.getElementById('endChoice2'),
  endCta: document.getElementById('endCta'),
  endAdSlot: document.getElementById('endAdSlot'),
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
  onEnd: () => { hideBanner(); showEndscreen(els, data); }, // seq 368 定格 → 藏 banner → 结算页
});

// 首屏背景先铺上
els.bgA.src = data.meta.default_background;
els.bgA.onload = () => els.bgA.classList.add('show');

let started = false;
const beginFrom = (seq) => {
  if (started) return;
  started = true;
  els.tapGate.classList.add('hidden');
  els.playControls.classList.remove('hidden');
  showBanner(); // 底部假广告 banner：播放全程常驻（结算页隐藏）
  // start() 链在本次点击手势内同步执行：BGM 与首句配音的首次 play() 均在手势中，完成音频解锁
  player.start(seq);
  player.resumeBgm(); // 回首页续播时恢复被停掉的 BGM（在手势内起播）
};

// 回到首页：停声与自动播放、保留进度、印章改「继续剧情」；再点印章从当前断点续播
const goHome = () => {
  player.stopAll();
  player.auto = false; // 回首页即暂停：自动播放不跨首页存活，杜绝遮罩下偷跑
  els.btnAuto.classList.remove('on');
  started = false;
  els.playControls.classList.add('hidden');
  els.dialog.classList.add('hidden');
  els.choices.classList.add('hidden');
  document.querySelector('.tap-seal span:last-child').textContent = '继续剧情';
  els.tapGate.classList.remove('hidden');
};
// stopPropagation：按钮点击不得冒泡到全局 advance（否则点一次按钮剧情跳一句）
els.btnAuto.onclick = (e) => { e.stopPropagation(); els.btnAuto.classList.toggle('on', player.toggleAuto()); };
els.btnHome.onclick = (e) => { e.stopPropagation(); goHome(); };

// ?seq=N 调试跳转（仅验收用）：跳过轻触直接落到指定步（无声）
const debugSeq = Number(new URLSearchParams(location.search).get('seq'));
if (debugSeq && player.bySeq.has(debugSeq)) {
  started = true;
  els.tapGate.classList.add('hidden');
  showBanner();
  player.start(debugSeq);
} else {
  // 断点恢复：有存档直接从断点续播（不询问），印章文案改为「继续剧情」
  const saved = readStore();
  if (saved.seq && player.bySeq.has(saved.seq)) {
    document.querySelector('.tap-seal span:last-child').textContent = '继续剧情';
  }
  // 统一动态读存档：回首页后再点印章，从「当前」断点续播而非加载时的旧位置
  els.tapGate.addEventListener('click', () => beginFrom(readStore().seq));
}

// 全局点击 = 补全当前句 / 跳下一句（选择按钮自带 stopPropagation）
document.getElementById('app').addEventListener('click', (e) => {
  if (!started) return;
  if (e.target.closest('#tapGate')) return; // 轻触首屏的点击只用于开始/续播，不冒泡推进剧情
  if (!els.choices.classList.contains('hidden')) return;
  player.advance();
});
