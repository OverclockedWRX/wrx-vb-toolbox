#!/usr/bin/env python3
"""Write fictional VB WRX sample CSVs. Nothing in here is from a real car."""

import csv
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "logs"

COLUMNS = [
    "Time (sec)",
    "AF Correction 1 (%)",
    "AF Learning 1 (%)",
    "AF Learning 3 (%)",
    "AF Sens 1 Ratio (AFR)",
    "Accel Position (%)",
    "Boost (psi)",
    "Calculated Load (g/rev)",
    "Comm Fuel Final (AFR)",
    "Coolant Temp (F)",
    "Dyn Adv Mult (DAM)",
    "Feedback Knock (deg)",
    "Fine Knock Learn (deg)",
    "Fuel Pressure (psi)",
    "Gear Position (gear)",
    "Ignition Timing (deg)",
    "Inj Duty Cycle (%)",
    "Intake Temp (F)",
    "Intake Temp Manifold (F)",
    "Oil Temp (F)",
    "RPM (RPM)",
    "Target Boost Final Rel (psi)",
    "Throttle Pos (%)",
    "Vehicle Speed (mph)",
    "Roughness Cyl 1 (count)",
]


def ap_info(reflash: str) -> str:
    return (
        "AP Info:[AP3-SUB-006 v0.0.0-1][2024 USDM WRX MT SAMPLE DATA]"
        f"[Reflash: {reflash}.ptm]"
    )


def blank(**overrides: float) -> dict:
    row = {
        "t": 0.0,
        "corr": 0.4,
        "learn1": -1.5,
        "learn3": 2.0,
        "afr": 14.68,
        "accel": 12.0,
        "boost": -7.4,
        "load": 0.42,
        "cmd": 14.70,
        "coolant": 188.0,
        "dam": 1.0,
        "fk": 0.0,
        "fkl": 0.0,
        "fp": 720.0,
        "gear": 3,
        "timing": 14.0,
        "duty": 3.5,
        "iat": 76.0,
        "manifold": 84.0,
        "oil": 196.0,
        "rpm": 1680.0,
        "tgt": 0.0,
        "throttle": 10.0,
        "speed": 22.0,
        "rough": 0,
    }
    row.update(overrides)
    return row


def cruise(seconds: float, t0: float, **overrides: float) -> list[dict]:
    rows = []
    steps = int(seconds / 0.05)
    for i in range(steps):
        wave = ((i % 20) - 10) / 10
        rows.append(
            blank(
                t=round(t0 + i * 0.05, 2),
                rpm=1750 + wave * 40,
                speed=28 + wave,
                afr=14.65 + wave * 0.04,
                **overrides,
            )
        )
    return rows


def pull(
    t0: float,
    *,
    boost_hold: float,
    target: float,
    afr: float,
    cmd: float,
    rpm0: float = 2800,
    rpm1: float = 6100,
    seconds: float = 5.0,
    gear: int = 3,
    speed0: float = 34,
    speed1: float = 82,
    lean_at: float | None = None,
    lean_afr: float | None = None,
    knock_from: float | None = None,
    knock_to: float | None = None,
    knock: float = 0.0,
    **overrides: float,
) -> list[dict]:
    """One fictional wide-open pull. AFR, boost, and load move with rpm so the cloud is not a flat line."""
    rows = []
    steps = int(seconds / 0.05)
    for i in range(steps):
        p = i / (steps - 1)
        spool = min(1.0, max(0.0, (p - 0.04) / 0.30))
        boost = boost_hold * (0.12 + 0.88 * spool)
        boost += math.sin(p * math.pi * 3) * 0.28 * spool
        shape = math.sin(p * math.pi)
        wobble = math.sin(p * math.pi * 7) * 0.03
        on_boost_afr = afr - 0.14 * shape + wobble
        on_boost_cmd = cmd - 0.12 * shape
        row = blank(
            t=round(t0 + i * 0.05, 2),
            accel=100,
            throttle=98,
            gear=gear,
            rpm=round(rpm0 + (rpm1 - rpm0) * p, 1),
            speed=round(speed0 + (speed1 - speed0) * p, 1),
            boost=round(boost, 2),
            tgt=round(target if boost >= 8 else max(boost, 0), 2),
            afr=round(on_boost_afr if boost >= 10 else 13.35 + wobble, 2),
            cmd=round(on_boost_cmd if boost >= 10 else 12.8, 2),
            load=round(0.55 + (boost / max(boost_hold, 1)) * (0.85 + 0.65 * p) + 0.05 * math.sin(p * 11), 3),
            fp=round(2100 + 700 * spool + 200 * p, 0),
            duty=round(14 + 24 * p * max(spool, 0.2), 1),
            timing=round(5.5 + 9 * p - 1.2 * spool, 1),
            coolant=190,
            oil=202,
            iat=82,
            manifold=round(88 + 14 * spool, 1),
            **overrides,
        )
        if lean_at is not None and lean_afr is not None and abs(p - lean_at) < 0.012 and boost >= 12:
            row["afr"] = lean_afr
        if knock_from is not None and knock_to is not None and knock_from <= p <= knock_to and boost >= 10:
            row["fk"] = knock
        rows.append(row)
    return rows


def lift(t0: float, **overrides: float) -> list[dict]:
    rows = []
    for i in range(16):
        rows.append(
            blank(
                t=round(t0 + i * 0.05, 2),
                accel=0,
                throttle=2,
                boost=-4.5,
                afr=18.5,
                cmd=14.7,
                rpm=4200 - i * 80,
                speed=70 - i,
                fp=900,
                **overrides,
            )
        )
    return rows


