#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""tts_regen.py —— 试玩版旁白重生成（旁路，不入正本资产）

读 data/script-slice.json，把 TTS 读感修正过的旁白（老周说：/韩策说：…）
用与正本相同的音色合成到 assets-src/audio-overrides/nar_XXXX.mp3；
build.mjs 会优先取用该目录。正本 narration/ 资产不受影响。

用法：
  python scripts/tts_regen.py           # 增量（已有且时长达标则跳过）
  python scripts/tts_regen.py --force   # 全部重合成
依赖：pip install edge-tts mutagen（本机已随入戏管线安装）
"""
import argparse
import asyncio
import json
import os
import sys

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SLICE = os.path.join(ROOT, "data", "script-slice.json")
OUT_DIR = os.path.join(ROOT, "assets-src", "audio-overrides")

VOICE = "zh-CN-YunxiNeural"  # 与回山正本旁白一致（对话稿/nar_manifest.json）
RATE = "-4%"
CONCURRENCY = 4
RETRIES = 3
MIN_MS = 300


def mp3_ms(path):
    from mutagen.mp3 import MP3
    return int(MP3(path).info.length * 1000)


def ok(path):
    if not os.path.exists(path) or os.path.getsize(path) < 1024:
        return False
    try:
        return mp3_ms(path) >= MIN_MS
    except ImportError:
        return True
    except Exception:
        return False


async def synth(text, out_path):
    comm = edge_tts.Communicate(text, VOICE, rate=RATE)
    await comm.save(out_path + ".part")
    os.replace(out_path + ".part", out_path)


async def worker(sem, item, state, failed):
    async with sem:
        for attempt in range(RETRIES):
            try:
                await synth(item["text"], item["out"])
                if not ok(item["out"]):
                    raise RuntimeError("合成校验不通过")
                state[item["key"]] = True
                print(f"  ✓ {item['key']} ({len(item['text'])}字)")
                return
            except Exception as e:
                if attempt < RETRIES - 1:
                    await asyncio.sleep(2 * (attempt + 1))
                else:
                    failed.append(item["key"])
                    print(f"  [FAIL] {item['key']}: {e!r}")


async def main(force):
    data = json.load(open(SLICE, encoding="utf-8"))
    os.makedirs(OUT_DIR, exist_ok=True)
    items = []
    for s in data["steps"]:
        if s.get("type") != "narration" or not s.get("audio_key"):
            continue
        text = s.get("text") or ""
        if not text.startswith(("老周说：", "韩策说：")):
            continue  # 只重生成读感修正过的行
        out = os.path.join(OUT_DIR, f"{s['audio_key']}.mp3")
        if not force and ok(out):
            continue
        items.append({"key": s["audio_key"], "text": text, "out": out})

    print(f"音色 {VOICE}｜语速 {RATE}｜待重生成 {len(items)} 条 → {os.path.relpath(OUT_DIR, ROOT)}")
    if items:
        sem = asyncio.Semaphore(CONCURRENCY)
        state, failed = {}, []
        await asyncio.gather(*(worker(sem, it, state, failed) for it in items))
        if failed:
            print(f"失败 {len(failed)} 条:", failed)
            sys.exit(1)
    total = len([f for f in os.listdir(OUT_DIR) if f.endswith(".mp3")])
    print(f"完成。override 目录现有 {total} 条 mp3")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    asyncio.run(main(ap.parse_args().force))
