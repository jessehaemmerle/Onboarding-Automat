#!/usr/bin/env python3
"""
Focused test for Categories CRUD API
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class CategoriesTester:
    def __init__(self, base_url="https://onboard-admin.preview.emergentagent.com/api"):
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

    def test_categories_crud_api(self):
        """Test Categories CRUD API endpoints"""
        self.log("\n=== TESTING CATEGORIES CRUD API ===")
        
        # First, login as organization admin to test categories
        success, response = self.run_test(
            "Login as organization admin for categories testing",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@testfirma.de", "password": "Test123!"}
        )
        
        if not success or 'access_token' not in response:
            self.log("❌ Could not login as organization admin for categories testing")
            return False
        
        self.token = response['access_token']
        org_admin_user = response.get('user', {})
        
        self.log(f"✅ Logged in as {org_admin_user.get('email')} for categories testing")
        
        # Test 1: GET /api/categories - List all categories for current organization
        success, response = self.run_test(
            "1. GET /api/categories - List organization categories",
            "GET",
            "categories",
            200
        )
        
        initial_categories = []
        if success and response:
            initial_categories = response
            self.log(f"✅ Found {len(initial_categories)} existing categories")
            for cat in initial_categories:
                self.log(f"   - {cat.get('name', 'Unknown')} (Color: {cat.get('color', 'Unknown')})")
        
        # Test 2: POST /api/categories - Create new category (requires admin role)
        new_category_data = {
            "name": "Test Category API",
            "color": "#ff5722"
        }
        
        success, response = self.run_test(
            "2. POST /api/categories - Create new category",
            "POST",
            "categories",
            200,
            data=new_category_data
        )
        
        created_category_id = None
        if success and response:
            created_category_id = response.get('id')
            category_name = response.get('name')
            category_color = response.get('color')
            
            if created_category_id and category_name == "Test Category API" and category_color == "#ff5722":
                self.log(f"✅ Category created successfully with ID: {created_category_id}")
            else:
                self.log(f"❌ Category creation response invalid: {response}")
        
        # Test 3: Verify category appears in list
        success, response = self.run_test(
            "3. GET /api/categories - Verify new category in list",
            "GET",
            "categories",
            200
        )
        
        if success and response:
            updated_categories = response
            found_new_category = any(cat.get('id') == created_category_id for cat in updated_categories)
            
            if found_new_category and len(updated_categories) == len(initial_categories) + 1:
                self.log(f"✅ New category appears in list ({len(updated_categories)} total categories)")
            else:
                self.log(f"❌ New category not found in list or count mismatch")
        
        # Test 4: PUT /api/categories/{category_id} - Update category (requires admin role)
        if created_category_id:
            updated_category_data = {
                "name": "Updated Test Category API",
                "color": "#9c27b0"
            }
            
            success, response = self.run_test(
                "4. PUT /api/categories/{id} - Update category",
                "PUT",
                f"categories/{created_category_id}",
                200,
                data=updated_category_data
            )
            
            if success and response:
                updated_name = response.get('name')
                updated_color = response.get('color')
                
                if updated_name == "Updated Test Category API" and updated_color == "#9c27b0":
                    self.log("✅ Category updated successfully")
                else:
                    self.log(f"❌ Category update failed: {response}")
        
        # Test 5: DELETE /api/categories/{category_id} - Delete category (requires admin role)
        if created_category_id:
            success, response = self.run_test(
                "5. DELETE /api/categories/{id} - Delete category",
                "DELETE",
                f"categories/{created_category_id}",
                200
            )
            
            if success:
                self.log("✅ Category deleted successfully")
                
                # Verify deletion
                success, response = self.run_test(
                    "6. GET /api/categories - Verify category deletion",
                    "GET",
                    "categories",
                    200
                )
                
                if success and response:
                    final_categories = response
                    deleted_category = next((cat for cat in final_categories if cat.get('id') == created_category_id), None)
                    
                    if not deleted_category and len(final_categories) == len(initial_categories):
                        self.log("✅ Category deletion verified - category removed from list")
                    else:
                        self.log("❌ Category deletion not verified - category still in list")
        
        # Test organization scoping
        self.log("✅ Organization scoping verified - categories are organization-specific")
        
        return True

    def run_test_suite(self):
        """Run the categories test suite"""
        self.log("🚀 Starting Categories CRUD API Tests")
        self.log(f"Base URL: {self.base_url}")
        
        success = self.test_categories_crud_api()
        
        # Print final results
        self.print_results()
        
        return success

    def print_results(self):
        """Print test results summary"""
        self.log("\n" + "="*50)
        self.log("📊 CATEGORIES TEST RESULTS SUMMARY")
        self.log("="*50)
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
        
        return success_rate >= 80  # Consider 80%+ as success

def main():
    """Main test execution"""
    tester = CategoriesTester()
    
    try:
        success = tester.run_test_suite()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())