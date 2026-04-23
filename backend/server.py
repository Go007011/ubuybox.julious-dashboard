"""
UBUYBOX Backend API - Emergent Application
Connects to Google Sheets as the single source of truth for deal data.
Includes comprehensive orchestration layer for OpenClaw integration.

ARCHITECTURE:
- Google Sheets: Source of truth (read-only from this layer)
- Emergent App Layer: All visibility/disclosure logic
- OpenClaw: Orchestration client (calls these endpoints)
"""

import os
import re
import csv
import io
import uuid
import httpx
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, Literal, List
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from pymongo import MongoClient
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

# Configure logging (safe - no secrets exposed)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ubuybox-emergent")

app = FastAPI(
    title="UBUYBOX Emergent API",
    version="1.1.0",
    description="UBUYBOX SPV Dashboard API with OpenClaw Orchestration Layer"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============= PRESENTATION SANITIZER (UBIDS ENFORCEMENT) =============
# UBUYBOX Data Presentation and Enforcement Layer.
# Legacy "SPV" terminology must never reach a user-visible surface.
# Internal field names (e.g. keys like "SPV_ID", "spvId") are preserved
# so the JSON contract stays stable; only string VALUES are rewritten.
#
# Precedence (applied in order):
#   SPV_###       -> UBIDS_###
#   SPV Registry  -> Business Registry
#   SPV ID        -> Business ID (UBIDS)
#   SPV Structure -> Business Structure
#   \bSPV\b       -> Business   (standalone word only; keys like SPV_ID are unaffected
#                                because "_" is a word character, so no word boundary)
import re as _re

_SPV_VALUE_PATTERNS = [
    (_re.compile(r'SPV_(\d+)'),                      r'UBIDS_\1'),
    (_re.compile(r'\bSPV[ \-]Registry\b'),           'Business Registry'),
    (_re.compile(r'\bSPV[ \-]ID\b', _re.IGNORECASE), 'Business ID (UBIDS)'),
    (_re.compile(r'\bSPV[ \-]Structure\b'),          'Business Structure'),
    (_re.compile(r'\bSPVs\b'),                       'Businesses'),
    (_re.compile(r'\bSPV\b'),                        'Business'),
]

def _sanitize_ubids_text(text: str) -> str:
    for pattern, replacement in _SPV_VALUE_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


@app.middleware("http")
async def ubids_presentation_sanitizer(request: Request, call_next):
    """Rewrite SPV terminology to UBIDS / Business in all outbound /api/* JSON.
    Keys preserved; only string values inside the JSON body are transformed.
    """
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        return response
    ctype = response.headers.get("content-type", "")
    if "application/json" not in ctype:
        return response

    try:
        body = b""
        async for chunk in response.body_iterator:
            body += chunk
        text = body.decode("utf-8")
        # Fast path: skip if no "SPV" token at all
        if "SPV" in text:
            text = _sanitize_ubids_text(text)
        new_body = text.encode("utf-8")
        headers = dict(response.headers)
        # Rebuild Content-Length to match the new body
        headers["content-length"] = str(len(new_body))
        return Response(
            content=new_body,
            status_code=response.status_code,
            headers=headers,
            media_type="application/json",
        )
    except Exception as e:
        logger.warning(f"UBIDS sanitizer failed: {type(e).__name__} — passing raw response")
        return response

# ============= CONFIGURATION =============

# Google Sheet configuration (source of truth)
SPREADSHEET_ID = os.environ.get("SPREADSHEET_ID")
ACCESS_CONTROL_GID = "1056764769"

# Sheet tab names
SHEET_MAIN_MAPS = "Main Maps Offers"
SHEET_SPV_REGISTRY = "SPV Registry"
SHEET_CAPITAL_STACK = "Capital Stack"
SHEET_WATERFALL = "Waterfall Engine"
SHEET_DEAL_SUMMARY = "Deal Summary (UBuyBox View)"
SHEET_VALIDATION = "Validation Engine"
SHEET_ORDERS = "Orders"
SHEET_OPP_RELEASE = "Opportunity Release Control"
SHEET_TRANCHE = "Tranche Breakdown"
SHEET_HOLDCO_SUMMARY = "HoldCo Summary Rollup"
SHEET_HOLDCO_DETAIL = "HoldCo Detail View"
SHEET_HOLDCO_ACCESS = "Holding Company Access"

# Level hierarchy for release filtering
LEVEL_HIERARCHY = {"LEVEL_1": 1, "LEVEL_2": 2, "LEVEL_3": 3}

# Admin configuration
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")

# Hard-masked fields — NEVER shown to any partner-facing user
HARD_MASKED_FIELDS = {
    "Property Address", "Property_Address", "Seller Name", "Agent Name",
    "Agent Phone", "Agent Email"
}

# Interest/participation caps by license level
CAPS = {
    "LEVEL_1": {"max_active_requests": 1, "can_participate": False},
    "LEVEL_2": {"max_active_requests": 3, "can_participate": True},
    "LEVEL_3": {"max_active_requests": 10, "can_participate": True},
}

# Orchestration API Token
ORCHESTRATION_API_TOKEN = os.environ.get("ORCHESTRATION_API_TOKEN")

logger.info(f"Emergent orchestration layer initialized. Token configured: {bool(ORCHESTRATION_API_TOKEN)}")

# MongoDB connection for persistent storage
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]
requests_col = db["admin_requests"]
notifications_col = db["admin_notifications"]
admin_actions_col = db["admin_actions"]
menu_config_col = db["menu_config"]
supabase_fallback_log_col = db["supabase_fallback_log"]

logger.info("MongoDB connected for persistent admin storage")

# Supabase safe-view reader — preferred read source for dashboard data.
# Bolt controls access. Emergent controls data.
from supabase_reader import (
    try_supabase_view as _try_supabase_view,
    status_snapshot as _supabase_status_snapshot,
    SUPABASE_ENABLED as _SUPABASE_ENABLED,
)
logger.info(f"Supabase safe-view reader initialized (enabled={_SUPABASE_ENABLED})")


# ============= VISIBILITY STATES =============

VISIBILITY_STATES = Literal["blocked", "teaser", "preview", "full"]
DISCLOSURE_LEVELS = ["blocked", "teaser", "preview", "full"]

# Required fields for validation
REQUIRED_IDENTITY_FIELDS = ["SPV_ID", "Deal_ID"]
REQUIRED_LOCATION_FIELDS = ["County", "State"]
REQUIRED_FINANCIAL_FIELDS = [
    "Purchase Price",
    "Monthly Payment To Seller",
    "Seller Carryback",
    "Cash At Closing To Seller",
    "TOTAL_CAPITAL_REQUIRED"
]
REQUIRED_STATUS_FIELDS = ["Status"]

ALL_REQUIRED_FIELDS = (
    REQUIRED_IDENTITY_FIELDS + 
    REQUIRED_LOCATION_FIELDS + 
    REQUIRED_FINANCIAL_FIELDS + 
    REQUIRED_STATUS_FIELDS
)

# Waterfall required inputs
WATERFALL_REQUIRED_FIELDS = [
    "TOTAL_CAPITAL_REQUIRED",
    "Seller Carryback",
    "Cash At Closing To Seller",
    "Net Cash To Seller",
    "Status"
]


# ============= APP-LAYER STATE MANAGEMENT =============

class SPVDisplayState:
    """
    In-memory state for SPV display configuration.
    This is APP-LAYER ONLY - never writes to Google Sheets.
    """
    
    def __init__(self):
        self._disclosure_levels: dict[str, str] = {}  # spvId -> disclosure level
        self._last_updated: dict[str, datetime] = {}
        self._waterfall_permissions: dict[str, bool] = {}  # spvId -> waterfall permitted
    
    def set_disclosure(self, spv_id: str, level: str) -> None:
        """Set disclosure level for an SPV (app layer only)"""
        if level not in DISCLOSURE_LEVELS:
            raise ValueError(f"Invalid disclosure level: {level}")
        self._disclosure_levels[spv_id] = level
        self._last_updated[spv_id] = datetime.utcnow()
        logger.info(f"Disclosure set for {spv_id}: {level}")
    
    def get_disclosure(self, spv_id: str) -> str:
        """Get disclosure level (defaults to 'teaser')"""
        return self._disclosure_levels.get(spv_id, "teaser")
    
    def get_last_updated(self, spv_id: str) -> Optional[datetime]:
        """Get last update time for SPV state"""
        return self._last_updated.get(spv_id)
    
    def set_waterfall_permission(self, spv_id: str, permitted: bool) -> None:
        """Set waterfall visibility permission"""
        self._waterfall_permissions[spv_id] = permitted
        self._last_updated[spv_id] = datetime.utcnow()
    
    def get_waterfall_permission(self, spv_id: str) -> bool:
        """Get waterfall permission (defaults to False)"""
        return self._waterfall_permissions.get(spv_id, False)
    
    def clear(self, spv_id: str) -> None:
        """Clear all state for an SPV"""
        self._disclosure_levels.pop(spv_id, None)
        self._last_updated.pop(spv_id, None)
        self._waterfall_permissions.pop(spv_id, None)

# Global state instance
spv_state = SPVDisplayState()


# ============= PYDANTIC MODELS =============

class LoadSPVRequest(BaseModel):
    spvId: str = Field(..., description="SPV identifier", example="SPV_011")

class SetDisclosureRequest(BaseModel):
    spvId: str = Field(..., description="SPV identifier", example="SPV_011")
    disclosureLevel: Literal["blocked", "teaser", "preview", "full"] = Field(
        ..., 
        description="Disclosure level for display",
        example="preview"
    )

class ResolveVisibilityRequest(BaseModel):
    spvId: str = Field(..., description="SPV identifier", example="SPV_011")

class SetWaterfallRequest(BaseModel):
    spvId: str = Field(..., description="SPV identifier", example="SPV_011")
    permitted: bool = Field(..., description="Whether waterfall is permitted", example=True)


# ============= AUTH DEPENDENCY =============

async def verify_orchestration_token(authorization: str = Header(None)) -> bool:
    """Verify Bearer token for orchestration endpoints"""
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail={"error": "unauthorized", "message": "Missing Authorization header"},
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={"error": "unauthorized", "message": "Invalid authorization format. Use: Bearer <token>"},
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = authorization[7:]
    
    if token != ORCHESTRATION_API_TOKEN:
        logger.warning("Invalid orchestration token attempt")
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Invalid API token"}
        )
    
    return True


# ============= HELPER FUNCTIONS =============

def get_csv_url(spreadsheet_id: str, sheet_name: str = "Sheet1") -> str:
    """Generate CSV export URL for a public Google Sheet"""
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/gviz/tq?tqx=out:csv&sheet={sheet_name}"


def get_csv_url_by_gid(spreadsheet_id: str, gid: str) -> str:
    """Generate CSV export URL for a public Google Sheet tab by gid"""
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/gviz/tq?tqx=out:csv&gid={gid}"


async def fetch_access_control() -> list[dict]:
    """
    Fetch Licensed Users access-control tab from Google Sheets.
    Columns: license_id, email, owner_name, license_level, status, assigned_spv_id, access_type, source
    """
    url = get_csv_url_by_gid(SPREADSHEET_ID, ACCESS_CONTROL_GID)
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch access-control tab: {type(e).__name__}")
            raise HTTPException(status_code=502, detail="Failed to fetch access-control data")
    
    reader = csv.DictReader(io.StringIO(response.text))
    users = []
    for row in reader:
        email = row.get("email", "").strip().lower()
        if not email:
            continue
        users.append({
            "license_id": row.get("license_id", "").strip(),
            "email": email,
            "owner_name": row.get("owner_name", "").strip(),
            "license_level": row.get("license_level", "").strip(),
            "status": row.get("status", "").strip(),
            # Licensed Users sheet migrated: "assigned_spv_id" -> "assigned_business_id".
            # Keep internal key name "assigned_spv_id" stable; value is the UBIDS identifier.
            "assigned_spv_id": (row.get("assigned_business_id") or row.get("assigned_spv_id") or "").strip(),
            "access_type": row.get("access_type", "").strip(),
            "source": row.get("source", "").strip(),
        })
    return users


def resolve_user_access(users: list[dict], email: str) -> Optional[dict]:
    """
    Look up a user by email in the access-control list.
    Returns the user record if found and Active, else None.
    """
    email_lower = email.strip().lower()
    for user in users:
        if user["email"] == email_lower:
            return user
    return None


async def fetch_sheet_tab(sheet_name: str) -> list[dict]:
    """Fetch any named tab from the Google Sheet as list of dicts."""
    import urllib.parse
    encoded = urllib.parse.quote(sheet_name)
    url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet={encoded}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch sheet tab '{sheet_name}': {type(e).__name__}")
            return []
    reader = csv.DictReader(io.StringIO(response.text))
    rows = []
    for row in reader:
        clean = {k: v.strip() for k, v in row.items() if k and k.strip()}
        # Source data has migrated SPV terminology -> UBIDS.
        # Alias the new canonical identifier column to the legacy key names
        # so existing downstream masking / filtering code keeps working without churn.
        if "Business ID (UBIDS)" in clean:
            business_id = clean["Business ID (UBIDS)"]
            if "SPV_ID" not in clean:
                clean["SPV_ID"] = business_id
            if "spv_id" not in clean:
                clean["spv_id"] = business_id
        rows.append(clean)
    return rows


def filter_by_spv(rows: list[dict], spv_id: str) -> list[dict]:
    """Filter rows to those matching the given business identifier (internally named SPV_ID)."""
    return [r for r in rows if r.get("SPV_ID", "").strip() == spv_id]


def mask_main_maps_l1(row: dict) -> dict:
    """LEVEL_1 view of Main Maps Offers — teaser only."""
    return {
        "Deal_ID": row.get("Deal_ID", ""),
        "SPV_ID": row.get("SPV_ID", ""),
        "State": row.get("State", ""),
        "County": row.get("County", ""),
        "Status": row.get("Status", ""),
        "Partner_Updates": row.get("Partner Updates", ""),
        "UNIT_SIZE": row.get("UNIT_SIZE", ""),
        "TOTAL_UNITS": row.get("TOTAL_UNITS", ""),
        "UNITS_SOLD": row.get("UNITS_SOLD", ""),
        "Property_Type": row.get("Property_Type", ""),
        "Target_Business_Use": row.get("Target_Business_Use", ""),
    }


def mask_main_maps_l2(row: dict) -> dict:
    """LEVEL_2 view — adds financial fields, still masks address/seller."""
    base = mask_main_maps_l1(row)
    base.update({
        "Purchase_Price": row.get("Purchase Price", ""),
        "Monthly_Payment": row.get("Monthly Payment To Seller", ""),
        "Seller_Carryback": row.get("Seller Carryback", ""),
        "Open_Loan_Balance": row.get("Open Loan Balance", ""),
        "TOTAL_CAPITAL_REQUIRED": row.get("TOTAL_CAPITAL_REQUIRED", ""),
    })
    return base


def mask_main_maps_l3(row: dict) -> dict:
    """LEVEL_3 view — full financial, still masks address/seller/agent."""
    base = mask_main_maps_l2(row)
    base.update({
        "Agents_Commission": row.get("Agent's Commission", ""),
        "Cash_At_Closing": row.get("Cash At Closing To Seller", ""),
        "Net_Cash_To_Seller": row.get("Net Cash To Seller", ""),
    })
    return base


def mask_spv_registry_l1(row: dict) -> dict:
    return {
        "Deal_ID": row.get("Deal_ID", ""),
        "SPV_ID": row.get("SPV_ID", ""),
        "State": row.get("State", ""),
        "County": row.get("County", ""),
        "Target_Business_Use": row.get("Target_Business_Use", ""),
        "Status": row.get("Status", ""),
    }


def mask_spv_registry_l2(row: dict) -> dict:
    base = mask_spv_registry_l1(row)
    base.update({
        "Purchase_Price": row.get("Purchase_Price", ""),
        "TOTAL_CAPITAL_REQUIRED": row.get("TOTAL_CAPITAL_REQUIRED", ""),
    })
    return base


