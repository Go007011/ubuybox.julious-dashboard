#!/usr/bin/env python3
"""
Backend API Testing for UBUYBOX Data Pipeline
Tests all backend endpoints that connect to Google Sheets
"""

import requests
import sys
import json
from datetime import datetime

class UBUYBOXAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        # Orchestration API token from environment
        self.orchestration_token = "ubx_orch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"

    def run_test(self, name, method, endpoint, expected_status, expected_data_checks=None, data=None, headers=None):
        """Run a single API test with data validation"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data or {}, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            response_data = {}
            
            if success:
                try:
                    response_data = response.json()
                    print(f"✅ Status: {response.status_code}")
                    
                    # Run data validation checks
                    if expected_data_checks:
                        for check_name, check_func in expected_data_checks.items():
                            try:
                                check_result = check_func(response_data)
                                if check_result:
                                    print(f"   ✅ {check_name}: PASS")
                                else:
                                    print(f"   ❌ {check_name}: FAIL")
                                    success = False
                            except Exception as e:
                                print(f"   ❌ {check_name}: ERROR - {str(e)}")
                                success = False
                    
                except json.JSONDecodeError:
                    print(f"❌ Failed - Invalid JSON response")
                    success = False
                    
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")

            if success:
                self.tests_passed += 1
                
            self.test_results.append({
                "test": name,
                "endpoint": endpoint,
                "status": "PASS" if success else "FAIL",
                "response_code": response.status_code,
                "data_sample": str(response_data)[:200] + "..." if len(str(response_data)) > 200 else str(response_data)
            })

            return success, response_data

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed - Network Error: {str(e)}")
            self.test_results.append({
                "test": name,
                "endpoint": endpoint,
                "status": "FAIL",
                "error": str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test /api/health endpoint"""
        return self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200,
            {
                "has_status": lambda data: "status" in data and data["status"] == "healthy",
                "has_source": lambda data: "source" in data and data["source"] == "Google Sheets"
            }
        )

    def test_get_all_deals(self):
        """Test /api/deals endpoint"""
        return self.run_test(
            "Get All Deals",
            "GET", 
            "api/deals",
            200,
            {
                "has_deals_array": lambda data: "deals" in data and isinstance(data["deals"], list),
                "has_count": lambda data: "count" in data and isinstance(data["count"], int),
                "deals_count_matches": lambda data: len(data["deals"]) == data["count"],
                "has_expected_deals": lambda data: data["count"] >= 15,  # Expecting around 20 deals
                "deal_structure": lambda data: len(data["deals"]) > 0 and all(
                    key in data["deals"][0] for key in ["id", "deal", "spv", "price", "totalCapital", "status"]
                )
            }
        )

    def test_get_dashboard(self):
        """Test /api/dashboard endpoint"""
        return self.run_test(
            "Get Dashboard Metrics",
            "GET",
            "api/dashboard", 
            200,
            {
                "has_total_deals": lambda data: "totalDeals" in data and isinstance(data["totalDeals"], int),
                "has_active_spvs": lambda data: "activeSPVs" in data and isinstance(data["activeSPVs"], int),
                "has_total_capital": lambda data: "totalCapital" in data and isinstance(data["totalCapital"], (int, float)),
                "has_avg_payment": lambda data: "avgMonthlyPayment" in data and isinstance(data["avgMonthlyPayment"], (int, float)),
                "has_status_counts": lambda data: "statusCounts" in data and isinstance(data["statusCounts"], dict),
                "has_recent_deals": lambda data: "recentDeals" in data and isinstance(data["recentDeals"], list),
                "reasonable_metrics": lambda data: data["totalDeals"] > 0 and data["totalCapital"] > 0
            }
        )

    def test_get_spvs(self):
        """Test /api/spvs endpoint"""
        return self.run_test(
            "Get SPVs",
            "GET",
            "api/spvs",
            200,
            {
                "has_spvs_array": lambda data: "spvs" in data and isinstance(data["spvs"], list),
                "has_count": lambda data: "count" in data and isinstance(data["count"], int),
                "spvs_count_matches": lambda data: len(data["spvs"]) == data["count"],
                "spv_structure": lambda data: len(data["spvs"]) > 0 and all(
                    key in data["spvs"][0] for key in ["id", "name", "deals", "totalCapital", "dealCount"]
                )
            }
        )

    def test_get_single_deal(self):
        """Test /api/deals/{deal_id} endpoint"""
        return self.run_test(
            "Get Single Deal (Deal_011)",
            "GET",
            "api/deals/Deal_011",
            200,
            {
                "has_deal_id": lambda data: "id" in data and data["id"] == "Deal_011",
                "has_required_fields": lambda data: all(
                    key in data for key in ["deal", "spv", "price", "totalCapital", "status", "location"]
                ),
                "has_capital_stack": lambda data: all(
                    key in data for key in ["senior", "mezz", "equity"]
                ),
                "capital_stack_valid": lambda data: (
                    isinstance(data.get("senior", 0), (int, float)) and
                    isinstance(data.get("mezz", 0), (int, float)) and
                    isinstance(data.get("equity", 0), (int, float))
                )
            }
        )

    # ============= ORCHESTRATION API TESTS =============

    def test_orchestration_health(self):
        """Test /api/orchestration/health endpoint (no auth required)"""
        return self.run_test(
            "Orchestration Health Check (No Auth)",
            "GET",
            "api/orchestration/health",
            200,
            {
                "has_ok": lambda data: "ok" in data and data["ok"] is True,
                "has_service": lambda data: "service" in data and data["service"] == "ubuybox-emergent",
                "has_version": lambda data: "version" in data and data["version"] == "1.0.0"
            }
        )

    def test_orchestration_load_spv_no_auth(self):
        """Test /api/orchestration/load-spv fails without auth"""
        return self.run_test(
            "Load SPV Without Auth (Should Fail)",
            "POST",
            "api/orchestration/load-spv",
            401,
            {
                "has_error": lambda data: "error" in data and data["error"] == "unauthorized",
                "has_message": lambda data: "message" in data and "Missing Authorization header" in data["message"]
            },
            data={"spvId": "SPV_011"}
        )

    def test_orchestration_load_spv_with_auth(self):
        """Test /api/orchestration/load-spv succeeds with Bearer token"""
        headers = {"Authorization": f"Bearer {self.orchestration_token}"}
        
        # First reset disclosure to teaser to test default behavior
        self.run_test(
            "Reset Disclosure to Teaser",
            "POST",
            "api/orchestration/set-disclosure",
            200,
            data={"spvId": "SPV_011", "disclosureLevel": "teaser"},
            headers=headers
        )
        
        return self.run_test(
            "Load SPV With Auth",
            "POST",
            "api/orchestration/load-spv",
            200,
            {
                "has_success": lambda data: "success" in data and data["success"] is True,
                "has_spv_id": lambda data: "spvId" in data and data["spvId"] == "SPV_011",
                "has_disclosure_level": lambda data: "disclosureLevel" in data,
                "has_view_model": lambda data: "viewModel" in data and isinstance(data["viewModel"], dict),
                "has_timestamp": lambda data: "timestamp" in data,
                "default_disclosure_teaser": lambda data: data["disclosureLevel"] == "teaser",
                "teaser_view_model": lambda data: (
                    data["viewModel"].get("disclosureLevel") == "teaser" and
                    "id" in data["viewModel"] and
                    "name" in data["viewModel"] and
                    "dealCount" in data["viewModel"]
                )
            },
            data={"spvId": "SPV_011"},
            headers=headers
        )

    def test_orchestration_set_disclosure_no_auth(self):
        """Test /api/orchestration/set-disclosure fails without auth"""
        return self.run_test(
            "Set Disclosure Without Auth (Should Fail)",
            "POST",
            "api/orchestration/set-disclosure",
            401,
            {
                "has_error": lambda data: "error" in data and data["error"] == "unauthorized"
            },
            data={"spvId": "SPV_011", "disclosureLevel": "preview"}
        )

    def test_orchestration_set_disclosure_invalid_level(self):
        """Test /api/orchestration/set-disclosure with invalid disclosure level"""
        headers = {"Authorization": f"Bearer {self.orchestration_token}"}
        return self.run_test(
            "Set Disclosure Invalid Level (Should Fail)",
            "POST",
            "api/orchestration/set-disclosure",
            422,
            {
                "has_validation_error": lambda data: "detail" in data and isinstance(data["detail"], list)
            },
            data={"spvId": "SPV_011", "disclosureLevel": "invalid"},
            headers=headers
        )

    def test_orchestration_set_disclosure_valid(self):
        """Test /api/orchestration/set-disclosure with valid disclosure level"""
        headers = {"Authorization": f"Bearer {self.orchestration_token}"}
        return self.run_test(
            "Set Disclosure to Preview",
            "POST",
            "api/orchestration/set-disclosure",
            200,
            {
                "has_success": lambda data: "success" in data and data["success"] is True,
                "has_spv_id": lambda data: "spvId" in data and data["spvId"] == "SPV_011",
                "has_disclosure_level": lambda data: "disclosureLevel" in data and data["disclosureLevel"] == "preview",
                "has_message": lambda data: "message" in data and "app layer only" in data["message"],
                "has_timestamp": lambda data: "timestamp" in data
            },
            data={"spvId": "SPV_011", "disclosureLevel": "preview"},
            headers=headers
        )

    def test_orchestration_load_spv_after_disclosure_change(self):
        """Test /api/orchestration/load-spv returns updated disclosure level"""
        headers = {"Authorization": f"Bearer {self.orchestration_token}"}
        return self.run_test(
            "Load SPV After Disclosure Change",
            "POST",
            "api/orchestration/load-spv",
            200,
            {
                "has_success": lambda data: "success" in data and data["success"] is True,
                "disclosure_is_preview": lambda data: data["disclosureLevel"] == "preview",
                "preview_view_model": lambda data: (
                    data["viewModel"].get("disclosureLevel") == "preview" and
                    "id" in data["viewModel"] and
                    "name" in data["viewModel"] and
                    "dealCount" in data["viewModel"] and
                    "deals" in data["viewModel"]  # Preview includes deals array
                )
            },
            data={"spvId": "SPV_011"},
            headers=headers
        )

    def test_orchestration_set_disclosure_full(self):
        """Test setting disclosure to full level"""
        headers = {"Authorization": f"Bearer {self.orchestration_token}"}
        return self.run_test(
            "Set Disclosure to Full",
            "POST",
            "api/orchestration/set-disclosure",
            200,
            {
                "has_success": lambda data: "success" in data and data["success"] is True,
                "disclosure_is_full": lambda data: data["disclosureLevel"] == "full"
            },
            data={"spvId": "SPV_011", "disclosureLevel": "full"},
            headers=headers
        )

    def test_orchestration_load_spv_full_disclosure(self):
        """Test /api/orchestration/load-spv with full disclosure"""
        headers = {"Authorization": f"Bearer {self.orchestration_token}"}
        return self.run_test(
            "Load SPV With Full Disclosure",
            "POST",
            "api/orchestration/load-spv",
            200,
            {
                "disclosure_is_full": lambda data: data["disclosureLevel"] == "full",
                "full_view_model": lambda data: (
                    data["viewModel"].get("disclosureLevel") == "full" and
                    "totalCapital" in data["viewModel"] and
                    "totalSenior" in data["viewModel"] and
                    "totalEquity" in data["viewModel"]  # Full includes financial data
                )
            },
            data={"spvId": "SPV_011"},
            headers=headers
        )

    def test_orchestration_status_no_auth(self):
        """Test /api/orchestration/status/:spvId fails without auth"""
        return self.run_test(
            "Get SPV Status Without Auth (Should Fail)",
            "GET",
            "api/orchestration/status/SPV_011",
            401,
            {
                "has_error": lambda data: "error" in data and data["error"] == "unauthorized"
            }
        )

    def test_orchestration_status_existing_spv(self):
        """Test /api/orchestration/status/:spvId for existing SPV"""
        headers = {"Authorization": f"Bearer {self.orchestration_token}"}
        return self.run_test(
            "Get Status for Existing SPV",
            "GET",
            "api/orchestration/status/SPV_011",
            200,
            {
                "has_spv_id": lambda data: "spvId" in data and data["spvId"] == "SPV_011",
                "exists_true": lambda data: "exists" in data and data["exists"] is True,
                "has_disclosure_level": lambda data: "disclosureLevel" in data,
                "has_waterfall_available": lambda data: "waterfallAvailable" in data and isinstance(data["waterfallAvailable"], bool),
                "has_required_fields_complete": lambda data: "requiredFieldsComplete" in data and isinstance(data["requiredFieldsComplete"], bool),
                "has_safe_to_display": lambda data: "safeToDisplay" in data and isinstance(data["safeToDisplay"], bool),
                "has_summary": lambda data: "summary" in data and isinstance(data["summary"], dict),
                "has_timestamp": lambda data: "timestamp" in data
            },
            headers=headers
        )

    def test_orchestration_status_nonexistent_spv(self):
        """Test /api/orchestration/status/:spvId for non-existent SPV"""
        headers = {"Authorization": f"Bearer {self.orchestration_token}"}
        return self.run_test(
            "Get Status for Non-existent SPV",
            "GET",
            "api/orchestration/status/SPV_999",
            200,
            {
                "has_spv_id": lambda data: "spvId" in data and data["spvId"] == "SPV_999",
                "exists_false": lambda data: "exists" in data and data["exists"] is False,
                "disclosure_null": lambda data: data.get("disclosureLevel") is None,
                "waterfall_false": lambda data: data.get("waterfallAvailable") is False,
                "required_fields_false": lambda data: data.get("requiredFieldsComplete") is False,
                "safe_to_display_false": lambda data: data.get("safeToDisplay") is False,
                "has_reason": lambda data: "reason" in data and "not found" in data["reason"].lower()
            },
            headers=headers
        )

    def test_orchestration_load_nonexistent_spv(self):
        """Test /api/orchestration/load-spv for non-existent SPV"""
        headers = {"Authorization": f"Bearer {self.orchestration_token}"}
        return self.run_test(
            "Load Non-existent SPV (Should Fail)",
            "POST",
            "api/orchestration/load-spv",
            404,
            {
                "has_error": lambda data: "error" in data and data["error"] == "not_found",
                "has_message": lambda data: "message" in data and "SPV_999" in data["message"]
            },
            data={"spvId": "SPV_999"},
            headers=headers
        )
