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
    def __init__(self, base_url="https://onboarding-flow-27.preview.emergentagent.com/api"):
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
        self.rolechange_template_id = None
        self.rolechange_case_id = None

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
            data={"email": "admin@startmate.de", "password": "adminpassword"}
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

    def test_rolechange_flow(self):
        """Test complete rolechange flow implementation"""
        self.log("\n=== TESTING ROLECHANGE FLOW ===")
        
        # Step 1: Create a rolechange template
        rolechange_template_data = {
            "name": "Standard Rollenwechsel",
            "description": "Template für interne Rollenwechsel",
            "template_type": "rolechange",
            "tasks": [
                {
                    "title": "Neue Zugriffsrechte einrichten",
                    "description": "Berechtigungen für neue Rolle konfigurieren",
                    "category": "IT",
                    "owner_role": "IT",
                    "offset_days": -3,
                    "evidence_required": False,
                    "sort_order": 1
                },
                {
                    "title": "Alte Zugriffsrechte entziehen",
                    "description": "Nicht mehr benötigte Berechtigungen entfernen",
                    "category": "Security",
                    "owner_role": "Security",
                    "offset_days": -1,
                    "evidence_required": True,
                    "sort_order": 2
                },
                {
                    "title": "Rollenwechsel-Meeting durchführen",
                    "description": "Übergabegespräch mit Manager",
                    "category": "Manager",
                    "owner_role": "Manager",
                    "offset_days": 0,
                    "evidence_required": False,
                    "sort_order": 3
                }
            ]
        }
        
        success, response = self.run_test(
            "Create rolechange template",
            "POST",
            "templates",
            200,
            data=rolechange_template_data
        )
        
        if success and 'id' in response:
            self.rolechange_template_id = response['id']
            self.log(f"✅ Created rolechange template with ID: {self.rolechange_template_id}")
            
            # Verify template type is correctly set
            template_type = response.get('template_type')
            if template_type == 'rolechange':
                self.log("✅ Template type correctly set to 'rolechange'")
            else:
                self.log(f"❌ Expected template_type 'rolechange', got '{template_type}'")
        else:
            self.log("❌ Failed to create rolechange template")
            return False
        
        # Step 2: Test template filtering by rolechange type
        success, response = self.run_test(
            "Get rolechange templates only",
            "GET",
            "templates?template_type=rolechange",
            200
        )
        
        if success and response:
            rolechange_templates = response
            found_our_template = any(t['id'] == self.rolechange_template_id for t in rolechange_templates)
            if found_our_template:
                self.log(f"✅ Template filtering works - found {len(rolechange_templates)} rolechange templates")
            else:
                self.log("❌ Template filtering failed - our rolechange template not found")
        
        # Step 3: Create a rolechange case
        rolechange_case_data = {
            "employee_name": "Max Mustermann",
            "employee_email": "max.mustermann@startmate.de",
            "template_id": self.rolechange_template_id,
            "start_date": (datetime.now() + timedelta(days=7)).isoformat(),  # Transition date
            "location": "Berlin",
            "manager_email": "manager@startmate.de",
            "case_type": "rolechange",
            "old_role": "Junior Developer",
            "new_role": "Senior Developer"
        }
        
        success, response = self.run_test(
            "Create rolechange case",
            "POST",
            "cases",
            200,
            data=rolechange_case_data
        )
        
        if success and 'id' in response:
            self.rolechange_case_id = response['id']
            self.log(f"✅ Created rolechange case with ID: {self.rolechange_case_id}")
            
            # Verify rolechange-specific fields
            case_type = response.get('case_type')
            old_role = response.get('old_role')
            new_role = response.get('new_role')
            
            if case_type == 'rolechange':
                self.log("✅ Case type correctly set to 'rolechange'")
            else:
                self.log(f"❌ Expected case_type 'rolechange', got '{case_type}'")
            
            if old_role == 'Junior Developer':
                self.log("✅ Old role correctly stored")
            else:
                self.log(f"❌ Expected old_role 'Junior Developer', got '{old_role}'")
            
            if new_role == 'Senior Developer':
                self.log("✅ New role correctly stored")
            else:
                self.log(f"❌ Expected new_role 'Senior Developer', got '{new_role}'")
            
            # Verify tasks were created
            tasks = response.get('tasks', [])
            if len(tasks) == 3:
                self.log(f"✅ All {len(tasks)} tasks created from template")
            else:
                self.log(f"❌ Expected 3 tasks, got {len(tasks)}")
        else:
            self.log("❌ Failed to create rolechange case")
            return False
        
        # Step 4: Test case retrieval with rolechange fields
        success, response = self.run_test(
            "Get rolechange case details",
            "GET",
            f"cases/{self.rolechange_case_id}",
            200
        )
        
        if success and response:
            case_type = response.get('case_type')
            old_role = response.get('old_role')
            new_role = response.get('new_role')
            
            if case_type == 'rolechange' and old_role == 'Junior Developer' and new_role == 'Senior Developer':
                self.log("✅ Rolechange case retrieval with all fields working correctly")
            else:
                self.log(f"❌ Case retrieval failed - type: {case_type}, old: {old_role}, new: {new_role}")
        
        # Step 5: Test case filtering by rolechange type
        success, response = self.run_test(
            "Get rolechange cases only",
            "GET",
            "cases?case_type=rolechange",
            200
        )
        
        if success and response:
            rolechange_cases = response
            found_our_case = any(c['id'] == self.rolechange_case_id for c in rolechange_cases)
            if found_our_case:
                self.log(f"✅ Case filtering works - found {len(rolechange_cases)} rolechange cases")
            else:
                self.log("❌ Case filtering failed - our rolechange case not found")
        
        return success

    def test_dashboard_with_rolechanges(self):
        """Test dashboard statistics with rolechange counts"""
        self.log("\n=== TESTING DASHBOARD WITH ROLECHANGE STATS ===")
        
        success, response = self.run_test(
            "Get dashboard stats with rolechanges",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success and response:
            stats = response
            required_fields = [
                'overdue_tasks', 'due_in_7_days', 'active_cases', 
                'completed_cases', 'active_offboardings', 'completed_offboardings',
                'active_rolechanges', 'completed_rolechanges'
            ]
            
            missing_fields = [field for field in required_fields if field not in stats]
            
            if not missing_fields:
                self.log("✅ All 8 KPI fields present in dashboard stats")
                self.log(f"   Active rolechanges: {stats.get('active_rolechanges', 0)}")
                self.log(f"   Completed rolechanges: {stats.get('completed_rolechanges', 0)}")
                
                # Verify we have at least 1 active rolechange from our test
                if stats.get('active_rolechanges', 0) >= 1:
                    self.log("✅ Dashboard correctly shows active rolechange count")
                else:
                    self.log("⚠️ Expected at least 1 active rolechange in dashboard")
            else:
                self.log(f"❌ Missing KPI fields: {missing_fields}")
                return False
        
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

    def test_audit_logs(self):
        """Test audit log functionality (DSGVO Art. 30)"""
        self.log("\n=== TESTING AUDIT LOGS (DSGVO Art. 30) ===")
        
        # Get audit logs (admin only)
        success, response = self.run_test(
            "Get audit logs",
            "GET",
            "audit-logs",
            200
        )
        
        if success and response:
            logs = response
            self.log(f"✅ Found {logs.get('total', 0)} audit log entries")
            
            # Test pagination
            self.run_test(
                "Get audit logs with pagination",
                "GET",
                "audit-logs?page=1&page_size=10",
                200
            )
            
            # Test filtering by action
            self.run_test(
                "Filter audit logs by action",
                "GET",
                "audit-logs?action=login",
                200
            )
            
            # Test filtering by resource type
            self.run_test(
                "Filter audit logs by resource type",
                "GET",
                "audit-logs?resource_type=auth",
                200
            )
        
        # Test audit log export
        success, response = self.run_test(
            "Export audit logs as CSV",
            "GET",
            "audit-logs/export",
            200
        )
        
        if success:
            self.log("✅ Audit log CSV export successful")
        
        return success

    def test_gdpr_endpoints(self):
        """Test GDPR compliance endpoints"""
        self.log("\n=== TESTING GDPR COMPLIANCE ENDPOINTS ===")
        
        # Test privacy info (Art. 13/14)
        success, response = self.run_test(
            "Get privacy information",
            "GET",
            "gdpr/privacy-info",
            200
        )
        
        if success and response:
            privacy_info = response
            self.log(f"✅ Privacy info loaded with {len(privacy_info.get('rights', []))} rights")
        
        # Test my data (Art. 15 - Right to access)
        success, response = self.run_test(
            "Get my data (Art. 15)",
            "GET",
            "gdpr/my-data",
            200
        )
        
        if success and response:
            my_data = response
            categories = my_data.get('data_categories', [])
            self.log(f"✅ Personal data retrieved with {len(categories)} data categories")
            
            # Verify required data categories are present
            expected_categories = ['Stammdaten', 'Nutzungsdaten', 'Kommunikation', 'Nachweise', 'Protokolldaten']
            found_categories = [cat['category'] for cat in categories]
            
            for expected in expected_categories:
                if expected in found_categories:
                    self.log(f"   ✅ {expected} category present")
                else:
                    self.log(f"   ⚠️ {expected} category missing")
        
        # Test data export JSON (Art. 20 - Data portability)
        success, response = self.run_test(
            "Export personal data as JSON",
            "GET",
            "gdpr/export?format=json",
            200
        )
        
        if success:
            self.log("✅ JSON data export successful")
        
        # Test data export CSV (Art. 20 - Data portability)
        success, response = self.run_test(
            "Export personal data as CSV",
            "GET",
            "gdpr/export?format=csv",
            200
        )
        
        if success:
            self.log("✅ CSV data export successful")
        
        # Test consents (Art. 7)
        success, response = self.run_test(
            "Get user consents",
            "GET",
            "gdpr/consents",
            200
        )
        
        if success and response:
            consents = response
            self.log(f"✅ Found {len(consents)} consent records")
        
        # Test deletion request (Art. 17 - Right to be forgotten)
        deletion_data = {
            "confirm": True,
            "reason": "Test deletion request for GDPR compliance testing"
        }
        
        success, response = self.run_test(
            "Submit deletion request (Art. 17)",
            "POST",
            "gdpr/delete-request",
            200,
            data=deletion_data
        )
        
        if success:
            self.log("✅ Deletion request submitted successfully")
        
        # Test getting deletion requests (admin only)
        success, response = self.run_test(
            "Get deletion requests (admin)",
            "GET",
            "gdpr/deletion-requests",
            200
        )
        
        if success and response:
            requests = response
            self.log(f"✅ Found {len(requests)} deletion requests")
        
        return True

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
            self.test_rolechange_flow,
            self.test_evidence_upload,
            self.test_tasks,
            self.test_dashboard_with_rolechanges,
            self.test_settings,
            self.test_users,
            self.test_audit_logs,
            self.test_gdpr_endpoints,
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