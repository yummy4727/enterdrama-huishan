---
doc: spec
status: approved
---

# 回山试玩版 — Technical Spec

## How This Works, In Plain Language

整个产品就是**一堆静态文件**：一个 `index.html`、几个 JS 文件、一份裁好的剧本数据、一批音频图片。没有服务器程序、没有数据库、没有需要登录的第三方服务——任何能挂静态文件的地方（本机起个服务、腾讯云 nginx）都能跑。

它分两段工作：

1. **构建期（你电脑上跑一次）**：一个 Node 脚本读《回山》正本 `script.json`（1190 步），裁出 seq 1–368 存成 `script-slice.json`；把用到的音频和图片从 `D:\恋爱剧本交友\剧本\回山\` 拷进项目（图片顺手压成 WebP，原图一张 3MB，手机上太重）；盘点每一步的配音文件，缺的列一张清单（拿去走进戏的 TTS 管线补生成）。
2. **运行期（玩家手机上）**：浏览器打开页面，玩家轻触一下解锁声音，播放器按 seq 顺序读剧本数据——每一步是"一句台词/一次背景切换/一次音乐切换"，台词配音播起来、文字打字机逐字出现，点屏幕跳下一句。走到 66 和 272 两步弹出选择，选完跳去对应分支，汇合后继续。走到 368 画面定格，弹出结算页——悬念文案、你的选择摘要、"去入戏 App 看结局"按钮。每播一步就往 `localStorage`（浏览器给每个网站的一块本地小存储）记一笔，关了页面再打开就从断点接着播。

为什么是这个形状：PRD 承诺"第一秒就是出声的剧情、无登录无后端"，所以运行时越薄越好——框架、包管理器、构建工具链在玩家手机上没有任何收益，反而增加微信浏览器兼容风险。复杂度全部前置到构建期的一次性脚本里。

## Stack

| 层 | 选型 | 理由与代价 |
|---|---|---|
| 前端 | 原生 HTML / CSS / JS（ES Modules），**无框架无运行时依赖** | 学习者同意的推荐。零依赖 = 微信内置浏览器兼容风险最小、仓库干净；代价：无类型检查、无热更新（对 368 步的线性播放器可接受） |
| 构建期脚本 | Node ≥ 18（`scripts/build.mjs`，零第三方依赖或仅 devDependencies） | 裁剪/拷贝/压缩/盘点全在构建期完成，产物直接可部署 |
| 图片压缩 | `sharp`（仅构建期 devDependency）[docs](https://sharp.pixelplumbing.com/) | 原 PNG 每张 2.5–3.7MB，微信手机端首屏体验不可接受；压成 WebP 约 300–500KB |
| 字体 | `"Noto Serif SC"` webfont 子集化 + 系统"宋体/楷体"回退 | 古风拟物要求的衬线宋楷；子集化只打包界面用到的字，避免整套中文字体（几 MB） |
| 台词 TTS | 入戏项目现成 TTS 管线（学习者拍板） | 音色与正式版一致，导流一致性最好；仅补台词行，旁白 `nar_*` 全量现成 |

版本说明：Node/sharp 无锁死版本要求；`sharp` 在 Windows 上 npm 安装即用。构建脚本若发现 sharp 不可用，降级为直接拷贝原图并在控制台警告（构建不因此失败）。

## Where It Runs and How Someone Tries It

- **运行时**：任意现代浏览器（目标：微信内置浏览器 + 手机浏览器；桌面浏览器居中竖屏画布）。运行时零环境要求、零 API key。
- **本地跑**：`node scripts/build.mjs` → 起任意静态服务（如 `npx serve .`）→ 打开 `http://localhost:3000`。
- **录屏（比赛必交物）**：手机浏览器真机，或桌面 DevTools 移动视口（375×812）。
- **GitHub 公开仓库（比赛必交物）**：提交代码 + `devpost/` 规划文档；**构建产物与音频图片资产不入仓**（学习者拍板，防更新膨胀；评委不运行代码，README 记录资产来源与构建步骤即可复现）。
- **部署（可选 Try-it-out 链接）**：腾讯云 `ubuntu@49.235.29.61`，`enterdrama.cn` 的子路径（如 `/trial/`），nginx 静态托管，rsync/scp 上传构建产物。部署不是必交物，细节 6-ship 再定。