def main():
    print("🚀 Starting UBUYBOX Backend API Tests")
    print("=" * 50)
    
    # Test with localhost since we're testing internally
    tester = UBUYBOXAPITester("http://localhost:8001")
    
    # Run all tests - Standard API tests first, then Orchestration API tests
    print("\n🔧 Testing Standard UBUYBOX API Endpoints...")
    standard_tests = [
        tester.test_health_check,
        tester.test_get_all_deals,
        tester.test_get_dashboard,
        tester.test_get_spvs,
        tester.test_get_single_deal
    ]
    
    for test in standard_tests:
        test()
    
    print("\n🎯 Testing Orchestration API Endpoints...")
    orchestration_tests = [
        tester.test_orchestration_health,
        tester.test_orchestration_load_spv_no_auth,
        tester.test_orchestration_load_spv_with_auth,
        tester.test_orchestration_set_disclosure_no_auth,
        tester.test_orchestration_set_disclosure_invalid_level,
        tester.test_orchestration_set_disclosure_valid,
        tester.test_orchestration_load_spv_after_disclosure_change,
        tester.test_orchestration_set_disclosure_full,
        tester.test_orchestration_load_spv_full_disclosure,
        tester.test_orchestration_status_no_auth,
        tester.test_orchestration_status_existing_spv,
        tester.test_orchestration_status_nonexistent_spv,
        tester.test_orchestration_load_nonexistent_spv
    ]
    
    tests = standard_tests + orchestration_tests
    
    for test in orchestration_tests:
        test()
    
    # Print summary
    print("\n" + "=" * 50)
    print(f"📊 Test Summary: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests PASSED!")
        return 0
    else:
        print("❌ Some tests FAILED!")
        print("\nFailed Tests:")
        for result in tester.test_results:
            if result["status"] == "FAIL":
                print(f"  - {result['test']}: {result.get('error', 'Check logs above')}")
        return 1

if __name__ == "__main__":
    sys.exit(main())