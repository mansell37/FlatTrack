"""Bike (Wahoo trainer) workout builders. Power targets are % of FTP.

Each block carries ``power_pct`` and a computed ``watts`` (from the user's FTP),
plus ``seconds`` and a ``kind`` so the interval timer and the Garmin uploader can
both consume the same structure.
"""

# Intensity multiplier applied to power targets by energy level. On "wrecked"
# we also trim the number of hard intervals (handled per-builder).
ENERGY = {"fresh": 1.0, "ok": 0.97, "wrecked": 0.88}


def _b(label, seconds, pct, kind, ftp, notes=""):
    watts = round(ftp * pct / 100) if pct else None
    return {
        "label": label,
        "reps": None,
        "seconds": seconds,
        "power_pct": pct,
        "watts": watts,
        "kind": kind,
        "notes": notes,
    }


def _warm_cool(duration_min):
    warm = 5 if duration_min >= 30 else 4
    cool = 5 if duration_min >= 40 else 3
    return warm, cool


def _intensity(energy):
    return ENERGY[energy]


def _finalize(blocks, duration_min, ftp, energy):
    """Pad interval workouts with a steady Z2 block so they fill the requested time.

    Inserts the filler just before the cool-down (the last block).
    """
    f = _intensity(energy)
    total = sum((b.get("seconds") or 0) for b in blocks)
    gap = duration_min * 60 - total
    if gap >= 180:  # only bother if there's a meaningful chunk left
        filler = _b("Endurance", gap, round(66 * f), "work", ftp,
                    "Steady Zone 2 to round out the ride.")
        blocks.insert(len(blocks) - 1, filler)
    return blocks


def build_endurance(duration_min, energy, ftp, title):
    warm, cool = _warm_cool(duration_min)
    f = _intensity(energy)
    main = duration_min - warm - cool
    blocks = [_b("Warm-up", warm * 60, round(55 * f), "warmup", ftp, "Easy spin, build the legs.")]
    # Break the steady block with a couple of light tempo surges for engagement.
    if main >= 20:
        third = main // 3
        blocks += [
            _b("Endurance", third * 60, round(68 * f), "work", ftp, "Conversational Zone 2."),
            _b("Tempo surge", 3 * 60, round(80 * f), "work", ftp, "Lift to steady tempo."),
            _b("Endurance", (main - third - 3) * 60, round(68 * f), "work", ftp, "Settle back to Zone 2."),
        ]
    else:
        blocks.append(_b("Endurance", main * 60, round(68 * f), "work", ftp, "Steady Zone 2."))
    blocks.append(_b("Cool-down", cool * 60, round(50 * f), "cooldown", ftp, "Spin it out."))
    return _wrap("ENDURANCE", duration_min, blocks, title,
                 "Steady aerobic ride — keep it conversational, smooth pedalling.")


