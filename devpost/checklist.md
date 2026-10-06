---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn

## Slices

- [x] **1. 构建脚本 + 可点击读的试玩骨架**
  Becomes usable: 打开页面轻触后，能逐句点击读第一幕：背景图、对话框、打字机、场景切换全部就位（暂无声）。
  Why now: 一次性打通最大风险——正本 1190 步裁剪、旁白奇数序号映射、资产压缩、播放器读数全链路；坏消息最早出现。
  PRD ref: `prd.md > The Core Journey` (steps 1–3)、`prd.md > Screens and Layout`
  Spec ref: `spec.md > Components > 构建脚本`、`spec.md > Data Model`、`spec.md > File Structure`
  Build: `git init` + .gitignore 补 `data/`；写 `scripts/build.mjs`（裁 seq 1–368、拷贝压缩资产、生成 audio-manifest/missing、正本文字零改动校验）；搭 index.html/css/js 骨架（main/player/storage 最小版）：轻触首屏、背景淡切、打字机台词、点击推进。
  Verify (mechanical): `node scripts/build.mjs` 退出码 0；script-slice.json 恰 368 步、2 处 branch、2 条 default_goto_seq（67→89/273→299）；manifest 与 missing 报告生成；起本地静态服务，浏览器实走 20+ 步，背景切换与步进一致。
  Learner check: 打开页面轻触进入，点读十几句，看对话框/打字机/背景切换的手感对不对。
  Commit: `构建脚本与文字版试玩骨架`

- [ ] **2. 有声：旁白配音与 BGM（kernel：第一秒出声）**
  Becomes usable: 轻触后第一句旁白配音出声，BGM 起且在 music 步淡切（bgm_daily → bgm_uneasy），台词打字机与配音同步。
  Why now: "点开第一秒就是出声的剧情"是 scope 承诺的核心拍点，紧贴数据链路接入。
  PRD ref: `prd.md > 有声播放器`
  Spec ref: `spec.md > Components > 播放器引擎`、`spec.md > Components > 轻触首屏`
  Build: player.js 接 audio-manifest 逐句调度（缺失静默跳过）、AudioContext 解锁链路、BGM 循环与 music 步淡切、音频不打断仅台词提前。
  Verify (mechanical): 浏览器实测（自动化）：轻触后首个 audio 触发 play、控制台零报错、背景/音乐步切换时资源请求正确；报告 manifest 对已生成旁白的覆盖率。
  Learner check: 手机浏览器打开，听第一句是否 3 秒内出声、BGM 是否在钩子处变调。
  Commit: `接入旁白配音与BGM调度`

- [ ] **3. 选择点与真实分支（含"不答话"）**
  Becomes usable: 走到 seq 66/272 弹出 4 枚朱砂印选项，选完播对应分支、汇合继续；选 A 与选 B 后续台词确实不同。
  Why now: "按下去剧情真的不一样"是内核第二拍；此片完成后核心循环（读→选→变）首次完整可玩，是早期反馈检查点。
  PRD ref: `prd.md > 玩家选择`
  Spec ref: `spec.md > Components > 选择层`
  Build: choices.js 渲染 branch 步选项卡组（3 原文 + （不答话）→default_goto_seq）、点选跳转、选择摘要写入 localStorage；加 `?seq=` 调试跳转参数（仅验收用）。
  Verify (mechanical): 浏览器自动化跳 seq 66：两条剧本选项各走一次，断言下一句文本不同；"（不答话）"落到 seq 89；seq 272 同法验证 299；选项文案与正本逐字一致（脚本比对）。
  Learner check: 实走一次选择，感受分支变化与按钮手感。
  Commit: `选择点与分支推进`

- [ ] **4. 断点恢复**
  Becomes usable: 播到任一处关页重开，直接从断点台词继续，已做选择不丢；清进度后从头开始。
  Why now: 存储读写已在片 1–3 就位，此片只补"回来"的路径，风险最低时验证 PRD 状态行为。
  PRD ref: `prd.md > 进度与重玩`、`prd.md > States and Boundaries`（断点恢复）
  Spec ref: `spec.md > Components > 进度管理`、`spec.md > Data Model`
  Build: storage.js 完整化：每步渲染前写 seq、开页读档直接跳断点并还原选择摘要、localStorage 不可用时静默降级。
  Verify (mechanical): 浏览器自动化：玩到中途带 storage 重开，断言从同 seq 继续、摘要文本一致；删除 key 后重开回首屏。
  Learner check: 手机上玩半分钟关页重开，确认接着播。
  Commit: `localStorage断点恢复`

- [ ] **5. 结算页（导流终点）**
  Becomes usable: 播完 seq 368 画面定格，弹出结算页：待续印、悬念文案、你的选择两行摘要、CTA 跳官网、重玩清进度；页面标题为分享文案。
  Why now: 导流结算页是内核的收口（"能玩的买量广告"最后一跳），核心旅程至此全程可走通。
  PRD ref: `prd.md > 结算页（导流）`
  Spec ref: `spec.md > Components > 结算层`
  Build: endscreen.js（定格压暗、待续印、主副文案、摘要两行含沉默文案、CTA 新窗口 enterdrama.cn、重玩清 storage 回首屏）、document.title 设置。
  Verify (mechanical): 浏览器自动化跳 seq 368：断言结算元素齐全、摘要与实际选择逐字一致（含沉默显示"他没答话。"）、CTA href 与 target 正确、重玩后回轻触首屏且 storage 为空。
  Learner check: 走完整旅程到结算页，看文案与跳转。
  Commit: `结算导流页与重玩`

- [ ] **6. 广告占位（假素材演示）**
  Becomes usable: 播放全程底部假广告 banner（带"广告"角标、结算页隐藏）；结算页激励视频假卡可走完"点开→3 秒倒计时→关闭→回结算"全流程。
  Why now: 广告位结构是 scope 的 POC 边界承诺，素材与流程都为演示真实投放观感。
  PRD ref: `prd.md > 广告占位（假素材演示）`
  Spec ref: `spec.md > Components > 广告占位层`
  Build: ads.js（banner 常驻/结算隐藏、假卡倒计时关闭流程）+ 自制两张古风修仙假广告素材（本地合成，入 assets-src/fake-ads）。
  Verify (mechanical): 浏览器自动化：播放中 banner 可见且带角标，结算页不可见；假卡点开后倒计时走 3 秒、关闭钮出现、关闭后回结算页。
  Learner check: 看假广告观感是否"像模像样"。
  Commit: `广告占位层与假素材`

- [ ] **7. 台词配音补齐（manifest 清零）**
  Becomes usable: 368 步内台词行配音补生成完毕，任何一句出现即有声。
  Why now: 缺口清单已在片 1 产出，TTS 管线是学习者现成资产，放最后批量跑避免阻塞前六片验证。
  PRD ref: `prd.md > 有声播放器`
  Spec ref: `spec.md > External Services and Dependencies`（TTS 补生成）
  Build: 按 `data/audio-missing.json` 用入戏现成 TTS 管线补生成台词 mp3，放入资产目录重跑构建，manifest 纳入全部台词。
  Verify (mechanical): 重跑盘点 missing 计数为 0；抽听 3 段台词音色与音量正常；manifest 覆盖率报告 100%。
  Learner check: 手机实走，任意点几段台词确认有声。
  Commit: `台词TTS补齐并更新manifest`

## Hands-on Checkpoints

- [ ] 早期反馈（片 3 后）：核心循环（读→选→分支）首次完整，学习者试玩并给方向性反馈
- [ ] 最终踢胎（片 7 后）：学习者自由探索完整核心旅程并汇总反馈

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions

