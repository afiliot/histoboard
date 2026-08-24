#!/usr/bin/env python3
"""
Update CRoMa data from the official GitHub repository.

Fetches the committed publication CSVs from:
  https://github.com/clemsgrs/croma/tree/main/results/

  - cross_benchmark.csv  → the panel ranks (mean / CRoMa / tail) and the
                           per-cohort median CRoMa + LTM10 pairs
  - camelyon.csv         ┐
  - tcga-4x4.csv         ├ per-cohort diagnostics: bio/conf balanced accuracy,
  - tolkach-esca.csv     ┘ RI, MaRI, delta, F(0), support

CRoMa (Cross-confounder Robustness Margin) is a signed margin in (-1, 1),
neutral at 0: it measures how much of a model's neighbourhood structure is
driven by biology rather than by the acquisition center. It builds on the
Robustness Index (RI) introduced by PathoROB, and is scored on the same three
PathoROB tile cohorts.

For each (model, cohort) pair this script writes one result carrying the full
column set. It also writes one virtual `croma_aggregate` row per model holding
the three panel ranks and the Pareto-frontier / TCGA-exposure flags (the same
pattern PFM-DenseBench uses for `pfm_densebench_avgrank`).

Ranking follows the official panel: models are ordered by `mean_rank`
(lower is better), the average of the CRoMa rank and the tail rank.

Not ingested:
  - the natural-image control DINOv2-B, which Histoboard excludes along with
    every other generic (non-pathology) vision baseline, and which CRoMa
    itself leaves out of its ranks
  - the slide-level PCaBiop cohort, a different 5-encoder roster that takes no
    part in the tile panel's aggregate ranks

Usage:
    python scraper/update_croma_data.py

The script is idempotent: re-running it overwrites every CRoMa entry in
tasks.json, results.json and rankings.json with fresh values.
"""

from __future__ import annotations

import csv
import datetime
import io
import json
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).parent.parent / "frontend" / "src" / "data"
RESULTS_PATH = DATA_DIR / "results.json"
TASKS_PATH = DATA_DIR / "tasks.json"
RANKINGS_PATH = DATA_DIR / "rankings.json"

BENCHMARK_ID = "croma"

# ---------------------------------------------------------------------------
# Source URLs
# ---------------------------------------------------------------------------
RAW_BASE = "https://raw.githubusercontent.com/clemsgrs/croma/main/results"
CROSS_BENCHMARK_URL = f"{RAW_BASE}/cross_benchmark.csv"

# Cohort slug in cross_benchmark.csv column names → (task id, cohort CSV name)
COHORTS = {
    "camelyon": ("croma_camelyon", "camelyon.csv"),
    "tcga_4x4": ("croma_tcga_4x4", "tcga-4x4.csv"),
    "tolkach_esca": ("croma_tolkach_esca", "tolkach-esca.csv"),
}

# ---------------------------------------------------------------------------
# Task definitions (written into tasks.json)
# ---------------------------------------------------------------------------
TASK_DEFS = [
    {
        "id": "croma_camelyon",
        "benchmarkId": BENCHMARK_ID,
        "name": "Camelyon",
        "category": "Confounder Robustness",
        "organ": "breast",
        "metric": "croma",
    },
    {
        "id": "croma_tcga_4x4",
        "benchmarkId": BENCHMARK_ID,
        "name": "TCGA-4x4",
        "category": "Confounder Robustness",
        "organ": "multi-organ",
        "metric": "croma",
    },
    {
        "id": "croma_tolkach_esca",
        "benchmarkId": BENCHMARK_ID,
        "name": "Tolkach ESCA",
        "category": "Confounder Robustness",
        "organ": "esophagus",
        "metric": "croma",
    },
]

# Virtual task holding the panel-level ranks and flags. Deliberately absent
# from tasks.json so it never shows up as a column or inflates taskCount.
AGGREGATE_TASK_ID = "croma_aggregate"