def write(name: str, reflash: str, rows: list[dict]) -> None:
    path = ROOT / name
    header = COLUMNS + [ap_info(reflash)]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        for row in rows:
            writer.writerow(
                [
                    f"{row['t']:.2f}",
                    f"{row['corr']:.2f}",
                    f"{row['learn1']:.2f}",
                    f"{row['learn3']:.2f}",
                    f"{row['afr']:.2f}",
                    f"{row['accel']:.1f}",
                    f"{row['boost']:.2f}",
                    f"{row['load']:.3f}",
                    f"{row['cmd']:.2f}",
                    f"{row['coolant']:.1f}",
                    f"{row['dam']:.2f}",
                    f"{row['fk']:.2f}",
                    f"{row['fkl']:.2f}",
                    f"{row['fp']:.0f}",
                    int(row["gear"]),
                    f"{row['timing']:.1f}",
                    f"{row['duty']:.1f}",
                    f"{row['iat']:.1f}",
                    f"{row['manifold']:.1f}",
                    f"{row['oil']:.1f}",
                    f"{row['rpm']:.1f}",
                    f"{row['tgt']:.2f}",
                    f"{row['throttle']:.1f}",
                    f"{row['speed']:.1f}",
                    int(row["rough"]),
                    "",
                ]
            )


def wide_open_rows(t0: float, **pull_kwargs: float) -> list[dict]:
    """2nd gear then 3rd gear, both wide open, with a lift between them."""
    second = pull(
        t0,
        gear=2,
        rpm0=3600,
        rpm1=6500,
        seconds=2.8,
        speed0=24,
        speed1=54,
        **pull_kwargs,
    )
    second_end = second[-1]["t"]
    lifted = lift(second_end + 0.1, **{key: pull_kwargs[key] for key in ("learn1", "learn3", "dam", "fkl") if key in pull_kwargs})
    third_start = lifted[-1]["t"] + 0.15
    third = pull(
        third_start,
        gear=3,
        rpm0=2800,
        rpm1=6100,
        seconds=5.0,
        speed0=34,
        speed1=82,
        **pull_kwargs,
    )
    return second + lifted + third


def pack(reflash: str, cruise_name: str, pull_name: str, **pull_kwargs: float) -> None:
    shared = {key: pull_kwargs[key] for key in ("learn1", "learn3", "dam", "fkl") if key in pull_kwargs}
    write(cruise_name, reflash, cruise(4.0, 0.0, **shared))
    pulls = wide_open_rows(1.2, **pull_kwargs)
    rows = cruise(1.2, 0.0, **shared) + pulls + lift(pulls[-1]["t"] + 0.15, **shared)
    write(pull_name, reflash, rows)


def main() -> None:
    ROOT.mkdir(exist_ok=True)
    pack(
        "Sample Map Clean Commute - 16psi 93oct",
        "sample-s-cruise.csv",
        "sample-s-pull.csv",
        boost_hold=16.1,
        target=16.0,
        afr=11.05,
        cmd=11.05,
        learn1=-1.2,
        learn3=2.3,
    )
    a_rows_knock = cruise(2.2, 0.0, learn1=-1.0, learn3=3.1, fk=-1.05, accel=14, boost=-6.2)
    write("sample-a-cruise.csv", "Sample Map Almost Tidy - 16psi 93oct", a_rows_knock)
    a_pulls = wide_open_rows(
        1.2,
        boost_hold=16.05,
        target=16.0,
        afr=11.12,
        cmd=11.08,
        learn1=-1.0,
        learn3=3.1,
        lean_at=0.62,
        lean_afr=11.90,
    )
    write(
        "sample-a-pull.csv",
        "Sample Map Almost Tidy - 16psi 93oct",
        cruise(1.2, 0.0, learn1=-1.0, learn3=3.1) + a_pulls + lift(a_pulls[-1]["t"] + 0.15, learn1=-1.0, learn3=3.1, fk=-1.05),
    )
    pack(
        "Sample Map Trim Goblin - 17psi 91oct",
        "sample-b-cruise.csv",
        "sample-b-pull.csv",
        boost_hold=17.15,
        target=17.0,
        afr=11.12,
        cmd=11.08,
        learn1=-3.1,
        learn3=16.4,
        lean_at=0.55,
        lean_afr=11.58,
    )
    pack(
        "Sample Map Needs a Conversation - 16psi 91oct",
        "sample-c-cruise.csv",
        "sample-c-pull.csv",
        boost_hold=16.2,
        target=16.0,
        afr=11.18,
        cmd=11.10,
        learn1=4.6,
        learn3=12.5,
        fkl=-1.17,
        lean_at=0.58,
        lean_afr=11.80,
    )
    overboost = wide_open_rows(1.0, boost_hold=50.0, target=18.0, afr=11.05, cmd=11.00, learn3=1.5)
    write(
        "sample-50psi.csv",
        "Sample Map Wastegate Vacation - 18psi 93oct",
        cruise(1.0, 0.0, learn3=1.5) + overboost + lift(overboost[-1]["t"] + 0.15, learn3=1.5),
    )
    knocked = wide_open_rows(
        1.0,
        boost_hold=16.4,
        target=16.0,
        afr=11.20,
        cmd=11.15,
        dam=8.75,
        fkl=-6.0,
        learn3=4.0,
        knock_from=0.25,
        knock_to=0.85,
        knock=-12.50,
    )
    write(
        "sample-knock.csv",
        "Sample Map Knock Choir - 16psi 91oct",
        cruise(1.0, 0.0, dam=8.75, fkl=-6.0, learn3=4.0) + knocked + lift(knocked[-1]["t"] + 0.15, dam=8.75, fkl=-6.0, learn3=4.0),
    )


if __name__ == "__main__":
    main()