def mask_capital_stack_l1(row: dict) -> dict:
    return {
        "Deal_ID": row.get("Deal_ID", ""),
        "SPV_ID": row.get("SPV_ID", ""),
        "Total_Capital": "Restricted",
        "Senior_Amount": "Restricted",
        "Mezz_Amount": "Restricted",
        "Equity_Amount": "Restricted",
        "Risk_Profile": "Restricted",
    }


def mask_capital_stack_l2(row: dict) -> dict:
    return {
        "Deal_ID": row.get("Deal_ID", ""),
        "SPV_ID": row.get("SPV_ID", ""),
        "Total_Capital": row.get("Total_Capital", ""),
        "Senior_Amount": row.get("Senior_Amount", ""),
        "Mezz_Amount": row.get("Mezz_Amount", ""),
        "Equity_Amount": row.get("Equity_Amount", ""),
        "Risk_Profile": row.get("Risk_Profile", ""),
    }


def mask_capital_stack_l3(row: dict) -> dict:
    return {
        "Deal_ID": row.get("Deal_ID", ""),
        "SPV_ID": row.get("SPV_ID", ""),
        "Total_Capital": row.get("Total_Capital", ""),
        "Senior_Amount": row.get("Senior_Amount", ""),
        "Senior_Return": row.get("Senior_Return", ""),
        "Senior_Priority": row.get("Senior_Priority", ""),
        "Mezz_Amount": row.get("Mezz_Amount", ""),
        "Mezz_Return": row.get("Mezz_Return", ""),
        "Mezz_Priority": row.get("Mezz_Priority", ""),
        "Equity_Amount": row.get("Equity_Amount", ""),
        "Equity_Return": row.get("Equity_Return", ""),
        "Equity_Priority": row.get("Equity_Priority", ""),
        "Risk_Profile": row.get("Risk_Profile", ""),
    }


def mask_deal_summary_l1(row: dict) -> dict:
    return {
        "Deal_ID": row.get("Deal_ID", ""),
        "SPV_ID": row.get("SPV_ID", ""),
        "Deal_Name": row.get("Deal_Name", ""),
        "State": row.get("State", ""),
        "Risk_Summary": row.get("Risk_Summary", ""),
    }


def mask_deal_summary_l2(row: dict) -> dict:
    base = mask_deal_summary_l1(row)
    base["Capital_Stack_Display"] = row.get("Capital_Stack_Display", "")
    return base


def mask_deal_summary_l3(row: dict) -> dict:
    base = mask_deal_summary_l2(row)
    base["Waterfall_Display"] = row.get("Waterfall_Display", "")
    return base


def mask_validation_l1(row: dict) -> dict:
    return {
        "SPV_ID": row.get("SPV_ID", ""),
        "Overall_Status": row.get("Overall_Status", ""),
    }


def mask_validation_l2(row: dict) -> dict:
    return {
        "Deal_ID": row.get("Deal_ID", ""),
        "SPV_ID": row.get("SPV_ID", ""),
        "Tranche_Count_Check": row.get("Tranche_Count_Check", ""),
        "Capital_Match_Check": row.get("Capital_Match_Check", ""),
        "Waterfall_Check": row.get("Waterfall_Check", ""),
        "Capital_Presence_Check": row.get("Capital_Presence_Check", ""),
        "Overall_Status": row.get("Overall_Status", ""),
    }


def parse_number(value) -> float:
    """Parse a number from string, handling currency and commas"""
    if value is None or value == "" or value == "-":
        return 0.0
    cleaned = re.sub(r'[$,\s]', '', str(value))
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return 0.0


def is_valid_number(value) -> bool:
    """Check if value is a valid positive number"""
    num = parse_number(value)
    return num > 0


def parse_status(value: str) -> str:
    """Normalize status values"""
    if not value:
        return "Pending"
    value = str(value).strip().lower()
    if value in ["active", "green", "approved", "funded"]:
        return "Active"
    elif value in ["locked", "red", "closed", "completed"]:
        return "Locked"
    else:
        return "Pending"


async def fetch_sheet_data() -> list[dict]:
    """
    Fetch and parse data from Google Sheets (source of truth).
    This is READ-ONLY - never modifies the sheet.
    """
    url = get_csv_url(SPREADSHEET_ID, SHEET_MAIN_MAPS)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch Google Sheet: {type(e).__name__}")
            raise HTTPException(status_code=502, detail="Failed to fetch Google Sheet")
    
    csv_content = response.text
    reader = csv.DictReader(io.StringIO(csv_content))
    
    deals = []
    for row in reader:
        deal_id = row.get("Deal_ID", "").strip()
        if not deal_id or not deal_id.startswith("Deal_"):
            continue
        
        price = parse_number(row.get("Purchase Price", 0))
        senior = parse_number(row.get("Seller Carryback", 0))
        equity = parse_number(row.get("Cash At Closing To Seller", 0))
        total_capital = parse_number(row.get("TOTAL_CAPITAL_REQUIRED", 0))
        payment = parse_number(row.get("Monthly Payment To Seller", 0))
        net_to_seller = parse_number(row.get("Net Cash To Seller", 0))
        
        if total_capital == 0:
            total_capital = senior + equity
        
        mezz = max(0, total_capital - senior - equity)
        state = row.get("State", "").strip()
        county = row.get("County", "").strip()
        location = f"{county}, {state}".strip(", ")
        
        deal = {
            "id": deal_id,
            "deal": deal_id,
            "spv": row.get("SPV_ID", "").strip(),
            "sellerName": row.get("Seller Name", "").strip(),
            "address": row.get("Property Address", "").strip(),
            "state": state,
            "county": county,
            "location": location,
            "price": price,
            "payment": payment,
            "senior": senior,
            "mezz": mezz,
            "equity": equity,
            "agentCommission": parse_number(row.get("Agent's Commission", 0)),
            "netToSeller": net_to_seller,
            "status": parse_status(row.get("Status", "")),
            "rawStatus": row.get("Status", "").strip(),
            "totalCapital": total_capital,
            "unitSize": parse_number(row.get("UNIT_SIZE", 0)),
            "units": int(parse_number(row.get("TOTAL_UNITS", 0))),
            "unitsSold": int(parse_number(row.get("UNITS_SOLD", 0))),
            "propertyType": row.get("Property_Type", "").strip() or "Commercial",
            "businessUse": row.get("Target_Business_Use", "").strip() or "Investment",
            # Raw fields for validation
            "_raw": row
        }
        deals.append(deal)
    
    return deals


def get_spv_deals(deals: list[dict], spv_id: str) -> list[dict]:
    """Get all deals for an SPV"""
    return [d for d in deals if d["spv"] == spv_id]


def get_spv_aggregate(deals: list[dict], spv_id: str) -> Optional[dict]:
    """Get aggregated SPV data from deals list"""
    spv_deals = get_spv_deals(deals, spv_id)
    if not spv_deals:
        return None
    
    return {
        "id": spv_id,
        "name": spv_id,
        "deals": [d["deal"] for d in spv_deals],
        "dealCount": len(spv_deals),
        "totalCapital": sum(d["totalCapital"] for d in spv_deals),
        "totalSenior": sum(d["senior"] for d in spv_deals),
        "totalMezz": sum(d["mezz"] for d in spv_deals),
        "totalEquity": sum(d["equity"] for d in spv_deals),
        "avgPayment": sum(d["payment"] for d in spv_deals) / len(spv_deals) if spv_deals else 0,
        "totalNetToSeller": sum(d["netToSeller"] for d in spv_deals),
        # Aggregate location info
        "counties": list(set(d["county"] for d in spv_deals if d["county"])),
        "states": list(set(d["state"] for d in spv_deals if d["state"])),
        "propertyTypes": list(set(d["propertyType"] for d in spv_deals if d["propertyType"])),
        "businessUses": list(set(d["businessUse"] for d in spv_deals if d["businessUse"])),
        "statuses": list(set(d["status"] for d in spv_deals)),
    }


# ============= VALIDATION FUNCTIONS =============

def validate_required_fields(spv_deals: list[dict]) -> dict:
    """
    Validate required fields for SPV deals.
    Returns missing fields and blocking reasons.
    """
    missing_fields = []
    blocking_reasons = []
    
    for deal in spv_deals:
        raw = deal.get("_raw", {})
        deal_id = deal.get("deal", "Unknown")
        
        # Check identity fields
        if not raw.get("SPV_ID", "").strip():
            missing_fields.append(f"{deal_id}: SPV_ID")
            blocking_reasons.append(f"{deal_id}: Missing SPV_ID (identity)")
        
        if not raw.get("Deal_ID", "").strip():
            missing_fields.append(f"{deal_id}: Deal_ID")
            blocking_reasons.append(f"{deal_id}: Missing Deal_ID (identity)")
        
        # Check location fields
        if not raw.get("County", "").strip():
            missing_fields.append(f"{deal_id}: County")
        
        if not raw.get("State", "").strip():
            missing_fields.append(f"{deal_id}: State")
        
        # Check financial fields
        if not is_valid_number(raw.get("Purchase Price")):
            missing_fields.append(f"{deal_id}: Purchase Price")
            blocking_reasons.append(f"{deal_id}: Invalid Purchase Price")
        
        if not is_valid_number(raw.get("Monthly Payment To Seller")):
            missing_fields.append(f"{deal_id}: Monthly Payment")
        
        if not is_valid_number(raw.get("Seller Carryback")):
            missing_fields.append(f"{deal_id}: Seller Carryback")
        
        if not is_valid_number(raw.get("Cash At Closing To Seller")):
            missing_fields.append(f"{deal_id}: Cash At Closing")
        
        if not is_valid_number(raw.get("TOTAL_CAPITAL_REQUIRED")):
            missing_fields.append(f"{deal_id}: Total Capital Required")
        
        # Check status
        if not raw.get("Status", "").strip():
            missing_fields.append(f"{deal_id}: Status")
    
    return {
        "missingFields": missing_fields[:10],  # Limit for brevity
        "blockingReasons": blocking_reasons[:5],
        "fieldsComplete": len(missing_fields) == 0,
        "hasBlockingIssues": len(blocking_reasons) > 0
    }


def validate_waterfall_inputs(spv_deals: list[dict]) -> dict:
    """
    Validate waterfall required inputs.
    Returns availability status and any blocking reasons.
    """
    blocking_reasons = []
    all_valid = True
    
    for deal in spv_deals:
        deal_id = deal.get("deal", "Unknown")
        
        # Check total capital is valid number
        if deal.get("totalCapital", 0) <= 0:
            blocking_reasons.append(f"{deal_id}: Invalid total capital")
            all_valid = False
        
        # Check senior is valid number
        if deal.get("senior", 0) < 0:
            blocking_reasons.append(f"{deal_id}: Invalid senior debt")
            all_valid = False
        
        # Check equity is valid number
        if deal.get("equity", 0) < 0:
            blocking_reasons.append(f"{deal_id}: Invalid equity")
            all_valid = False
        
        # Check computed mezz is not negative
        if deal.get("mezz", 0) < 0:
            blocking_reasons.append(f"{deal_id}: Negative mezzanine (invalid capital stack)")
            all_valid = False
        
        # Check status is not blank
        if not deal.get("rawStatus", "").strip():
            blocking_reasons.append(f"{deal_id}: Missing status")
            all_valid = False
    
    return {
        "waterfallAvailable": all_valid and len(spv_deals) > 0,
        "waterfallBlockingReasons": blocking_reasons[:5]
    }


def resolve_spv_visibility_state(
    exists: bool,
    field_validation: dict,
    waterfall_validation: dict,
    disclosure_level: str,
    has_capital_stack: bool,
    waterfall_permitted: bool
) -> dict:
    """
    Single unified function that computes ALL visibility fields
    and enforces invariants before returning.

    Returns a dict with:
      resolvedVisibility, safeToDisplay, waterfallAvailable,
      waterfallVisible, blockingReasons, nextSafeAction
    """
    fields_complete = field_validation["fieldsComplete"]
    has_field_blocking = field_validation["hasBlockingIssues"]
    waterfall_available = waterfall_validation["waterfallAvailable"]

    # --- Collect ALL blocking reasons from both sources ---
    all_blocking: list[str] = []
    all_blocking.extend(field_validation.get("blockingReasons", []))
    all_blocking.extend(waterfall_validation.get("waterfallBlockingReasons", []))

    # --- safeToDisplay: true only when fields are complete AND no blocking from ANY source ---
    safe_to_display = (
        exists and
        fields_complete and
        not has_field_blocking and
        len(all_blocking) == 0
    )

    # --- Resolve visibility state ---
    if not exists:
        resolved = "blocked"
    elif has_field_blocking:
        resolved = "blocked"
    elif disclosure_level in DISCLOSURE_LEVELS:
        if disclosure_level == "full" and not (fields_complete and has_capital_stack and safe_to_display):
            resolved = "preview" if has_capital_stack else "teaser"
        elif disclosure_level == "preview" and not has_capital_stack:
            resolved = "teaser"
        else:
            resolved = disclosure_level
    elif fields_complete and has_capital_stack:
        resolved = "preview"
    elif exists:
        resolved = "teaser"
    else:
        resolved = "blocked"

    # --- INVARIANT ENFORCEMENT ---

    # Invariant 1: if resolvedVisibility=full then safeToDisplay must be true
    if resolved == "full" and not safe_to_display:
        resolved = "preview" if has_capital_stack else "teaser"

    # Invariant 2: if safeToDisplay=false then resolvedVisibility must not be full
    # (already enforced above, but belt-and-suspenders)
    if not safe_to_display and resolved == "full":
        resolved = "preview" if has_capital_stack else "teaser"

    # Invariant 3: if waterfallVisible=true the SPV cannot be blocked
    # (computed below, but we prevent blocked from having waterfall)

    # --- Compute waterfall visibility ---
    waterfall_visible = (
        resolved == "full" and
        waterfall_available and
        fields_complete and
        safe_to_display and
        waterfall_permitted
    )

    # Invariant 4: if waterfallVisible=true, SPV cannot be blocked
    if waterfall_visible and resolved == "blocked":
        waterfall_visible = False

    # --- Compute nextSafeAction ---
    if resolved == "blocked":
        if not exists:
            next_action = "spv_not_found"
        elif has_field_blocking:
            next_action = "fix_blocking_fields"
        else:
            next_action = "fix_blocking_fields"
    elif resolved == "teaser":
        if not fields_complete:
            next_action = "complete_required_fields"
        elif not has_capital_stack:
            next_action = "add_capital_stack_data"
        else:
            next_action = "set_disclosure_preview"
    elif resolved == "preview":
        if not safe_to_display:
            next_action = "resolve_blocking_reasons"
        elif disclosure_level != "full":
            next_action = "set_disclosure_full"
        else:
            next_action = "resolve_blocking_reasons"
    elif resolved == "full":
        if not waterfall_visible and waterfall_permitted:
            next_action = "resolve_waterfall_blocking"
        elif not waterfall_permitted:
            next_action = "permit_waterfall"
        else:
            next_action = "allow_full_display"
    else:
        next_action = "unknown"

    # --- Invariant 5: if missingFields=[] and blockingReasons=[] then safeToDisplay must be true ---
    missing_fields = field_validation.get("missingFields", [])
    if len(missing_fields) == 0 and len(all_blocking) == 0 and exists:
        safe_to_display = True

    # Re-check: if safeToDisplay just got forced true but resolved was downgraded, re-resolve
    if safe_to_display and resolved != "full" and disclosure_level == "full" and has_capital_stack and fields_complete:
        resolved = "full"
        # Recompute waterfall
        waterfall_visible = (
            waterfall_available and
            fields_complete and
            waterfall_permitted
        )
        if waterfall_visible and waterfall_permitted:
            next_action = "allow_full_display"
        elif not waterfall_permitted:
            next_action = "permit_waterfall"
        else:
            next_action = "resolve_waterfall_blocking"

    return {
        "resolvedVisibility": resolved,
        "safeToDisplay": safe_to_display,
        "waterfallAvailable": waterfall_available,
        "waterfallVisible": waterfall_visible,
        "blockingReasons": all_blocking[:5],
        "nextSafeAction": next_action,
    }