## Look and Feel

Implements `prd.md > Look and Feel`，实现落点：

- **配色**（CSS 自定义属性）：宣纸米白 `#f6f1e5` 底、墨黑 `#2c2822` 正文、朱砂 `#a83c2e` 点睛（选择按钮/印章/关键 CTA）、淡金 `#c9a96a` 分隔线；低饱和，贴《回山》木色陶土美术口径。
- **质感**：宣纸纹理底（CSS 渐变/噪点实现，不引入贴图）、细回纹描边装饰；印章式按钮 = 朱砂底白字 + 圆角 2px + 盖下微缩放动效。
- **字体**：衬线宋楷系，标题字重 700、正文 400。
- **动效**：打字机逐字（约 40ms/字）；背景切换 opacity 淡入淡出（约 600ms）；选择按钮"盖下"微动效。无粒子、无翻页特效。
- **禁**：玻璃拟态、纯黑底白字、Q 版元素。

## Components

### 构建脚本 `scripts/build.mjs`

一次性预处理（Implements 全部行为的素材前提）：

1. 读 `D:\恋爱剧本交友\剧本\回山\回山-script_json\script.json`（1190 步正本），裁 seq 1–368 → `data/script-slice.json`（文本零改动）。
2. 资产拷贝：切片内 4 张背景（`bg_shop_dusk` / `bg_shop_night` / `bg_store_night` / `bg_courtyard_night`）、2 张头像（`江明.png` / `陈惠卿.png`）、4 段 BGM（`bgm_daily` / `bgm_uneasy` 用到，全拷）、旁白 `nar_*` 按切片引用拷贝；图片转 WebP。
3. **音频盘点**：遍历切片 368 步，生成 `data/audio-manifest.json`（seq → 音频文件映射）与 `data/audio-missing.json`（缺口清单，含台词行文本，直接可投喂 TTS 管线）。旁白与台词的文件命名/映射规则（旁白为 `nar_XXXX.mp3` 奇数序号）在此步与正本逐条核对。
4. 字体子集化（可选步骤，工具可用则做，不可用则回退系统字体）。

### 轻触首屏

全屏第一幕背景 + 居中"轻触 开启剧情"印；唯一点击门，点击时调 `AudioContext.resume()` / 首次 `play()` 解锁音频。Implements `prd.md > 有声播放器`、`prd.md > States and Boundaries`（首次使用）。

### 播放器引擎

核心组件，一个按 seq 步进的状态机：

- 输入：`script-slice.json` + `audio-manifest.json`；每步按 `type` 分派——文本行（旁白/台词）、`background`、`music`、`branch`。
- 渲染：底部对话框（旁白无头像字体略灰 / 台词带圆框头像+角色名），打字机与配音同步开始。
- 交互：点击 = 未完句立即完整、已完句跳下一句；跳句时停掉上一句配音（防混声，学习者修订）。
- 音频调度：台词行播对应 mp3（缺失则静默降级不阻塞）；BGM 循环播放，`music` 步触发 `bgm_daily → bgm_uneasy → bgm_daily` 淡入淡出切换；背景淡入淡出切换。
- 每步渲染前写 localStorage（见 Data Model）。

Implements `prd.md > 有声播放器` 全部验收项。

### 选择层

走到 `branch` 步（seq 66 / 272）暂停推进，对话框位置换成竖排 4 枚朱砂印章按钮：3 个剧本原文选项 + "（不答话）"（超时支标签，`default_goto_seq` 67→89 / 273→299）。点选后记录进选择摘要、写入 localStorage、跳 `goto_seq`。选项文案照抄正本，不缩写。Implements `prd.md > 玩家选择`。

### 结算层

