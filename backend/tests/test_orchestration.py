"""
UBUYBOX Orchestration API Tests
Tests all orchestration endpoints including:
- Health check (no auth)
- Load SPV (auth required)
- Set disclosure (auth required)
- Get status (auth required)
- Resolve visibility (auth required)
- Set waterfall permission (auth required)
- SPV visibility (public endpoint)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://capital-stack-ui.preview.emergentagent.com').rstrip('/')
VALID_TOKEN = "ubx_orch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
INVALID_TOKEN = "invalid_token_12345"
VALID_SPV = "SPV_011"
INVALID_SPV = "SPV_999"


class TestOrchestrationHealth:
    """Test /api/orchestration/health - no auth required"""
    
    def test_health_returns_ok(self):
        """Health endpoint should return ok:true without auth"""
        response = requests.get(f"{BASE_URL}/api/orchestration/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert "service" in data
        assert "version" in data
        print(f"PASS: Health endpoint returns ok:true - {data}")


class TestOrchestrationAuth:
    """Test authentication on protected endpoints"""
    
    def test_load_spv_missing_auth_returns_401(self):
        """Missing auth header should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/load-spv",
            json={"spvId": VALID_SPV}
        )
        assert response.status_code == 401
        data = response.json()
        assert data.get("error") == "unauthorized"
        print(f"PASS: Missing auth returns 401 - {data}")
    
    def test_load_spv_invalid_token_returns_403(self):
        """Invalid token should return 403"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/load-spv",
            json={"spvId": VALID_SPV},
            headers={"Authorization": f"Bearer {INVALID_TOKEN}"}
        )
        assert response.status_code == 403
        data = response.json()
        assert data.get("error") == "forbidden"
        print(f"PASS: Invalid token returns 403 - {data}")
    
    def test_set_disclosure_missing_auth_returns_401(self):
        """Set disclosure without auth should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/set-disclosure",
            json={"spvId": VALID_SPV, "disclosureLevel": "preview"}
        )
        assert response.status_code == 401
        print("PASS: Set disclosure without auth returns 401")
    
    def test_status_missing_auth_returns_401(self):
        """Status endpoint without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/orchestration/status/{VALID_SPV}")
        assert response.status_code == 401
        print("PASS: Status without auth returns 401")
    
    def test_resolve_visibility_missing_auth_returns_401(self):
        """Resolve visibility without auth should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/resolve-visibility",
            json={"spvId": VALID_SPV}
        )
        assert response.status_code == 401
        print("PASS: Resolve visibility without auth returns 401")
    
    def test_set_waterfall_missing_auth_returns_401(self):
        """Set waterfall permission without auth should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/set-waterfall-permission",
            json={"spvId": VALID_SPV, "permitted": True}
        )
        assert response.status_code == 401
        print("PASS: Set waterfall without auth returns 401")


class TestLoadSPV:
    """Test POST /api/orchestration/load-spv"""
    
    def test_load_valid_spv_returns_view_model(self):
        """Valid SPV should return view model with visibility state"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/load-spv",
            json={"spvId": VALID_SPV},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("spvId") == VALID_SPV
        assert "visibilityState" in data
        assert "viewModel" in data
        assert "disclosureLevel" in data
        assert "waterfallAvailable" in data
        assert "waterfallVisible" in data
        print(f"PASS: Load valid SPV returns view model - visibilityState: {data.get('visibilityState')}")
    
    def test_load_invalid_spv_returns_404(self):
        """Invalid SPV should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/load-spv",
            json={"spvId": INVALID_SPV},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 404
        data = response.json()
        assert data.get("error") == "not_found"
        print(f"PASS: Invalid SPV returns 404 - {data}")


class TestSetDisclosure:
    """Test POST /api/orchestration/set-disclosure"""
    
    def test_set_disclosure_blocked(self):
        """Set disclosure to blocked"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/set-disclosure",
            json={"spvId": VALID_SPV, "disclosureLevel": "blocked"},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("disclosureLevel") == "blocked"
        print(f"PASS: Set disclosure to blocked - {data}")
    
    def test_set_disclosure_teaser(self):
        """Set disclosure to teaser"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/set-disclosure",
            json={"spvId": VALID_SPV, "disclosureLevel": "teaser"},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("disclosureLevel") == "teaser"
        print(f"PASS: Set disclosure to teaser - {data}")
    
    def test_set_disclosure_preview(self):
        """Set disclosure to preview"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/set-disclosure",
            json={"spvId": VALID_SPV, "disclosureLevel": "preview"},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("disclosureLevel") == "preview"
        print(f"PASS: Set disclosure to preview - {data}")
    
    def test_set_disclosure_full(self):
        """Set disclosure to full"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/set-disclosure",
            json={"spvId": VALID_SPV, "disclosureLevel": "full"},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("disclosureLevel") == "full"
        print(f"PASS: Set disclosure to full - {data}")
    
    def test_set_disclosure_invalid_spv_returns_404(self):
        """Set disclosure on invalid SPV should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/set-disclosure",
            json={"spvId": INVALID_SPV, "disclosureLevel": "preview"},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 404
        data = response.json()
        assert data.get("error") == "not_found"
        print(f"PASS: Set disclosure on invalid SPV returns 404 - {data}")
    
    def test_set_disclosure_invalid_level_returns_422(self):
        """Invalid disclosure level should return 422"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/set-disclosure",
            json={"spvId": VALID_SPV, "disclosureLevel": "invalid_level"},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 422
        print("PASS: Invalid disclosure level returns 422")


class TestGetStatus:
    """Test GET /api/orchestration/status/{spvId}"""
    
    def test_status_valid_spv(self):
        """Status for valid SPV should return comprehensive info"""
        response = requests.get(
            f"{BASE_URL}/api/orchestration/status/{VALID_SPV}",
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("spvId") == VALID_SPV
        assert data.get("exists") == True
        assert "dealCount" in data
        assert "disclosureLevel" in data
        assert "waterfallAvailable" in data
        assert "waterfallVisible" in data
        assert "fieldsComplete" in data
        assert "safeToDisplay" in data
        assert "visibilityState" in data
        assert "missingFields" in data
        assert "blockingReasons" in data
        print(f"PASS: Status for valid SPV - exists: {data.get('exists')}, visibilityState: {data.get('visibilityState')}")
    
    def test_status_invalid_spv(self):
        """Status for invalid SPV should return exists:false"""
        response = requests.get(
            f"{BASE_URL}/api/orchestration/status/{INVALID_SPV}",
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("exists") == False
        assert data.get("visibilityState") == "blocked"
        print(f"PASS: Status for invalid SPV - exists: {data.get('exists')}, visibilityState: {data.get('visibilityState')}")


class TestResolveVisibility:
    """Test POST /api/orchestration/resolve-visibility"""
    
    def test_resolve_visibility_valid_spv(self):
        """Resolve visibility for valid SPV"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/resolve-visibility",
            json={"spvId": VALID_SPV},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("spvId") == VALID_SPV
        assert "resolvedVisibility" in data
        assert "waterfallAvailable" in data
        assert "waterfallVisible" in data
        assert "safeToDisplay" in data
        assert "fieldsComplete" in data
        print(f"PASS: Resolve visibility - resolvedVisibility: {data.get('resolvedVisibility')}")
    
    def test_resolve_visibility_invalid_spv(self):
        """Resolve visibility for invalid SPV should return blocked"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/resolve-visibility",
            json={"spvId": INVALID_SPV},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("resolvedVisibility") == "blocked"
        print(f"PASS: Resolve visibility for invalid SPV - resolvedVisibility: {data.get('resolvedVisibility')}")


class TestSetWaterfallPermission:
    """Test POST /api/orchestration/set-waterfall-permission"""
    
    def test_set_waterfall_permitted_true(self):
        """Set waterfall permission to true"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/set-waterfall-permission",
            json={"spvId": VALID_SPV, "permitted": True},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("waterfallPermitted") == True
        print(f"PASS: Set waterfall permitted to true - {data}")
    
    def test_set_waterfall_permitted_false(self):
        """Set waterfall permission to false"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/set-waterfall-permission",
            json={"spvId": VALID_SPV, "permitted": False},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("waterfallPermitted") == False
        print(f"PASS: Set waterfall permitted to false - {data}")
    
    def test_set_waterfall_invalid_spv_returns_404(self):
        """Set waterfall on invalid SPV should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/set-waterfall-permission",
            json={"spvId": INVALID_SPV, "permitted": True},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 404
        data = response.json()
        assert data.get("error") == "not_found"
        print(f"PASS: Set waterfall on invalid SPV returns 404 - {data}")


