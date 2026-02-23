#!/bin/bash
# Production Deployment Automation Script
# Usage: ./deploy.sh [environment]

set -e  # Exit on error

ENVIRONMENT=${1:-production}
echo "🚀 Deploying Abyss Vault Keeper to $ENVIRONMENT..."

# Step 1: Validate environment
echo "✓ Step 1: Validating environment..."
if [ ! -f ".env.$ENVIRONMENT" ]; then
    echo "❌ Error: .env.$ENVIRONMENT not found"
    echo "Please create environment file from .env.example"
    exit 1
  fi

# Step 2: Install dependencies
echo "✓ Step 2: Installing dependencies..."
npm install --legacy-peer-deps

# Step 3: Run linting
echo "✓ Step 3: Running linter..."
npm run lint

# Step 4: Run tests
echo "✓ Step 4: Running tests..."
npm run test

# Step 5: Security audit
echo "✓ Step 5: Checking dependencies..."
npm audit --audit-level=moderate || echo "⚠️  Review vulnerabilities above"

# Step 6: Build for production
echo "✓ Step 6: Building for production..."
npm run build

# Step 7: Verify build output
echo "✓ Step 7: Verifying build output..."
if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed - dist folder not found"
    exit 1
  fi

if [ ! -f "dist/index.html" ]; then
    echo "❌ Error: Build incomplete - index.html not found"
    exit 1
  fi

echo ""
echo "✅ Build Complete!"
echo ""
echo "📊 Build Statistics:"
du -sh dist
find dist -type f | wc -l | xargs echo "Total files:"

echo ""
echo "📦 Build Output:"
ls -lh dist/assets/ | awk '{print $9, "(" $5 ")"}'

echo ""
echo "🚀 Ready for deployment!"
echo ""
echo "Deployment Options:"
echo "1. Vercel:  vercel"
echo "2. Netlify: netlify deploy --prod --dir=dist"
echo "3. Manual:  Copy dist/ folder to your server's web root"
echo ""
