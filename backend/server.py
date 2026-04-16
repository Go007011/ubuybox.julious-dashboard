"""
UBUYBOX Backend API
Connects to Google Sheets as the single source of truth for deal data.
Includes orchestration endpoints for OpenClaw integration.
"""

import os
import re
import csv
import io
import httpx
import secrets
import logging
from datetime import datetime
from typing import Optional, Literal
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

# Configure logging (safe - no secrets)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ubuybox")

app = FastAPI(
    title="UBUYBOX API",
    version="1.0.0",
    description="UBUYBOX SPV Dashboard API with OpenClaw Orchestration"
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
SPREADSHEET_ID = "1N8-PD3654Qcd65r9Etc2Z1ayZbHB0X5m__URQYFYVeY"
SHEET_NAME = "Sheet1"

# Orchestration API Token (generate secure token for production)
ORCHESTRATION_API_TOKEN = os.environ.get("ORCHESTRATION_API_TOKEN", "ubx_orch_" + secrets.token_hex(16))

# Log token existence (not the token itself)
logger.info(f"Orchestration API configured. Token set: {bool(ORCHESTRATION_API_TOKEN)}")


# ============= IN-MEMORY STATE (App Layer Only) =============
# This state controls display/disclosure - NOT source data

class SPVDisplayState:
    """In-memory state for SPV display configuration (app layer only)"""
    
    def __init__(self):
        self._disclosure_levels: dict[str, str] = {}  # spvId -> disclosure level
        self._last_updated: dict[str, datetime] = {}
    
    def set_disclosure(self, spv_id: str, level: str) -> None:
        """Set disclosure level for an SPV (app layer only)"""
        self._disclosure_levels[spv_id] = level
        self._last_updated[spv_id] = datetime.utcnow()
        logger.info(f"Disclosure updated for {spv_id}: {level}")
    
    def get_disclosure(self, spv_id: str) -> str:
        """Get disclosure level (defaults to 'teaser')"""
        return self._disclosure_levels.get(spv_id, "teaser")
    
    def get_last_updated(self, spv_id: str) -> Optional[datetime]:
        """Get last update time for SPV state"""
        return self._last_updated.get(spv_id)
    
    def clear(self, spv_id: str) -> None:
        """Clear state for an SPV"""
        self._disclosure_levels.pop(spv_id, None)
        self._last_updated.pop(spv_id, None)

# Global state instance
spv_state = SPVDisplayState()


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
    
    token = authorization[7:]  # Remove "Bearer " prefix
    
    if token != ORCHESTRATION_API_TOKEN:
        logger.warning("Invalid orchestration token attempt")
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Invalid API token"}
        )
    
    return True


# ============= PYDANTIC MODELS =============

class LoadSPVRequest(BaseModel):
    spvId: str = Field(..., description="SPV identifier", example="SPV_001")

class SetDisclosureRequest(BaseModel):
    spvId: str = Field(..., description="SPV identifier", example="SPV_001")
    disclosureLevel: Literal["teaser", "preview", "full"] = Field(
        ..., 
        description="Disclosure level for display",
        example="teaser"
    )

class ErrorResponse(BaseModel):
    error: str
    message: str
    timestamp: str


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
    """Fetch and parse data from Google Sheets (source of truth)"""
    url = get_csv_url(SPREADSHEET_ID, SHEET_NAME)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch Google Sheet: {type(e).__name__}")
            raise HTTPException(status_code=502, detail=f"Failed to fetch Google Sheet")
    
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
            "netToSeller": parse_number(row.get("Net Cash To Seller", 0)),
            "status": parse_status(row.get("Status", "")),
            "totalCapital": total_capital,
            "unitSize": parse_number(row.get("UNIT_SIZE", 0)),
            "units": int(parse_number(row.get("TOTAL_UNITS", 0))),
            "unitsSold": int(parse_number(row.get("UNITS_SOLD", 0))),
            "propertyType": row.get("Property_Type", "").strip() or "Commercial",
            "businessUse": "Investment",
        }
        deals.append(deal)
    
    return deals


def get_spv_from_deals(deals: list[dict], spv_id: str) -> Optional[dict]:
    """Get aggregated SPV data from deals list"""
    spv_deals = [d for d in deals if d["spv"] == spv_id]
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
    }


def check_required_fields(spv_data: dict, deals: list[dict]) -> dict:
    """Check if required fields are complete for an SPV"""
    spv_deals = [d for d in deals if d["spv"] == spv_data["id"]]
    
    missing = []
    for deal in spv_deals:
        if not deal.get("address"):
            missing.append(f"{deal['deal']}: missing address")
        if deal.get("price", 0) == 0:
            missing.append(f"{deal['deal']}: missing price")
        if deal.get("senior", 0) == 0 and deal.get("equity", 0) == 0:
            missing.append(f"{deal['deal']}: missing capital stack")
    
    return {
        "complete": len(missing) == 0,
        "missingFields": missing[:5]  # Limit to 5 for brevity
    }


def apply_disclosure_filter(data: dict, level: str) -> dict:
    """Apply disclosure level filtering to SPV view model"""
    if level == "teaser":
        # Minimal info - just identifiers and summary
        return {
            "id": data.get("id"),
            "name": data.get("name"),
            "dealCount": data.get("dealCount"),
            "disclosureLevel": "teaser"
        }
    elif level == "preview":
        # More detail but no financials
        return {
            "id": data.get("id"),
            "name": data.get("name"),
            "dealCount": data.get("dealCount"),
            "deals": data.get("deals", []),
            "disclosureLevel": "preview"
        }
    else:  # full
        return {
            **data,
            "disclosureLevel": "full"
        }