# ============= VISIBILITY FILTERING =============

def apply_visibility_filter(
    spv_data: dict,
    spv_deals: list[dict],
    visibility_state: str,
    waterfall_visible: bool
) -> dict:
    """
    Apply visibility filtering based on disclosure state.
    """
    
    if visibility_state == "blocked":
        # Show: SPV ID only, blocked message
        # Hide: everything else
        return {
            "spvId": spv_data.get("id"),
            "visibilityState": "blocked",
            "message": "This SPV is currently blocked from display due to missing or invalid data.",
            "dealCount": spv_data.get("dealCount", 0)
        }
    
    elif visibility_state == "teaser":
        # Show: SPV ID, county, state, property type, target business use, high-level status
        # Hide: exact address, seller identity, full capital stack details, waterfall
        return {
            "spvId": spv_data.get("id"),
            "visibilityState": "teaser",
            "dealCount": spv_data.get("dealCount", 0),
            "counties": spv_data.get("counties", []),
            "states": spv_data.get("states", []),
            "propertyTypes": spv_data.get("propertyTypes", []),
            "businessUses": spv_data.get("businessUses", []),
            "statuses": spv_data.get("statuses", [])
        }
    
    elif visibility_state == "preview":
        # Show: SPV ID, county, state, purchase price, monthly payment, 
        #       senior, mezz, equity, units, units sold, status
        # Hide: seller identity, direct source path, sensitive notes, 
        #       full waterfall splits unless waterfall gating passes
        preview_deals = []
        for deal in spv_deals:
            preview_deals.append({
                "dealId": deal.get("deal"),
                "county": deal.get("county"),
                "state": deal.get("state"),
                "location": deal.get("location"),
                "purchasePrice": deal.get("price"),
                "monthlyPayment": deal.get("payment"),
                "senior": deal.get("senior"),
                "mezz": deal.get("mezz"),
                "equity": deal.get("equity"),
                "totalCapital": deal.get("totalCapital"),
                "units": deal.get("units"),
                "unitsSold": deal.get("unitsSold"),
                "status": deal.get("status"),
                "propertyType": deal.get("propertyType")
            })
        
        result = {
            "spvId": spv_data.get("id"),
            "visibilityState": "preview",
            "dealCount": spv_data.get("dealCount", 0),
            "deals": preview_deals,
            "summary": {
                "totalCapital": spv_data.get("totalCapital", 0),
                "totalSenior": spv_data.get("totalSenior", 0),
                "totalMezz": spv_data.get("totalMezz", 0),
                "totalEquity": spv_data.get("totalEquity", 0),
                "avgPayment": spv_data.get("avgPayment", 0)
            }
        }
        
        # Include waterfall summary if visible
        if waterfall_visible:
            result["waterfallSummary"] = {
                "available": True,
                "totalNetToSeller": spv_data.get("totalNetToSeller", 0)
            }
        
        return result
    
    elif visibility_state == "full":
        # Show: all permitted SPV business model fields, capital stack, 
        #       waterfall if waterfall gating passes
        # Still hide: seller identity, direct source path (unless explicitly enabled later)
        full_deals = []
        for deal in spv_deals:
            full_deal = {
                "dealId": deal.get("deal"),
                "county": deal.get("county"),
                "state": deal.get("state"),
                "location": deal.get("location"),
                "address": deal.get("address"),  # Included in full
                "purchasePrice": deal.get("price"),
                "monthlyPayment": deal.get("payment"),
                "senior": deal.get("senior"),
                "mezz": deal.get("mezz"),
                "equity": deal.get("equity"),
                "totalCapital": deal.get("totalCapital"),
                "agentCommission": deal.get("agentCommission"),
                "netToSeller": deal.get("netToSeller"),
                "units": deal.get("units"),
                "unitsSold": deal.get("unitsSold"),
                "unitSize": deal.get("unitSize"),
                "status": deal.get("status"),
                "propertyType": deal.get("propertyType"),
                "businessUse": deal.get("businessUse")
                # Note: sellerName and sourcePath intentionally excluded
            }
            full_deals.append(full_deal)
        
        result = {
            "spvId": spv_data.get("id"),
            "visibilityState": "full",
            "dealCount": spv_data.get("dealCount", 0),
            "deals": full_deals,
            "summary": {
                "totalCapital": spv_data.get("totalCapital", 0),
                "totalSenior": spv_data.get("totalSenior", 0),
                "totalMezz": spv_data.get("totalMezz", 0),
                "totalEquity": spv_data.get("totalEquity", 0),
                "avgPayment": spv_data.get("avgPayment", 0),
                "totalNetToSeller": spv_data.get("totalNetToSeller", 0)
            }
        }
        
        # Include full waterfall data if visible
        if waterfall_visible:
            result["waterfall"] = {
                "available": True,
                "visible": True,
                "capitalStack": {
                    "senior": spv_data.get("totalSenior", 0),
                    "mezz": spv_data.get("totalMezz", 0),
                    "equity": spv_data.get("totalEquity", 0),
                    "total": spv_data.get("totalCapital", 0)
                },
                "distributions": {
                    "netToSeller": spv_data.get("totalNetToSeller", 0)
                }
            }
        else:
            result["waterfall"] = {
                "available": False,
                "visible": False,
                "reason": "Waterfall data not available or not permitted"
            }
        
        return result
    
    # Fallback
    return {
        "spvId": spv_data.get("id"),
        "visibilityState": "blocked",
        "message": "Unknown visibility state"
    }


# ============= STANDARD API ENDPOINTS =============

@app.get("/")
async def root():
    return {"message": "UBUYBOX Emergent API", "version": "1.1.0"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "source": "Google Sheets", "layer": "Emergent"}


@app.get("/api/deals")
async def get_all_deals():
    """Get all deals from Google Sheets"""
    deals = await fetch_sheet_data()
    # Remove _raw field from response
    clean_deals = [{k: v for k, v in d.items() if k != "_raw"} for d in deals]
    return {"deals": clean_deals, "count": len(clean_deals)}


@app.get("/api/deals/{deal_id}")
async def get_deal_by_id(deal_id: str):
    """Get a single deal by Deal_ID"""
    deals = await fetch_sheet_data()
    
    for deal in deals:
        if deal["deal"].lower() == deal_id.lower() or deal["id"].lower() == deal_id.lower():
            return {k: v for k, v in deal.items() if k != "_raw"}
    
    raise HTTPException(status_code=404, detail=f"Deal {deal_id} not found")


@app.get("/api/spvs")
async def get_spvs():
    """Get deals grouped by SPV_ID"""
    deals = await fetch_sheet_data()
    
    spv_map = {}
    for deal in deals:
        spv_id = deal["spv"] or "Unknown"
        if spv_id not in spv_map:
            spv_map[spv_id] = {
                "id": spv_id,
                "name": spv_id,
                "deals": [],
                "totalCapital": 0,
                "dealCount": 0,
                "status": "Active"
            }
        spv_map[spv_id]["deals"].append(deal["deal"])
        spv_map[spv_id]["totalCapital"] += deal["totalCapital"]
        spv_map[spv_id]["dealCount"] += 1
    
    spvs = list(spv_map.values())
    return {"spvs": spvs, "count": len(spvs)}


@app.get("/api/dashboard")
async def get_dashboard():
    """Get aggregated dashboard metrics"""
    deals = await fetch_sheet_data()
    
    if not deals:
        return {
            "totalDeals": 0,
            "activeSPVs": 0,
            "totalCapital": 0,
            "avgMonthlyPayment": 0,
            "statusCounts": {"Active": 0, "Pending": 0, "Locked": 0},
            "recentDeals": []
        }
    
    total_deals = len(deals)
    total_capital = sum(d["totalCapital"] for d in deals)
    total_payment = sum(d["payment"] for d in deals)
    avg_payment = total_payment / total_deals if total_deals > 0 else 0
    
    spvs = set(d["spv"] for d in deals if d["spv"])
    active_spvs = len(spvs)
    
    status_counts = {"Active": 0, "Pending": 0, "Locked": 0}
    for deal in deals:
        status = deal["status"]
        if status in status_counts:
            status_counts[status] += 1
    
    clean_deals = [{k: v for k, v in d.items() if k != "_raw"} for d in deals[:5]]
    
    return {
        "totalDeals": total_deals,
        "activeSPVs": active_spvs,
        "totalCapital": total_capital,
        "avgMonthlyPayment": round(avg_payment, 2),
        "statusCounts": status_counts,
        "recentDeals": clean_deals
    }


# ============= USER-SCOPED ENDPOINTS (Bolt auth context) =============

async def _resolve_and_validate(email: str) -> dict:
    """Common auth resolution. Returns user dict or raises HTTPException."""
    if not email or not email.strip():
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "Email parameter is required"})
    
    # Admin bypass — admin may not be in Licensed Users sheet
    if email.strip().lower() == ADMIN_EMAIL:
        users = await fetch_access_control()
        user = resolve_user_access(users, email)
        if user:
            return user
        # Admin not in sheet — return synthetic admin record
        return {
            "license_id": "ADMIN",
            "email": ADMIN_EMAIL,
            "owner_name": "Admin",
            "license_level": "LEVEL_3",
            "status": "Active",
            "assigned_spv_id": "SPV_011",
            "access_type": "Admin",
            "source": "System",
        }
    
    users = await fetch_access_control()
    user = resolve_user_access(users, email)
    if not user:
        raise HTTPException(status_code=404, detail={"error": "user_not_found", "message": f"No licensed user found for email: {email}"})
    if user["status"] != "Active":
        raise HTTPException(status_code=403, detail={"error": "user_inactive", "message": f"User account is not active (status: {user['status']})"})
    if not user["assigned_spv_id"]:
        raise HTTPException(status_code=403, detail={"error": "no_spv_assigned", "message": "No SPV assigned to this user"})
    return user


@app.get("/api/user/resolve")
async def resolve_user_endpoint(email: str):
    user = await _resolve_and_validate(email)
    level = user["license_level"]
    caps = CAPS.get(level, CAPS["LEVEL_1"])
    return {
        "success": True,
        "email": user["email"],
        "ownerName": user["owner_name"],
        "licenseLevel": level,
        "assignedSpvId": user["assigned_spv_id"],
        "accessType": user["access_type"],
        "status": user["status"],
        "caps": caps,
    }


@app.get("/api/user/dashboard")
async def get_user_dashboard(email: str):
    """Full multi-sheet dashboard: personal SPV context + released private opportunities."""
    user = await _resolve_and_validate(email)
    spv_id = user["assigned_spv_id"]
    level = user["license_level"]
    user_level_num = LEVEL_HIERARCHY.get(level, 1)
    email_lower = user["email"]

    # Fetch tabs
    main_maps_all = await fetch_sheet_tab(SHEET_MAIN_MAPS)
    spv_reg_all = await fetch_sheet_tab(SHEET_SPV_REGISTRY)
    cap_stack_all = await fetch_sheet_tab(SHEET_CAPITAL_STACK)
    waterfall_all = await fetch_sheet_tab(SHEET_WATERFALL)
    deal_sum_all = await fetch_sheet_tab(SHEET_DEAL_SUMMARY)
    validation_all = await fetch_sheet_tab(SHEET_VALIDATION)
    orders_all = await fetch_sheet_tab(SHEET_ORDERS)
    opp_release_all = await fetch_sheet_tab(SHEET_OPP_RELEASE)

    # --- Additive repair: rescue Active Opportunities when the Release Control
    # sheet has been overwritten with a Main-Maps-Offers-style schema (no
    # `release_status`, `release_to_level`, `level_*_cta` columns). In that
    # case we synthesize release metadata from the row's `Status` column and
    # sensible level-based defaults so the Active Opportunities dashboard
    # block still renders. Properly-shaped release sheets are not touched.
    if opp_release_all and "release_status" not in opp_release_all[0]:
        synth = []
        for row in opp_release_all:
            if (row.get("Status") or "").strip().lower() != "active":
                continue
            opp_spv = (row.get("spv_id") or row.get("Business ID (UBIDS)") or "").strip()
            opp_deal = (row.get("deal_id") or row.get("Deal_ID") or "").strip()
            if not opp_spv or not opp_deal:
                continue
            synth.append({
                "release_status": "Active",
                "release_to_level": "LEVEL_1",  # visible to every level by default
                "spv_id": opp_spv,
                "deal_id": opp_deal,
                "visibility_mode": "teaser",
                "level_1_visibility": "teaser",
                "level_2_visibility": "preview",
                "level_3_visibility": "full",
                "level_1_cta": "Request Information",
                "level_2_cta": "Request Participation",
                "level_3_cta": "Manage Opportunity",
                "level_1_access_state": "Approval Required",
                "level_2_access_state": "Available",
                "level_3_access_state": "Available",
                "approval_required": "Yes",
                "max_orders_allowed": "0",
                "current_orders_count": "0",
                "capacity_status": "",
                "opportunity_access_state": "Available",
                "notes": "",
            })
        opp_release_all = synth
        logger.info(
            f"Opportunity Release Control sheet detected as misaligned; synthesized {len(synth)} active releases using level defaults."
        )

    # --- Personal Business context (assigned_spv_id) ---
    personal_main = filter_by_spv(main_maps_all, spv_id)
    personal_reg = filter_by_spv(spv_reg_all, spv_id)
    personal_cap = filter_by_spv(cap_stack_all, spv_id)
    personal_wf = filter_by_spv(waterfall_all, spv_id)
    personal_ds = filter_by_spv(deal_sum_all, spv_id)
    personal_val = filter_by_spv(validation_all, spv_id)
    personal_orders = filter_by_spv(orders_all, spv_id)

    # Mask personal context by license level
    if level == "LEVEL_3":
        p_main = [mask_main_maps_l3(r) for r in personal_main]
        p_reg = [mask_spv_registry_l2(r) for r in personal_reg]
        p_cap = [mask_capital_stack_l3(r) for r in personal_cap]
        p_wf = [{"Deal_ID": r.get("Deal_ID",""), "SPV_ID": r.get("SPV_ID",""), "Step_Order": r.get("Step_Order",""), "Tranche": r.get("Tranche",""), "Description": r.get("Description","")} for r in personal_wf]
        p_ds = [mask_deal_summary_l3(r) for r in personal_ds]
        p_val = [mask_validation_l2(r) for r in personal_val]
        p_orders = [{"Order_ID": r.get("Order_ID",""), "SPV_ID": r.get("SPV_ID",""), "Units_Bought": r.get("Units_Bought",""), "Unit_Size": r.get("Unit_Size",""), "Total_Investment": r.get("Total_Investment",""), "Ownership_Percent": r.get("Ownership_Percent",""), "Payment_Status": r.get("Payment_Status",""), "Buyer_Level": r.get("Buyer_Level","")} for r in personal_orders]
    elif level == "LEVEL_2":
        p_main = [mask_main_maps_l2(r) for r in personal_main]
        p_reg = [mask_spv_registry_l2(r) for r in personal_reg]
        p_cap = [mask_capital_stack_l2(r) for r in personal_cap]
        p_wf = [{"SPV_ID": spv_id, "summary": "Waterfall summary available at Level 3"}]
        p_ds = [mask_deal_summary_l2(r) for r in personal_ds]
        p_val = [mask_validation_l2(r) for r in personal_val]
        p_orders = []
    else:
        p_main = [mask_main_maps_l1(r) for r in personal_main]
        p_reg = [mask_spv_registry_l1(r) for r in personal_reg]
        p_cap = [mask_capital_stack_l1(r) for r in personal_cap]
        p_wf = []
        p_ds = [mask_deal_summary_l1(r) for r in personal_ds]
        p_val = [mask_validation_l1(r) for r in personal_val]
        p_orders = []

    # --- Active released opportunities (Opportunity Release Control) ---
    # Per-viewer-level columns: level_X_visibility, level_X_cta, level_X_access_state
    level_key = level.lower()  # e.g. "level_1", "level_2", "level_3"
    released_opps = []
    for opp in opp_release_all:
        if opp.get("release_status", "").strip() != "Active":
            continue
        release_level = opp.get("release_to_level", "").strip()
        release_num = LEVEL_HIERARCHY.get(release_level, 99)
        if user_level_num < release_num:
            continue

        opp_spv = opp.get("spv_id", "").strip()
        opp_deal = opp.get("deal_id", "").strip()

        # Select per-viewer-level columns
        viewer_vis = opp.get(f"{level_key}_visibility", "").strip()
        viewer_cta = opp.get(f"{level_key}_cta", "").strip()
        viewer_access = opp.get(f"{level_key}_access_state", "").strip()

        # If viewer visibility is "hidden", skip this opportunity entirely
        if viewer_vis == "hidden":
            continue

        # Fall back to shared columns if per-level columns are empty
        vis_mode = viewer_vis or opp.get("visibility_mode", "teaser").strip()

        # Get deal data for this opportunity from Main Maps
        deal_rows = [r for r in main_maps_all if r.get("SPV_ID", "").strip() == opp_spv and r.get("Deal_ID", "").strip() == opp_deal]
        deal_summary_rows = [r for r in deal_sum_all if r.get("SPV_ID", "").strip() == opp_spv]
        cap_rows = [r for r in cap_stack_all if r.get("SPV_ID", "").strip() == opp_spv]
        val_rows = [r for r in validation_all if r.get("SPV_ID", "").strip() == opp_spv]

        # Apply masking based on viewer's resolved visibility
        deal_data = deal_rows[0] if deal_rows else {}
        if vis_mode == "full":
            masked_deal = mask_main_maps_l3(deal_data) if deal_data else {}
            masked_cap = [mask_capital_stack_l3(r) for r in cap_rows]
            masked_ds = [mask_deal_summary_l3(r) for r in deal_summary_rows]
        elif vis_mode == "preview":
            masked_deal = mask_main_maps_l2(deal_data) if deal_data else {}
            masked_cap = [mask_capital_stack_l2(r) for r in cap_rows]
            masked_ds = [mask_deal_summary_l2(r) for r in deal_summary_rows]
        else:
            masked_deal = mask_main_maps_l1(deal_data) if deal_data else {}
            masked_cap = [mask_capital_stack_l1(r) for r in cap_rows]
            masked_ds = [mask_deal_summary_l1(r) for r in deal_summary_rows]

        max_orders = int(opp.get("max_orders_allowed", "0") or "0")
        cur_orders = int(opp.get("current_orders_count", "0") or "0")
        cap_status = opp.get("capacity_status", "").strip()

        # Use viewer-level access state; fall back to shared
        access_state = viewer_access or opp.get("opportunity_access_state", "").strip()

        # Determine CTA label from viewer-level column
        cta_label = viewer_cta

        # Owner restriction: "Manage Opportunity" only for actual owner
        is_owner = (opp_spv == spv_id)
        if cta_label == "Manage Opportunity" and not is_owner:
            cta_label = "Request Information"

        # Determine CTA availability state
        if access_state == "Restricted" or cap_status == "Closed":
            cta_state = "Restricted"
        elif cap_status == "Full" or (max_orders > 0 and cur_orders >= max_orders):
            cta_state = "Full"
        elif access_state == "Approval Required":
            cta_state = "Approval Required"
        elif access_state == "Available":
            cta_state = "Available"
        else:
            cta_state = access_state or "Available"

        released_opps.append({
            "spvId": opp_spv,
            "dealId": opp_deal,
            "releaseToLevel": release_level,
            "visibilityMode": vis_mode,
            "ctaLabel": cta_label,
            "ctaState": cta_state,
            "accessState": access_state,
            "isOwner": is_owner,
            "approvalRequired": opp.get("approval_required", "").strip() == "Yes",
            "capacityStatus": cap_status,
            "maxOrders": max_orders,
            "currentOrders": cur_orders,
            "notes": opp.get("notes", "").strip(),
            "deal": masked_deal,
            "capitalStack": masked_cap[0] if masked_cap else {},
            "dealSummary": masked_ds[0] if masked_ds else {},
            "validation": (mask_validation_l2(val_rows[0]) if vis_mode in ("preview", "full") and val_rows else mask_validation_l1(val_rows[0]) if val_rows else {}),
        })

    # Personal stats
    total_units = sum(parse_number(r.get("TOTAL_UNITS", 0)) for r in personal_main)
    units_sold = sum(parse_number(r.get("UNITS_SOLD", 0)) for r in personal_main)
    user_orders = [r for r in personal_orders if r.get("Partner_Email", "").strip().lower() == user["email"]]
    active_user_orders = [r for r in user_orders if r.get("Payment_Status", "").strip() in ("Pending", "Active", "Completed")]
    caps = CAPS.get(level, CAPS["LEVEL_1"])

    return {
        "user": {
            "email": user["email"],
            "ownerName": user["owner_name"],
            "licenseLevel": level,
            "assignedSpvId": spv_id,
            "licenseId": user["license_id"],
        },
        "personalContext": {
            "stats": {
                "totalDeals": len(p_main),
                "activeSPVs": 1,
                "totalUnits": int(total_units),
                "unitsSold": int(units_sold),
            },
            "mainMaps": p_main,
            "spvRegistry": p_reg,
            "capitalStack": p_cap,
            "waterfall": p_wf,
            "dealSummary": p_ds,
            "validation": p_val,
            "orders": p_orders,
        },
        "opportunities": released_opps,
        "caps": {
            "maxActiveRequests": caps["max_active_requests"],
            "canParticipate": caps["can_participate"],
            "activeOrderCount": len(active_user_orders),
            "capReached": len(active_user_orders) >= caps["max_active_requests"],
        },
    }


