#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_dialog_tts.py —— 片7：按 data/audio-missing.json 补生成台词配音（edge-tts）。

读 d:\explore\data\audio-missing.json（build.mjs 盘点产物），
把每条 line/prompt 台词合成到《回山》资产目录 dialog/line_{seq:04d}.mp3，
重跑 node scripts/build.mjs 后 audio-manifest.json 即纳入全部台词。

音色（与旁白 zh-CN-YunxiNeural 区分人物）：
  c1 江明   → zh-CN-YunjianNeural（青年男声）
  c2 陈惠卿 → zh-CN-XiaoyiNeural（青年女声）
语速与旁白一致（-4%）。

用法：python scripts/gen_dialog_tts.py [--force]
依赖：pip install edge-tts mutagen
"""
import argparse
import asyncio
import json
import os
import sys
import time

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MISSING_JSON = os.path.join(ROOT, "data", "audio-missing.json")
ASSET_DIR = r"D:\恋爱剧本交友\剧本\回山\回山-资产"
OUT_DIR = os.path.join(ASSET_DIR, "dialog")
STATE_FILE = os.path.join(OUT_DIR, "dialog_state.json")

VOICES = {"c1": "zh-CN-YunjianNeural", "c2": "zh-CN-XiaoyiNeural"}
RATE = "-4%"
CONCURRENCY = 4
RETRIES = 3
RETRY_BACKOFF_S = 2
MIN_MS = 300  # 音频最短时长（防空音频）


def mp3_ok(path, min_ms=MIN_MS):
    if not os.path.exists(path) or os.path.getsize(path) < 1024:
        return False
    try:
        from mutagen.mp3 import MP3
        return MP3(path).info.length * 1000 >= min_ms
    except ImportError:
        return True  # 无 mutagen 时退化为大小检查
    except Exception:
        return False


def mp3_ms(path):
    from mutagen.mp3 import MP3
    return int(MP3(path).info.length * 1000)


def load_state():
    if os.path.exists(STATE_FILE):
        try:
            return json.load(open(STATE_FILE, encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_state(state):
    json.dump(state, open(STATE_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


async def worker(sem, item, state, failed, progress):
    out_path = os.path.join(OUT_DIR, f"line_{item['seq']:04d}.mp3")
    voice = VOICES.get(item.get("char"), "zh-CN-YunxiNeural")
    key = str(item["seq"])
    async with sem:
        for attempt in range(RETRIES):
            try:
                comm = edge_tts.Communicate(item["text"], voice, rate=RATE)
                await comm.save(out_path + ".part")
                os.replace(out_path + ".part", out_path)
                if not mp3_ok(out_path):
                    raise RuntimeError("合成结果校验不通过")
                state[key] = item["text"]
                save_state(state)
                progress[0] += 1
                if progress[0] % 20 == 0:
                    print(f"  进度 {progress[0]}/{progress[1]}")
                return
            except Exception as e:
                if attempt < RETRIES - 1:
                    await asyncio.sleep(RETRY_BACKOFF_S * (attempt + 1))
                else:
                    failed.append((key, repr(e)))
                    print(f"  [FAIL] seq {key}: {e!r}")


async def run(force):
    items = json.load(open(MISSING_JSON, encoding="utf-8"))
    items = [it for it in items if it["type"] in ("line", "prompt")]
    if not items:
        print("missing 清单无台词，无需生成")
        return
    os.makedirs(OUT_DIR, exist_ok=True)
    state = load_state()

    todo = []
    for it in items:
        out_path = os.path.join(OUT_DIR, f"line_{it['seq']:04d}.mp3")
        if not force and state.get(str(it["seq"])) == it["text"] and mp3_ok(out_path):
            continue
        todo.append(it)

    print(f"共 {len(items)} 条台词，待合成 {len(todo)} 条")
    if todo:
        sem = asyncio.Semaphore(CONCURRENCY)
        failed, progress = [], [0, len(todo)]
        t0 = time.time()
        await asyncio.gather(*(worker(sem, it, state, failed, progress) for it in todo))
        print(f"合成完成 {progress[0]}/{len(todo)}，耗时 {time.time()-t0:.0f}s")

    # ---- 终检：全量清单必须文件齐全 ----
    missing, total_ms = [], 0
    for it in items:
        p = os.path.join(OUT_DIR, f"line_{it['seq']:04d}.mp3")
        if not os.path.exists(p):
            missing.append(it["seq"])
            continue
        try:
            total_ms += mp3_ms(p)
        except Exception:
            pass
    print(f"终检：{len(items)} 条｜缺失 {len(missing)}｜总时长 {total_ms/60000:.1f} 分钟")
    if missing:
        print("缺失:", missing[:20])
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="片7 台词 TTS 补生成")
    ap.add_argument("--force", action="store_true", help="忽略增量状态全部重合成")
    asyncio.run(run(ap.parse_args().force))
