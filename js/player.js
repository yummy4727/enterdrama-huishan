// 播放器引擎：按 seq 步进，分派 background / music / narration / line / prompt / branch
import { showChoices } from './choices.js';

const TYPE_SPEED = 40;   // 打字机 ms/字
const VOICE_MAX = 4;     // 并发配音上限（点击过快时停最旧，正常节奏不触发）
const BGM_VOL = 0.55;    // BGM 目标音量
const FADE_MS = 900;     // BGM 淡切时长

export class Player {
  constructor(data, opts = {}) {
    this.meta = data.meta;
    this.steps = data.steps;
    this.manifest = opts.manifest || {};
    this.bySeq = new Map(this.steps.map(s => [s.seq, s]));
    this.onStep = opts.onStep || (() => {}); // 每步回调（存进度）
    this.onEnd = opts.onEnd || (() => {});   // 切断定格步（end:true）台词播完后回调
    this.current = null;
    this.typing = false;
    this.typingDone = false;
    this.timer = null;
    this.voices = [];   // 在播配音池
    this.bgm = null;    // 当前 BGM Audio
    this.bgmKey = null;
    this.auto = false;        // 自动播放：当前句（配音+打字机）结束后自动进下一句
    this.autoVoiceDone = true; // 当前句配音是否已播完（无配音句恒 true）
    this.autoTimer = null;
  }

  // ---------- DOM ----------
  static els = {};
  static bindDom(els) { Player.els = els; }

  start(seq = this.steps[0].seq) {
    this.jump(seq);
  }

  jump(seq) {
    const step = this.bySeq.get(seq);
    if (!step) return console.warn('jump 无此 seq:', seq);
    clearTimeout(this.autoTimer);
    this.stopVoices(); // 跳句即停上一句配音，避免混声（BGM 不受影响）
    this.autoVoiceDone = !this.manifest[seq]; // 有配音句等 ended，无配音句视为已完
    this.current = step;
    this.render(step);
  }

  advance() {
    // 打字中 → 先补全
    if (this.typing && !this.typingDone) { this.finishTyping(); return; }
    if (this.current.type === 'branch') return; // 选择步由选项点击驱动
    const next = this.bySeq.get(this.current.seq + 1);
    if (next) this.jump(next.seq);
  }

  // ---------- 渲染分派 ----------
  render(step) {
    this.onStep(step);
    const el = Player.els;
    switch (step.type) {
      case 'background': this.setBackground(step.image_key); this.nextAuto(); break;
      case 'music': this.setMusic(step.song_key); this.nextAuto(); break;
      case 'narration': this.showDialog(step, false); break;
      case 'line':
      case 'prompt': this.showDialog(step, true); break;
      case 'branch':
        if (step.branches.length && step.branches[0].choices) {
          el.dialog.classList.add('hidden'); // 选项卡组替换对话框位置
          showChoices(el.choices, step, (goto) => this.jump(goto));
        } else this.jump(step.default_goto_seq ?? step.seq + 1); // AUTO 分支按正本汇合点跳转
        break;
      default:
        console.warn('未知步类型', step.type, step.seq); this.nextAuto();
    }
  }

  nextAuto() {
    const next = this.bySeq.get(this.current.seq + 1);
    if (next) this.jump(next.seq);
  }

  // ---------- 背景 ----------
  setBackground(key) {
    const el = Player.els;
    const src = this.meta.backgrounds[key];
    const show = el.bgA.classList.contains('show') ? el.bgB : el.bgA;
    const hide = show === el.bgA ? el.bgB : el.bgA;
    if (!src) { el.bgFallback.dataset.name = key; el.bgFallback.classList.add('show'); return; }
    el.bgFallback.classList.remove('show');
    show.src = src;
    show.onload = () => { show.classList.add('show'); hide.classList.remove('show'); };
    show.onerror = () => { el.bgFallback.dataset.name = key; el.bgFallback.classList.add('show'); };
  }

  // ---------- 对话 ----------
  showDialog(step, withChar) {
    this.playVoice(step.seq); // 打字机与配音同步开始；缺失静默跳过
    const el = Player.els;
    el.dialog.classList.remove('hidden');
    el.dialog.classList.toggle('narration', !withChar);
    if (withChar) {
      const ch = this.meta.characters[step.char_id] || {};
      el.avatarWrap.classList.remove('hidden');
      el.avatar.src = ch.avatar || '';
      el.charName.textContent = ch.name || '';
    } else {
      el.avatarWrap.classList.add('hidden');
      el.charName.textContent = '';
    }
    this.typewrite(el.charText, step.text || '');
  }

