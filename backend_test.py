import requests
import sys
import json
from datetime import datetime

class MetaSearchAPITester:
    def __init__(self, base_url="https://allinone.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_source_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                    elif isinstance(response_data, dict):
                        print(f"   Response keys: {list(response_data.keys())}")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            return success, response.json() if response.text and response.status_code < 500 else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        success, response = self.run_test(
            "API Health Check",
            "GET",
            "",
            200
        )
        return success

    def test_seed_database(self):
        """Test database seeding"""
        success, response = self.run_test(
            "Seed Database",
            "POST",
            "seed",
            200
        )
        return success

    def test_get_all_sources(self):
        """Test getting all sources"""
        success, response = self.run_test(
            "Get All Sources",
            "GET",
            "sources",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} sources")
            if len(response) > 0:
                print(f"   Sample source: {response[0].get('name', 'N/A')}")
        return success, response

    def test_get_sources_by_type(self, content_type="game"):
        """Test getting sources by type"""
        success, response = self.run_test(
            f"Get Sources by Type ({content_type})",
            "GET",
            f"sources/by-type/{content_type}",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} {content_type} sources")
        return success, response

    def test_create_source(self):
        """Test creating a new source"""
        test_source = {
            "name": "Test Platform",
            "type": "game",
            "url_base": "https://test.com/search?q={query}",
            "search_method": "scraping",
            "config": {"default_image": "https://placehold.co/300x400/test"},
            "enabled": True
        }
        
        success, response = self.run_test(
            "Create New Source",
            "POST",
            "sources",
            200,
            data=test_source
        )
        
        if success and 'id' in response:
            self.created_source_id = response['id']
            print(f"   Created source with ID: {self.created_source_id}")
        
        return success, response

    def test_get_single_source(self, source_id):
        """Test getting a single source by ID"""
        success, response = self.run_test(
            "Get Single Source",
            "GET",
            f"sources/{source_id}",
            200
        )
        return success, response

    def test_update_source(self, source_id):
        """Test updating a source"""
        update_data = {
            "name": "Updated Test Platform",
            "enabled": False
        }
        
        success, response = self.run_test(
            "Update Source",
            "PUT",
            f"sources/{source_id}",
            200,
            data=update_data
        )
        return success, response

    def test_delete_source(self, source_id):
        """Test deleting a source"""
        success, response = self.run_test(
            "Delete Source",
            "DELETE",
            f"sources/{source_id}",
            200
        )
        return success, response

    def test_search_functionality(self):
        """Test search functionality"""
        search_request = {
            "query": "GTA",
            "type": "game",
            "source_ids": []  # Empty means search all sources of this type
        }
        
        success, response = self.run_test(
            "Search Functionality (GTA games)",
            "POST",
            "search",
            200,
            data=search_request
        )
        
        if success and isinstance(response, list):
            print(f"   Search returned {len(response)} source results")
            for i, source_result in enumerate(response):
                if isinstance(source_result, dict):
                    source_name = source_result.get('source_name', 'Unknown')
                    items_count = len(source_result.get('items', []))
                    error = source_result.get('error')
                    print(f"   Source {i+1}: {source_name} - {items_count} items" + (f" (Error: {error})" if error else ""))
        
        return success, response

def main():
    print("🚀 Starting MetaSearch API Testing...")
    print("=" * 50)
    
    tester = MetaSearchAPITester()
    
    # Test sequence
    tests_results = []
    
    # 1. Health check
    tests_results.append(("Health Check", tester.test_health_check()))
    
    # 2. Seed database
    tests_results.append(("Seed Database", tester.test_seed_database()))
    
    # 3. Get all sources
    success, sources = tester.test_get_all_sources()
    tests_results.append(("Get All Sources", success))
    
    # 4. Get sources by type for each content type
    content_types = ["game", "movie", "anime"]
    for content_type in content_types:
        success, type_sources = tester.test_get_sources_by_type(content_type)
        tests_results.append((f"Get {content_type.title()} Sources", success))
    
    # 5. Create new source
    success, created_source = tester.test_create_source()
    tests_results.append(("Create Source", success))
    
    # 6. Get single source (if we created one)
    if tester.created_source_id:
        success, single_source = tester.test_get_single_source(tester.created_source_id)
        tests_results.append(("Get Single Source", success))
        
        # 7. Update source
        success, updated_source = tester.test_update_source(tester.created_source_id)
        tests_results.append(("Update Source", success))
        
        # 8. Delete source
        success, delete_result = tester.test_delete_source(tester.created_source_id)
        tests_results.append(("Delete Source", success))
    
    # 9. Search functionality
    success, search_results = tester.test_search_functionality()
    tests_results.append(("Search Functionality", success))
    
    # Print summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    for test_name, result in tests_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n📈 Overall: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())