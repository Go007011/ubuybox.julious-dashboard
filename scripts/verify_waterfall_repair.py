"""Verifies the Waterfall Engine + Tranche Breakdown sheets have been repaired
and that the synthetic fallback is OFF for the canonical Business UBIDS_011.

Run: python3 /app/scripts/verify_waterfall_repair.py
Exit code 0 = repair verified; 1 = still on synthetic fallback or schema mismatch.
"""
import json, sys, urllib.request

ADMIN_EMAIL = "mrbraboy+007011@gmail.com"
TARGET = "UBIDS_011"


def fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> int:
    base = "http://localhost:8001"
    payload = fetch_json(
        f"{base}/api/user/waterfall-view?email={urllib.request.quote(ADMIN_EMAIL)}&businessId={TARGET}"
    )

    fallback = bool(payload.get("synthesized_default_stack"))
    tranches = payload.get("tranches", [])
    summary  = payload.get("summary", {})

    expected_kinds = {"senior", "mezz", "equity"}
    actual_kinds   = {t.get("kind") for t in tranches}

    issues = []
    if fallback:
        issues.append("synthesized_default_stack is TRUE — synthetic fallback is still active")
    if not payload.get("has_waterfall_rows"):
        issues.append("Waterfall Engine sheet returned no rows for UBIDS_011")
    if not payload.get("has_tranche_rows"):
        issues.append("Tranche Breakdown sheet returned no rows for UBIDS_011")
    if expected_kinds - actual_kinds:
        issues.append(f"Missing tranche kinds: {expected_kinds - actual_kinds}")
    if summary.get("tranche_count", 0) != 3:
        issues.append(f"Expected 3 tranches, got {summary.get('tranche_count')}")
    if summary.get("total_capital", 0) <= 0:
        issues.append("total_capital <= 0")

    print(json.dumps({
        "Waterfall Engine Rows Written":  "user-pasted via Google Sheets",
        "Tranche Breakdown Rows Written": "user-pasted via Google Sheets",
        "Business_IDs Processed":         "from Business Registry (20)",
        "Fallback Active":                "YES" if fallback else "NO",
        "Validation Errors":              issues,
        "Sample Output for UBIDS_011":    {
            "business_id":   payload.get("business_id"),
            "total_capital": summary.get("total_capital"),
            "tranches":      [
                {"step": t["step"], "name": t["name"], "amount": t["amount"], "percent": t["percent"], "return_target": t["return_target"], "priority": t["priority"], "risk": t["risk"]}
                for t in tranches
            ],
            "summary": {
                "senior": summary.get("senior"),
                "mezz":   summary.get("mezz"),
                "equity": summary.get("equity"),
            },
        },
    }, indent=2))

    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
