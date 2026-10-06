// 选择层：branch 步的朱砂印选项卡组；选择结果经 storage.js 写入 localStorage
import { readStore, writeStore } from './storage.js';

// 记录选择：choices[branch步seq] = 选项序号（0–2 剧本原文，3 = 不答话）
export function recordChoice(branchSeq, choiceIndex) {
  const s = readStore();
  s.choices = s.choices || {};
  s.choices[branchSeq] = choiceIndex;
  writeStore(s);
}

// 渲染选项卡组：3 个剧本原文 + （不答话）→ default_goto_seq；点击后回调 onPick(gotoSeq)
export function showChoices(el, step, onPick) {
  el.innerHTML = '';
  const options = step.branches[0].choices.map((c, i) => ({ index: i, text: c.text, goto: c.goto_seq }));
  if (step.default_goto_seq) options.push({ index: options.length, text: '（不答话）', goto: step.default_goto_seq });
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.textContent = opt.text; // 选项文案照抄正本，不缩写
    btn.onclick = (e) => {
      e.stopPropagation();
      recordChoice(step.seq, opt.index);
      el.classList.add('hidden');
      onPick(opt.goto);
    };
    el.appendChild(btn);
  }
  el.classList.remove('hidden');
}
