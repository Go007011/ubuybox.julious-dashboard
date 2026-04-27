"""Soft-tenancy operator layer for UBUYBOX.

Rules:
    UBUYBOX_CORE  -> Master System (full visibility, admin scope)
    EVENT_HABITAT -> Restricted Level 3 operator (only EVENT_HABITAT-tagged rows)

Scope:
    This module is purely additive. It NEVER mutates sheet data. It only:
      1. Resolves a user's operator_id (env map + sheet column + safe default).
      2. Provides a universal filter `filter_by_operator(rows, user_operator_id)`
         applied to every user-facing data read after any existing SPV / UBIDS filter.
      3. Ships a bootstrap record for operator admins not yet present in the
         Licensed Users sheet, so the EVENT_HABITAT admin can resolve even
         before the sheet is updated.

Design:
    A row's `operator_id` is read case-insensitively from columns:
        "operator_id", "Operator_ID", "operator", "Operator"
    If none are set, the row is treated as owned by UBUYBOX_CORE (legacy default).
    Rule: UBUYBOX_CORE users see everything; restricted operators see only
    rows whose operator_id exactly matches their own.
"""
from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)

UBUYBOX_CORE = "UBUYBOX_CORE"
EVENT_HABITAT = "EVENT_HABITAT"

# Allow-list of valid operator_id values. Operator IDs outside this list are
# treated as invalid and cause access denial. Override with
# KNOWN_OPERATORS='["UBUYBOX_CORE","EVENT_HABITAT","OTHER"]'
_DEFAULT_KNOWN = [UBUYBOX_CORE, EVENT_HABITAT]
KNOWN_OPERATORS: set[str] = set(
    _DEFAULT_KNOWN
) | set(json.loads(os.environ.get("KNOWN_OPERATORS", "[]")) if os.environ.get("KNOWN_OPERATORS") else [])

# Canonical columns the operator filter will consult on each row.
_OPERATOR_ROW_KEYS = ("operator_id", "Operator_ID", "operator", "Operator")


def _load_json_env(name: str) -> dict:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"{name} env JSON parse failed: {type(e).__name__}")
        return {}


# Email -> operator_id override. Highest precedence.
# Example: OPERATOR_EMAIL_MAP='{"mrbraboy+EHadmin@gmail.com":"EVENT_HABITAT"}'
OPERATOR_EMAIL_MAP = {k.strip().lower(): v for k, v in _load_json_env("OPERATOR_EMAIL_MAP").items()}

# Bootstrap users for operator admins not in the Licensed Users sheet.
# Keyed by email, value is a Licensed-Users-shaped dict.
OPERATOR_BOOTSTRAP_USERS = {k.strip().lower(): v for k, v in _load_json_env("OPERATOR_BOOTSTRAP_USERS").items()}


def is_valid_operator(op: str) -> bool:
    return bool(op) and op.strip() in KNOWN_OPERATORS


def _row_operator_id(row: dict) -> str:
    for k in _OPERATOR_ROW_KEYS:
        v = row.get(k)
        if v is not None and str(v).strip():
            return str(v).strip()
    return UBUYBOX_CORE  # legacy rows (no tag) belong to the master system


def resolve_operator_id(user_record: dict, admin_email_lc: str = "") -> str:
    """Return the operator_id for a resolved user record.

    STRICT PRECEDENCE (fail-closed):
        1. OPERATOR_EMAIL_MAP override — explicit admin-set mapping. Validated
           against KNOWN_OPERATORS. Invalid mapping -> "" (deny).
        2. Licensed Users sheet column 'operator_id'. Validated against
           KNOWN_OPERATORS. Invalid -> "" (deny).
        3. No match anywhere -> "" (deny).

    Note: admin_email_lc is accepted for signature compatibility but is NOT
    consulted — admin identity must be expressed via OPERATOR_EMAIL_MAP.
    """
    email = (user_record.get("email") or "").strip().lower()
    if email and email in OPERATOR_EMAIL_MAP:
        candidate = str(OPERATOR_EMAIL_MAP[email] or "").strip()
        if is_valid_operator(candidate):
            return candidate
        logger.warning(f"OPERATOR_EMAIL_MAP has invalid operator_id for {email!r}: {candidate!r}")
        return ""
    sheet_val = str(user_record.get("operator_id") or "").strip()
    if sheet_val:
        if is_valid_operator(sheet_val):
            return sheet_val
        logger.warning(f"Licensed Users sheet has invalid operator_id for {email!r}: {sheet_val!r}")
        return ""
    return ""


def filter_by_operator(rows: list[dict], user_operator_id: str) -> list[dict]:
    """Return only rows this user is allowed to see, by operator_id.
    UBUYBOX_CORE users see everything. Other operators see only matching rows."""
    if user_operator_id == UBUYBOX_CORE:
        return rows
    if not user_operator_id:
        # Fail-safe: missing/invalid operator_id yields NO DATA.
        return []
    allowed = user_operator_id.strip()
    return [r for r in rows if _row_operator_id(r) == allowed]


def bootstrap_user_for(email: str) -> dict | None:
    """If the email has a bootstrap record, return a Licensed-Users-shaped dict."""
    key = (email or "").strip().lower()
    seed = OPERATOR_BOOTSTRAP_USERS.get(key)
    if not seed:
        return None
    return {
        "license_id":      seed.get("license_id", f"OPR-{key.split('@')[0]}"),
        "email":           key,
        "owner_name":      seed.get("owner_name", key.split("@")[0]),
        "license_level":   seed.get("license_level", "LEVEL_3"),
        "status":          seed.get("status", "active"),
        "assigned_spv_id": seed.get("assigned_spv_id", ""),
        "access_type":     seed.get("access_type", "Operator"),
        "source":          seed.get("source", "operator_bootstrap"),
        "operator_id":     seed.get("operator_id") or OPERATOR_EMAIL_MAP.get(key, UBUYBOX_CORE),
    }


def status_snapshot() -> dict:
    return {
        "master_operator": UBUYBOX_CORE,
        "known_operators": sorted(set(OPERATOR_EMAIL_MAP.values()) | {UBUYBOX_CORE}),
        "email_overrides": len(OPERATOR_EMAIL_MAP),
        "bootstrap_users": sorted(OPERATOR_BOOTSTRAP_USERS.keys()),
    }