class RequestActionBody(BaseModel):
    email: str = Field(..., description="Authenticated user email")
    action: str = Field(..., description="Action type: request_review, request_participation, request_access")


@app.post("/api/user/request-action")
async def request_action(body: RequestActionBody):
    """Controlled interest/participation request. Logs and enforces caps."""
    user = await _resolve_and_validate(body.email)
    spv_id = user["assigned_spv_id"]
    level = user["license_level"]
    caps = CAPS.get(level, CAPS["LEVEL_1"])

    allowed_actions = ["request_review", "request_participation", "request_access"]
    if body.action not in allowed_actions:
        raise HTTPException(status_code=400, detail={"error": "invalid_action", "message": f"Action must be one of: {allowed_actions}"})

    if body.action == "request_participation" and not caps["can_participate"]:
        raise HTTPException(status_code=403, detail={
            "error": "participation_not_allowed",
            "message": "Your license level does not allow participation requests. Level 2+ required."
        })

    # Check order/request cap from Orders sheet
    orders_raw = filter_by_spv(await fetch_sheet_tab(SHEET_ORDERS), spv_id)
    user_orders = [r for r in orders_raw if r.get("Partner_Email", "").strip().lower() == user["email"]]
    active_orders = [r for r in user_orders if r.get("Payment_Status", "").strip() in ("Pending", "Active", "Completed")]

    if len(active_orders) >= caps["max_active_requests"]:
        raise HTTPException(status_code=429, detail={
            "error": "cap_reached",
            "message": f"You have reached the maximum active requests ({caps['max_active_requests']}) for your license level."
        })

    # Log the request (persistent via MongoDB)
    request_record = {
        "request_id": str(uuid.uuid4())[:8],
        "user_email": user["email"],
        "license_id": user["license_id"],
        "license_level": level,
        "spv_id": spv_id,
        "deal_id": "",
        "request_type": body.action,
        "request_status": "pending_review",
        "timestamp": datetime.utcnow().isoformat(),
    }
    requests_col.insert_one(dict(request_record))
    logger.info(f"Request action logged: {request_record}")

    return {
        "success": True,
        "request": request_record,
        "message": f"Your {body.action.replace('_', ' ')} has been submitted for review.",
    }


class InfoRequestBody(BaseModel):
    email: str
    spvId: str
    dealId: str
    dealName: Optional[str] = ""


@app.post("/api/user/request-info")
async def request_information(body: InfoRequestBody):
    """Request Information on a specific opportunity card. Owner-blocked, cooldown-enforced."""
    user = await _resolve_and_validate(body.email)

    if not body.spvId or not body.dealId:
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "spvId and dealId are required"})

    # Block owners from requesting info on their own SPV
    if body.spvId == user["assigned_spv_id"]:
        raise HTTPException(status_code=403, detail={"error": "owner_blocked", "message": "Owners manage their own opportunities through Admin Control."})

    # Cooldown: block duplicate for same user+deal within 60 seconds
    cutoff = (datetime.utcnow() - timedelta(seconds=60)).isoformat()
    recent = requests_col.find_one({
        "requested_by_email": user["email"],
        "spv_id": body.spvId,
        "deal_id": body.dealId,
        "request_type": "information_request",
        "created_at": {"$gte": cutoff}
    })
    if recent:
        raise HTTPException(status_code=429, detail={"error": "cooldown", "message": "You already submitted a request for this opportunity. Please wait before trying again."})

    record = {
        "request_id": str(uuid.uuid4())[:8],
        "request_type": "information_request",
        "requested_by_user_id": user.get("license_id", ""),
        "requested_by_name": user.get("owner_name", ""),
        "requested_by_email": user["email"],
        "requester_level": user["license_level"],
        "spv_id": body.spvId,
        "deal_id": body.dealId,
        "deal_name": body.dealName or "",
        "owner_user_id": "",
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
    }
    requests_col.insert_one(dict(record))
    logger.info(f"Information request: {record}")

    return {
        "success": True,
        "message": "Your request has been sent for review.",
        "requestId": record["request_id"],
    }


# Legacy user-scoped endpoints (kept for backward compatibility)
@app.get("/api/user/deals")
async def get_user_deals(email: str):
    """User-scoped deals. Reads Supabase v_main_maps_l{N} first; falls back to Sheets + Python mask."""
    user = await _resolve_and_validate(email)
    spv_id = user["assigned_spv_id"]
    level = user["license_level"]

    supabase_rows, source = await _try_supabase_view(
        area="main_maps",
        level=level,
        spv_id=spv_id,
        fallback_log_collection=supabase_fallback_log_col,
    )
    if source == "supabase":
        deals = supabase_rows or []
        return {"deals": deals, "count": len(deals), "spvId": spv_id, "source": "supabase"}

    main_maps_raw = filter_by_spv(await fetch_sheet_tab(SHEET_MAIN_MAPS), spv_id)
    if level == "LEVEL_3":
        return {"deals": [mask_main_maps_l3(r) for r in main_maps_raw], "count": len(main_maps_raw), "spvId": spv_id, "source": "sheet"}
    elif level == "LEVEL_2":
        return {"deals": [mask_main_maps_l2(r) for r in main_maps_raw], "count": len(main_maps_raw), "spvId": spv_id, "source": "sheet"}
    return {"deals": [mask_main_maps_l1(r) for r in main_maps_raw], "count": len(main_maps_raw), "spvId": spv_id, "source": "sheet"}


@app.get("/api/user/spvs")
async def get_user_spvs(email: str):
    """User-scoped SPV registry. Reads Supabase v_spv_registry_l{N} first; falls back to Sheets."""
    user = await _resolve_and_validate(email)
    spv_id = user["assigned_spv_id"]
    level = user["license_level"]

    supabase_rows, source = await _try_supabase_view(
        area="spv_registry",
        level=level,
        spv_id=spv_id,
        fallback_log_collection=supabase_fallback_log_col,
    )
    if source == "supabase":
        masked = supabase_rows or []
        return {"spvs": masked, "count": len(masked), "source": "supabase"}

    spv_reg_raw = filter_by_spv(await fetch_sheet_tab(SHEET_SPV_REGISTRY), spv_id)
    if level in ("LEVEL_2", "LEVEL_3"):
        masked = [mask_spv_registry_l2(r) for r in spv_reg_raw]
    else:
        masked = [mask_spv_registry_l1(r) for r in spv_reg_raw]
    return {"spvs": masked, "count": len(masked), "source": "sheet"}


@app.get("/api/user/notifications")
async def get_user_notifications(email: str):
    """
    User-facing notifications. Combines:
    1. Admin-sent notifications targeted to this user
    2. Request-driven notifications from admin_requests (information_request, etc.)
    """
    user = await _resolve_and_validate(email)
    level = user["license_level"]
    spv_id = user["assigned_spv_id"]
    user_email = user["email"]
    is_admin = user_email == (ADMIN_EMAIL or "")

    result = []

    # 1. Admin-sent notifications (filtered by target)
    all_sent = list(notifications_col.find(
        {"notification_status": "sent"},
        {"_id": 0, "admin_notes": 0, "created_by": 0}
    ).sort("sent_timestamp", -1).limit(200))

    for n in all_sent:
        target_user = (n.get("target_user") or "").strip().lower()
        target_level = (n.get("target_level") or "").strip()
        related_spv = (n.get("related_spv_id") or "").strip()

        if target_user and target_user != user_email and not is_admin:
            continue
        if target_level and not is_admin:
            target_num = LEVEL_HIERARCHY.get(target_level, 99)
            user_num = LEVEL_HIERARCHY.get(level, 0)
            if user_num < target_num:
                continue
        if related_spv and related_spv != spv_id and not is_admin:
            continue

        result.append(n)

    # 2. Request-driven notifications from admin_requests
    if is_admin:
        # Admin sees all requests as notifications
        requests = list(requests_col.find(
            {}, {"_id": 0}
        ).sort("created_at", -1).limit(100))
    else:
        # Non-admin sees only their own submitted requests
        requests = list(requests_col.find(
            {"requested_by_email": user_email}, {"_id": 0}
        ).sort("created_at", -1).limit(50))

    for r in requests:
        req_type = r.get("request_type", "request")
        req_spv = r.get("spv_id", "")
        req_deal = r.get("deal_id", "")
        req_name = r.get("deal_name", req_deal)
        requester = r.get("requested_by_email", "")
        requester_name = r.get("requested_by_name", requester)
        status = r.get("status", "pending")

        # Build title
        type_label = req_type.replace("_", " ").title()
        title = f"{type_label} for {req_spv}" if req_spv else type_label

        # Build body
        if is_admin:
            body = f"{requester} submitted {req_type.replace('_', ' ')} for {req_spv}"
            if req_name and req_name != req_deal:
                body += f" ({req_name})"
            body += f". Status: {status}."
        else:
            body = f"Your {req_type.replace('_', ' ')} for {req_spv}"
            if req_name and req_name != req_deal:
                body += f" ({req_name})"
            body += f" is {status}."

        result.append({
            "notification_id": r.get("request_id", ""),
            "notification_type": title,
            "message_body": body,
            "target_level": r.get("requester_level"),
            "target_user": requester if is_admin else None,
            "related_spv_id": req_spv,
            "related_deal_id": req_deal,
            "notification_status": "sent",
            "sent_timestamp": r.get("created_at", r.get("timestamp", "")),
            "request_status": status,
            "source": "request",
        })

    # Sort all by timestamp, newest first
    result.sort(key=lambda x: x.get("sent_timestamp", ""), reverse=True)

    return {"notifications": result, "count": len(result)}


# ============= LEVEL 3 PAGES =============

@app.get("/api/user/deal-summary")
async def get_deal_summary(email: str):
    """Deal Summary page data — Level 3 only. Property_Address hard-masked.
    Reads from Supabase safe view v_deal_summary_l3 when available, else
    falls back to Google Sheets with Python-side masking.
    """
    user = await _resolve_and_validate(email)
    level = user["license_level"]
    spv_id = user["assigned_spv_id"]
    is_admin = user["email"] == (ADMIN_EMAIL or "")

    if level != "LEVEL_3" and not is_admin:
        raise HTTPException(status_code=403, detail={"error": "access_denied", "message": "Deal Summary requires Level 3 access."})

    # Prefer Supabase safe view (already masked + level-scoped).
    supabase_rows, source = await _try_supabase_view(
        area="deal_summary",
        level="LEVEL_3",
        spv_id=None if is_admin else spv_id,
        fallback_log_collection=supabase_fallback_log_col,
    )
    if source == "supabase":
        result = [r for r in (supabase_rows or []) if any(v for v in r.values())]
        return {"dealSummary": result, "count": len(result), "spvId": spv_id, "source": "supabase"}

    # Fallback: Google Sheets + Python masking.
    rows = await fetch_sheet_tab(SHEET_DEAL_SUMMARY)
    if not is_admin:
        rows = filter_by_spv(rows, spv_id)

    result = []
    for r in rows:
        entry = {
            "Deal_ID": r.get("Deal_ID", ""),
            "SPV_ID": r.get("SPV_ID", ""),
            "Deal_Name": r.get("Deal_Name", ""),
            "State": r.get("State", ""),
            "Capital_Stack_Display": r.get("Capital_Stack_Display", ""),
            "Waterfall_Display": r.get("Waterfall_Display", ""),
            "Risk_Summary": r.get("Risk_Summary", ""),
        }
        if any(v for v in entry.values()):
            result.append(entry)

    return {"dealSummary": result, "count": len(result), "spvId": spv_id, "source": "sheet"}


