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

    def run_test(self, name, method, endpoint, expected_status, expected_data_checks=None):
        """Run a single API test with data validation"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json={}, headers=headers, timeout=30)

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

def main():
    print("🚀 Starting UBUYBOX Backend API Tests")
    print("=" * 50)
    
    # Test with localhost since we're testing internally
    tester = UBUYBOXAPITester("http://localhost:8001")
    
    # Run all tests
    tests = [
        tester.test_health_check,
        tester.test_get_all_deals,
        tester.test_get_dashboard,
        tester.test_get_spvs,
        tester.test_get_single_deal
    ]
    
    for test in tests:
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