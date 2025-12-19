#!/usr/bin/env python3
"""
Organization-Admin User Management Functions Test
Tests the new organization admin endpoints as requested in the review
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class OrgAdminTester:
    def __init__(self, base_url="https://onboard-genius-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_user_id = None
        self.org_info = None

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if params:
            url += "?" + "&".join([f"{k}={v}" for k, v in params.items()])
            
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

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

    def test_org_admin_login(self):
        """Test login with provided organization admin credentials"""
        self.log("\n=== TESTING ORGANIZATION ADMIN LOGIN ===")
        
        success, response = self.run_test(
            "Login with admin@testfirma.de",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@testfirma.de", "password": "Test123!"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            user_data = response.get('user', {})
            
            self.log(f"✅ Login successful for {user_data.get('email')}")
            self.log(f"   User ID: {user_data.get('id')}")
            self.log(f"   Role: {user_data.get('role')}")
            self.log(f"   Organization: {user_data.get('organization_name')}")
            self.log(f"   Is Super Admin: {user_data.get('is_super_admin', False)}")
            
            return True
        else:
            self.log("❌ Login failed - cannot proceed with organization admin tests")
            return False

    def test_org_info_endpoint(self):
        """Test GET /api/org/info - Get organization information"""
        self.log("\n=== TESTING GET /api/org/info ===")
        
        success, response = self.run_test(
            "GET /api/org/info - Organization information",
            "GET",
            "org/info",
            200
        )
        
        if success and response:
            self.org_info = response
            required_fields = ['user_count', 'user_limit', 'name']
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                self.log(f"✅ All required fields present:")
                self.log(f"   Organization: {response.get('name')}")
                self.log(f"   User Count: {response.get('user_count')}")
                self.log(f"   User Limit: {response.get('user_limit')}")
                return True
            else:
                self.log(f"❌ Missing required fields: {missing_fields}")
                return False
        
        return False

    def test_create_user_endpoint(self):
        """Test POST /api/org/users - Create new user"""
        self.log("\n=== TESTING POST /api/org/users ===")
        
        # Create test user data
        user_data = {
            "name": "Neuer Test Benutzer",
            "email": "neuer@testfirma.de",
            "password": "Test12345!",
            "role": "user"
        }
        
        success, response = self.run_test(
            "POST /api/org/users - Create new user",
            "POST",
            "org/users",
            200,
            data=user_data
        )
        
        if success and response:
            if 'user_id' in response:
                self.created_user_id = response['user_id']
                self.log(f"✅ User created successfully:")
                self.log(f"   User ID: {self.created_user_id}")
                self.log(f"   Email: {response.get('email', user_data['email'])}")
                return True
            else:
                self.log(f"❌ User creation response missing user_id: {response}")
                return False
        
        return False

    def test_get_org_users_endpoint(self):
        """Test GET /api/org/users - Get all organization users"""
        self.log("\n=== TESTING GET /api/org/users ===")
        
        success, response = self.run_test(
            "GET /api/org/users - Get organization users",
            "GET",
            "org/users",
            200
        )
        
        if success and response:
            users = response
            self.log(f"✅ Retrieved {len(users)} organization users")
            
            # Verify our created user is in the list
            if self.created_user_id:
                created_user_found = any(user.get('id') == self.created_user_id for user in users)
                if created_user_found:
                    self.log(f"✅ Created user found in organization user list")
                else:
                    self.log(f"❌ Created user not found in organization user list")
                    return False
            
            return True
        
        return False

    def test_change_user_role_endpoint(self):
        """Test PATCH /api/org/users/{user_id}/role - Change user role"""
        self.log("\n=== TESTING PATCH /api/org/users/{user_id}/role ===")
        
        if not self.created_user_id:
            self.log("❌ No created user ID available for role change test")
            return False
        
        success, response = self.run_test(
            "PATCH /api/org/users/{user_id}/role - Change to admin",
            "PATCH",
            f"org/users/{self.created_user_id}/role",
            200,
            params={"role": "admin"}
        )
        
        if success:
            self.log(f"✅ User role changed to admin successfully")
            
            # Change back to user role
            success2, response2 = self.run_test(
                "PATCH /api/org/users/{user_id}/role - Change back to user",
                "PATCH",
                f"org/users/{self.created_user_id}/role",
                200,
                params={"role": "user"}
            )
            
            if success2:
                self.log(f"✅ User role changed back to user successfully")
                return True
        
        return False

    def test_reset_password_endpoint(self):
        """Test POST /api/org/users/{user_id}/reset-password - Reset user password"""
        self.log("\n=== TESTING POST /api/org/users/{user_id}/reset-password ===")
        
        if not self.created_user_id:
            self.log("❌ No created user ID available for password reset test")
            return False
        
        success, response = self.run_test(
            "POST /api/org/users/{user_id}/reset-password - Reset password",
            "POST",
            f"org/users/{self.created_user_id}/reset-password",
            200,
            params={"new_password": "NeuesPasswort123!"}
        )
        
        if success:
            self.log(f"✅ User password reset successfully")
            return True
        
        return False

    def test_block_user_endpoint(self):
        """Test PATCH /api/org/users/{user_id}/status - Block user"""
        self.log("\n=== TESTING PATCH /api/org/users/{user_id}/status ===")
        
        if not self.created_user_id:
            self.log("❌ No created user ID available for status change test")
            return False
        
        # Block user
        success, response = self.run_test(
            "PATCH /api/org/users/{user_id}/status - Block user",
            "PATCH",
            f"org/users/{self.created_user_id}/status",
            200,
            params={"status": "blocked"}
        )
        
        if success:
            self.log(f"✅ User blocked successfully")
            
            # Unblock user (restore to active)
            success2, response2 = self.run_test(
                "PATCH /api/org/users/{user_id}/status - Unblock user",
                "PATCH",
                f"org/users/{self.created_user_id}/status",
                200,
                params={"status": "active"}
            )
            
            if success2:
                self.log(f"✅ User unblocked successfully")
                return True
        
        return False

    def test_delete_user_endpoint(self):
        """Test DELETE /api/org/users/{user_id} - Delete user"""
        self.log("\n=== TESTING DELETE /api/org/users/{user_id} ===")
        
        if not self.created_user_id:
            self.log("❌ No created user ID available for deletion test")
            return False
        
        success, response = self.run_test(
            "DELETE /api/org/users/{user_id} - Delete user",
            "DELETE",
            f"org/users/{self.created_user_id}",
            200
        )
        
        if success:
            self.log(f"✅ User deleted successfully")
            
            # Verify user is no longer in organization user list
            success2, response2 = self.run_test(
                "Verify user deletion - GET /api/org/users",
                "GET",
                "org/users",
                200
            )
            
            if success2 and response2:
                users = response2
                deleted_user_found = any(user.get('id') == self.created_user_id for user in users)
                if not deleted_user_found:
                    self.log(f"✅ Deleted user no longer appears in organization user list")
                    return True
                else:
                    self.log(f"❌ Deleted user still appears in organization user list")
                    return False
        
        return False

    def run_all_tests(self):
        """Run all organization admin tests in sequence"""
        self.log("🚀 Starting Organization-Admin User Management Tests")
        self.log(f"Base URL: {self.base_url}")
        
        # Test sequence as specified in review request
        test_sequence = [
            ("Login", self.test_org_admin_login),
            ("Organization Info", self.test_org_info_endpoint),
            ("Create User", self.test_create_user_endpoint),
            ("Get Organization Users", self.test_get_org_users_endpoint),
            ("Change User Role", self.test_change_user_role_endpoint),
            ("Reset Password", self.test_reset_password_endpoint),
            ("Block/Unblock User", self.test_block_user_endpoint),
            ("Delete User", self.test_delete_user_endpoint)
        ]
        
        all_passed = True
        
        for test_name, test_func in test_sequence:
            try:
                result = test_func()
                if not result:
                    all_passed = False
                    self.log(f"❌ {test_name} test failed")
            except Exception as e:
                all_passed = False
                self.log(f"❌ {test_name} test failed with error: {str(e)}")
        
        # Print final results
        self.print_results()
        
        return all_passed

    def print_results(self):
        """Print test results summary"""
        self.log("\n" + "="*60)
        self.log("📊 ORGANIZATION-ADMIN TEST RESULTS")
        self.log("="*60)
        self.log(f"Total Tests: {self.tests_run}")
        self.log(f"Passed: {self.tests_passed}")
        self.log(f"Failed: {len(self.failed_tests)}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"Success Rate: {success_rate:.1f}%")
        
        if self.failed_tests:
            self.log("\n❌ FAILED TESTS:")
            for i, failure in enumerate(self.failed_tests, 1):
                self.log(f"{i}. {failure.get('test', 'Unknown')}")
                if 'error' in failure:
                    self.log(f"   Error: {failure['error']}")
                else:
                    self.log(f"   Expected: {failure.get('expected')}, Got: {failure.get('actual')}")
                    if 'response' in failure:
                        self.log(f"   Response: {failure['response']}")
        
        if success_rate == 100:
            self.log("\n🎉 ALL ORGANIZATION-ADMIN ENDPOINTS WORKING PERFECTLY!")
        elif success_rate >= 80:
            self.log(f"\n✅ Organization-Admin endpoints mostly working ({success_rate:.1f}% success)")
        else:
            self.log(f"\n❌ Organization-Admin endpoints need attention ({success_rate:.1f}% success)")
        
        return success_rate >= 80

def main():
    """Main test execution"""
    tester = OrgAdminTester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())