  typewrite(target, text) {
    clearInterval(this.timer);
    this.typing = true; this.typingDone = false;
    let i = 0;
    target.textContent = '';
    this.timer = setInterval(() => {
      target.textContent = text.slice(0, ++i);
      if (i >= text.length) this.finishTyping();
    }, TYPE_SPEED);
    this._fullText = text;
    this._target = target;
  }

  finishTyping() {
    clearInterval(this.timer);
    this._target.textContent = this._fullText;
    this.typing = true; this.typingDone = true; // 点击即跳下一句
    this.maybeAuto(); // 自动播放：打字机与配音取更晚结束者
    if (this.current.end) setTimeout(() => this.onEnd(), 1400); // 最后一句定格片刻 → 结算页
  }

  // ---------- 自动播放 ----------
  toggleAuto() {
    this.auto = !this.auto;
    if (this.auto) this.maybeAuto(); // 开关打开瞬间当前句可能早已播完
    return this.auto;
  }

  maybeAuto() {
    if (!this.auto || !this.typingDone || !this.autoVoiceDone) return;
    clearTimeout(this.autoTimer);
    this.autoTimer = setTimeout(() => { if (this.auto) this.advance(); }, 500); // 句间稍作停顿
    // branch 步 advance 直接 return：真分岔永远等玩家选
  }

  // ---------- 配音（跳句停上一句防混声；并发上限兜底） ----------
  stopVoices() {
    for (const v of this.voices) { v.pause(); v.removeAttribute('src'); v.load(); }
    this.voices = [];
  }

  // 回首页：停全部声音与自动播放；保留 bgmKey 供续播恢复
  stopAll() {
    this.stopVoices();
    clearTimeout(this.autoTimer);
    if (this.bgm) { this.bgm.pause(); this.bgm.removeAttribute('src'); this.bgm.load(); this.bgm = null; }
  }

  // 续播恢复 BGM（须在点击手势内调用以过自动播放策略）
  resumeBgm() {
    if (!this.bgmKey) return;
    const key = this.bgmKey;
    this.bgmKey = null;
    this.setMusic(key);
  }

  playVoice(seq) {
    const src = this.manifest[seq];
    if (!src) return; // 无配音：静默降级，绝不阻塞
    this.autoVoiceDone = false;
    const audio = new Audio(src);
    this.voices.push(audio);
    audio.addEventListener('ended', () => {
      this.voices = this.voices.filter(v => v !== audio);
      this.autoVoiceDone = true;
      this.maybeAuto(); // 自动播放：配音播完（打字机若也完）→ 进下一句
    });
    // 超过并发上限：停最旧（仅在快速连点时发生）
    while (this.voices.length > VOICE_MAX) {
      const old = this.voices.shift();
      old.pause();
      old.removeAttribute('src'); old.load();
    }
    audio.play().catch(() => {
      // 首句播放失败静默重试一次（微信自动播放策略差异），仍失败则放弃
      setTimeout(() => audio.play().catch(() => {}), 300);
    });
  }

  // ---------- BGM：循环播放，music 步淡切 ----------
  setMusic(key) {
    if (key === this.bgmKey && this.bgm) return;
    this.bgmKey = key;
    const src = this.meta.music[key];
    if (!src) return;
    const old = this.bgm;
    const next = new Audio(src);
    next.loop = true;
    next.volume = 0;
    this.bgm = next;
    let ticks = 0;
    const fade = setInterval(() => {
      if (++ticks > 60) { clearInterval(fade); return; } // 兜底：约 5s 后不再空转
      // 淡出旧曲
      if (old && !old.paused) {
        old.volume = Math.max(0, old.volume - 0.05);
        if (old.volume <= 0) { old.pause(); old.removeAttribute('src'); old.load(); }
      }
      // 淡入新曲
      if (!next.paused) {
        next.volume = Math.min(BGM_VOL, next.volume + 0.05);
        if (next.volume >= BGM_VOL) clearInterval(fade);
      }
    }, FADE_MS * 0.05 / BGM_VOL);
    next.play().catch(() => setTimeout(() => next.play().catch(() => {}), 300));
  }
}
