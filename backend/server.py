"""
UBUYBOX Backend API
Connects to Google Sheets as the single source of truth for deal data.
"""

import os
import re
import csv
import io
import httpx
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="UBUYBOX API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Google Sheet configuration
SPREADSHEET_ID = "1N8-PD3654Qcd65r9Etc2Z1ayZbHB0X5m__URQYFYVeY"
SHEET_NAME = "Sheet1"

def get_csv_url(spreadsheet_id: str, sheet_name: str = "Sheet1") -> str:
    """Generate CSV export URL for a public Google Sheet"""
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/gviz/tq?tqx=out:csv&sheet={sheet_name}"


def parse_number(value) -> float:
    """Parse a number from string, handling currency and commas"""
    if value is None or value == "" or value == "-":
        return 0.0
    # Remove currency symbols, commas, and spaces
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
    """Fetch and parse data from Google Sheets using proper CSV parsing"""
    url = get_csv_url(SPREADSHEET_ID, SHEET_NAME)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch Google Sheet: {str(e)}")
    
    # Use Python's CSV reader for proper parsing (handles quoted multi-line values)
    csv_content = response.text
    reader = csv.DictReader(io.StringIO(csv_content))
    
    deals = []
    for row in reader:
        # Get Deal_ID - skip rows without valid Deal_ID
        deal_id = row.get("Deal_ID", "").strip()
        if not deal_id or not deal_id.startswith("Deal_"):
            continue
        
        # Parse numeric values
        price = parse_number(row.get("Purchase Price", 0))
        senior = parse_number(row.get("Seller Carryback", 0))
        equity = parse_number(row.get("Cash At Closing To Seller", 0))
        total_capital = parse_number(row.get("TOTAL_CAPITAL_REQUIRED", 0))
        payment = parse_number(row.get("Monthly Payment To Seller", 0))
        
        # If total_capital not set, estimate it
        if total_capital == 0:
            total_capital = senior + equity
        
        # Compute mezz = totalCapital - senior - equity
        mezz = max(0, total_capital - senior - equity)
        
        # Get state and county
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
            "businessUse": "Investment",  # Simplified - the full text is too long
        }
        
        deals.append(deal)
    
    return deals


# ============= API ENDPOINTS =============

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
    
    # Find deal by ID (case-insensitive)
    for deal in deals:
        if deal["deal"].lower() == deal_id.lower() or deal["id"].lower() == deal_id.lower():
            return deal
    
    raise HTTPException(status_code=404, detail=f"Deal {deal_id} not found")


@app.get("/api/spvs")
async def get_spvs():
    """Get deals grouped by SPV_ID"""
    deals = await fetch_sheet_data()
    
    # Group by SPV
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
    
    # Calculate metrics
    total_deals = len(deals)
    total_capital = sum(d["totalCapital"] for d in deals)
    total_payment = sum(d["payment"] for d in deals)
    avg_payment = total_payment / total_deals if total_deals > 0 else 0
    
    # Count unique SPVs
    spvs = set(d["spv"] for d in deals if d["spv"])
    active_spvs = len(spvs)
    
    # Count by status
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
        "recentDeals": deals[:5]  # First 5 deals
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