def build_sweetspot(duration_min, energy, ftp, title):
    warm, cool = _warm_cool(duration_min)
    f = _intensity(energy)
    avail = duration_min - warm - cool
    work, rec = 8, 4
    n = max(1, avail // (work + rec))
    if energy == "wrecked":
        n = max(1, n - 1)
    blocks = [_b("Warm-up", warm * 60, round(58 * f), "warmup", ftp, "Build gradually.")]
    for i in range(n):
        blocks.append(_b(f"Sweet spot {i + 1}/{n}", work * 60, round(90 * f), "work", ftp,
                         "Comfortably hard — heavy but controlled breathing."))
        if i < n - 1:
            blocks.append(_b("Recovery", rec * 60, round(55 * f), "rest", ftp, "Easy spin."))
    blocks.append(_b("Cool-down", cool * 60, round(50 * f), "cooldown", ftp, "Spin it out."))
    _finalize(blocks, duration_min, ftp, energy)
    return _wrap("SWEETSPOT", duration_min, blocks, title,
                 f"{n} × {work}-min sweet spot efforts at ~90% FTP. Great maintenance bang-for-buck.")


def build_threshold(duration_min, energy, ftp, title):
    warm, cool = _warm_cool(duration_min)
    f = _intensity(energy)
    avail = duration_min - warm - cool
    work, rec = 8, 4
    n = max(1, avail // (work + rec))
    if energy == "wrecked":
        n = max(1, n - 1)
    blocks = [_b("Warm-up", warm * 60, round(60 * f), "warmup", ftp, "Include a couple of openers.")]
    for i in range(n):
        blocks.append(_b(f"Threshold {i + 1}/{n}", work * 60, round(99 * f), "work", ftp,
                         "Right at FTP — controlled and even."))
        if i < n - 1:
            blocks.append(_b("Recovery", rec * 60, round(52 * f), "rest", ftp, "Easy spin."))
    blocks.append(_b("Cool-down", cool * 60, round(50 * f), "cooldown", ftp, "Spin it out."))
    _finalize(blocks, duration_min, ftp, energy)
    return _wrap("THRESHOLD", duration_min, blocks, title,
                 f"{n} × {work}-min efforts at FTP. Builds your sustainable power.")


def build_vo2(duration_min, energy, ftp, title):
    warm, cool = _warm_cool(duration_min)
    f = _intensity(energy)
    avail = duration_min - warm - cool
    work_s, rec_s = 180, 180  # 3 on / 3 off
    n = max(2, (avail * 60) // (work_s + rec_s))
    if energy == "wrecked":
        n = max(2, n - 1)
    blocks = [_b("Warm-up", warm * 60, round(60 * f), "warmup", ftp, "Build with 2–3 short openers.")]
    for i in range(int(n)):
        blocks.append(_b(f"VO2 {i + 1}/{int(n)}", work_s, round(115 * f), "work", ftp,
                         "Hard — above threshold, deep breathing."))
        if i < int(n) - 1:
            blocks.append(_b("Recovery", rec_s, round(50 * f), "rest", ftp, "Very easy, fully recover."))
    blocks.append(_b("Cool-down", cool * 60, round(48 * f), "cooldown", ftp, "Spin it out."))
    _finalize(blocks, duration_min, ftp, energy)
    return _wrap("VO2", duration_min, blocks, title,
                 f"{int(n)} × 3-min VO2max efforts at ~115% FTP. Short, sharp, effective.")


def build_pyramid(duration_min, energy, ftp, title):
    warm, cool = _warm_cool(duration_min)
    f = _intensity(energy)
    avail = duration_min - warm - cool
    steps = [65, 78, 90, 100, 90, 78, 65]
    step_s = max(120, round((avail * 60) / len(steps)))
    blocks = [_b("Warm-up", warm * 60, round(58 * f), "warmup", ftp, "Spin up.")]
    for i, pct in enumerate(steps):
        kind = "work" if pct >= 78 else "rest"
        blocks.append(_b(f"Step {i + 1} — {pct}%", step_s, round(pct * f), kind, ftp,
                         "Ramp up then back down, smooth transitions."))
    blocks.append(_b("Cool-down", cool * 60, round(48 * f), "cooldown", ftp, "Spin it out."))
    return _wrap("PYRAMID", duration_min, blocks, title,
                 "Power pyramid — climb from endurance to threshold and back down.")


def build_recovery(duration_min, energy, ftp, title):
    f = _intensity(energy)
    blocks = [_b("Easy spin", duration_min * 60, round(52 * f), "work", ftp,
                 "Light, high cadence, flush the legs. Should feel almost too easy.")]
    return _wrap("RECOVERY", duration_min, blocks, title,
                 "Pure recovery spin — keep it gentle, the point is blood flow not fitness.")


def _wrap(fmt, duration_min, blocks, title, summary):
    return {
        "format": fmt,
        "timer": "interval",
        "duration_min": duration_min,
        "blocks": blocks,
        "summary": summary,
        "title": title,
    }


BUILDERS = {
    "ENDURANCE": build_endurance,
    "SWEETSPOT": build_sweetspot,
    "THRESHOLD": build_threshold,
    "VO2": build_vo2,
    "PYRAMID": build_pyramid,
    "RECOVERY": build_recovery,
}
