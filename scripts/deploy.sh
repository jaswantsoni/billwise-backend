#!/bin/bash

# Deployment script for serverless backend
set -e

echo "🚀 Starting serverless deployment..."

# Check if AWS profile is provided
if [ -z "$1" ]; then
    echo "❌ Error: AWS profile not provided"
    echo "Usage: ./scripts/deploy.sh <aws-profile> [stage] [region]"
    echo "Example: ./scripts/deploy.sh my-aws-profile prod us-east-1"
    exit 1
fi

AWS_PROFILE=$1
STAGE=${2:-dev}
REGION=${3:-us-east-1}

echo "📋 Deployment Configuration:"
echo "   AWS Profile: $AWS_PROFILE"
echo "   Stage: $STAGE"
echo "   Region: $REGION"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if the AWS profile exists
if ! aws configure list-profiles | grep -q "^$AWS_PROFILE$"; then
    echo "❌ AWS profile '$AWS_PROFILE' not found."
    echo "Available profiles:"
    aws configure list-profiles
    exit 1
fi

# Check if serverless is installed
if ! command -v serverless &> /dev/null; then
    echo "📦 Installing Serverless Framework..."
    npm install -g serverless
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Deploy with specified profile
echo "🚀 Deploying to AWS Lambda..."
export AWS_PROFILE=$AWS_PROFILE
serverless deploy --stage $STAGE --region $REGION --verbose

echo "✅ Deployment completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Update your frontend API_BASE_URL to point to the new Lambda endpoint"
echo "2. Test the deployment with: curl https://your-api-gateway-url/health"
echo "3. Monitor logs with: npm run serverless:logs"