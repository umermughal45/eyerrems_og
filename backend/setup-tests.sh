#!/bin/bash

# API Test Suite Setup Script
# This script sets up the test environment and runs the comprehensive API tests

echo "🚀 Setting up API Test Suite..."

# Check if we're in the server directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the server directory"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 &> /dev/null; then
    echo "⚠️  PostgreSQL is not running on localhost:5432"
    echo "   Please start PostgreSQL or update TEST_DATABASE_URL"
fi

# Set up environment variables
echo "📝 Setting up environment variables..."
export NODE_ENV=test
export JWT_SECRET=test-secret-key-for-jwt-signing-very-long-and-secure
export TEST_DATABASE_URL=${TEST_DATABASE_URL:-"postgresql://test:test@localhost:5432/test_db"}

echo "   NODE_ENV: $NODE_ENV"
echo "   TEST_DATABASE_URL: $TEST_DATABASE_URL"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# Check if test database is accessible
echo "🔍 Testing database connection..."
if npx prisma db execute --stdin <<< "SELECT 1;" &> /dev/null; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    echo "   Please check your TEST_DATABASE_URL and ensure the database exists"
    exit 1
fi

# Run a quick test to verify setup
echo "🧪 Running setup verification test..."
if npm test -- --testNamePattern="should" --testPathPattern="setup" --passWithNoTests; then
    echo "✅ Test setup verification passed"
else
    echo "⚠️  Test setup verification had issues, but continuing..."
fi

echo ""
echo "🎉 Test suite setup complete!"
echo ""
echo "Available test commands:"
echo "  npm run test:all          # Run all API tests with detailed report"
echo "  npm run test:api          # Run all API tests"
echo "  npm run test:coverage     # Run tests with coverage report"
echo "  npm run test:auth         # Run authentication tests only"
echo "  npm run test:crm          # Run CRM tests only"
echo "  npm run test:properties   # Run properties tests only"
echo "  npm run test:tenants      # Run tenants tests only"
echo "  npm run test:finance      # Run finance tests only"
echo "  npm run test:employees    # Run employees tests only"
echo ""
echo "To run the comprehensive test suite:"
echo "  npm run test:all"
echo ""

# Ask if user wants to run tests now
read -p "Would you like to run the comprehensive test suite now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Running comprehensive API test suite..."
    npm run test:all
else
    echo "✅ Setup complete. Run 'npm run test:all' when ready to test your API."
fi