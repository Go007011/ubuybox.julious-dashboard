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
import httpx
import secrets
import logging
from datetime import datetime
from typing import Optional, Literal, List
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

# ============= CONFIGURATION =============

# Google Sheet configuration (source of truth - unchanged)
SPREADSHEET_ID = os.environ.get("SPREADSHEET_ID", "1N8-PD3654Qcd65r9Etc2Z1ayZbHB0X5m__URQYFYVeY")
SHEET_NAME = "Sheet1"

# Orchestration API Token
ORCHESTRATION_API_TOKEN = os.environ.get(
    "ORCHESTRATION_API_TOKEN", 
    "ubx_orch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
)

logger.info(f"Emergent orchestration layer initialized. Token configured: {bool(ORCHESTRATION_API_TOKEN)}")


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
    url = get_csv_url(SPREADSHEET_ID, SHEET_NAME)
    
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
