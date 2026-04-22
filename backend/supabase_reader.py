"""Supabase safe-view reader with fallback logging.

Design rule:
    Bolt controls access. Emergent controls data.

Dashboard endpoints prefer Supabase safe views (pre-masked, level-scoped)
as the read layer. If Supabase is not configured or a view is unavailable,
readers fall back to the existing Google Sheets path + Python-side masking.

Fallback events are appended to a MongoDB collection for admin diagnostics.
Raw seller/agent/address data never passes through this module — views must
be defined without those columns at the SQL layer.
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
SUPABASE_ENABLED = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

# Map (data_area, level) -> Supabase view name.
# View names follow the convention v_<area>_l<level> for investor-facing views
# and v_<area>_admin for admin-only operational reads.
VIEW_MAP: dict[tuple[str, str], str] = {
    ("main_maps", "LEVEL_1"):        "v_main_maps_l1",
    ("main_maps", "LEVEL_2"):        "v_main_maps_l2",
    ("main_maps", "LEVEL_3"):        "v_main_maps_l3",
    ("spv_registry", "LEVEL_1"):     "v_spv_registry_l1",
    ("spv_registry", "LEVEL_2"):     "v_spv_registry_l2",
    ("spv_registry", "LEVEL_3"):     "v_spv_registry_l2",  # same safe fields as L2
    ("capital_stack", "LEVEL_1"):    "v_capital_stack_l1",
    ("capital_stack", "LEVEL_2"):    "v_capital_stack_l2",
    ("capital_stack", "LEVEL_3"):    "v_capital_stack_l3",
    ("waterfall", "LEVEL_3"):        "v_waterfall_l3",
    ("deal_summary", "LEVEL_1"):     "v_deal_summary_l1",
    ("deal_summary", "LEVEL_2"):     "v_deal_summary_l2",
    ("deal_summary", "LEVEL_3"):     "v_deal_summary_l3",
    ("tranche_breakdown", "LEVEL_3"): "v_tranche_breakdown_l3",
    ("validation", "LEVEL_1"):       "v_validation_l1",
    ("validation", "LEVEL_2"):       "v_validation_l2",
    ("opportunity_release", "ADMIN"): "v_opportunity_release_admin",
}


def view_for(area: str, level: str) -> Optional[str]:
    return VIEW_MAP.get((area, level))


async def fetch_view(
    view_name: str,
    spv_id: Optional[str] = None,
    deal_id: Optional[str] = None,
) -> Optional[list[dict]]:
    """Query a Supabase view via PostgREST. Returns rows or None on failure."""
    if not SUPABASE_ENABLED:
        return None
    params: dict[str, str] = {"select": "*"}
    if spv_id:
        params["SPV_ID"] = f"eq.{spv_id}"
    if deal_id:
        params["Deal_ID"] = f"eq.{deal_id}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/{view_name}",
                params=params,
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Accept": "application/json",
                },
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"Supabase view '{view_name}' responded {resp.status_code}")
    except Exception as e:
        logger.warning(f"Supabase view '{view_name}' fetch failed: {type(e).__name__}")
    return None


def log_fallback(collection, area: str, level: str, reason: str, view_name: Optional[str]) -> None:
    """Record a fallback event to MongoDB for admin diagnostics."""
    if collection is None:
        return
    try:
        collection.insert_one({
            "area": area,
            "level": level,
            "view_name": view_name,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.warning(f"Failed to persist supabase fallback log: {type(e).__name__}")


async def try_supabase_view(
    area: str,
    level: str,
    spv_id: Optional[str] = None,
    deal_id: Optional[str] = None,
    fallback_log_collection=None,
) -> Tuple[Optional[list[dict]], str]:
    """
    Try to read from a Supabase safe view.
    Returns (rows, source) where source is one of:
      - "supabase"            rows came from the safe view (already masked)
      - "sheet"               Supabase unavailable or view missing — caller must fall back
    Rows returned with source="supabase" are already level-filtered and masked.
    """
    view_name = view_for(area, level)
    if not SUPABASE_ENABLED:
        log_fallback(fallback_log_collection, area, level, "supabase_disabled", view_name)
        return None, "sheet"
    if not view_name:
        log_fallback(fallback_log_collection, area, level, "view_not_mapped", view_name)
        return None, "sheet"

    rows = await fetch_view(view_name, spv_id=spv_id, deal_id=deal_id)
    if rows is None:
        log_fallback(fallback_log_collection, area, level, "view_fetch_failed", view_name)
        return None, "sheet"
    return rows, "supabase"


def status_snapshot() -> dict:
    """Lightweight status for admin diagnostics UI."""
    return {
        "enabled": SUPABASE_ENABLED,
        "url_configured": bool(SUPABASE_URL),
        "key_configured": bool(SUPABASE_SERVICE_KEY),
        "views_mapped": len(VIEW_MAP),
        "view_map": [
            {"area": a, "level": lvl, "view": v} for (a, lvl), v in VIEW_MAP.items()
        ],
    }
