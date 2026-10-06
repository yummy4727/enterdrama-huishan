// 进度管理：localStorage 读写/清除（key 见 spec Data Model）
// 不可用时（隐私模式等）静默降级：功能照常、退出即失
const STORE_KEY = 'huishan_trial_v1';

export function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}

export function writeStore(patch) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...readStore(), ...patch })); } catch { /* 降级 */ }
}

export function clearStore() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* 降级 */ }
}