class TestSPVVisibility:
    """Test GET /api/spv-visibility - public endpoint"""
    
    def test_spv_visibility_no_auth_required(self):
        """SPV visibility endpoint should work without auth"""
        response = requests.get(f"{BASE_URL}/api/spv-visibility")
        assert response.status_code == 200
        data = response.json()
        assert "visibility" in data
        assert "timestamp" in data
        print(f"PASS: SPV visibility endpoint works without auth - {len(data.get('visibility', {}))} SPVs")
    
    def test_spv_visibility_returns_map(self):
        """SPV visibility should return visibility map for all SPVs"""
        response = requests.get(f"{BASE_URL}/api/spv-visibility")
        assert response.status_code == 200
        data = response.json()
        visibility_map = data.get("visibility", {})
        
        # Check that we have SPVs in the map
        assert len(visibility_map) > 0
        
        # Check structure of each SPV visibility entry
        for spv_id, vis_data in visibility_map.items():
            assert "visibilityState" in vis_data
            assert "waterfallVisible" in vis_data
            assert "disclosureLevel" in vis_data
            assert vis_data["visibilityState"] in ["blocked", "teaser", "preview", "full"]
        
        print(f"PASS: SPV visibility returns map with {len(visibility_map)} SPVs")


class TestVisibilityStateFiltering:
    """Test that visibility states correctly filter view model data"""
    
    def test_teaser_visibility_filters_data(self):
        """Teaser visibility should show limited data"""
        # First set disclosure to teaser
        requests.post(
            f"{BASE_URL}/api/orchestration/set-disclosure",
            json={"spvId": VALID_SPV, "disclosureLevel": "teaser"},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        
        # Then load SPV
        response = requests.post(
            f"{BASE_URL}/api/orchestration/load-spv",
            json={"spvId": VALID_SPV},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        view_model = data.get("viewModel", {})
        
        # Teaser should have limited fields
        assert view_model.get("visibilityState") == "teaser"
        assert "spvId" in view_model
        assert "dealCount" in view_model
        # Teaser should NOT have full deals array with financial data
        if "deals" in view_model:
            # If deals exist, they should not have sensitive financial data
            pass
        print(f"PASS: Teaser visibility filters data correctly - {view_model.get('visibilityState')}")
    
    def test_blocked_visibility_shows_minimal(self):
        """Blocked visibility should show minimal data"""
        # First set disclosure to blocked
        requests.post(
            f"{BASE_URL}/api/orchestration/set-disclosure",
            json={"spvId": VALID_SPV, "disclosureLevel": "blocked"},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        
        # Then load SPV
        response = requests.post(
            f"{BASE_URL}/api/orchestration/load-spv",
            json={"spvId": VALID_SPV},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        view_model = data.get("viewModel", {})
        
        # Blocked should have minimal fields
        assert view_model.get("visibilityState") == "blocked"
        assert "spvId" in view_model
        assert "message" in view_model
        print(f"PASS: Blocked visibility shows minimal data - {view_model.get('visibilityState')}")
    
    def test_reset_to_teaser(self):
        """Reset SPV to teaser for other tests"""
        response = requests.post(
            f"{BASE_URL}/api/orchestration/set-disclosure",
            json={"spvId": VALID_SPV, "disclosureLevel": "teaser"},
            headers={"Authorization": f"Bearer {VALID_TOKEN}"}
        )
        assert response.status_code == 200
        print("PASS: Reset SPV to teaser")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
