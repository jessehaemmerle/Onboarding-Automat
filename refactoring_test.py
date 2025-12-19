#!/usr/bin/env python3
"""
OnboardIQ Backend Refactoring Test
Tests critical endpoints after refactoring to ensure functionality is maintained
"""

import requests
import sys
import json
from datetime import datetime
import os

class RefactoringTester:
    def __init__(self):
        # Get backend URL from frontend .env file
        self.backend_url = self.get_backend_url()
        self.health_url = self.backend_url.replace('/api', '')  # Health check is direct, not via /api
        self.token = None
        self.super_admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def get_backend_url(self):
        """Read REACT_APP_BACKEND_URL from frontend/.env"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        url = line.split('=', 1)[1].strip()
                        return f"{url}/api"
            return "https://onboard-genius-1.preview.emergentagent.com/api"
        except Exception as e:
            print(f"Warning: Could not read frontend/.env: {e}")
            return "https://onboard-genius-1.preview.emergentagent.com/api"

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, url, expected_status, data=None, headers=None, use_token=True):
        """Run a single API test"""
        test_headers = {'Content-Type': 'application/json'}
        if use_token and self.token:
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
                self.log(f"   Response: {response.text[:300]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:300]
                })
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test Health Check endpoint"""
        self.log("\n=== 1. TESTING HEALTH CHECK ===")
        
        success, response = self.run_test(
            "Health Check (GET /health)",
            "GET",
            f"{self.health_url}/health",
            200,
            use_token=False
        )
        
        if success and response:
            status = response.get('status')
            service = response.get('service')
            if status == 'healthy' and service == 'onboarding-automat':
                self.log("✅ Health check response format correct")
            else:
                self.log(f"⚠️ Health check response: status={status}, service={service}")
        
        return success

    def test_admin_authentication(self):
        """Test Admin Authentication"""
        self.log("\n=== 2. TESTING ADMIN AUTHENTICATION ===")
        
        # Test admin login
        success, response = self.run_test(
            "Admin Login (POST /api/auth/login)",
            "POST",
            f"{self.backend_url}/auth/login",
            200,
            data={"email": "admin@testfirma.de", "password": "Test123!"},
            use_token=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            user_data = response.get('user', {})
            self.log(f"✅ Admin login successful for {user_data.get('email')}")
            
            # Test auth/me endpoint
            success, me_response = self.run_test(
                "Get Current User (GET /api/auth/me)",
                "GET",
                f"{self.backend_url}/auth/me",
                200
            )
            
            if success and me_response:
                email = me_response.get('email')
                role = me_response.get('role')
                org_name = me_response.get('organization_name')
                self.log(f"✅ Auth/me successful: {email}, role: {role}, org: {org_name}")
            
            return True
        else:
            self.log("❌ Admin login failed")
            return False

    def test_super_admin_authentication(self):
        """Test Super-Admin Authentication"""
        self.log("\n=== 3. TESTING SUPER-ADMIN AUTHENTICATION ===")
        
        # Test Super-Admin login
        success, response = self.run_test(
            "Super-Admin Login (POST /api/auth/login)",
            "POST",
            f"{self.backend_url}/auth/login",
            200,
            data={"email": "jesse@haemmerle.at", "password": "O!@Pr92HWrWYVeFJTp2@VNkV"},
            use_token=False
        )
        
        if success and 'access_token' in response:
            self.super_admin_token = response['access_token']
            user_data = response.get('user', {})
            is_super_admin = user_data.get('is_super_admin', False)
            
            if is_super_admin:
                self.log(f"✅ Super-Admin login successful with is_super_admin: true")
                
                # Store original token and use super admin token for auth/me test
                original_token = self.token
                self.token = self.super_admin_token
                
                # Test auth/me endpoint for Super-Admin
                success, me_response = self.run_test(
                    "Super-Admin Auth/Me (GET /api/auth/me)",
                    "GET",
                    f"{self.backend_url}/auth/me",
                    200
                )
                
                if success and me_response:
                    is_super_admin_me = me_response.get('is_super_admin', False)
                    if is_super_admin_me:
                        self.log("✅ Auth/me correctly returns is_super_admin: true")
                    else:
                        self.log(f"❌ Auth/me failed - is_super_admin: {is_super_admin_me}")
                
                # Restore original token
                self.token = original_token
                return True
            else:
                self.log(f"❌ Super-Admin login failed - is_super_admin: {is_super_admin}")
                return False
        else:
            self.log("❌ Super-Admin login failed")
            return False

    def test_contact_sales_api(self):
        """Test Contact Sales API"""
        self.log("\n=== 4. TESTING CONTACT SALES API ===")
        
        # Test contact sales endpoint
        contact_data = {
            "company": "Test Refactoring GmbH",
            "name": "Test Refactoring User",
            "email": "test.refactoring@example.com",
            "phone": "+49 123 456789",
            "employees": "11-25",
            "message": "Testing contact sales API after refactoring"
        }
        
        success, response = self.run_test(
            "Contact Sales (POST /api/contact/sales)",
            "POST",
            f"{self.backend_url}/contact/sales",
            200,
            data=contact_data,
            use_token=False
        )
        
        if success:
            self.log("✅ Contact sales API working correctly")
            if response:
                message = response.get('message', '')
                self.log(f"   Response: {message}")
        
        return success

    def test_cases_api(self):
        """Test Cases API with Admin Token"""
        self.log("\n=== 5. TESTING CASES API ===")
        
        if not self.token:
            self.log("❌ No admin token available for cases API test")
            return False
        
        success, response = self.run_test(
            "Get Cases (GET /api/cases)",
            "GET",
            f"{self.backend_url}/cases",
            200
        )
        
        if success:
            cases = response if isinstance(response, list) else []
            self.log(f"✅ Cases API working - found {len(cases)} cases")
            
            # Log some case details if available
            for i, case in enumerate(cases[:3]):  # Show first 3 cases
                case_type = case.get('case_type', 'unknown')
                employee_name = case.get('employee_name', 'Unknown')
                status = case.get('status', 'unknown')
                self.log(f"   Case {i+1}: {employee_name} ({case_type}) - {status}")
        
        return success

    def test_templates_api(self):
        """Test Templates API with Admin Token"""
        self.log("\n=== 6. TESTING TEMPLATES API ===")
        
        if not self.token:
            self.log("❌ No admin token available for templates API test")
            return False
        
        success, response = self.run_test(
            "Get Templates (GET /api/templates)",
            "GET",
            f"{self.backend_url}/templates",
            200
        )
        
        if success:
            templates = response if isinstance(response, list) else []
            self.log(f"✅ Templates API working - found {len(templates)} templates")
            
            # Log template details if available
            template_types = {}
            for template in templates:
                template_type = template.get('template_type', 'unknown')
                template_types[template_type] = template_types.get(template_type, 0) + 1
            
            for t_type, count in template_types.items():
                self.log(f"   {t_type}: {count} templates")
        
        return success

    def run_all_tests(self):
        """Run all critical endpoint tests"""
        self.log("🚀 Starting OnboardIQ Backend Refactoring Tests")
        self.log(f"Backend URL: {self.backend_url}")
        self.log(f"Health URL: {self.health_url}")
        
        # Run all tests
        tests = [
            self.test_health_check,
            self.test_admin_authentication,
            self.test_super_admin_authentication,
            self.test_contact_sales_api,
            self.test_cases_api,
            self.test_templates_api
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.log(f"❌ Test {test.__name__} failed with exception: {e}")
                self.failed_tests.append({
                    "test": test.__name__,
                    "error": str(e)
                })
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        self.log("\n" + "="*60)
        self.log("🏁 REFACTORING TEST SUMMARY")
        self.log("="*60)
        self.log(f"Total Tests: {self.tests_run}")
        self.log(f"Passed: {self.tests_passed}")
        self.log(f"Failed: {len(self.failed_tests)}")
        self.log(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            self.log("\n❌ FAILED TESTS:")
            for i, failure in enumerate(self.failed_tests, 1):
                self.log(f"{i}. {failure['test']}")
                if 'expected' in failure:
                    self.log(f"   Expected: {failure['expected']}, Got: {failure['actual']}")
                    self.log(f"   Response: {failure['response']}")
                if 'error' in failure:
                    self.log(f"   Error: {failure['error']}")
        else:
            self.log("\n✅ ALL TESTS PASSED!")
        
        self.log("="*60)

if __name__ == "__main__":
    tester = RefactoringTester()
    tester.run_all_tests()
    
    # Exit with error code if tests failed
    if tester.failed_tests:
        sys.exit(1)
    else:
        sys.exit(0)