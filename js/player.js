// 播放器引擎：按 seq 步进，分派 background / music / narration / line / prompt / branch
const TYPE_SPEED = 40; // 打字机 ms/字

export class Player {
  constructor(data, opts = {}) {
    this.meta = data.meta;
    this.steps = data.steps;
    this.bySeq = new Map(this.steps.map(s => [s.seq, s]));
    this.onStep = opts.onStep || (() => {}); // 每步回调（片 4 存进度用）
    this.current = null;
    this.typing = false;
    this.typingDone = false;
    this.timer = null;
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
      case 'music': this.nextAuto(); break;        // BGM 调度片 2 接入
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
}
