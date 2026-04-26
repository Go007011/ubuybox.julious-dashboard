"""Generate ready-to-paste TSV for Waterfall Engine + Tranche Breakdown
from Business Registry (source of truth).

Output files:
  /app/docs/repair/waterfall_engine.tsv
  /app/docs/repair/tranche_breakdown.tsv
"""
from __future__ import annotations
import os, csv, io, json, urllib.parse, sys
import httpx
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
SPREADSHEET_ID = os.environ.get("SPREADSHEET_ID", "")

OUT_DIR = "/app/docs/repair"
os.makedirs(OUT_DIR, exist_ok=True)


def _money(v) -> float:
    if v in (None, ""):
        return 0.0
    try:
        return float(str(v).replace("$", "").replace(",", "").strip() or 0)
    except Exception:
        return 0.0


def fetch_registry() -> list[dict]:
    encoded = urllib.parse.quote("Business Registry")
    url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet={encoded}"
    resp = httpx.get(url, timeout=20.0, follow_redirects=True)
    resp.raise_for_status()
    return list(csv.DictReader(io.StringIO(resp.text)))


def build_rows(registry: list[dict]):
    waterfall = [["Business_ID", "Step_Order", "Tranche", "Description"]]
    tranche   = [["Business_ID", "Tranche_Type", "Amount", "Return_Target", "Priority", "Risk_Level"]]
    validation_errors: list[str] = []
    processed: list[str] = []

    for r in registry:
        bid = (r.get("Business_ID") or "").strip()
        total = _money(r.get("TOTAL_CAPITAL_REQUIRED"))
        if not bid:
            validation_errors.append(f"Skipped row — no Business_ID: {r}")
            continue
        if total <= 0:
            validation_errors.append(f"{bid}: TOTAL_CAPITAL_REQUIRED missing/zero — skipped")
            continue

        senior = round(total * 0.65, 2)
        mezz   = round(total * 0.20, 2)
        equity = round(total - senior - mezz, 2)  # absorb rounding so sum exactly equals total

        # Sum-check
        if abs((senior + mezz + equity) - total) > 0.01:
            validation_errors.append(f"{bid}: sum mismatch — senior+mezz+equity={senior+mezz+equity} vs total={total}")
            continue

        waterfall += [
            [bid, "1", "Senior",     "Senior debt repayment"],
            [bid, "2", "Mezzanine",  "Mezzanine return distribution"],
            [bid, "3", "Equity",     "Equity residual distribution"],
        ]
        tranche += [
            [bid, "Senior",    f"{senior:.2f}", "8-10%",  "1", "Low"],
            [bid, "Mezzanine", f"{mezz:.2f}",   "12-16%", "2", "Medium"],
            [bid, "Equity",    f"{equity:.2f}", "20%+",   "3", "High"],
        ]
        processed.append(bid)

    return waterfall, tranche, processed, validation_errors


def write_tsv(rows: list[list[str]], path: str):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n")
        w.writerows(rows)


def main():
    if not SPREADSHEET_ID:
        print("SPREADSHEET_ID missing", file=sys.stderr); sys.exit(1)
    registry = fetch_registry()
    waterfall_rows, tranche_rows, processed, errors = build_rows(registry)

    write_tsv(waterfall_rows, f"{OUT_DIR}/waterfall_engine.tsv")
    write_tsv(tranche_rows,   f"{OUT_DIR}/tranche_breakdown.tsv")

    report = {
        "Waterfall Engine Rows Written":   len(waterfall_rows) - 1,  # minus header
        "Tranche Breakdown Rows Written":  len(tranche_rows) - 1,
        "Business_IDs Processed":          processed,
        "Validation Errors":               errors,
        "Output Files": [
            f"{OUT_DIR}/waterfall_engine.tsv",
            f"{OUT_DIR}/tranche_breakdown.tsv",
        ],
    }
    with open(f"{OUT_DIR}/report.json", "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
