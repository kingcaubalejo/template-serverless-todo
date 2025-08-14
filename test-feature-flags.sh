#!/bin/bash

# Feature Flags Test Script
BASE_URL="http://localhost:3000/dev"

echo "🧪 Testing Feature Flags..."

# Test 1: Create a feature flag
echo "1. Creating feature flag..."
curl -X POST "$BASE_URL/feature-flags" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-feature",
    "enabled": true,
    "description": "Test feature flag",
    "percentage": 100
  }' | jq '.'

# Test 2: Check if flag is enabled
echo "2. Checking feature flag status..."
curl -X GET "$BASE_URL/feature-flags/test-feature/check" | jq '.'

# Test 3: List all flags
echo "3. Listing all feature flags..."
curl -X GET "$BASE_URL/feature-flags" | jq '.'

# Test 4: Update flag
echo "4. Updating feature flag..."
curl -X PUT "$BASE_URL/feature-flags/test-feature" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false,
    "description": "Updated test feature flag"
  }' | jq '.'

# Test 5: Check updated flag
echo "5. Checking updated feature flag..."
curl -X GET "$BASE_URL/feature-flags/test-feature/check" | jq '.'

# Test 6: Test percentage rollout
echo "6. Testing percentage rollout..."
curl -X PUT "$BASE_URL/feature-flags/test-feature" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "percentage": 50
  }' | jq '.'

# Test 7: Multiple requests to see percentage rollout
echo "7. Testing percentage rollout with multiple requests..."
for i in {1..5}; do
  echo "Request $i:"
  curl -X GET "$BASE_URL/feature-flags/test-feature/check" | jq '.data.enabled'
done

# Test 8: Clean up
echo "8. Cleaning up test flag..."
curl -X DELETE "$BASE_URL/feature-flags/test-feature" | jq '.'

echo "✅ Feature flags testing complete!"
