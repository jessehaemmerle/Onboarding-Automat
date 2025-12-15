#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Onboarding-Automat MVP
Tests all major API endpoints and functionality
"""

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class OnboardingAutomatTester:
    def __init__(self, base_url="https://startmate.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.template_id = None
        self.case_id = None
        self.task_id = None
        self.owner_role_id = None
        self.offboarding_template_id = None
        self.offboarding_case_id = None
        self.evidence_task_id = None
        self.evidence_id = None

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

    def test_auth_flow(self):
        """Test authentication endpoints"""
        self.log("\n=== TESTING AUTHENTICATION ===")
        
        # Test login with provided credentials
        success, response = self.run_test(
            "Login with test credentials",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@test.de", "password": "test123"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.log(f"✅ Login successful, token acquired")
            
            # Test get current user
            self.run_test(
                "Get current user info",
                "GET",
                "auth/me",
                200
            )
        else:
            self.log("❌ Login failed - cannot proceed with authenticated tests")
            return False
            
        return True

    def test_seed_data(self):
        """Test seed data loading"""
        self.log("\n=== TESTING SEED DATA ===")
        
        success, response = self.run_test(
            "Load seed data",
            "POST",
            "seed",
            200
        )
        
        if success:
            self.log(f"✅ Seed data loaded: {response.get('message', 'Success')}")
        
        return success

    def test_templates(self):
        """Test template management"""
        self.log("\n=== TESTING TEMPLATES ===")
        
        # Get all templates
        success, response = self.run_test(
            "Get all templates",
            "GET",
            "templates",
            200
        )
        
        if success and response:
            templates = response
            if len(templates) > 0:
                # Find onboarding template
                onboarding_templates = [t for t in templates if t.get('template_type') == 'onboarding']
                if onboarding_templates:
                    self.template_id = onboarding_templates[0]['id']
                else:
                    self.template_id = templates[0]['id']
                
                self.log(f"✅ Found {len(templates)} templates")
                
                # Test filtering by template type
                self.run_test(
                    "Get onboarding templates",
                    "GET",
                    "templates?template_type=onboarding",
                    200
                )
                
                self.run_test(
                    "Get offboarding templates",
                    "GET",
                    "templates?template_type=offboarding",
                    200
                )
                
                # Get specific template
                self.run_test(
                    "Get specific template",
                    "GET",
                    f"templates/{self.template_id}",
                    200
                )
                
                # Test duplicate template
                self.run_test(
                    "Duplicate template",
                    "POST",
                    f"templates/{self.template_id}/duplicate",
                    200
                )
            else:
                self.log("⚠️ No templates found after seed data")
        
        return success

    def test_owner_roles(self):
        """Test owner roles management"""
        self.log("\n=== TESTING OWNER ROLES ===")
        
        # Get owner roles
        success, response = self.run_test(
            "Get owner roles",
            "GET",
            "owner-roles",
            200
        )
        
        if success and response:
            roles = response
            self.log(f"✅ Found {len(roles)} owner roles")
            
            if len(roles) > 0:
                self.owner_role_id = roles[0]['id']
        
        # Create new owner role
        test_role_data = {
            "name": f"Test Role {uuid.uuid4().hex[:8]}",
            "emails": ["test@example.com"]
        }
        
        success, response = self.run_test(
            "Create owner role",
            "POST",
            "owner-roles",
            200,
            data=test_role_data
        )
        
        if success and 'id' in response:
            new_role_id = response['id']
            
            # Update the role
            updated_data = {
                "name": test_role_data['name'] + " Updated",
                "emails": ["updated@example.com"]
            }
            
            self.run_test(
                "Update owner role",
                "PUT",
                f"owner-roles/{new_role_id}",
                200,
                data=updated_data
            )
            
            # Delete the test role
            self.run_test(
                "Delete owner role",
                "DELETE",
                f"owner-roles/{new_role_id}",
                200
            )
        
        return True

    def test_onboarding_cases(self):
        """Test onboarding case management"""
        self.log("\n=== TESTING ONBOARDING CASES ===")
        
        if not self.template_id:
            self.log("❌ No template ID available for case creation")
            return False
        
        # Create new onboarding case
        case_data = {
            "employee_name": "Test Employee",
            "employee_email": "test.employee@example.com",
            "template_id": self.template_id,
            "start_date": (datetime.now() + timedelta(days=1)).isoformat(),
            "location": "Berlin",
            "manager_email": "manager@example.com",
            "case_type": "onboarding"
        }
        
        success, response = self.run_test(
            "Create onboarding case",
            "POST",
            "cases",
            200,
            data=case_data
        )
        
        if success and 'id' in response:
            self.case_id = response['id']
            self.log(f"✅ Created case with ID: {self.case_id}")
            
            # Get all cases
            self.run_test(
                "Get all cases",
                "GET",
                "cases",
                200
            )
            
            # Get cases filtered by type
            self.run_test(
                "Get onboarding cases only",
                "GET",
                "cases?case_type=onboarding",
                200
            )
            
            # Get specific case
            success, case_response = self.run_test(
                "Get specific case",
                "GET",
                f"cases/{self.case_id}",
                200
            )
            
            if success and case_response.get('tasks'):
                tasks = case_response['tasks']
                if len(tasks) > 0:
                    self.task_id = tasks[0]['id']
                    self.log(f"✅ Found {len(tasks)} tasks in case")
            
            # Test case status update
            self.run_test(
                "Update case status to completed",
                "PATCH",
                f"cases/{self.case_id}/status?status=completed",
                200
            )
            
            # Test reschedule case
            reschedule_data = {
                "new_start_date": (datetime.now() + timedelta(days=7)).isoformat()
            }
            
            self.run_test(
                "Reschedule case",
                "PATCH",
                f"cases/{self.case_id}/reschedule",
                200,
                data=reschedule_data
            )
        
        return success

    def test_offboarding_cases(self):
        """Test offboarding case management"""
        self.log("\n=== TESTING OFFBOARDING CASES ===")
        
        # Get offboarding templates first
        success, response = self.run_test(
            "Get offboarding templates",
            "GET",
            "templates?template_type=offboarding",
            200
        )
        
        if success and response and len(response) > 0:
            self.offboarding_template_id = response[0]['id']
            self.log(f"✅ Found offboarding template: {self.offboarding_template_id}")
        else:
            self.log("❌ No offboarding templates found")
            return False
        
        # Get employees for offboarding
        success, response = self.run_test(
            "Get employees for offboarding",
            "GET",
            "employees/for-offboarding",
            200
        )
        
        if success:
            employees = response
            self.log(f"✅ Found {len(employees)} employees available for offboarding")
        
        # Create offboarding case
        offboarding_data = {
            "employee_name": "Test Offboarding Employee",
            "employee_email": "test.offboarding@example.com",
            "template_id": self.offboarding_template_id,
            "start_date": (datetime.now() + timedelta(days=30)).isoformat(),  # Exit date
            "location": "Berlin",
            "manager_email": "manager@example.com",
            "case_type": "offboarding",
            "linked_case_id": self.case_id  # Link to onboarding case if available
        }
        
        success, response = self.run_test(
            "Create offboarding case",
            "POST",
            "cases",
            200,
            data=offboarding_data
        )
        
        if success and 'id' in response:
            self.offboarding_case_id = response['id']
            self.log(f"✅ Created offboarding case with ID: {self.offboarding_case_id}")
            
            # Verify case type is offboarding
            success, case_response = self.run_test(
                "Get offboarding case details",
                "GET",
                f"cases/{self.offboarding_case_id}",
                200
            )
            
            if success and case_response:
                case_type = case_response.get('case_type')
                if case_type == 'offboarding':
                    self.log("✅ Case type correctly set to offboarding")
                else:
                    self.log(f"❌ Expected case_type 'offboarding', got '{case_type}'")
                
                # Find a task with evidence_required for testing
                tasks = case_response.get('tasks', [])
                for task in tasks:
                    if task.get('evidence_required'):
                        self.evidence_task_id = task['id']
                        self.log(f"✅ Found evidence-required task: {self.evidence_task_id}")
                        break
            
            # Test filtering offboarding cases
            self.run_test(
                "Get offboarding cases only",
                "GET",
                "cases?case_type=offboarding",
                200
            )
        
        return success

    def test_evidence_upload(self):
        """Test evidence upload functionality"""
        self.log("\n=== TESTING EVIDENCE UPLOAD ===")
        
        if not self.evidence_task_id:
            self.log("❌ No evidence-required task available for testing")
            return False
        
        # Test getting evidence for task (should be empty initially)
        success, response = self.run_test(
            "Get task evidence (empty)",
            "GET",
            f"tasks/{self.evidence_task_id}/evidence",
            200
        )
        
        if success:
            evidence_list = response
            self.log(f"✅ Initial evidence count: {len(evidence_list)}")
        
        # Test task completion without evidence (should fail)
        success, response = self.run_test(
            "Try to complete task without evidence (should fail)",
            "PATCH",
            f"tasks/{self.evidence_task_id}/status?status=done",
            400  # Should fail with 400
        )
        
        if success:
            self.log("✅ Task completion correctly blocked without evidence")
        else:
            self.log("⚠️ Task completion validation may not be working")
        
        # Create a test file content (simulate file upload)
        # Note: This is a simplified test - in real scenario we'd use multipart/form-data
        test_file_content = "This is a test evidence file content"
        
        # For now, we'll test the evidence endpoints exist and return proper status codes
        # The actual file upload would require multipart form data which is complex in this test
        
        return True

    def test_dashboard_with_offboarding(self):
        """Test dashboard with offboarding statistics"""
        self.log("\n=== TESTING DASHBOARD WITH OFFBOARDING STATS ===")
        
        success, response = self.run_test(
            "Get dashboard stats with offboarding",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success and response:
            stats = response
            required_fields = [
                'overdue_tasks', 'due_in_7_days', 'active_cases', 
                'completed_cases', 'active_offboardings', 'completed_offboardings'
            ]
            
            missing_fields = [field for field in required_fields if field not in stats]
            
            if not missing_fields:
                self.log("✅ All 6 KPI fields present in dashboard stats")
                self.log(f"   Active offboardings: {stats.get('active_offboardings', 0)}")
                self.log(f"   Completed offboardings: {stats.get('completed_offboardings', 0)}")
            else:
                self.log(f"❌ Missing KPI fields: {missing_fields}")
                return False
        
        return success

    def test_tasks(self):
        """Test task management"""
        self.log("\n=== TESTING TASKS ===")
        
        if not self.task_id:
            self.log("❌ No task ID available for testing")
            return False
        
        # Get my tasks
        self.run_test(
            "Get my tasks",
            "GET",
            "tasks/my-tasks",
            200
        )
        
        # Update task status to done
        success, response = self.run_test(
            "Mark task as done",
            "PATCH",
            f"tasks/{self.task_id}/status?status=done",
            200
        )
        
        # Update task status back to open
        self.run_test(
            "Reopen task",
            "PATCH",
            f"tasks/{self.task_id}/status?status=open",
            200
        )
        
        # Test task comments
        comment_data = {"body": "This is a test comment"}
        
        success, comment_response = self.run_test(
            "Add task comment",
            "POST",
            f"tasks/{self.task_id}/comments",
            200,
            data=comment_data
        )
        
        # Get task comments
        self.run_test(
            "Get task comments",
            "GET",
            f"tasks/{self.task_id}/comments",
            200
        )
        
        return True

    def test_dashboard(self):
        """Test dashboard statistics"""
        self.log("\n=== TESTING DASHBOARD ===")
        
        success, response = self.run_test(
            "Get dashboard stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success:
            stats = response
            self.log(f"✅ Dashboard stats: {stats}")
        
        return success

    def test_settings(self):
        """Test settings management"""
        self.log("\n=== TESTING SETTINGS ===")
        
        # Get settings
        success, response = self.run_test(
            "Get organization settings",
            "GET",
            "settings",
            200
        )
        
        if success:
            settings = response
            
            # Update settings
            updated_settings = {
                "org_name": "Test Organization Updated",
                "org_timezone": "Europe/Berlin",
                "reminder_days_before": 5,
                "reminder_days_after": 3
            }
            
            self.run_test(
                "Update organization settings",
                "PUT",
                "settings",
                200,
                data=updated_settings
            )
        
        return success

    def test_pdf_report(self):
        """Test PDF report generation"""
        self.log("\n=== TESTING PDF REPORT ===")
        
        if not self.case_id:
            self.log("❌ No case ID available for PDF report")
            return False
        
        # Test PDF report download
        success, response = self.run_test(
            "Generate PDF report",
            "GET",
            f"cases/{self.case_id}/report",
            200
        )
        
        return success

    def test_users(self):
        """Test user management"""
        self.log("\n=== TESTING USER MANAGEMENT ===")
        
        # Get all users
        success, response = self.run_test(
            "Get all users",
            "GET",
            "users",
            200
        )
        
        if success and response:
            users = response
            self.log(f"✅ Found {len(users)} users")
        
        return success

    def run_all_tests(self):
        """Run comprehensive test suite"""
        self.log("🚀 Starting Onboarding-Automat Backend API Tests")
        self.log(f"Base URL: {self.base_url}")
        
        # Test authentication first
        if not self.test_auth_flow():
            self.log("❌ Authentication failed - stopping tests")
            return False
        
        # Run all test suites
        test_suites = [
            self.test_seed_data,
            self.test_templates,
            self.test_owner_roles,
            self.test_onboarding_cases,
            self.test_offboarding_cases,
            self.test_evidence_upload,
            self.test_tasks,
            self.test_dashboard_with_offboarding,
            self.test_settings,
            self.test_users,
            self.test_pdf_report
        ]
        
        for test_suite in test_suites:
            try:
                test_suite()
            except Exception as e:
                self.log(f"❌ Test suite failed with error: {str(e)}")
        
        # Print final results
        self.print_results()
        
        return self.tests_passed == self.tests_run

    def print_results(self):
        """Print test results summary"""
        self.log("\n" + "="*50)
        self.log("📊 TEST RESULTS SUMMARY")
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
    tester = OnboardingAutomatTester()
    
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