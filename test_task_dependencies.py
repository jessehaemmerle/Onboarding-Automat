#!/usr/bin/env python3
"""
Task Dependencies Backend Testing
Tests the specific task dependencies feature after bug fix
"""

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class TaskDependenciesTester:
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

    def test_task_dependencies_complete_workflow(self):
        """Test complete Task Dependencies workflow after bug fix"""
        self.log("\n=== TESTING TASK DEPENDENCIES BACKEND (AFTER BUG FIX) ===")
        
        # Login as organization admin with provided credentials
        success, response = self.run_test(
            "Login as organization admin",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@testfirma.de", "password": "Test123!"}
        )
        
        if not success or 'access_token' not in response:
            self.log("❌ Could not login as organization admin")
            return False
        
        self.token = response['access_token']
        org_admin_user = response.get('user', {})
        
        self.log(f"✅ Logged in as {org_admin_user.get('email')}")
        
        # Step 1: Create a new template with 2 tasks where Task B depends on Task A
        template_data = {
            "name": "Dependency Test Template",
            "description": "Template to test task dependencies",
            "template_type": "onboarding",
            "tasks": [
                {
                    "id": "task-a-id",  # Stable ID for Task A
                    "title": "Laptop bereitstellen",
                    "description": "Laptop für neuen Mitarbeiter bereitstellen",
                    "category": "IT",
                    "owner_role": "IT",
                    "offset_days": -2,
                    "evidence_required": False,
                    "sort_order": 1,
                    "depends_on": None  # Task A has no dependencies
                },
                {
                    "id": "task-b-id",  # Stable ID for Task B
                    "title": "Software installieren",
                    "description": "Benötigte Software auf Laptop installieren",
                    "category": "IT",
                    "owner_role": "IT",
                    "offset_days": -1,
                    "evidence_required": False,
                    "sort_order": 2,
                    "depends_on": "task-a-id"  # Task B depends on Task A
                }
            ]
        }
        
        success, response = self.run_test(
            "1. Create template with task dependencies",
            "POST",
            "templates",
            200,
            data=template_data
        )
        
        template_id = None
        if success and response:
            template_id = response.get('id')
            template_tasks = response.get('tasks', [])
            
            self.log(f"✅ Template created with ID: {template_id}")
            
            # Verify template tasks have stable IDs and correct dependencies
            task_a = next((t for t in template_tasks if t.get('title') == 'Laptop bereitstellen'), None)
            task_b = next((t for t in template_tasks if t.get('title') == 'Software installieren'), None)
            
            if task_a and task_b:
                task_a_id = task_a.get('id')
                task_b_id = task_b.get('id')
                task_b_depends_on = task_b.get('depends_on')
                
                self.log(f"   Task A ID: {task_a_id}")
                self.log(f"   Task B ID: {task_b_id}")
                self.log(f"   Task B depends_on: {task_b_depends_on}")
                
                if task_a_id and task_b_id and task_b_depends_on == task_a_id:
                    self.log("✅ Template tasks have stable IDs and correct dependencies")
                else:
                    self.log("❌ Template task dependencies not saved correctly")
                    return False
            else:
                self.log("❌ Template tasks not found")
                return False
        else:
            self.log("❌ Failed to create template")
            return False
        
        # Step 2: Verify template is saved correctly by retrieving it
        success, response = self.run_test(
            "2. Get template to verify dependencies saved",
            "GET",
            f"templates/{template_id}",
            200
        )
        
        if success and response:
            template_tasks = response.get('tasks', [])
            task_a = next((t for t in template_tasks if t.get('title') == 'Laptop bereitstellen'), None)
            task_b = next((t for t in template_tasks if t.get('title') == 'Software installieren'), None)
            
            if task_a and task_b and task_b.get('depends_on') == task_a.get('id'):
                self.log("✅ Template dependencies verified after retrieval")
            else:
                self.log("❌ Template dependencies not persisted correctly")
                return False
        
        # Step 3: Create a case from this template
        case_data = {
            "employee_name": "Max Mustermann",
            "employee_email": "max.mustermann@testfirma.de",
            "template_id": template_id,
            "start_date": (datetime.now() + timedelta(days=3)).isoformat(),
            "location": "Berlin",
            "manager_email": "manager@testfirma.de",
            "case_type": "onboarding"
        }
        
        success, response = self.run_test(
            "3. Create case from template with dependencies",
            "POST",
            "cases",
            200,
            data=case_data
        )
        
        case_id = None
        case_task_a_id = None
        case_task_b_id = None
        
        if success and response:
            case_id = response.get('id')
            case_tasks = response.get('tasks', [])
            
            self.log(f"✅ Case created with ID: {case_id}")
            self.log(f"   Case has {len(case_tasks)} tasks")
            
            # Find case tasks
            case_task_a = next((t for t in case_tasks if t.get('title') == 'Laptop bereitstellen'), None)
            case_task_b = next((t for t in case_tasks if t.get('title') == 'Software installieren'), None)
            
            if case_task_a and case_task_b:
                case_task_a_id = case_task_a.get('id')
                case_task_b_id = case_task_b.get('id')
                case_task_a_depends_on = case_task_a.get('depends_on')
                case_task_b_depends_on = case_task_b.get('depends_on')
                case_task_a_blocked = case_task_a.get('is_blocked')
                case_task_b_blocked = case_task_b.get('is_blocked')
                
                self.log(f"   Case Task A ID: {case_task_a_id}")
                self.log(f"   Case Task A depends_on: {case_task_a_depends_on}")
                self.log(f"   Case Task A is_blocked: {case_task_a_blocked}")
                self.log(f"   Case Task B ID: {case_task_b_id}")
                self.log(f"   Case Task B depends_on: {case_task_b_depends_on}")
                self.log(f"   Case Task B is_blocked: {case_task_b_blocked}")
                
                # Verify case task dependencies are correctly mapped
                if case_task_a_depends_on is None:
                    self.log("✅ Task A has no depends_on (correct)")
                else:
                    self.log(f"❌ Task A should have no depends_on, but has: {case_task_a_depends_on}")
                
                if case_task_b_depends_on == case_task_a_id:
                    self.log("✅ Task B depends_on points to case Task A's ID (CRITICAL BUG FIXED)")
                else:
                    self.log(f"❌ CRITICAL BUG: Task B depends_on should be {case_task_a_id}, but is: {case_task_b_depends_on}")
                    return False
                
                if case_task_b_blocked == True:
                    self.log("✅ Task B has is_blocked=true (correct)")
                else:
                    self.log(f"❌ Task B should be blocked, but is_blocked={case_task_b_blocked}")
            else:
                self.log("❌ Case tasks not found")
                return False
        else:
            self.log("❌ Failed to create case")
            return False
        
        # Step 4: Test blocking logic - Try to complete Task B (should fail with 400 error)
        success, response = self.run_test(
            "4. Try to complete Task B (should fail - blocked by dependency)",
            "PATCH",
            f"tasks/{case_task_b_id}/status?status=done",
            400  # Should fail with 400 error
        )
        
        if success:
            self.log("✅ Task B completion correctly blocked with 400 error")
        else:
            self.log("❌ Task B completion should have been blocked but wasn't")
            return False
        
        # Step 5: Complete Task A (should succeed)
        success, response = self.run_test(
            "5. Complete Task A (should succeed)",
            "PATCH",
            f"tasks/{case_task_a_id}/status?status=done",
            200
        )
        
        if success:
            self.log("✅ Task A completed successfully")
        else:
            self.log("❌ Task A completion failed")
            return False
        
        # Step 6: Get case again - Task B should have is_blocked=false
        success, response = self.run_test(
            "6. Get case again - verify Task B is unblocked",
            "GET",
            f"cases/{case_id}",
            200
        )
        
        if success and response:
            case_tasks = response.get('tasks', [])
            case_task_b = next((t for t in case_tasks if t.get('id') == case_task_b_id), None)
            
            if case_task_b:
                task_b_blocked = case_task_b.get('is_blocked')
                self.log(f"   Task B is_blocked after Task A completion: {task_b_blocked}")
                
                if task_b_blocked == False:
                    self.log("✅ Task B is now unblocked (is_blocked=false)")
                else:
                    self.log(f"❌ Task B should be unblocked, but is_blocked={task_b_blocked}")
                    return False
            else:
                self.log("❌ Task B not found in case")
                return False
        
        # Step 7: Complete Task B (should succeed now)
        success, response = self.run_test(
            "7. Complete Task B (should succeed now)",
            "PATCH",
            f"tasks/{case_task_b_id}/status?status=done",
            200
        )
        
        if success:
            self.log("✅ Task B completed successfully after Task A completion")
        else:
            self.log("❌ Task B completion failed even after Task A was completed")
            return False
        
        self.log("✅ Task Dependencies Backend testing completed successfully")
        self.log("🎉 CRITICAL DEPENDENCY MAPPING BUG HAS BEEN FIXED!")
        return True

    def run_tests(self):
        """Run all task dependency tests"""
        self.log("🚀 Starting Task Dependencies Backend Testing...")
        
        success = self.test_task_dependencies_complete_workflow()
        
        # Print summary
        self.log(f"\n📊 TEST SUMMARY:")
        self.log(f"   Tests run: {self.tests_run}")
        self.log(f"   Tests passed: {self.tests_passed}")
        self.log(f"   Tests failed: {len(self.failed_tests)}")
        self.log(f"   Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            self.log(f"\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                self.log(f"   - {test['test']}")
                if 'error' in test:
                    self.log(f"     Error: {test['error']}")
                else:
                    self.log(f"     Expected: {test['expected']}, Got: {test['actual']}")
        
        return success

if __name__ == "__main__":
    tester = TaskDependenciesTester()
    success = tester.run_tests()
    sys.exit(0 if success else 1)