seq 368 播完触发：定格背景压暗 → 朱砂印"待续" → 悬念文案（PRD 已批初稿）→ "你的选择"两行摘要 → CTA"去入戏 App 看结局"（新窗口 `https://www.enterdrama.cn/`）→ 激励视频假广告卡 → "重玩一次"（清 localStorage 回首屏）。`document.title` = "入戏·回山试玩｜天亮之前，他得选"。Implements `prd.md > 结算页（导流）`。

### 广告占位层

- 底部 banner 常驻条：古风修仙假广告图（自制）+ 右上"广告"角标，结算页隐藏。
- 激励视频假卡（结算层内）：点击 → 全屏假广告图 → 3 秒倒计时 → 关闭按钮出现 → 返回结算页。
Implements `prd.md > 广告占位（假素材演示）`。

### 进度管理

一个读写 localStorage 的模块，被播放器引擎和结算层调用。Implements `prd.md > 进度与重玩`。

## Data Model

**`data/script-slice.json`**（构建产物）：seq 1–368 的步数组，每步字段沿用正本结构（`type` / `text` / `char_id` / `background` / `music` / `audio` / `branches[].choices[].{text,goto_seq}` / `default_goto_seq`），外加 `end: true` 标记 seq 368。选择点共 2 处，超时支 2 条。

**`data/audio-manifest.json`**：`{ "<seq>": "audio/nar_0067.mp3", ... }`；台词行与旁白统一走此映射，缺失的 seq 不出现在映射里（播放器静默跳过）。

**localStorage**（key `huishan_trial_v1`，学习者网站域下的一块持久小存储）：

```json
{ "seq": 89, "choices": { "66": 2 } }
```

- 每步渲染前更新 `seq`；选择时写入 `choices`。
- 打开页面时：有记录 → 直接跳 `seq` 断点并还原选择摘要；无记录 → 轻触首屏从头开始。
- "重玩一次" → 删除该 key。隐私模式等 localStorage 不可用时：功能照常、退出即失（见 Failure Modes）。

## File Structure

```
d:\explore\
├── index.html                 # 单页入口：舞台层/对话层/选择层/广告层/结算层的骨架
├── css/style.css              # 古风拟物全部样式（宣纸/墨/朱砂/淡金 CSS 变量）
├── js/
│   ├── main.js                # 启动：加载 manifest → 判断进度 → 轻触解锁 → 进引擎
│   ├── player.js              # 播放器引擎：步进状态机、打字机、音频/BGM/背景调度
│   ├── choices.js             # 选择层：branch 步的选项卡组
│   ├── endscreen.js           # 结算层：定格、文案、摘要、CTA、重玩
│   ├── promo.js               # 广告占位：banner + 激励视频假卡流程
│   └── storage.js             # 进度管理：localStorage 读写/清除
├── scripts/build.mjs          # 构建期：裁剪/拷贝/压缩/盘点/字体子集
├── data/                      # 全部构建产物（.gitignore，不入仓）
│   ├── script-slice.json
│   ├── audio-manifest.json
│   ├── audio-missing.json     # TTS 补生成投喂清单
│   └── assets/                # audio/ bg/ portraits/（压缩后）
├── assets-src/fake-promo/     # 假广告图源文件（自制，入仓，体积小）
├── devpost/                   # 规划文档（scope/prd/spec + html，入仓）
├── .gitignore                 # data/ 构建产物
└── README.md                  # 资产来源、构建命令、试玩方式（入仓）
```

边界：`js/` 六个文件即全部运行时代码；`data/` 一律不手改，坏了重跑构建。

## External Services and Dependencies

