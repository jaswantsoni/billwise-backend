#!/bin/bash

# Script to set up AWS profile for deployment
set -e

echo "🔧 AWS Profile Setup for Serverless Deployment"
echo "=============================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed."
    echo "Please install AWS CLI first:"
    echo "  macOS: brew install awscli"
    echo "  Linux: sudo apt-get install awscli"
    echo "  Windows: Download from https://aws.amazon.com/cli/"
    exit 1
fi

# Get profile name
read -p "Enter AWS profile name (e.g., invoice-backend-prod): " PROFILE_NAME

if [ -z "$PROFILE_NAME" ]; then
    echo "❌ Profile name cannot be empty"
    exit 1
fi

# Check if profile already exists
if aws configure list-profiles | grep -q "^$PROFILE_NAME$"; then
    read -p "⚠️  Profile '$PROFILE_NAME' already exists. Overwrite? (y/N): " OVERWRITE
    if [[ ! $OVERWRITE =~ ^[Yy]$ ]]; then
        echo "❌ Aborted"
        exit 1
    fi
fi

echo ""
echo "📝 Please provide your AWS credentials:"
echo "   (You can find these in AWS Console > IAM > Users > Security Credentials)"

# Get AWS credentials
read -p "AWS Access Key ID: " ACCESS_KEY
read -s -p "AWS Secret Access Key: " SECRET_KEY
echo ""
read -p "Default region (e.g., us-east-1): " REGION
read -p "Default output format (json): " OUTPUT_FORMAT

# Set defaults
REGION=${REGION:-us-east-1}
OUTPUT_FORMAT=${OUTPUT_FORMAT:-json}

# Configure the profile
echo ""
echo "🔧 Configuring AWS profile..."
aws configure set aws_access_key_id "$ACCESS_KEY" --profile "$PROFILE_NAME"
aws configure set aws_secret_access_key "$SECRET_KEY" --profile "$PROFILE_NAME"
aws configure set region "$REGION" --profile "$PROFILE_NAME"
aws configure set output "$OUTPUT_FORMAT" --profile "$PROFILE_NAME"

# Test the profile
echo "🧪 Testing AWS profile..."
if aws sts get-caller-identity --profile "$PROFILE_NAME" > /dev/null 2>&1; then
    echo "✅ AWS profile '$PROFILE_NAME' configured successfully!"
    echo ""
    echo "📋 Profile details:"
    aws configure list --profile "$PROFILE_NAME"
    echo ""
    echo "🚀 You can now deploy using:"
    echo "   ./scripts/deploy.sh $PROFILE_NAME"
else
    echo "❌ Failed to configure AWS profile. Please check your credentials."
    exit 1
fi