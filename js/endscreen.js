// 结算层：定格压暗、待续印、悬念文案、你的选择摘要、官网 CTA、重玩
import { readStore, clearStore } from './storage.js';
import { mountRewardedCard } from './promo.js';

const CTA_URL = 'https://www.enterdrama.cn/';
const SHARE_TITLE = '入戏·回山试玩｜天亮之前，他得选';

// 摘要单行：0–2 = 剧本原文选项；3 = 沉默
function summaryLine(actLabel, branchSeq, sliceData) {
  const idx = (readStore().choices || {})[branchSeq];
  if (idx === undefined) return `${actLabel}，你替江明说：「……」`;
  if (idx === 3) return `${actLabel}，他没答话。`;
  const text = sliceData.steps.find(s => s.seq === branchSeq).branches[0].choices[idx].text;
  return `${actLabel}，你替江明说：「${text}」`;
}

export function showEndscreen(els, sliceData) {
  document.title = SHARE_TITLE;
  els.endChoice1.textContent = summaryLine('第一幕', 66, sliceData);
  els.endChoice2.textContent = summaryLine('第二幕', 272, sliceData);
  els.endCta.href = CTA_URL;
  mountRewardedCard(els.endAdSlot); // 激励视频广告占位卡（片 6）
  els.replay.onclick = () => {
    clearStore();
    location.href = location.pathname; // 清进度回首屏（去掉 ?seq= 调试参数）
  };
  els.endscreen.classList.remove('hidden');
}
