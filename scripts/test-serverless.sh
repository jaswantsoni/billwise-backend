#!/bin/bash

# Test script for serverless deployment
set -e

echo "🧪 Testing Serverless Architecture"
echo "=================================="

# Check if dependencies are installed
echo "📦 Checking dependencies..."
if ! npm list serverless-http > /dev/null 2>&1; then
    echo "❌ Serverless dependencies not found. Installing..."
    npm install
fi

# Setup test environment
echo "🔧 Setting up test environment..."
cp .env.test .env.local
export NODE_ENV=test

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Test webpack build
echo "🏗️  Testing webpack build..."
npm run build

# Test serverless offline (in background)
echo "🚀 Starting serverless offline..."
npm run serverless:dev > /tmp/serverless.log 2>&1 &
SERVERLESS_PID=$!

# Wait for serverless to start
echo "⏳ Waiting for serverless to start..."
sleep 10

# Test health endpoint
echo "🩺 Testing health endpoint..."
if curl -s http://localhost:3001/dev/health | grep -q "OK"; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    echo "Serverless logs:"
    tail -20 /tmp/serverless.log
fi

# Test API documentation
echo "📚 Testing API documentation..."
if curl -s http://localhost:3001/dev/api-docs.json | grep -q "swagger"; then
    echo "✅ API documentation accessible"
else
    echo "❌ API documentation not accessible"
fi

# Cleanup
echo "🧹 Cleaning up..."
kill $SERVERLESS_PID 2>/dev/null || true
rm -f /tmp/serverless.log

echo ""
echo "✅ Serverless testing completed!"
echo ""
echo "📝 Next steps:"
echo "1. Configure your AWS profile: ./scripts/setup-aws-profile.sh"
echo "2. Update .env with your production values"
echo "3. Deploy to AWS: ./scripts/deploy.sh your-aws-profile prod"