- **运行时外部服务：无。** 不调任何 API，无 key、无限额、无费用。
- **构建期依赖**：Node ≥ 18（[nodejs.org](https://nodejs.org/docs/latest/api/)）、`sharp`（[docs](https://sharp.pixelplumbing.com/)，仅 devDependency）。
- **TTS 补生成**：入戏项目现成管线（本机资产，非本仓库内容）；构建期产出 `audio-missing.json` 作为投喂清单，补好的 mp3 放入资产目录后重跑构建即纳入 manifest。
- **托管**：本地静态服务（试玩/录屏）；腾讯云 nginx 静态托管（可选上线，6-ship 定细节）。

## Important Failure Modes

- **台词音频缺失或加载慢** → 静默降级：台词照常打字机推进，绝不阻塞、绝不白屏（`prd.md > States and Boundaries` 承诺"第一秒出声"由音频盘点+补生成保障，运行时不赌网络）。
- **背景图加载失败** → 暗色底 + 场景名淡字占位，流程不中断。
- **localStorage 不可用（隐私模式/清缓存）** → 无进度照常玩，退出即失；不报错。
- **微信自动播放策略差异** → 轻触首屏统一解锁 + 首句播放失败时静默重试一次；具体机型差异构建期真机实测校准（见 Open Issues）。

## What Was Simplified and Why

- **资产与构建产物不入仓**（.gitignore）— 学习者拍板防更新膨胀；评委不运行代码，README 记录复现步骤。代价：克隆仓库不能直接跑，需本地回山资产。
- **无框架、无打包器** — 运行时零依赖；代价是放弃类型检查，换取微信兼容确定性。
- **假广告图自制**（scope `The POC Boundary`）— 不接广告网络；结构（banner 位/激励位/倒计时关闭）完整保留。
- **分享卡只设 `document.title`** — 不接微信 JS-SDK（PRD 拍板）；代价是分享缩略图不可控，POC 接受。
- **桌面端不深适配** — 居中竖屏画布，消费场景在手机。

## Decisions and Open Issues

**学习者拍板：**

- 前端**原生 HTML/CSS/JS + Node 构建脚本**（接受我的推荐，放弃 Vite+TS 的类型/热更新便利换零依赖）。
- **部署腾讯云**（enterdrama.cn 子路径）作 Devpost 可选 Try-it-out 链接；GitHub 公开仓库为必交物（学习者询问后确认：仓库 URL 不可用其他地址替代，试玩链接放 Try-it-out 位）。
- **资产不入仓**——理由：防后续 TTS 重生成/更新导致仓库体积膨胀（实测全量资产约 90MB，其实在 GitHub 限制内，但尊重决定，收益是仓库历史干净）。
- **台词 TTS 用入戏现有管线补生成**——音色与正式版一致，导流一致性最好。

**派生实现细节（由以上决定导出，无需再议）：** 图片压缩 WebP、字体子集化、localStorage schema、构建脚本产出物。

**构建期核对的未知项（One useful unknown）：**

- **旁白音频与 seq 的映射规则**——`nar_0001/0003/0005` 奇数序号命名与 1190 步正本的对应关系未经逐条核对；以构建期盘点脚本对齐 `script.json` 的 audio 引用与 `narration/` 实际文件，产出 manifest + 缺口报告为验证证据。
- **台词行配音全量缺失**（学习者确认无现成音频）→ 368 步中台词行走 TTS 管线补生成；验收 = manifest 无缺口。
- **微信内置浏览器自动播放/解锁行为差异**——真机实测校准轻触解锁方案（PRD Open Questions 顺延）。

## Sharing（6-ship 记录）

- **公开仓库**：https://github.com/yummy4727/enterdrama-huishan （2026-10-06 创建，master 分支，无认证可访问已验证）
- **线上试玩（Devpost Try-it-out 位）**：https://enterdrama.cn/trial/
- **演示视频**：已录制 `demo-huishan.mp4`（2:22，720×1640 竖屏，真机内录配音/BGM；含轻触出声、两个选择点真分岔、结算页、激励视频假卡全流程、CTA 跳官网）。
- **视频链接（优酷）**：https://v.youku.com/v_show/id_XNjU2NjQzMzgzMg==.html （2026-10-07 上传）
- **提交**：2026-10-07 提交至 Devpost，项目页 https://devpost.com/software/start-up-ek21hj （比赛截止 2026-10-26，提交后仍可编辑）；仓库补 MIT LICENSE（7c6437e），缩略图取自演示视频选择点帧。
