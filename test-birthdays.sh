#!/bin/bash

# Birthday Feature - Debug Testing Script
# Usage: bash test-birthdays.sh "teacher@example.com"

EMAIL="${1:-}"

if [ -z "$EMAIL" ]; then
    echo "❌ Email is required"
    echo "Usage: bash test-birthdays.sh 'your.email@example.com'"
    exit 1
fi

BASE_URL="http://localhost:3000"
DEBUG_ENDPOINT="${BASE_URL}/api/debug/birthdays?email=${EMAIL}"

echo "🧪 Testing Birthday Feature for: $EMAIL"
echo "📍 Endpoint: $DEBUG_ENDPOINT"
echo ""

# Fetch and display results
echo "⏳ Fetching test results..."
echo ""

curl -s "$DEBUG_ENDPOINT" | jq '.' || {
    echo "❌ Failed to fetch results"
    echo "Make sure:"
    echo "1. Server is running (npm run dev)"
    echo "2. Email is correct"
    echo "3. Replace localhost:3000 with actual URL if needed"
    exit 1
}

echo ""
echo "📋 Test Complete!"
echo ""
echo "What to check:"
echo "✓ gas_birthday_api.ok should be true"
echo "✓ gas_teacher_list.matched_teacher should not be null"
echo "✓ gas_teacher_profile.area should have a value"
echo "✓ database_privacy.settings_exist should be true"
echo "✓ errors array should be empty"