# ============= STANDARD API ENDPOINTS =============

@app.get("/")
async def root():
    return {"message": "UBUYBOX API", "version": "1.0.0"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "source": "Google Sheets"}


@app.get("/api/deals")
async def get_all_deals():
    """Get all deals from Google Sheets"""
    deals = await fetch_sheet_data()
    return {"deals": deals, "count": len(deals)}


@app.get("/api/deals/{deal_id}")
async def get_deal_by_id(deal_id: str):
    """Get a single deal by Deal_ID"""
    deals = await fetch_sheet_data()
    
    for deal in deals:
        if deal["deal"].lower() == deal_id.lower() or deal["id"].lower() == deal_id.lower():
            return deal
    
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
    
    return {
        "totalDeals": total_deals,
        "activeSPVs": active_spvs,
        "totalCapital": total_capital,
        "avgMonthlyPayment": round(avg_payment, 2),
        "statusCounts": status_counts,
        "recentDeals": deals[:5]
    }


# ============= ORCHESTRATION ENDPOINTS (OpenClaw) =============

@app.get("/api/orchestration/health")
async def orchestration_health():
    """
    Health check for orchestration layer.
    No authentication required - used for uptime monitoring.
    
    Returns:
        Service health status
    """
    return {
        "ok": True,
        "service": "ubuybox-emergent",
        "version": "1.0.0"
    }


@app.post("/api/orchestration/load-spv")
async def load_spv(
    request: LoadSPVRequest,
    authenticated: bool = Depends(verify_orchestration_token)
):
    """
    Load SPV view model based on current disclosure level.
    Validates SPV exists in sheet-backed data, returns allowed view model.
    Does NOT modify source data.
    
    Args:
        request: LoadSPVRequest with spvId
        
    Returns:
        SPV view model filtered by current disclosure level
    """
    spv_id = request.spvId
    logger.info(f"Loading SPV: {spv_id}")
    
    # Fetch current data from Google Sheets (source of truth)
    deals = await fetch_sheet_data()
    
    # Get SPV data
    spv_data = get_spv_from_deals(deals, spv_id)
    
    if not spv_data:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": f"SPV {spv_id} not found in source data",
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    # Get current disclosure level from app state
    disclosure_level = spv_state.get_disclosure(spv_id)
    
    # Apply disclosure filtering
    view_model = apply_disclosure_filter(spv_data, disclosure_level)
    
    return {
        "success": True,
        "spvId": spv_id,
        "disclosureLevel": disclosure_level,
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
    
    Args:
        request: SetDisclosureRequest with spvId and disclosureLevel
        
    Returns:
        Confirmation of disclosure state update
    """
    spv_id = request.spvId
    level = request.disclosureLevel
    
    logger.info(f"Setting disclosure for {spv_id}: {level}")
    
    # Validate SPV exists
    deals = await fetch_sheet_data()
    spv_data = get_spv_from_deals(deals, spv_id)
    
    if not spv_data:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": f"SPV {spv_id} not found in source data",
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    # Set display state (app layer only - no Google Sheets write)
    spv_state.set_disclosure(spv_id, level)
    
    return {
        "success": True,
        "spvId": spv_id,
        "disclosureLevel": level,
        "message": "Disclosure level updated (app layer only)",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/api/orchestration/status/{spv_id}")
async def get_spv_status(
    spv_id: str,
    authenticated: bool = Depends(verify_orchestration_token)
):
    """
    Get comprehensive status for an SPV.
    Returns existence, disclosure state, waterfall availability, 
    field completeness, and display safety.
    
    Args:
        spv_id: SPV identifier
        
    Returns:
        Complete status object for orchestration decisions
    """
    logger.info(f"Status check for SPV: {spv_id}")
    
    # Fetch current data
    deals = await fetch_sheet_data()
    spv_data = get_spv_from_deals(deals, spv_id)
    
    # Check existence
    exists = spv_data is not None
    
    if not exists:
        return {
            "spvId": spv_id,
            "exists": False,
            "disclosureLevel": None,
            "waterfallAvailable": False,
            "requiredFieldsComplete": False,
            "safeToDisplay": False,
            "reason": "SPV not found in source data",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    # Get disclosure state
    disclosure_level = spv_state.get_disclosure(spv_id)
    last_updated = spv_state.get_last_updated(spv_id)
    
    # Check required fields
    field_check = check_required_fields(spv_data, deals)
    
    # Check waterfall availability (has capital stack data)
    has_capital_data = (
        spv_data.get("totalSenior", 0) > 0 or 
        spv_data.get("totalEquity", 0) > 0
    )
    
    # Determine if safe to display
    safe_to_display = (
        exists and 
        field_check["complete"] and 
        has_capital_data
    )
    
    return {
        "spvId": spv_id,
        "exists": True,
        "disclosureLevel": disclosure_level,
        "disclosureLastUpdated": last_updated.isoformat() if last_updated else None,
        "waterfallAvailable": has_capital_data,
        "requiredFieldsComplete": field_check["complete"],
        "missingFields": field_check.get("missingFields", []),
        "safeToDisplay": safe_to_display,
        "summary": {
            "dealCount": spv_data.get("dealCount", 0),
            "totalCapital": spv_data.get("totalCapital", 0)
        },
        "timestamp": datetime.utcnow().isoformat()
    }


# ============= ERROR HANDLERS =============

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom error handler for consistent JSON responses"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail.get("error", "error") if isinstance(exc.detail, dict) else "error",
            "message": exc.detail.get("message", str(exc.detail)) if isinstance(exc.detail, dict) else str(exc.detail),
            "timestamp": datetime.utcnow().isoformat()
        }
    )


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