@app.get("/api/user/tranche-breakdown")
async def get_tranche_breakdown(email: str):
    """Tranche Breakdown page data — Level 3 only.
    Reads from Supabase safe view v_tranche_breakdown_l3 when available, else
    falls back to Google Sheets.
    """
    user = await _resolve_and_validate(email)
    level = user["license_level"]
    spv_id = user["assigned_spv_id"]
    is_admin = user["email"] == (ADMIN_EMAIL or "")

    if level != "LEVEL_3" and not is_admin:
        raise HTTPException(status_code=403, detail={"error": "access_denied", "message": "Tranche Breakdown requires Level 3 access."})

    supabase_rows, source = await _try_supabase_view(
        area="tranche_breakdown",
        level="LEVEL_3",
        spv_id=None if is_admin else spv_id,
        fallback_log_collection=supabase_fallback_log_col,
    )
    if source == "supabase":
        result = [r for r in (supabase_rows or []) if r.get("Tranche_Type")]
        return {"tranches": result, "count": len(result), "spvId": spv_id, "source": "supabase"}

    rows = await fetch_sheet_tab(SHEET_TRANCHE)
    if not is_admin:
        rows = filter_by_spv(rows, spv_id)

    result = []
    for r in rows:
        entry = {
            "Deal_ID": r.get("Deal_ID", ""),
            "SPV_ID": r.get("SPV_ID", ""),
            "Tranche_Type": r.get("Tranche_Type", ""),
            "Amount": r.get("Amount", ""),
            "Return_Target": r.get("Return_Target", ""),
            "Priority": r.get("Priority", ""),
            "Risk_Level": r.get("Risk_Level", ""),
        }
        if entry.get("Tranche_Type"):
            result.append(entry)

    return {"tranches": result, "count": len(result), "spvId": spv_id, "source": "sheet"}


# ============= WATERFALL VISUALIZATION ENGINE =============
# Joins Waterfall Engine + Tranche Breakdown sheets by Business ID (UBIDS) + Tranche.
# Returns a UI-ready structured payload for the premium waterfall dashboard.

def _tranche_kind(name: str) -> str:
    """Normalize tranche label to one of senior|mezz|equity|other for color/ordering."""
    n = (name or "").strip().lower()
    if "senior" in n:
        return "senior"
    if "mezz" in n:
        return "mezz"
    if "equity" in n:
        return "equity"
    return "other"


def _parse_amount_value(raw) -> float:
    """Permissive amount parser. Accepts strings like '$1,250,000' or numbers."""
    if raw in (None, ""):
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw)
    try:
        cleaned = str(raw).replace("$", "").replace(",", "").strip()
        return float(cleaned) if cleaned else 0.0
    except Exception:
        return 0.0


def _tranche_sort_rank(kind: str) -> int:
    return {"senior": 0, "mezz": 1, "equity": 2}.get(kind, 3)


@app.get("/api/user/available-businesses")
async def get_available_businesses(email: str):
    """List the Business IDs (UBIDS) the viewer is allowed to select in the Waterfall page.
    Regular users -> only their assigned UBIDS. Admin -> all distinct UBIDS found in
    Waterfall Engine sheet (fallback: Tranche Breakdown)."""
    user = await _resolve_and_validate(email)
    is_admin = user["email"] == (ADMIN_EMAIL or "")
    if not is_admin:
        bid = user["assigned_spv_id"]
        return {"businesses": [bid] if bid else [], "isAdmin": False}

    seen: list[str] = []
    for sheet_name in (SHEET_WATERFALL, SHEET_TRANCHE):
        try:
            rows = await fetch_sheet_tab(sheet_name)
            for r in rows:
                bid = (r.get("SPV_ID") or r.get("Business ID (UBIDS)") or "").strip()
                if bid and bid not in seen:
                    seen.append(bid)
        except Exception:
            continue
    return {"businesses": seen, "isAdmin": True}


@app.get("/api/user/waterfall-view")
async def get_waterfall_view(email: str, businessId: Optional[str] = None):
    """UI-ready Waterfall visualization payload for a single Business ID.
    Requires LEVEL_3 or admin. Joins Waterfall Engine (Step_Order, Tranche, Description)
    with Tranche Breakdown (Amount, Return_Target, Priority, Risk_Level).
    Safe degradation: missing sheets return empty sections rather than erroring out.
    """
    user = await _resolve_and_validate(email)
    level = user["license_level"]
    is_admin = user["email"] == (ADMIN_EMAIL or "")

    if level != "LEVEL_3" and not is_admin:
        raise HTTPException(
            status_code=403,
            detail={"error": "access_denied", "message": "Waterfall view requires Level 3 access."},
        )

    business_id = (businessId or "").strip() or user["assigned_spv_id"]
    if not business_id:
        raise HTTPException(
            status_code=400,
            detail={"error": "missing_business_id", "message": "No Business ID (UBIDS) supplied or assigned."},
        )
    # Non-admin users cannot request a different business than their own.
    if not is_admin and business_id != user["assigned_spv_id"]:
        raise HTTPException(
            status_code=403,
            detail={"error": "business_scope_violation", "message": "You may only view your assigned Business."},
        )

    # --- Fetch both sheets defensively ---
    try:
        waterfall_rows = filter_by_spv(await fetch_sheet_tab(SHEET_WATERFALL), business_id)
    except Exception as e:
        logger.warning(f"Waterfall Engine fetch failed: {type(e).__name__}")
        waterfall_rows = []
    try:
        tranche_rows = filter_by_spv(await fetch_sheet_tab(SHEET_TRANCHE), business_id)
    except Exception as e:
        logger.warning(f"Tranche Breakdown fetch failed: {type(e).__name__}")
        tranche_rows = []

    # --- Additive repair: rescue Waterfall rendering when the Waterfall Engine /
    # Tranche Breakdown sheets have been overwritten with a Main-Maps-Offers-style
    # schema (no Step_Order / Tranche / Tranche_Type / Amount columns). In that
    # case, synthesize a standard 3-tranche capital stack from TOTAL_CAPITAL_REQUIRED
    # using the conventional 65/20/15 Senior/Mezz/Equity split and prior default
    # return targets / risk labels. Properly-shaped sheets are not touched.
    def _row_lacks_waterfall_schema(rows):
        return bool(rows) and not any(r.get("Step_Order") or r.get("Tranche") for r in rows)

    def _row_lacks_tranche_schema(rows):
        return bool(rows) and not any(r.get("Tranche_Type") or r.get("Amount") for r in rows)

    synthesized_default_stack = False
    if _row_lacks_waterfall_schema(waterfall_rows) and _row_lacks_tranche_schema(tranche_rows):
        # Take the first row of either sheet to extract the preserved financials
        src = (waterfall_rows + tranche_rows)[0] if (waterfall_rows or tranche_rows) else {}
        total_required_raw = src.get("TOTAL_CAPITAL_REQUIRED") or src.get("Purchase Price") or ""
        total_required = _parse_amount_value(total_required_raw)
        deal_id = (src.get("Deal_ID") or src.get("deal_id") or "").strip()
        if total_required > 0:
            senior_amt = round(total_required * 0.65, 2)
            mezz_amt   = round(total_required * 0.20, 2)
            equity_amt = round(total_required - senior_amt - mezz_amt, 2)  # absorb rounding
            waterfall_rows = [
                {"Deal_ID": deal_id, "SPV_ID": business_id, "Step_Order": "1", "Tranche": "Senior",
                 "Description": "Senior debt — paid first from operating cash flow"},
                {"Deal_ID": deal_id, "SPV_ID": business_id, "Step_Order": "2", "Tranche": "Mezz",
                 "Description": "Mezzanine — paid after senior debt is current"},
                {"Deal_ID": deal_id, "SPV_ID": business_id, "Step_Order": "3", "Tranche": "Equity",
                 "Description": "Equity — receives remaining distributions"},
            ]
            tranche_rows = [
                {"Deal_ID": deal_id, "SPV_ID": business_id, "Tranche_Type": "Senior",
                 "Amount": str(senior_amt), "Return_Target": "8-10%", "Priority": "1", "Risk_Level": "Low"},
                {"Deal_ID": deal_id, "SPV_ID": business_id, "Tranche_Type": "Mezz",
                 "Amount": str(mezz_amt), "Return_Target": "12-16%", "Priority": "2", "Risk_Level": "Medium"},
                {"Deal_ID": deal_id, "SPV_ID": business_id, "Tranche_Type": "Equity",
                 "Amount": str(equity_amt), "Return_Target": "20%+", "Priority": "3", "Risk_Level": "High"},
            ]
            synthesized_default_stack = True
            logger.info(
                f"Waterfall/Tranche sheets misaligned for {business_id}; synthesized default 65/20/15 stack from TOTAL_CAPITAL_REQUIRED=${total_required:,.0f}."
            )

    # --- Build joined tranche records keyed by tranche name (case-insensitive) ---
    tranche_lookup: dict[str, dict] = {}
    for t in tranche_rows:
        key = (t.get("Tranche_Type") or "").strip().lower()
        if not key:
            continue
        tranche_lookup[key] = t

    tranches_out: list[dict] = []
    for w in waterfall_rows:
        tranche_name = (w.get("Tranche") or "").strip()
        kind = _tranche_kind(tranche_name)
        t = tranche_lookup.get(tranche_name.lower(), {})
        amount = _parse_amount_value(t.get("Amount"))
        try:
            step_order = int(w.get("Step_Order") or 0)
        except ValueError:
            step_order = 0
        try:
            priority = int(t.get("Priority") or 0) if t.get("Priority") else None
        except ValueError:
            priority = None
        tranches_out.append({
            "step": step_order,
            "name": tranche_name or "—",
            "kind": kind,
            "amount": amount,
            "return_target": (t.get("Return_Target") or "").strip() or "Data unavailable",
            "priority": priority,
            "risk": (t.get("Risk_Level") or "").strip() or "Data unavailable",
            "description": (w.get("Description") or "").strip() or "Data unavailable",
        })

    # If Waterfall Engine is empty but Tranche Breakdown has data, derive steps from tranche sort
    if not tranches_out and tranche_rows:
        for idx, t in enumerate(
            sorted(tranche_rows, key=lambda r: _tranche_sort_rank(_tranche_kind(r.get("Tranche_Type", "")))),
            start=1,
        ):
            tranche_name = (t.get("Tranche_Type") or "").strip()
            kind = _tranche_kind(tranche_name)
            amount = _parse_amount_value(t.get("Amount"))
            try:
                priority = int(t.get("Priority") or 0) if t.get("Priority") else None
            except ValueError:
                priority = None
            tranches_out.append({
                "step": idx,
                "name": tranche_name or "—",
                "kind": kind,
                "amount": amount,
                "return_target": (t.get("Return_Target") or "").strip() or "Data unavailable",
                "priority": priority,
                "risk": (t.get("Risk_Level") or "").strip() or "Data unavailable",
                "description": "Data unavailable",
            })

    # Sort ascending by step, fall back to senior->mezz->equity
    tranches_out.sort(key=lambda x: (x["step"] if x["step"] else 99, _tranche_sort_rank(x["kind"])))

    total_capital = sum(t["amount"] for t in tranches_out)
    for t in tranches_out:
        t["percent"] = round((t["amount"] / total_capital) * 100, 2) if total_capital else 0.0

    # Summary KPI strip — one bucket per kind
    summary_by_kind: dict[str, dict] = {}
    for t in tranches_out:
        entry = summary_by_kind.setdefault(t["kind"], {"amount": 0.0, "percent": 0.0, "count": 0})
        entry["amount"] += t["amount"]
        entry["count"] += 1
    for k, entry in summary_by_kind.items():
        entry["percent"] = round((entry["amount"] / total_capital) * 100, 2) if total_capital else 0.0

    chart_data = [
        {"name": t["name"], "kind": t["kind"], "amount": t["amount"], "percent": t["percent"]}
        for t in tranches_out
        if t["amount"] > 0
    ]

    return {
        "business_id": business_id,
        "total_capital": total_capital,
        "tranches": tranches_out,
        "chart_data": chart_data,
        "summary": {
            "senior": summary_by_kind.get("senior", {"amount": 0.0, "percent": 0.0, "count": 0}),
            "mezz":   summary_by_kind.get("mezz",   {"amount": 0.0, "percent": 0.0, "count": 0}),
            "equity": summary_by_kind.get("equity", {"amount": 0.0, "percent": 0.0, "count": 0}),
            "total_capital": total_capital,
            "tranche_count": len(tranches_out),
        },
        "has_waterfall_rows": len(waterfall_rows) > 0,
        "has_tranche_rows": len(tranche_rows) > 0,
        "synthesized_default_stack": synthesized_default_stack,
    }


# ============= HOLDCO AUTHORIZATION + RENDERING =============
# Permission-scoped rendering for HoldCo Summary + Detail views.
# Source of truth:
#   - HoldCo Summary Rollup     (the authoritative card list)
#   - HoldCo Detail View        (per-business records under a holding)
#   - Holding Company Access    (access rules: User_Email, Holding_ID, Can_View_Summary, Can_View_Details)
#
# Authorization precedence:
#   1. If the access sheet is shaped correctly (has the expected columns) use it verbatim.
#   2. Otherwise fall back to `Owner_User_Email` in the Summary Rollup — owner gets both
#      summary and detail permissions; all other users see nothing.
#   3. Admin (ADMIN_EMAIL) is authorized for every holding (matches admin role elsewhere).
#
# Enforcement rules:
#   - Unauthorized rows never enter the rendered dataset (filter before return, not after).
#   - View Details is re-checked on server at load time; UI-visibility is not the gate.

_EXPECTED_HOLDCO_ACCESS_COLS = {"User_Email", "Holding_ID", "Can_View_Summary", "Can_View_Details"}


def _parse_bool(v) -> bool:
    """Permissive bool parser for sheet cells (TRUE/FALSE/Yes/No/1/0)."""
    if isinstance(v, bool):
        return v
    s = str(v or "").strip().lower()
    return s in {"true", "yes", "y", "1", "t", "allow", "allowed", "enabled"}


def _access_sheet_well_formed(rows: list[dict]) -> bool:
    if not rows:
        return False
    cols = set(rows[0].keys())
    return _EXPECTED_HOLDCO_ACCESS_COLS.issubset(cols)