# ---------------------------------------------------------------------------
# Model name → Histoboard model ID mapping
# Update this dict whenever CRoMa adds an encoder to the panel.
# ---------------------------------------------------------------------------
MODEL_KEY_MAP = {
    "Mascaret": "waiv_mascaret",
    "Phaet": "waiv_phaet",
    "RudolfV-2": "aignostics_rudolfv_2",
    "RudolfV-2-B": "aignostics_rudolfv_2_b",
    "RudolfV-2-S": "aignostics_rudolfv_2_s",
    "Prost40M": "radboud_prost40m",
    "CONCHv1.5": "mahmood_lab_conch_1_5",
    "CONCH": "mahmood_lab_conch",
    "GenBio-PathFM": "genbio_ai_genbio_pathfm",
    "Virchow2": "paige_ai_virchow2",
    "Virchow": "paige_ai_virchow",
    "H-optimus-1": "bioptimus_h_optimus_1",
    "H-optimus-0": "bioptimus_h_optimus_0",
    "H0-mini": "bioptimus_h0_mini",
    "Midnight-12k": "kaiko_ai_midnight_12k",
    "UNI2-h": "mahmood_lab_uni2",
    "UNI": "mahmood_lab_uni",
    "mSTAR": "tsinghua_hkust_mstar",
    "MUSK": "stanford_university_musk",
    "Prov-GigaPath": "microsoft_prov_gigapath",
    "GPFM": "hkust_gpfm",
    "Hibou-B": "hist_ai_hibou_b",
    "Hibou-L": "hist_ai_hibou_l",
    "Phikon": "owkin_phikon",
    "Phikon-v2": "owkin_phikon_v2",
}

# Encoders present in the source CSVs that are intentionally not ingested.
SKIPPED_MODELS = {
    "DINOv2-B": "natural-image control; Histoboard excludes generic vision baselines",
}

