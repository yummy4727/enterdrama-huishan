# 入戏·回山试玩

一个 3 分钟浏览器可玩的互动剧试玩 H5：点开第一秒就是带配音的剧情，走到选择点剧情真实分岔，结尾悬念切断并跳转官网。纯前端静态页，无后端、无登录，进度存 localStorage。

> English TL;DR: A 3-minute playable interactive-fiction demo (Chinese, ancient-fantasy romance 《回山》). Pure static HTML/CSS/JS — no framework, no backend, no login; progress persists in localStorage. Built as a Devpost "Build With AI: Basics" proof of concept.

## 怎么跑

构建产物（`data/`）不入仓。要本地运行需要《回山》剧本源资产（私有资产，见下），步骤：

```bash
npm install          # 安装构建期依赖（sharp，用于图片压缩）
node scripts/build.mjs   # 裁剪剧本 seq 1–368、拷贝压缩资产、生成音频 manifest
node scripts/serve.mjs   # 起本地静态服务（默认 3000 端口）
# 打开 http://localhost:3000（手机调试可用桌面 DevTools 移动视口 375×812）
```

构建脚本读取的源资产路径在 `scripts/build.mjs` 顶部 `SRC_DIR` 常量：

- 《回山》正本剧本 JSON（1190 步）与立绘/背景/BGM 资产
- 旁白配音 `nar_*.mp3` 与台词配音 `line_*.mp3`（台词 TTS 由 `scripts/gen_dialog_tts.py` 用 edge-tts 生成）

没有源资产时仓库无法直接运行；`scripts/make-fake-ads.mjs` 可重新合成 `assets-src/fake-promo/` 下的假广告图。

## 资产来源与版权口径

- 剧本文字、角色立绘、场景背景、BGM：来自「入戏」项目的原创剧本《回山》资产。
- 旁白与台词配音：项目自有 TTS 管线生成。
- 广告素材：`assets-src/fake-promo/` 为本地自制假图，仅作广告位结构演示，不接任何真实广告网络。

## 目录结构

```
index.html            单页入口（舞台/对话/选择/广告/结算各层骨架）
css/style.css         古风拟物样式（宣纸/墨/朱砂/淡金）
js/main.js            启动与全局交互（轻触解锁音频、断点恢复、?seq= 调试跳转）
js/player.js          播放器引擎（步进状态机、打字机、配音/BGM/背景调度）
js/choices.js         选择层（branch 步选项卡组，选择写入 localStorage）
js/endscreen.js       结算层（定格、悬念文案、选择摘要、官网 CTA、重玩）
js/promo.js           广告占位（底部 banner + 激励视频假卡 3 秒倒计时）
js/storage.js         localStorage 进度读写
scripts/build.mjs     构建期：裁剪/拷贝/压缩/盘点（产物在 data/，已 gitignore）
devpost/              规划文档：scope / prd / spec / checklist（Build With AI 流程产物）
```

## 运行时行为要点

- 轻触首屏统一解锁音频（兼容微信内置浏览器自动播放策略）；台词配音缺失时静默降级，绝不阻塞。
- 每步渲染前写 `localStorage`（key `huishan_trial_v1`）；关页重开直接从断点续播；「重玩一次」清档回首屏。
- 选择点 seq 66 / 272 各有 3 个剧本原文选项 + 「（不答话）」沉默支；选择摘要进结算页。
- `?seq=N` 为验收用调试跳转参数，会覆盖存档，正常分发链接不带此参数。

## 部署口径

线上试玩：`https://enterdrama.cn/trial/`（nginx 静态托管，配置正本在入戏主仓库 `ops/nginx-site.conf` 的 `location ^~ /trial/` 块）。部署内容 = `index.html` + `css/` + `js/` + `data/`（构建产物）+ `assets-src/fake-promo/`（index.html 运行时直接引用假广告图，部署时必须带上）。

> 命名注记：广告占位模块曾叫 `ads.js`、素材目录曾叫 `fake-ads/`，2026-10-06 真机验收发现小米浏览器内置广告拦截会按 URL 字样秒拦 `ads` 命名的脚本与图片（模块图静默断裂 → 灰屏/死门），故更名 `promo.js` / `fake-promo/`。其他浏览器无此问题，但改名零成本，通用性更稳。