async def _resolve_holdco_access(email: str, is_admin: bool) -> tuple[dict[str, dict], dict]:
    """
    Resolve allowed holdings for the given user.
    Returns (access_map, meta) where:
      access_map = {Holding_ID: {"can_view_summary": bool, "can_view_details": bool, "source": str}}
      meta       = {"source": "access_sheet" | "owner_fallback", "access_sheet_ok": bool}
    Admins receive universal access (populated from Summary Rollup IDs).
    """
    email_lc = (email or "").strip().lower()

    # Fetch both possible access layers defensively
    try:
        access_rows = await fetch_sheet_tab(SHEET_HOLDCO_ACCESS)
    except Exception as e:
        logger.warning(f"Holding Company Access fetch failed: {type(e).__name__}")
        access_rows = []
    try:
        summary_rows = await fetch_sheet_tab(SHEET_HOLDCO_SUMMARY)
    except Exception as e:
        logger.warning(f"HoldCo Summary Rollup fetch failed: {type(e).__name__}")
        summary_rows = []

    access_sheet_ok = _access_sheet_well_formed(access_rows)

    # Admin short-circuit — grant access to every holding in the summary rollup
    if is_admin:
        access_map = {}
        for r in summary_rows:
            hid = (r.get("Holding_ID") or "").strip()
            if hid:
                access_map[hid] = {"can_view_summary": True, "can_view_details": True, "source": "admin_override"}
        return access_map, {
            "source": "admin_override",
            "access_sheet_ok": access_sheet_ok,
        }

    access_map: dict[str, dict] = {}
    if access_sheet_ok:
        for r in access_rows:
            if (r.get("User_Email") or "").strip().lower() != email_lc:
                continue
            hid = (r.get("Holding_ID") or "").strip()
            if not hid:
                continue
            access_map[hid] = {
                "can_view_summary": _parse_bool(r.get("Can_View_Summary")),
                "can_view_details": _parse_bool(r.get("Can_View_Details")),
                "source": "access_sheet",
            }
        return access_map, {"source": "access_sheet", "access_sheet_ok": True}

    # Fallback — Owner_User_Email in Summary Rollup
    for r in summary_rows:
        owner = (r.get("Owner_User_Email") or "").strip().lower()
        hid = (r.get("Holding_ID") or "").strip()
        if not hid or not owner:
            continue
        if owner == email_lc:
            access_map[hid] = {"can_view_summary": True, "can_view_details": True, "source": "owner_fallback"}
    return access_map, {"source": "owner_fallback", "access_sheet_ok": False}


def _coerce_number(value) -> Optional[float]:
    """Convert sheet cell to float if possible; return None otherwise."""
    if value in (None, ""):
        return None
    try:
        cleaned = str(value).replace("$", "").replace(",", "").strip()
        return float(cleaned) if cleaned else None
    except Exception:
        return None


def _project_holdco_summary(row: dict) -> dict:
    return {
        "Holding_ID":       (row.get("Holding_ID") or "").strip(),
        "Holding_Name":     (row.get("Holding_Name") or "").strip() or "Unnamed Holding",
        "Holding_Status":   (row.get("Holding_Status") or "").strip() or "—",
        "Total_Businesses": _coerce_number(row.get("Total_Businesses")),
        "Total_Assets":     _coerce_number(row.get("Total_Assets")),
        "Net_Income":       _coerce_number(row.get("Net_Income")),
        "Yield":            _coerce_number(row.get("Yield")),
    }


def _project_holdco_detail(row: dict) -> dict:
    return {
        "Holding_ID":          (row.get("Holding_ID") or "").strip(),
        "Holding_Name":        (row.get("Holding_Name") or "").strip(),
        "Business_ID":         (row.get("Business ID (UBIDS)") or row.get("SPV_ID") or "").strip(),
        "Business_Name":       (row.get("Business_Name") or "").strip() or "—",
        "Business_Status":     (row.get("Business_Status") or "").strip() or "—",
        "Asset_Value":         _coerce_number(row.get("Asset_Value")),
        "Net_Income":          _coerce_number(row.get("Net_Income")),
        "Yield":               _coerce_number(row.get("Yield")),
        "Capital_Stack_Ref":   (row.get("Capital_Stack_Ref") or "").strip() or "—",
        "Waterfall_Ref":       (row.get("Waterfall_Ref") or "").strip() or "—",
        "Registry_Ref":        (row.get("Registry_Ref") or "").strip() or "—",
    }


@app.get("/api/user/holdcos")
async def get_user_holdcos(email: str):
    """Return ONLY holdings the authenticated user is authorized to view as a summary card.
    Unauthorized holdings are filtered out before serialization."""
    user = await _resolve_and_validate(email)
    is_admin = user["email"] == (ADMIN_EMAIL or "")

    access_map, meta = await _resolve_holdco_access(user["email"], is_admin)
    if not access_map:
        return {
            "holdings": [],
            "count": 0,
            "accessSource": meta["source"],
            "accessSheetOk": meta["access_sheet_ok"],
        }

    try:
        summary_rows = await fetch_sheet_tab(SHEET_HOLDCO_SUMMARY)
    except Exception as e:
        logger.warning(f"HoldCo Summary Rollup fetch failed: {type(e).__name__}")
        summary_rows = []

    # Index summary rows by Holding_ID for O(1) lookup
    summary_index: dict[str, dict] = {}
    for r in summary_rows:
        hid = (r.get("Holding_ID") or "").strip()
        if hid:
            summary_index[hid] = r

    out: list[dict] = []
    for hid, perms in access_map.items():
        if not perms.get("can_view_summary"):
            continue
        row = summary_index.get(hid)
        if not row:
            # Access grants a holding that has no summary row — skip silently
            continue
        entry = _project_holdco_summary(row)
        entry["can_view_details"] = bool(perms.get("can_view_details"))
        entry["access_source"] = perms.get("source", meta["source"])
        out.append(entry)

    # Consistent ordering for UI
    out.sort(key=lambda x: x["Holding_ID"])
    return {
        "holdings": out,
        "count": len(out),
        "accessSource": meta["source"],
        "accessSheetOk": meta["access_sheet_ok"],
    }


@app.get("/api/user/holdco-detail")
async def get_user_holdco_detail(email: str, holdingId: str):
    """Load HoldCo Detail rows for a single holding, with hard authorization re-check.
    Returns 403 when the user has no access or Can_View_Details is false.
    Returns 404 when the holding does not exist in the Summary Rollup."""
    user = await _resolve_and_validate(email)
    is_admin = user["email"] == (ADMIN_EMAIL or "")

    holding_id = (holdingId or "").strip()
    if not holding_id:
        raise HTTPException(status_code=400, detail={"error": "missing_holding_id", "message": "Holding_ID is required."})

    # 1. Confirm the holding exists in the source of truth (404 vs 403 distinction)
    try:
        summary_rows = await fetch_sheet_tab(SHEET_HOLDCO_SUMMARY)
    except Exception as e:
        logger.warning(f"HoldCo Summary Rollup fetch failed: {type(e).__name__}")
        summary_rows = []
    summary_row = next((r for r in summary_rows if (r.get("Holding_ID") or "").strip() == holding_id), None)
    if not summary_row:
        raise HTTPException(status_code=404, detail={"error": "holding_not_found", "message": "Holding company not available."})

    # 2. Hard access re-check (does not rely on the UI or client state)
    access_map, meta = await _resolve_holdco_access(user["email"], is_admin)
    perms = access_map.get(holding_id)
    if not perms or not perms.get("can_view_details"):
        raise HTTPException(status_code=403, detail={"error": "access_restricted", "message": "Access Restricted."})

    # 3. Load filtered detail rows for this holding ONLY
    try:
        detail_rows = await fetch_sheet_tab(SHEET_HOLDCO_DETAIL)
    except Exception as e:
        logger.warning(f"HoldCo Detail View fetch failed: {type(e).__name__}")
        detail_rows = []

    filtered = [r for r in detail_rows if (r.get("Holding_ID") or "").strip() == holding_id]
    details = [_project_holdco_detail(r) for r in filtered]

    return {
        "holding": _project_holdco_summary(summary_row),
        "details": details,
        "count": len(details),
        "accessSource": perms.get("source", meta["source"]),
    }


@app.get("/api/admin/holdco-diagnostics")
async def admin_holdco_diagnostics(email: str):
    """Report on HoldCo source-sheet health — admin-only. Never leaks row data.
    Surfaces whether the access sheet is properly shaped so admins can fix it."""
    _require_admin(email)
    try:
        access_rows = await fetch_sheet_tab(SHEET_HOLDCO_ACCESS)
    except Exception:
        access_rows = []
    try:
        summary_rows = await fetch_sheet_tab(SHEET_HOLDCO_SUMMARY)
    except Exception:
        summary_rows = []
    try:
        detail_rows = await fetch_sheet_tab(SHEET_HOLDCO_DETAIL)
    except Exception:
        detail_rows = []

    ok = _access_sheet_well_formed(access_rows)
    missing = list(_EXPECTED_HOLDCO_ACCESS_COLS - set(access_rows[0].keys())) if access_rows else list(_EXPECTED_HOLDCO_ACCESS_COLS)
    return {
        "accessSheetWellFormed": ok,
        "missingColumns": [] if ok else sorted(missing),
        "expectedColumns": sorted(_EXPECTED_HOLDCO_ACCESS_COLS),
        "accessRowCount": len(access_rows),
        "summaryRowCount": len(summary_rows),
        "detailRowCount": len(detail_rows),
        "fallbackInUse": not ok,
        "fallbackDescription": "Ownership is inferred from Owner_User_Email in HoldCo Summary Rollup until the access sheet is repaired.",
    }


# ============= BOLT ACCESS ROUTING LAYER =============
# Supabase is the secure structured access-decision source.
# If Supabase credentials are configured, use them. Otherwise fall back to
# Licensed Users sheet (Google Sheets remains source of truth that feeds Supabase).

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
SUPABASE_ENABLED = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

if SUPABASE_ENABLED:
    logger.info("Supabase access layer enabled")
else:
    logger.info("Supabase not configured — using Licensed Users sheet as access source")


async def supabase_lookup_user(email: str) -> Optional[dict]:
    """
    Look up user access state in Supabase licensed_users view.
    Returns user record or None.
    """
    if not SUPABASE_ENABLED:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Query Supabase REST API — licensed_users view
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/licensed_users",
                params={"email": f"eq.{email.strip().lower()}", "select": "*", "limit": "1"},
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Accept": "application/json",
                },
            )
            if resp.status_code == 200:
                rows = resp.json()
                if rows and len(rows) > 0:
                    return rows[0]
    except Exception as e:
        logger.warning(f"Supabase lookup failed for {email}: {e}")
    return None


async def resolve_access_state(email: str) -> dict:
    """
    Resolve a user's access state for Bolt routing decisions.
    Priority: Supabase → Licensed Users sheet → not found.
    
    Returns:
      access_state: unauthenticated | no_license | pending | denied | approved | admin
      license_level: LEVEL_1 | LEVEL_2 | LEVEL_3
      assigned_spv_id: str
      dashboard_route: /access/pending | /access/denied | /enter-dashboard
    """
    if not email or not email.strip():
        return {
            "accessState": "unauthenticated",
            "dashboardRoute": None,
            "reason": "No email provided",
        }

    email_lower = email.strip().lower()
    admin_email = ADMIN_EMAIL

    # Try Supabase first
    user = await supabase_lookup_user(email_lower)
    source = "supabase"

    # Fall back to Licensed Users sheet
    if not user:
        try:
            users = await fetch_access_control()
            sheet_user = resolve_user_access(users, email_lower)
            if sheet_user:
                user = sheet_user
                source = "licensed_users_sheet"
        except Exception:
            pass

    # Admin check
    if email_lower == admin_email:
        if user:
            return {
                "accessState": "admin",
                "email": email_lower,
                "ownerName": user.get("owner_name", "Admin"),
                "licenseLevel": user.get("license_level", "LEVEL_3"),
                "assignedSpvId": user.get("assigned_spv_id", ""),
                "dashboardRoute": "/enter-dashboard",
                "source": source,
            }
        return {
            "accessState": "admin",
            "email": email_lower,
            "ownerName": "Admin",
            "licenseLevel": "LEVEL_3",
            "assignedSpvId": "",
            "dashboardRoute": "/enter-dashboard",
            "source": "admin_bypass",
        }

    # Not found
    if not user:
        return {
            "accessState": "no_license",
            "email": email_lower,
            "dashboardRoute": None,
            "reason": "No licensed user record found",
        }

    status = user.get("status", "").strip()
    license_level = user.get("license_level", "").strip()
    spv_id = user.get("assigned_spv_id", "").strip()

    # Pending
    if status.lower() in ("pending", "review", "pending_review"):
        return {
            "accessState": "pending",
            "email": email_lower,
            "dashboardRoute": "/access/pending",
            "source": source,
        }

    # Denied / suspended / inactive
    if status.lower() in ("denied", "suspended", "inactive", "blocked"):
        return {
            "accessState": "denied",
            "email": email_lower,
            "dashboardRoute": "/access/denied",
            "reason": f"Account status: {status}",
            "source": source,
        }

    # Active / approved
    if status.lower() in ("active", "approved"):
        if not license_level:
            return {
                "accessState": "pending",
                "email": email_lower,
                "dashboardRoute": "/access/pending",
                "reason": "Active but no license level assigned",
                "source": source,
            }
        return {
            "accessState": "approved",
            "email": email_lower,
            "ownerName": user.get("owner_name", ""),
            "licenseLevel": license_level,
            "assignedSpvId": spv_id,
            "dashboardRoute": "/enter-dashboard",
            "source": source,
        }

    # Unknown status
    return {
        "accessState": "pending",
        "email": email_lower,
        "dashboardRoute": "/access/pending",
        "reason": f"Unrecognized status: {status}",
        "source": source,
    }


@app.get("/api/access/resolve")
async def access_resolve(email: str):
    """
    Bolt calls this to resolve a user's access state before routing.
    Returns the access decision and the target dashboard route.
    """
    result = await resolve_access_state(email)
    return result


@app.get("/api/access/enter")
async def access_enter(email: str, state: Optional[str] = None):
    """
    Entry point for Bolt redirect handoff.
    Validates the user's access state and returns the dashboard configuration.
    """
    result = await resolve_access_state(email)
    access = result.get("accessState")

    if access in ("unauthenticated", "no_license"):
        raise HTTPException(status_code=401, detail={
            "error": "no_access",
            "accessState": access,
            "message": result.get("reason", "Access not granted"),
        })

    if access in ("pending", "denied"):
        return {
            "accessGranted": False,
            "accessState": access,
            "redirectTo": result.get("dashboardRoute"),
            "message": result.get("reason", ""),
        }

    # approved or admin
    return {
        "accessGranted": True,
        "accessState": access,
        "email": result.get("email"),
        "ownerName": result.get("ownerName", ""),
        "licenseLevel": result.get("licenseLevel", ""),
        "assignedSpvId": result.get("assignedSpvId", ""),
        "dashboardRoute": "/enter-dashboard",
        "isAdmin": access == "admin",
    }


# ============= ADMIN CONTROL LAYER =============
# Persistent storage via MongoDB (requests_col, notifications_col, admin_actions_col)

# Canned notification templates
CANNED_TEMPLATES = {
    "Deal Approved": "Your deal has been approved and is ready for the next phase.",
    "Deal Closed": "The deal has been successfully closed. Final documents are available.",
    "Review Required": "A deal requires your review before proceeding.",
    "Capital Call Reminder": "A capital call is scheduled. Please review the details.",
    "Document Uploaded": "A new document has been uploaded to your SPV.",
    "Request Approved": "Your request has been approved.",
    "Request Denied": "Your request has been reviewed and was not approved at this time.",
    "Participation Approved": "Your participation request has been approved.",
    "Participation Pending": "Your participation request is under review.",
    "Opportunity Released": "A new opportunity has been released for your level.",
    "Capacity Full": "This opportunity has reached capacity.",
    "General Notice": "",
}


def _require_admin(email: str):
    if email.strip().lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Admin access required"})


@app.get("/api/admin/check")
async def admin_check(email: str):
    return {"isAdmin": email.strip().lower() == ADMIN_EMAIL}


@app.get("/api/admin/supabase-status")
async def admin_supabase_status(email: str):
    """Operational health of the Supabase safe-view read layer.
    Admin-only. Shows configuration state and recent fallback events."""
    _require_admin(email)
    recent = list(
        supabase_fallback_log_col.find({}, {"_id": 0}).sort("timestamp", -1).limit(50)
    )
    # Group recent fallbacks by (area, level, reason) for an at-a-glance summary
    summary: dict[str, int] = {}
    for ev in recent:
        key = f"{ev.get('area','?')}|{ev.get('level','?')}|{ev.get('reason','?')}"
        summary[key] = summary.get(key, 0) + 1
    summary_rows = [
        {"area": k.split("|")[0], "level": k.split("|")[1], "reason": k.split("|")[2], "count": c}
        for k, c in sorted(summary.items(), key=lambda x: -x[1])
    ]
    return {
        "config": _supabase_status_snapshot(),
        "recentFallbacks": recent,
        "fallbackSummary": summary_rows,
        "recentCount": len(recent),
    }


