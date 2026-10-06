// 播放器引擎：按 seq 步进，分派 background / music / narration / line / prompt / branch
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
    this.onStep = opts.onStep || (() => {}); // 每步回调（片 4 存进度用）
    this.current = null;
    this.typing = false;
    this.typingDone = false;
    this.timer = null;
    this.voices = [];   // 在播配音池
    this.bgm = null;    // 当前 BGM Audio
    this.bgmKey = null;
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
        if (step.branches.length && step.branches[0].choices) this.showChoices(step);
        else this.nextAuto(); // 空分支 = 自动汇合跳转
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
  }

  // ---------- 选择（片 1 最小可用，片 3 精修印章样式与摘要） ----------
  showChoices(step) {
    const el = Player.els;
    el.dialog.classList.add('hidden');
    el.choices.innerHTML = '';
    const options = [...step.branches[0].choices.map(c => ({ text: c.text, goto: c.goto_seq }))];
    if (step.default_goto_seq) options.push({ text: '（不答话）', goto: step.default_goto_seq, silent: true });
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.textContent = opt.text;
      btn.onclick = (e) => { e.stopPropagation(); this.pickChoice(opt); };
      el.choices.appendChild(btn);
    }
    el.choices.classList.remove('hidden');
  }

  pickChoice(opt) {
    Player.els.choices.classList.add('hidden');
    this.jump(opt.goto);
  }

  // ---------- 配音（音频不打断，仅台词提前；并发上限兜底） ----------
  playVoice(seq) {
    const src = this.manifest[seq];
    if (!src) return; // 无配音：静默降级，绝不阻塞
    const audio = new Audio(src);
    this.voices.push(audio);
    audio.addEventListener('ended', () => {
      this.voices = this.voices.filter(v => v !== audio);
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
