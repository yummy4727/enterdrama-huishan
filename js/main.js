// 启动：加载数据 → 轻触首屏 → 进播放器（音频解锁片 2 接入）
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

const data = await (await fetch('data/script-slice.json')).json();
const player = new Player(data);

// 首屏背景先铺上
els.bgA.src = data.meta.default_background;
els.bgA.onload = () => els.bgA.classList.add('show');

let started = false;
els.tapGate.addEventListener('click', () => {
  if (started) return;
  started = true;
  els.tapGate.classList.add('hidden');
  // 片 2：在此解锁音频（AudioContext.resume）
  player.start();
});

// 全局点击 = 补全当前句 / 跳下一句（选择按钮自带 stopPropagation）
document.getElementById('app').addEventListener('click', (e) => {
  if (!started) return;
  if (!els.choices.classList.contains('hidden')) return;
  player.advance();
});