@app.get("/api/admin/templates")
async def admin_get_templates(email: str):
    _require_admin(email)
    return {"templates": CANNED_TEMPLATES}


# --- 1. Requests Queue ---
@app.get("/api/admin/requests")
async def admin_get_requests(email: str):
    _require_admin(email)
    docs = list(requests_col.find({}, {"_id": 0}).sort("timestamp", -1).limit(200))
    return {"requests": docs, "count": len(docs)}


class AdminRequestAction(BaseModel):
    email: str
    requestId: str
    action: str = Field(..., description="approve, deny, pending, escalate")


@app.post("/api/admin/requests/action")
async def admin_request_action(body: AdminRequestAction):
    _require_admin(body.email)
    valid = ["approve", "deny", "pending", "escalate"]
    if body.action not in valid:
        raise HTTPException(status_code=400, detail={"error": "invalid_action", "message": f"Must be one of: {valid}"})
    
    status_map = {"approve": "approved", "deny": "denied", "pending": "pending_review", "escalate": "escalated"}
    new_status = status_map.get(body.action, body.action)
    
    result = requests_col.find_one_and_update(
        {"request_id": body.requestId},
        {"$set": {"request_status": new_status}},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Request not found"})
    
    admin_actions_col.insert_one({"type": "request_action", "request_id": body.requestId, "action": body.action, "admin": body.email, "timestamp": datetime.utcnow().isoformat()})
    result.pop("_id", None)
    return {"success": True, "request": result}


# --- 2. Orders Control ---
@app.get("/api/admin/orders")
async def admin_get_orders(email: str):
    _require_admin(email)
    orders = await fetch_sheet_tab(SHEET_ORDERS)
    return {"orders": orders, "count": len(orders)}


class AdminOrderAction(BaseModel):
    email: str
    orderId: str
    action: str = Field(..., description="approve, hold, reject, complete")


@app.post("/api/admin/orders/action")
async def admin_order_action(body: AdminOrderAction):
    _require_admin(body.email)
    valid = ["approve", "hold", "reject", "complete"]
    if body.action not in valid:
        raise HTTPException(status_code=400, detail={"error": "invalid_action", "message": f"Must be one of: {valid}"})
    record = {
        "type": "order_action",
        "order_id": body.orderId,
        "action": body.action,
        "admin": body.email,
        "timestamp": datetime.utcnow().isoformat(),
    }
    admin_actions_col.insert_one(dict(record))
    return {"success": True, "action": record, "message": f"Order action '{body.action}' recorded for {body.orderId}."}


# --- 3. Opportunity Release Control ---
@app.get("/api/admin/releases")
async def admin_get_releases(email: str):
    _require_admin(email)
    releases = await fetch_sheet_tab(SHEET_OPP_RELEASE)
    return {"releases": releases, "count": len(releases)}


class AdminReleaseAction(BaseModel):
    email: str
    spvId: str
    action: str = Field(..., description="release, pause, close")
    releaseToLevel: Optional[str] = None
    maxOrdersAllowed: Optional[int] = None
    approvalRequired: Optional[str] = None


@app.post("/api/admin/releases/action")
async def admin_release_action(body: AdminReleaseAction):
    _require_admin(body.email)
    valid = ["release", "pause", "close", "change_level", "change_cap", "change_approval"]
    if body.action not in valid:
        raise HTTPException(status_code=400, detail={"error": "invalid_action", "message": f"Must be one of: {valid}"})
    record = {
        "spv_id": body.spvId,
        "action": body.action,
        "release_to_level": body.releaseToLevel,
        "max_orders_allowed": body.maxOrdersAllowed,
        "approval_required": body.approvalRequired,
        "admin": body.email,
        "timestamp": datetime.utcnow().isoformat(),
    }
    admin_actions_col.insert_one(dict(record))
    return {"success": True, "action": record, "message": f"Release action '{body.action}' recorded for {body.spvId}. Sheet update required to persist."}


# --- 4. User Access Control ---
@app.get("/api/admin/users")
async def admin_get_users(email: str):
    _require_admin(email)
    users = await fetch_access_control()
    return {"users": users, "count": len(users)}


class AdminUserAction(BaseModel):
    email: str
    targetEmail: str
    action: str = Field(..., description="upgrade, downgrade, activate, suspend, assign_spv, remove_spv")
    value: Optional[str] = None


@app.post("/api/admin/users/action")
async def admin_user_action(body: AdminUserAction):
    _require_admin(body.email)
    valid = ["upgrade", "downgrade", "activate", "suspend", "assign_spv", "remove_spv"]
    if body.action not in valid:
        raise HTTPException(status_code=400, detail={"error": "invalid_action", "message": f"Must be one of: {valid}"})
    record = {
        "target_email": body.targetEmail,
        "action": body.action,
        "value": body.value,
        "admin": body.email,
        "timestamp": datetime.utcnow().isoformat(),
    }
    admin_actions_col.insert_one(dict(record))
    return {"success": True, "action": record, "message": f"User action '{body.action}' recorded for {body.targetEmail}. Sheet update required to persist."}


# --- 5. Notifications Control ---
@app.get("/api/admin/notifications")
async def admin_get_notifications(email: str):
    _require_admin(email)
    docs = list(notifications_col.find({}, {"_id": 0}).sort("sent_timestamp", -1).limit(200))
    return {"notifications": docs, "count": len(docs)}


class AdminNotificationAction(BaseModel):
    email: str
    action: str = Field(..., description="send, resend, draft, archive, edit")
    notificationId: Optional[str] = None
    notificationType: Optional[str] = "General Notice"
    targetLevel: Optional[str] = None
    targetUser: Optional[str] = None
    relatedSpvId: Optional[str] = None
    relatedDealId: Optional[str] = None
    messageBody: Optional[str] = None
    adminNotes: Optional[str] = None


@app.post("/api/admin/notifications/action")
async def admin_notification_action(body: AdminNotificationAction):
    _require_admin(body.email)
    valid = ["send", "resend", "draft", "archive", "edit"]
    if body.action not in valid:
        raise HTTPException(status_code=400, detail={"error": "invalid_action", "message": f"Must be one of: {valid}"})

    if body.action == "archive" and body.notificationId:
        notifications_col.update_one(
            {"notification_id": body.notificationId},
            {"$set": {"notification_status": "archived"}}
        )
        return {"success": True, "message": "Notification archived."}

    if body.action == "edit" and body.notificationId:
        updates = {}
        if body.messageBody is not None: updates["message_body"] = body.messageBody
        if body.adminNotes is not None: updates["admin_notes"] = body.adminNotes
        if body.notificationType: updates["notification_type"] = body.notificationType
        if body.targetLevel: updates["target_level"] = body.targetLevel
        if body.targetUser: updates["target_user"] = body.targetUser
        if body.relatedSpvId: updates["related_spv_id"] = body.relatedSpvId
        if updates:
            notifications_col.update_one({"notification_id": body.notificationId}, {"$set": updates})
        return {"success": True, "message": "Draft updated."}

    if body.action == "resend" and body.notificationId:
        existing = notifications_col.find_one({"notification_id": body.notificationId}, {"_id": 0})
        if existing:
            new_notif = dict(existing)
            new_notif["notification_id"] = str(uuid.uuid4())[:8]
            new_notif["notification_status"] = "sent"
            new_notif["sent_timestamp"] = datetime.utcnow().isoformat()
            new_notif["created_by"] = body.email
            notifications_col.insert_one(dict(new_notif))
            return {"success": True, "notification": new_notif, "message": "Notification resent."}
        raise HTTPException(status_code=404, detail={"error": "not_found"})

    # send or draft
    status = "sent" if body.action == "send" else "drafted"
    notif = {
        "notification_id": str(uuid.uuid4())[:8],
        "notification_type": body.notificationType or "General Notice",
        "target_level": body.targetLevel,
        "target_user": body.targetUser,
        "related_spv_id": body.relatedSpvId,
        "related_deal_id": body.relatedDealId,
        "message_body": body.messageBody or "",
        "admin_notes": body.adminNotes or "",
        "notification_status": status,
        "created_by": body.email,
        "sent_timestamp": datetime.utcnow().isoformat(),
    }
    notifications_col.insert_one(dict(notif))
    return {"success": True, "notification": notif, "message": f"Notification {status}."}


# ============= ORCHESTRATION ENDPOINTS =============


# ============= ORCHESTRATION ENDPOINTS =============

@app.get("/api/orchestration/health")
async def orchestration_health():
    """
    Health check for orchestration layer.
    No authentication required - used for uptime monitoring.
    """
    return {
        "ok": True,
        "service": "ubuybox-emergent",
        "version": "1.1.0"
    }


@app.post("/api/orchestration/load-spv")
async def load_spv(
    request: LoadSPVRequest,
    authenticated: bool = Depends(verify_orchestration_token)
):
    """
    Load SPV view model based on current visibility state.
    Validates SPV exists, applies visibility filtering, returns allowed view model.
    Does NOT modify source data.
    """
    spv_id = request.spvId
    logger.info(f"Loading SPV: {spv_id}")
    
    # Fetch current data from Google Sheets
    deals = await fetch_sheet_data()
    spv_deals = get_spv_deals(deals, spv_id)
    
    if not spv_deals:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": f"SPV {spv_id} not found in source data",
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    spv_data = get_spv_aggregate(deals, spv_id)
    
    # Get current state
    disclosure_level = spv_state.get_disclosure(spv_id)
    waterfall_permitted = spv_state.get_waterfall_permission(spv_id)
    
    # Validate fields
    field_validation = validate_required_fields(spv_deals)
    waterfall_validation = validate_waterfall_inputs(spv_deals)
    has_capital_stack = spv_data.get("totalCapital", 0) > 0
    
    # Unified visibility resolution with invariant enforcement
    vis = resolve_spv_visibility_state(
        exists=True,
        field_validation=field_validation,
        waterfall_validation=waterfall_validation,
        disclosure_level=disclosure_level,
        has_capital_stack=has_capital_stack,
        waterfall_permitted=waterfall_permitted
    )
    
    # Apply visibility filtering
    view_model = apply_visibility_filter(spv_data, spv_deals, vis["resolvedVisibility"], vis["waterfallVisible"])
    
    return {
        "success": True,
        "spvId": spv_id,
        "disclosureLevel": disclosure_level,
        "visibilityState": vis["resolvedVisibility"],
        "safeToDisplay": vis["safeToDisplay"],
        "waterfallAvailable": vis["waterfallAvailable"],
        "waterfallVisible": vis["waterfallVisible"],
        "nextSafeAction": vis["nextSafeAction"],
        "viewModel": view_model,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/orchestration/set-disclosure")
async def set_disclosure(
    request: SetDisclosureRequest,
    authenticated: bool = Depends(verify_orchestration_token)
):
    """
    Set disclosure level for an SPV (app layer only).
    Controls what data is visible - does NOT write to Google Sheets.
    """
    spv_id = request.spvId
    level = request.disclosureLevel
    
    logger.info(f"Setting disclosure for {spv_id}: {level}")
    
    # Validate SPV exists
    deals = await fetch_sheet_data()
    spv_deals = get_spv_deals(deals, spv_id)
    
    if not spv_deals:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": f"SPV {spv_id} not found in source data",
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    # Set display state (app layer only)
    spv_state.set_disclosure(spv_id, level)
    
    return {
        "success": True,
        "spvId": spv_id,
        "disclosureLevel": level,
        "message": "Disclosure level updated (app layer only - Google Sheets unchanged)",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/orchestration/set-waterfall-permission")
async def set_waterfall_permission(
    request: SetWaterfallRequest,
    authenticated: bool = Depends(verify_orchestration_token)
):
    """
    Set waterfall visibility permission for an SPV (app layer only).
    Even if waterfall data is available, it won't be visible unless permitted.
    """
    spv_id = request.spvId
    permitted = request.permitted
    
    logger.info(f"Setting waterfall permission for {spv_id}: {permitted}")
    
    # Validate SPV exists
    deals = await fetch_sheet_data()
    spv_deals = get_spv_deals(deals, spv_id)
    
    if not spv_deals:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": f"SPV {spv_id} not found in source data",
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    spv_state.set_waterfall_permission(spv_id, permitted)
    
    return {
        "success": True,
        "spvId": spv_id,
        "waterfallPermitted": permitted,
        "message": "Waterfall permission updated (app layer only)",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/api/orchestration/status/{spv_id}")
async def get_spv_status(
    spv_id: str,
    authenticated: bool = Depends(verify_orchestration_token)
):
    """
    Get comprehensive status for an SPV.
    Returns existence, disclosure state, waterfall availability/visibility,
    field completeness, and display safety.
    """
    logger.info(f"Status check for SPV: {spv_id}")
    
    timestamp = datetime.utcnow().isoformat()
    
    # Fetch current data
    deals = await fetch_sheet_data()
    spv_deals = get_spv_deals(deals, spv_id)
    
    # Check existence
    exists = len(spv_deals) > 0
    
    if not exists:
        return {
            "success": True,
            "spvId": spv_id,
            "exists": False,
            "dealCount": 0,
            "disclosureLevel": None,
            "waterfallAvailable": False,
            "waterfallVisible": False,
            "fieldsComplete": False,
            "safeToDisplay": False,
            "visibilityState": "blocked",
            "missingFields": [],
            "blockingReasons": ["SPV not found in source data"],
            "timestamp": timestamp
        }
    
    spv_data = get_spv_aggregate(deals, spv_id)
    
    # Get current app-layer state
    disclosure_level = spv_state.get_disclosure(spv_id)
    waterfall_permitted = spv_state.get_waterfall_permission(spv_id)
    
    # Validate fields
    field_validation = validate_required_fields(spv_deals)
    waterfall_validation = validate_waterfall_inputs(spv_deals)
    has_capital_stack = spv_data.get("totalCapital", 0) > 0
    
    # Unified visibility resolution with invariant enforcement
    vis = resolve_spv_visibility_state(
        exists=True,
        field_validation=field_validation,
        waterfall_validation=waterfall_validation,
        disclosure_level=disclosure_level,
        has_capital_stack=has_capital_stack,
        waterfall_permitted=waterfall_permitted
    )
    
    return {
        "success": True,
        "spvId": spv_id,
        "exists": True,
        "dealCount": spv_data.get("dealCount", 0),
        "disclosureLevel": disclosure_level,
        "waterfallAvailable": vis["waterfallAvailable"],
        "waterfallVisible": vis["waterfallVisible"],
        "waterfallPermitted": waterfall_permitted,
        "fieldsComplete": field_validation["fieldsComplete"],
        "safeToDisplay": vis["safeToDisplay"],
        "visibilityState": vis["resolvedVisibility"],
        "missingFields": field_validation.get("missingFields", []),
        "blockingReasons": vis["blockingReasons"],
        "nextSafeAction": vis["nextSafeAction"],
        "summary": {
            "totalCapital": spv_data.get("totalCapital", 0),
            "dealCount": spv_data.get("dealCount", 0)
        },
        "timestamp": timestamp
    }


@app.post("/api/orchestration/resolve-visibility")
async def resolve_visibility(
    request: ResolveVisibilityRequest,
    authenticated: bool = Depends(verify_orchestration_token)
):
    """
    Resolve the appropriate visibility state for an SPV.
    
    Logic:
    - if SPV missing -> blocked
    - if critical required fields missing -> blocked
    - if display state already set manually, respect it unless invalid
    - otherwise default to:
      - teaser if minimal SPV exists
      - preview if capital stack fields validate
      - full only if explicitly set and waterfall gating passes
    """
    spv_id = request.spvId
    logger.info(f"Resolving visibility for SPV: {spv_id}")
    
    timestamp = datetime.utcnow().isoformat()
    
    # Fetch current data
    deals = await fetch_sheet_data()
    spv_deals = get_spv_deals(deals, spv_id)
    
    # Check existence
    if not spv_deals:
        return {
            "success": True,
            "spvId": spv_id,
            "resolvedVisibility": "blocked",
            "waterfallAvailable": False,
            "waterfallVisible": False,
            "safeToDisplay": False,
            "missingFields": [],
            "blockingReasons": ["SPV not found in source data"],
            "timestamp": timestamp
        }
    
    spv_data = get_spv_aggregate(deals, spv_id)
    
    # Get current app-layer state
    disclosure_level = spv_state.get_disclosure(spv_id)
    waterfall_permitted = spv_state.get_waterfall_permission(spv_id)
    
    # Validate fields
    field_validation = validate_required_fields(spv_deals)
    waterfall_validation = validate_waterfall_inputs(spv_deals)
    has_capital_stack = spv_data.get("totalCapital", 0) > 0
    
    # Unified visibility resolution with invariant enforcement
    vis = resolve_spv_visibility_state(
        exists=True,
        field_validation=field_validation,
        waterfall_validation=waterfall_validation,
        disclosure_level=disclosure_level,
        has_capital_stack=has_capital_stack,
        waterfall_permitted=waterfall_permitted
    )
    
    return {
        "success": True,
        "spvId": spv_id,
        "resolvedVisibility": vis["resolvedVisibility"],
        "disclosureLevelSet": disclosure_level,
        "waterfallAvailable": vis["waterfallAvailable"],
        "waterfallVisible": vis["waterfallVisible"],
        "waterfallPermitted": waterfall_permitted,
        "safeToDisplay": vis["safeToDisplay"],
        "fieldsComplete": field_validation["fieldsComplete"],
        "missingFields": field_validation.get("missingFields", []),
        "blockingReasons": vis["blockingReasons"],
        "nextSafeAction": vis["nextSafeAction"],
        "timestamp": timestamp
    }


# ============= FRONTEND VISIBILITY ENDPOINT =============

@app.get("/api/spv-visibility")
async def get_all_spv_visibility():
    """
    Public endpoint (no auth) for frontend consumption.
    Returns the current visibility state for all SPVs.
    OpenClaw sets these via the orchestration API.
    Frontend reads them here and masks UI accordingly.
    """
    deals = await fetch_sheet_data()
    
    # Group by SPV
    spv_ids = set(d["spv"] for d in deals if d["spv"])
    
    visibility_map = {}
    for spv_id in spv_ids:
        spv_deals = get_spv_deals(deals, spv_id)
        spv_data = get_spv_aggregate(deals, spv_id)
        
        disclosure_level = spv_state.get_disclosure(spv_id)
        waterfall_permitted = spv_state.get_waterfall_permission(spv_id)
        
        field_validation = validate_required_fields(spv_deals)
        waterfall_validation = validate_waterfall_inputs(spv_deals)
        has_capital_stack = spv_data.get("totalCapital", 0) > 0
        
        vis = resolve_spv_visibility_state(
            exists=True,
            field_validation=field_validation,
            waterfall_validation=waterfall_validation,
            disclosure_level=disclosure_level,
            has_capital_stack=has_capital_stack,
            waterfall_permitted=waterfall_permitted
        )
        
        visibility_map[spv_id] = {
            "visibilityState": vis["resolvedVisibility"],
            "waterfallVisible": vis["waterfallVisible"],
            "disclosureLevel": disclosure_level
        }
    
    return {
        "visibility": visibility_map,
        "timestamp": datetime.utcnow().isoformat()
    }


# ============= MENU MANAGER =============
# Admin-controlled dynamic sidebar configuration.
# Source of truth: MongoDB `menu_config` collection.
# Frontend sidebar calls GET /api/menu?email=... to render (with safe fallback).

DEFAULT_MENU_ITEMS = [
    {"id": "dashboard",         "menu_label": "Dashboard",           "path": "/",                    "source_sheet_name": "Main Maps Offers",              "icon_name": "home",       "enabled": True, "allowed_levels": ["LEVEL_1", "LEVEL_2", "LEVEL_3"], "admin_only": False, "hidden_but_queryable": False, "sort_order": 1},
    {"id": "intake",            "menu_label": "Opportunity Intake",  "path": "/intake",              "source_sheet_name": "Opportunity Release Control",   "icon_name": "plus",       "enabled": True, "allowed_levels": ["LEVEL_2", "LEVEL_3"],            "admin_only": False, "hidden_but_queryable": False, "sort_order": 2},
    {"id": "capital",           "menu_label": "Capital Stack",       "path": "/capital",             "source_sheet_name": "Capital Stack",                 "icon_name": "stack",      "enabled": True, "allowed_levels": ["LEVEL_1", "LEVEL_2", "LEVEL_3"], "admin_only": False, "hidden_but_queryable": False, "sort_order": 3},
    {"id": "spv",               "menu_label": "Business Registry",   "path": "/spv",                 "source_sheet_name": "SPV Registry",                  "icon_name": "building",   "enabled": True, "allowed_levels": ["LEVEL_1", "LEVEL_2", "LEVEL_3"], "admin_only": False, "hidden_but_queryable": False, "sort_order": 4},
    {"id": "waterfalls",        "menu_label": "Waterfalls",          "path": "/waterfalls",          "source_sheet_name": "Waterfall Engine",              "icon_name": "chart",      "enabled": True, "allowed_levels": ["LEVEL_1", "LEVEL_2", "LEVEL_3"], "admin_only": False, "hidden_but_queryable": False, "sort_order": 5},
    {"id": "holdco",            "menu_label": "HoldCo Summary",      "path": "/holdco",              "source_sheet_name": "—",                             "icon_name": "doc",        "enabled": True, "allowed_levels": ["LEVEL_2", "LEVEL_3"],            "admin_only": False, "hidden_but_queryable": False, "sort_order": 6},
    {"id": "documents",         "menu_label": "Documents",           "path": "/documents",           "source_sheet_name": "—",                             "icon_name": "file",       "enabled": True, "allowed_levels": ["LEVEL_1", "LEVEL_2", "LEVEL_3"], "admin_only": False, "hidden_but_queryable": False, "sort_order": 7},
    {"id": "notifications",     "menu_label": "Notifications",       "path": "/notifications",       "source_sheet_name": "—",                             "icon_name": "bell",       "enabled": True, "allowed_levels": ["LEVEL_1", "LEVEL_2", "LEVEL_3"], "admin_only": False, "hidden_but_queryable": False, "sort_order": 8},
    {"id": "deal-summary",      "menu_label": "Deal Summary",        "path": "/deal-summary",        "source_sheet_name": "Deal Summary (UBuyBox View)",   "icon_name": "doc-text",   "enabled": True, "allowed_levels": ["LEVEL_3"],                       "admin_only": False, "hidden_but_queryable": False, "sort_order": 9},
    {"id": "tranche-breakdown", "menu_label": "Tranche Breakdown",   "path": "/tranche-breakdown",   "source_sheet_name": "Tranche Breakdown",             "icon_name": "bars",       "enabled": True, "allowed_levels": ["LEVEL_3"],                       "admin_only": False, "hidden_but_queryable": False, "sort_order": 10},
    {"id": "admin",             "menu_label": "Admin Control",       "path": "/admin",               "source_sheet_name": "—",                             "icon_name": "cog",        "enabled": True, "allowed_levels": [],                                "admin_only": True,  "hidden_but_queryable": False, "sort_order": 11},
    {"id": "menu-manager",      "menu_label": "Menu Manager",        "path": "/admin/menu-manager",  "source_sheet_name": "—",                             "icon_name": "sliders",    "enabled": True, "allowed_levels": [],                                "admin_only": True,  "hidden_but_queryable": False, "sort_order": 12},
]

# Sheets flagged with data-quality issues — surfaced only in admin diagnostics.
MENU_DIAGNOSTICS = [
    {
        "source_sheet_name": "Seller-Forward Maps Offers",
        "severity": "warning",
        "code": "mapping_issue",
        "title": "Mapping issue — source needs repair",
        "message": "Row values are misaligned against headers in the source sheet. Do not use this tab for critical UI mapping until repaired.",
    }
]


def _menu_doc_projection():
    return {"_id": 0}


def _normalize_menu_item(item: dict) -> dict:
    """Ensure a menu document has all expected fields with safe defaults."""
    return {
        "id": str(item.get("id", "")).strip(),
        "menu_label": str(item.get("menu_label", "")).strip(),
        "path": str(item.get("path", "")).strip(),
        "source_sheet_name": str(item.get("source_sheet_name", "—")).strip() or "—",
        "icon_name": str(item.get("icon_name", "doc")).strip() or "doc",
        "enabled": bool(item.get("enabled", True)),
        "allowed_levels": [str(x).strip().upper() for x in (item.get("allowed_levels") or []) if str(x).strip()],
        "admin_only": bool(item.get("admin_only", False)),
        "hidden_but_queryable": bool(item.get("hidden_but_queryable", False)),
        "sort_order": int(item.get("sort_order", 999)),
        "created_at": item.get("created_at") or datetime.utcnow().isoformat(),
        "updated_at": item.get("updated_at") or datetime.utcnow().isoformat(),
    }


def _seed_menu_if_empty():
    try:
        if menu_config_col.count_documents({}) == 0:
            seeds = [_normalize_menu_item(item) for item in DEFAULT_MENU_ITEMS]
            menu_config_col.insert_many(seeds)
            logger.info(f"Seeded menu_config with {len(seeds)} default items")
    except Exception as e:
        logger.warning(f"menu_config seeding skipped: {type(e).__name__}")


# Seed defaults on startup
_seed_menu_if_empty()

# One-shot migration: any existing menu_config rows still holding the legacy
# "SPV Registry" label are upgraded to "Business Registry".
try:
    _mig = menu_config_col.update_many(
        {"menu_label": "SPV Registry"},
        {"$set": {"menu_label": "Business Registry", "updated_at": datetime.utcnow().isoformat()}},
    )
    if _mig.modified_count:
        logger.info(f"Migrated {_mig.modified_count} menu_config rows: SPV Registry -> Business Registry")
except Exception as _e:
    logger.warning(f"menu_config UBIDS migration skipped: {type(_e).__name__}")


def _fetch_menu_items_sorted() -> list[dict]:
    try:
        return list(menu_config_col.find({}, _menu_doc_projection()).sort("sort_order", 1))
    except Exception as e:
        logger.warning(f"menu_config fetch failed, returning defaults: {type(e).__name__}")
        return [_normalize_menu_item(item) for item in DEFAULT_MENU_ITEMS]


def _user_can_see(item: dict, level: str, is_admin: bool) -> bool:
    if not item.get("enabled", True):
        return False
    if item.get("hidden_but_queryable", False):
        return False
    if item.get("admin_only", False):
        return is_admin
    if is_admin:
        return True
    allowed = item.get("allowed_levels") or []
    return level in allowed


class MenuItemIn(BaseModel):
    id: Optional[str] = None
    menu_label: str
    path: str
    source_sheet_name: Optional[str] = "—"
    icon_name: Optional[str] = "doc"
    enabled: Optional[bool] = True
    allowed_levels: Optional[List[str]] = []
    admin_only: Optional[bool] = False
    hidden_but_queryable: Optional[bool] = False
    sort_order: Optional[int] = 999


class MenuItemPatch(BaseModel):
    menu_label: Optional[str] = None
    path: Optional[str] = None
    source_sheet_name: Optional[str] = None
    icon_name: Optional[str] = None
    enabled: Optional[bool] = None
    allowed_levels: Optional[List[str]] = None
    admin_only: Optional[bool] = None
    hidden_but_queryable: Optional[bool] = None
    sort_order: Optional[int] = None


class MenuReorderBody(BaseModel):
    email: str
    order: List[str] = Field(..., description="Ordered list of menu item ids")


@app.get("/api/menu")
async def get_user_menu(email: str):
    """
    Returns the sidebar menu visible to the given user, filtered by
    license level, admin status, enabled flag, and hidden_but_queryable.
    Safe fallback: if config fetch fails, DEFAULT_MENU_ITEMS is used.
    """
    email_lc = (email or "").strip().lower()
    is_admin = bool(ADMIN_EMAIL) and email_lc == ADMIN_EMAIL
    level = "LEVEL_1"
    if email_lc:
        try:
            users = await fetch_access_control()
            user = resolve_user_access(users, email_lc)
            if user:
                level = user.get("license_level") or "LEVEL_1"
        except Exception:
            pass

    items = _fetch_menu_items_sorted()
    visible = [it for it in items if _user_can_see(it, level, is_admin)]
    return {"items": visible, "count": len(visible), "level": level, "isAdmin": is_admin}


@app.get("/api/admin/menu")
async def admin_get_menu(email: str):
    _require_admin(email)
    items = _fetch_menu_items_sorted()
    return {"items": items, "count": len(items)}


@app.get("/api/admin/menu/diagnostics")
async def admin_get_menu_diagnostics(email: str):
    _require_admin(email)
    return {"diagnostics": MENU_DIAGNOSTICS, "count": len(MENU_DIAGNOSTICS)}


@app.post("/api/admin/menu")
async def admin_create_menu_item(item: MenuItemIn, email: str):
    _require_admin(email)
    if not item.menu_label or not item.path:
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "menu_label and path are required"})
    item_id = (item.id or item.path.strip("/").replace("/", "-") or str(uuid.uuid4())).strip()
    if menu_config_col.count_documents({"id": item_id}) > 0:
        raise HTTPException(status_code=409, detail={"error": "conflict", "message": f"Menu item id '{item_id}' already exists"})
    doc = _normalize_menu_item({**item.model_dump(), "id": item_id})
    menu_config_col.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "item": doc}


@app.patch("/api/admin/menu/{item_id}")
async def admin_update_menu_item(item_id: str, patch: MenuItemPatch, email: str):
    _require_admin(email)
    existing = menu_config_col.find_one({"id": item_id}, _menu_doc_projection())
    if not existing:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": f"Menu item '{item_id}' not found"})
    update_fields = {k: v for k, v in patch.model_dump(exclude_unset=True).items() if v is not None}
    if "allowed_levels" in update_fields:
        update_fields["allowed_levels"] = [str(x).strip().upper() for x in update_fields["allowed_levels"] if str(x).strip()]
    update_fields["updated_at"] = datetime.utcnow().isoformat()
    menu_config_col.update_one({"id": item_id}, {"$set": update_fields})
    updated = menu_config_col.find_one({"id": item_id}, _menu_doc_projection())
    return {"success": True, "item": updated}


@app.delete("/api/admin/menu/{item_id}")
async def admin_delete_menu_item(item_id: str, email: str):
    _require_admin(email)
    result = menu_config_col.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": f"Menu item '{item_id}' not found"})
    return {"success": True, "deletedId": item_id}


@app.post("/api/admin/menu/reorder")
async def admin_reorder_menu(body: MenuReorderBody):
    _require_admin(body.email)
    if not body.order:
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "order list is required"})
    for idx, item_id in enumerate(body.order, start=1):
        menu_config_col.update_one(
            {"id": item_id},
            {"$set": {"sort_order": idx, "updated_at": datetime.utcnow().isoformat()}}
        )
    items = _fetch_menu_items_sorted()
    return {"success": True, "items": items}


@app.post("/api/admin/menu/reset-defaults")
async def admin_reset_menu_defaults(email: str):
    """Restore the seeded default menu. Destructive — deletes all existing items."""
    _require_admin(email)
    menu_config_col.delete_many({})
    seeds = [_normalize_menu_item(item) for item in DEFAULT_MENU_ITEMS]
    menu_config_col.insert_many(seeds)
    items = _fetch_menu_items_sorted()
    return {"success": True, "items": items, "count": len(items)}


# ============= ERROR HANDLERS =============

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom error handler for consistent JSON responses"""
    if isinstance(exc.detail, dict):
        content = exc.detail
        content["timestamp"] = datetime.utcnow().isoformat()
    else:
        content = {
            "error": "error",
            "message": str(exc.detail),
            "timestamp": datetime.utcnow().isoformat()
        }
    
    return JSONResponse(status_code=exc.status_code, content=content)


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Catch-all error handler (safe logging)"""
    logger.error(f"Unhandled error: {type(exc).__name__}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": "An internal error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
