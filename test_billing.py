#!/usr/bin/env python3
"""
OnboardIQ Backend Billing/Monetization System Testing
Tests all billing endpoints as requested in the review
"""

import requests
import sys
import json
from datetime import datetime

class BillingTester:
    def __init__(self, base_url="https://onboard-genius-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                self.log(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_billing_system(self):
        """Test OnboardIQ Backend Billing/Monetization System"""
        self.log("\n=== TESTING ONBOARDIQ BACKEND BILLING/MONETIZATION SYSTEM ===")
        
        # Login with provided test credentials
        success, response = self.run_test(
            "Login with admin@testfirma.de",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@testfirma.de", "password": "Test123!"}
        )
        
        if not success or 'access_token' not in response:
            self.log("❌ Could not login with admin@testfirma.de credentials")
            return False
        
        self.token = response['access_token']
        admin_user = response.get('user', {})
        
        self.log(f"✅ Logged in as {admin_user.get('email')} for Billing system testing")
        
        # Test 1: GET /api/billing/tiers - All pricing tiers (should return 5 tiers)
        success, response = self.run_test(
            "1. GET /api/billing/tiers - Get all pricing tiers",
            "GET",
            "billing/tiers",
            200
        )
        
        if success and response:
            tiers = response
            self.log(f"✅ Found {len(tiers)} pricing tiers")
            
            # Verify we have exactly 5 tiers as expected
            if len(tiers) == 5:
                self.log("✅ Correct number of tiers (5) returned")
                tier_names = [tier.get('name', 'Unknown') for tier in tiers]
                self.log(f"   Tiers: {', '.join(tier_names)}")
                
                # Show details for each tier
                for tier in tiers:
                    name = tier.get('name', 'Unknown')
                    user_limit = tier.get('user_limit', 0)
                    price_monthly = tier.get('price_monthly', 0)
                    self.log(f"   - {name}: {user_limit} users, €{price_monthly}/month")
            else:
                self.log(f"❌ Expected 5 tiers, got {len(tiers)}")
        
        # Test 2: GET /api/billing/usage - Usage tracking (users, cases, storage, templates limits)
        success, response = self.run_test(
            "2. GET /api/billing/usage - Get usage data",
            "GET",
            "billing/usage",
            200
        )
        
        if success and response:
            usage = response
            self.log("✅ Usage data retrieved successfully")
            
            # Check required usage fields
            required_fields = ['users', 'cases', 'storage', 'templates', 'tier', 'tier_name', 'subscription_status']
            missing_fields = [field for field in required_fields if field not in usage]
            
            if not missing_fields:
                self.log("✅ All required usage fields present")
                
                # Display usage details
                users = usage.get('users', {})
                cases = usage.get('cases', {})
                storage = usage.get('storage', {})
                templates = usage.get('templates', {})
                
                self.log(f"   Users: {users.get('current', 0)}/{users.get('limit', 0)} ({users.get('percentage', 0)}%)")
                self.log(f"   Cases: {cases.get('current', 0)}/{cases.get('limit', 0)} ({cases.get('percentage', 0)}%)")
                self.log(f"   Storage: {storage.get('current_mb', 0)}/{storage.get('limit_mb', 0)} MB ({storage.get('percentage', 0)}%)")
                self.log(f"   Templates: {templates.get('current', 0)}/{templates.get('limit', 0)} ({templates.get('percentage', 0)}%)")
                self.log(f"   Current Tier: {usage.get('tier_name', 'Unknown')} ({usage.get('tier', 'unknown')})")
                self.log(f"   Subscription Status: {usage.get('subscription_status', 'unknown')}")
            else:
                self.log(f"❌ Missing usage fields: {missing_fields}")
        
        # Test 3: GET /api/billing/subscription - Subscription details
        success, response = self.run_test(
            "3. GET /api/billing/subscription - Get subscription details",
            "GET",
            "billing/subscription",
            200
        )
        
        if success and response:
            subscription = response
            self.log("✅ Subscription details retrieved successfully")
            
            # Display subscription details
            tier = subscription.get('tier', 'unknown')
            tier_name = subscription.get('tier_name', 'Unknown')
            status = subscription.get('status', 'unknown')
            billing_cycle = subscription.get('billing_cycle', 'unknown')
            price_monthly = subscription.get('price_monthly', 0)
            price_yearly = subscription.get('price_yearly', 0)
            features = subscription.get('features', [])
            
            self.log(f"   Tier: {tier_name} ({tier})")
            self.log(f"   Status: {status}")
            self.log(f"   Billing: {billing_cycle}")
            self.log(f"   Pricing: €{price_monthly}/month, €{price_yearly}/year")
            self.log(f"   Features: {len(features)} features included")
        
        # Test 4: POST /api/billing/check-limit with resource="users" - Check user limit
        success, response = self.run_test(
            "4. POST /api/billing/check-limit - Check user limit",
            "POST",
            "billing/check-limit",
            200,
            data={"resource": "users", "amount": 1}
        )
        
        if success and response:
            limit_check = response
            allowed = limit_check.get('allowed', False)
            message = limit_check.get('message', 'No message')
            
            self.log(f"✅ User limit check: {'Allowed' if allowed else 'Blocked'}")
            self.log(f"   Message: {message}")
        
        # Test 5: POST /api/billing/check-limit with resource="cases" - Check case limit
        success, response = self.run_test(
            "5. POST /api/billing/check-limit - Check case limit",
            "POST",
            "billing/check-limit",
            200,
            data={"resource": "cases", "amount": 1}
        )
        
        if success and response:
            limit_check = response
            allowed = limit_check.get('allowed', False)
            message = limit_check.get('message', 'No message')
            
            self.log(f"✅ Case limit check: {'Allowed' if allowed else 'Blocked'}")
            self.log(f"   Message: {message}")
        
        # Test 6: POST /api/billing/upgrade with new_tier="business" - Upgrade request
        success, response = self.run_test(
            "6. POST /api/billing/upgrade - Request upgrade to business tier",
            "POST",
            "billing/upgrade",
            200,
            data={"new_tier": "business", "billing_cycle": "monthly"}
        )
        
        if success and response:
            upgrade_response = response
            message = upgrade_response.get('message', 'No message')
            request_id = upgrade_response.get('request_id', 'No ID')
            new_tier = upgrade_response.get('new_tier', 'unknown')
            price = upgrade_response.get('price', 0)
            billing_cycle = upgrade_response.get('billing_cycle', 'unknown')
            
            self.log("✅ Upgrade request created successfully")
            self.log(f"   Message: {message}")
            self.log(f"   Request ID: {request_id}")
            self.log(f"   New Tier: {new_tier}")
            self.log(f"   Price: €{price} ({billing_cycle})")
        
        # Additional Test: Check storage limit
        success, response = self.run_test(
            "7. POST /api/billing/check-limit - Check storage limit",
            "POST",
            "billing/check-limit",
            200,
            data={"resource": "storage", "amount": 100}  # 100 MB
        )
        
        if success and response:
            limit_check = response
            allowed = limit_check.get('allowed', False)
            message = limit_check.get('message', 'No message')
            
            self.log(f"✅ Storage limit check: {'Allowed' if allowed else 'Blocked'}")
            self.log(f"   Message: {message}")
        
        # Additional Test: Check templates limit
        success, response = self.run_test(
            "8. POST /api/billing/check-limit - Check templates limit",
            "POST",
            "billing/check-limit",
            200,
            data={"resource": "templates", "amount": 1}
        )
        
        if success and response:
            limit_check = response
            allowed = limit_check.get('allowed', False)
            message = limit_check.get('message', 'No message')
            
            self.log(f"✅ Templates limit check: {'Allowed' if allowed else 'Blocked'}")
            self.log(f"   Message: {message}")
        
        return True

    def print_results(self):
        """Print test results summary"""
        self.log("\n" + "="*50)
        self.log("📊 BILLING SYSTEM TEST RESULTS")
        self.log("="*50)
        self.log(f"Total Tests: {self.tests_run}")
        self.log(f"Passed: {self.tests_passed}")
        self.log(f"Failed: {len(self.failed_tests)}")
        
        if self.failed_tests:
            self.log("\n❌ FAILED TESTS:")
            for failed in self.failed_tests:
                self.log(f"   - {failed['test']}")
                if 'error' in failed:
                    self.log(f"     Error: {failed['error']}")
                else:
                    self.log(f"     Expected: {failed['expected']}, Got: {failed['actual']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = BillingTester()
    tester.log("🚀 Starting OnboardIQ Backend Billing/Monetization System Testing")
    tester.log(f"Base URL: {tester.base_url}")
    
    success = tester.test_billing_system()
    tester.print_results()
    
    sys.exit(0 if success else 1)