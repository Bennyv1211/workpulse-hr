#!/usr/bin/env python3
"""
WorkPulse HR API Testing Script
Tests all the main API endpoints for the HR management system after rebranding
"""

import requests
import json
import sys
from datetime import datetime
import os

# Get backend URL from environment or use default
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://talent-hub-app.preview.emergentagent.com')
BASE_URL = f"{BACKEND_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "test_user@test.com"
TEST_USER_PASSWORD = "test123"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, message, response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "response_data": response_data,
            "timestamp": datetime.now().isoformat()
        })
        
    def test_health_check(self):
        """Test the health check endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_test("Health Check", True, f"API is healthy. Response: {data}")
                    return True
                else:
                    self.log_test("Health Check", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Request failed: {str(e)}")
            return False
    
    def test_user_registration(self):
        """Test user registration endpoint"""
        try:
            user_data = {
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD,
                "first_name": "Test",
                "last_name": "User",
                "role": "employee"
            }
            
            response = self.session.post(f"{BASE_URL}/auth/register", json=user_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.log_test("User Registration", True, f"User registered successfully. User ID: {data['user']['id']}")
                    return True
                else:
                    self.log_test("User Registration", False, f"Missing required fields in response: {data}")
                    return False
            elif response.status_code == 400 and "already registered" in response.text:
                self.log_test("User Registration", True, "User already exists (expected for repeated tests)")
                return True
            else:
                self.log_test("User Registration", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Registration", False, f"Request failed: {str(e)}")
            return False
    
    def test_user_login(self):
        """Test user login and get access token"""
        try:
            login_data = {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
            
            response = self.session.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.access_token = data["access_token"]
                    self.session.headers.update({"Authorization": f"Bearer {self.access_token}"})
                    self.log_test("User Login", True, f"Login successful. User: {data['user']['email']}")
                    return True
                else:
                    self.log_test("User Login", False, f"Missing required fields in response: {data}")
                    return False
            else:
                self.log_test("User Login", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Login", False, f"Request failed: {str(e)}")
            return False
    
    def test_dashboard_stats(self):
        """Test dashboard stats endpoint (requires authentication)"""
        if not self.access_token:
            self.log_test("Dashboard Stats", False, "No access token available")
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/dashboard/stats", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["total_employees", "active_employees", "new_hires_this_month", 
                                 "employees_on_leave", "pending_leave_requests"]
                
                missing_fields = [field for field in required_fields if field not in data]
                if not missing_fields:
                    self.log_test("Dashboard Stats", True, f"Stats retrieved successfully. Total employees: {data['total_employees']}")
                    return True
                else:
                    self.log_test("Dashboard Stats", False, f"Missing fields: {missing_fields}")
                    return False
            else:
                self.log_test("Dashboard Stats", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Dashboard Stats", False, f"Request failed: {str(e)}")
            return False
    
    def test_get_employees(self):
        """Test get employees endpoint (requires authentication)"""
        if not self.access_token:
            self.log_test("Get Employees", False, "No access token available")
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/employees", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Employees", True, f"Retrieved {len(data)} employees")
                    return True
                else:
                    self.log_test("Get Employees", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_test("Get Employees", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Employees", False, f"Request failed: {str(e)}")
            return False
    
    def test_get_departments(self):
        """Test get departments endpoint (requires authentication)"""
        if not self.access_token:
            self.log_test("Get Departments", False, "No access token available")
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/departments", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Departments", True, f"Retrieved {len(data)} departments")
                    return True
                else:
                    self.log_test("Get Departments", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_test("Get Departments", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Departments", False, f"Request failed: {str(e)}")
            return False
    
    def test_get_leave_types(self):
        """Test get leave types endpoint (requires authentication)"""
        if not self.access_token:
            self.log_test("Get Leave Types", False, "No access token available")
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/leave-types", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Leave Types", True, f"Retrieved {len(data)} leave types")
                    return True
                else:
                    self.log_test("Get Leave Types", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_test("Get Leave Types", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Leave Types", False, f"Request failed: {str(e)}")
            return False
    
    def test_get_leave_requests(self):
        """Test get leave requests endpoint (requires authentication)"""
        if not self.access_token:
            self.log_test("Get Leave Requests", False, "No access token available")
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/leave-requests", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Leave Requests", True, f"Retrieved {len(data)} leave requests")
                    return True
                else:
                    self.log_test("Get Leave Requests", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_test("Get Leave Requests", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Leave Requests", False, f"Request failed: {str(e)}")
            return False
    
    def test_get_payroll(self):
        """Test get payroll endpoint (requires authentication)"""
        if not self.access_token:
            self.log_test("Get Payroll", False, "No access token available")
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/payroll", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Payroll", True, f"Retrieved {len(data)} payroll records")
                    return True
                else:
                    self.log_test("Get Payroll", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_test("Get Payroll", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Payroll", False, f"Request failed: {str(e)}")
            return False
    
    def test_get_attendance(self):
        """Test get attendance endpoint (requires authentication)"""
        if not self.access_token:
            self.log_test("Get Attendance", False, "No access token available")
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/attendance", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Attendance", True, f"Retrieved {len(data)} attendance records")
                    return True
                else:
                    self.log_test("Get Attendance", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_test("Get Attendance", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Attendance", False, f"Request failed: {str(e)}")
            return False
    
    def test_clock_in(self):
        """Test clock-in endpoint (requires authentication)"""
        if not self.access_token:
            self.log_test("Clock In", False, "No access token available")
            return False
            
        try:
            clock_in_data = {
                "latitude": 37.7749,
                "longitude": -122.4194,
                "notes": "Test clock-in from API test"
            }
            
            response = self.session.post(f"{BASE_URL}/attendance/clock-in", json=clock_in_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "clock_in" in data:
                    self.log_test("Clock In", True, f"Clock-in successful. Attendance ID: {data['id']}")
                    return True
                else:
                    self.log_test("Clock In", False, f"Missing required fields in response: {data}")
                    return False
            elif response.status_code == 400 and "Already clocked in" in response.text:
                self.log_test("Clock In", True, "Already clocked in today (expected for repeated tests)")
                return True
            elif response.status_code == 400 and "No employee profile found" in response.text:
                self.log_test("Clock In", True, "No employee profile found for test user (expected)")
                return True
            else:
                self.log_test("Clock In", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Clock In", False, f"Request failed: {str(e)}")
            return False
    
    def test_clock_out(self):
        """Test clock-out endpoint (requires authentication)"""
        if not self.access_token:
            self.log_test("Clock Out", False, "No access token available")
            return False
            
        try:
            clock_out_data = {
                "latitude": 37.7749,
                "longitude": -122.4194,
                "notes": "Test clock-out from API test"
            }
            
            response = self.session.post(f"{BASE_URL}/attendance/clock-out", json=clock_out_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "clock_out" in data:
                    self.log_test("Clock Out", True, f"Clock-out successful. Total hours: {data.get('total_hours', 'N/A')}")
                    return True
                else:
                    self.log_test("Clock Out", False, f"Missing required fields in response: {data}")
                    return False
            elif response.status_code == 400 and ("No clock-in record found" in response.text or "Already clocked out" in response.text):
                self.log_test("Clock Out", True, "No clock-in record or already clocked out (expected for test scenario)")
                return True
            elif response.status_code == 400 and "No employee profile found" in response.text:
                self.log_test("Clock Out", True, "No employee profile found for test user (expected)")
                return True
            else:
                self.log_test("Clock Out", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Clock Out", False, f"Request failed: {str(e)}")
            return False
    
    def test_api_title(self):
        """Test that the API title shows WorkPulse HR API"""
        try:
            # Test the health endpoint to verify API title in response
            response = self.session.get(f"{BASE_URL}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("app") == "WorkPulse HR":
                    self.log_test("API Title Check", True, "API correctly identifies as 'WorkPulse HR'")
                    return True
                else:
                    self.log_test("API Title Check", False, f"API identifies as '{data.get('app')}' instead of 'WorkPulse HR'")
                    return False
            else:
                self.log_test("API Title Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("API Title Check", False, f"Request failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all API tests in sequence"""
        print(f"🚀 Starting WorkPulse HR API Tests")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"⏰ Test started at: {datetime.now().isoformat()}")
        print("=" * 60)
        
        # Run tests in order
        tests = [
            self.test_health_check,
            self.test_api_title,
            self.test_user_registration,
            self.test_user_login,
            self.test_dashboard_stats,
            self.test_get_employees,
            self.test_get_departments,
            self.test_get_leave_types,
            self.test_get_leave_requests,
            self.test_get_attendance,
            self.test_get_payroll,
            self.test_clock_in,
            self.test_clock_out
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test.__name__}: Unexpected error: {str(e)}")
                failed += 1
            print("-" * 40)
        
        # Summary
        print("=" * 60)
        print(f"📊 TEST SUMMARY")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        print(f"⏰ Test completed at: {datetime.now().isoformat()}")
        
        # Return success if all critical tests pass
        return failed == 0

def main():
    """Main function to run the tests"""
    tester = APITester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()