# Per-cohort CSV column → result field. `croma` maps to the base `value`.
COHORT_FIELD_MAP = {
    "bio_bacc": "bioBacc",
    "conf_bacc": "confBacc",
    "ri": "ri",
    "mari": "mari",
    "delta": "delta",
    "croma_f0": "f0",
    "support": "support",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def fetch_csv(url: str) -> list[dict]:
    """Fetch a CSV and return it as a list of row dicts."""
    print(f"  Fetching {url}")
    with urllib.request.urlopen(url) as response:
        text = response.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def to_float(raw: str | None) -> float | None:
    """Parse a CSV cell into a float, treating blanks as missing."""
    if raw is None or raw.strip() == "":
        return None
    return float(raw)


def to_bool(raw: str | None) -> bool:
    """Parse a CSV cell holding a Python-style boolean."""
    return (raw or "").strip().lower() == "true"


def rounded(value: float | None, digits: int = 6) -> float | None:
    return None if value is None else round(value, digits)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    print("Updating CRoMa data...")

    # ------------------------------------------------------------------
    # 1. Fetch source CSVs
    # ------------------------------------------------------------------
    cross_rows = fetch_csv(CROSS_BENCHMARK_URL)
    cohort_rows = {
        slug: fetch_csv(f"{RAW_BASE}/{csv_name}")
        for slug, (_, csv_name) in COHORTS.items()
    }

    # cohort slug → model name → row
    cohort_by_model = {
        slug: {row["model"]: row for row in rows} for slug, rows in cohort_rows.items()
    }

    # ------------------------------------------------------------------
    # 2. Build per-cohort result entries
    # ------------------------------------------------------------------
    retrieved_at = (
        datetime.datetime.now(datetime.timezone.utc)
        .strftime("%Y-%m-%dT%H:%M:%SZ")
    )

    entries: list[dict] = []
    aggregate_entries: list[dict] = []
    skipped: list[str] = []

    for row in cross_rows:
        name = row["model"]
        hid = MODEL_KEY_MAP.get(name)
        if hid is None:
            reason = SKIPPED_MODELS.get(name, "not mapped — add it to MODEL_KEY_MAP")
            skipped.append(f"{name} ({reason})")
            continue

        for slug, (task_id, _) in COHORTS.items():
            croma = to_float(row.get(f"croma_{slug}"))
            if croma is None:
                continue

            entry: dict = {
                "modelId": hid,
                "taskId": task_id,
                "value": rounded(croma),
                "rank": 0,  # placeholder; assigned below
                "source": BENCHMARK_ID,
                "retrievedAt": retrieved_at,
                "ltm10": rounded(to_float(row.get(f"ltm_{slug}"))),
            }

            # Diagnostics from the cohort CSV (RI, MaRI, F(0), support, ...)
            cohort_row = cohort_by_model[slug].get(name)
            if cohort_row is not None:
                for src_col, field in COHORT_FIELD_MAP.items():
                    value = rounded(to_float(cohort_row.get(src_col)))
                    if value is not None:
                        entry[field] = value

            entries.append({k: v for k, v in entry.items() if v is not None})

        # Panel-level ranks. The control has no ranks, hence the None guard.
        mean_rank = to_float(row.get("mean_rank"))
        if mean_rank is not None:
            aggregate_entries.append(
                {
                    "modelId": hid,
                    "taskId": AGGREGATE_TASK_ID,
                    "value": mean_rank,
                    "source": BENCHMARK_ID,
                    "cromaRank": to_float(row.get("croma_rank")),
                    "ltmRank": to_float(row.get("ltm_rank")),
                    "onFrontier": to_bool(row.get("on_frontier")),
                    "tcgaExposed": to_bool(row.get("tcga_exposed")),
                }
            )

    for note in skipped:
        print(f"  Skipping {note}")

    # ------------------------------------------------------------------
    # 3. Assign per-cohort ranks (by median CRoMa, descending)
    # ------------------------------------------------------------------
    for task_id, _ in COHORTS.values():
        cohort_entries = [e for e in entries if e["taskId"] == task_id]
        cohort_entries.sort(key=lambda e: e["value"], reverse=True)
        for rank, entry in enumerate(cohort_entries, start=1):
            entry["rank"] = rank

    print(
        f"  Built {len(entries)} per-cohort entries and "
        f"{len(aggregate_entries)} panel rows for "
        f"{len(aggregate_entries)} ranked encoders"
    )

    # ------------------------------------------------------------------
    # 4. Merge into tasks.json
    # ------------------------------------------------------------------
    with open(TASKS_PATH) as f:
        tasks: list[dict] = json.load(f)

    tasks_out = [t for t in tasks if t.get("benchmarkId") != BENCHMARK_ID]
    tasks_out.extend(TASK_DEFS)

    with open(TASKS_PATH, "w") as f:
        json.dump(tasks_out, f, indent=2, ensure_ascii=False)
    print(f"  Wrote {len(TASK_DEFS)} tasks to tasks.json")

    # ------------------------------------------------------------------
    # 5. Merge into results.json
    # ------------------------------------------------------------------
    with open(RESULTS_PATH) as f:
        results: list[dict] = json.load(f)

    kept = [r for r in results if r.get("source") != BENCHMARK_ID]
    results_out = kept + entries + aggregate_entries

    with open(RESULTS_PATH, "w") as f:
        json.dump(results_out, f, indent=2, ensure_ascii=False)
    print(f"  Wrote {len(entries) + len(aggregate_entries)} entries to results.json")

    # ------------------------------------------------------------------
    # 6. Rebuild the CRoMa block of rankings.json
    #
    # `avgScore` carries the official mean rank so the shared ranking helper
    # (scoreHigherIsBetter: false for "croma") reproduces the published order
    # exactly, rather than re-deriving one from the raw margins.
    # ------------------------------------------------------------------
    with open(RANKINGS_PATH) as f:
        rankings: dict = json.load(f)

    cohort_count = {e["modelId"]: 0 for e in aggregate_entries}
    for entry in entries:
        if entry["modelId"] in cohort_count:
            cohort_count[entry["modelId"]] += 1

    rankings[BENCHMARK_ID] = {
        e["modelId"]: {
            "avgRank": round(e["value"], 2),
            "taskCount": cohort_count[e["modelId"]],
            "avgScore": round(e["value"], 2),
        }
        for e in sorted(aggregate_entries, key=lambda e: e["modelId"])
    }

    with open(RANKINGS_PATH, "w") as f:
        json.dump(rankings, f, indent=2, ensure_ascii=False)
    print(f"  Wrote {len(rankings[BENCHMARK_ID])} rankings to rankings.json")

    print("Done.")


if __name__ == "__main__":
    main()
