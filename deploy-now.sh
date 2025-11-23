#!/bin/bash
# Quick deployment script - opens deployment pages

echo "🚀 Quick Deploy Options"
echo ""
echo "Choose a platform:"
echo "1. Railway (Recommended - Auto-deploys from GitHub)"
echo "2. Render (Free tier, easy setup)"
echo "3. Fly.io"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
  1)
    echo ""
    echo "📦 Deploying to Railway..."
    echo ""
    echo "Option A: Use Railway GitHub Integration (Easiest)"
    echo "  1. Go to: https://railway.app/new"
    echo "  2. Click 'Deploy from GitHub repo'"
    echo "  3. Select: transformation-dashboard"
    echo "  4. Railway will auto-detect and deploy"
    echo "  5. Add environment variable: GROK_API_KEY"
    echo ""
    echo "Opening Railway..."
    open "https://railway.app/new"
    ;;
  2)
    echo ""
    echo "📦 Deploying to Render..."
    echo ""
    echo "Steps:"
    echo "  1. Sign up/login at render.com"
    echo "  2. New → Web Service"
    echo "  3. Connect GitHub repo: transformation-dashboard"
    echo "  4. Build: pip install -r requirements.txt"
    echo "  5. Start: gunicorn app:app"
    echo "  6. Add env var: GROK_API_KEY"
    echo ""
    echo "Opening Render..."
    open "https://dashboard.render.com/new/web-service"
    ;;
  3)
    echo ""
    echo "📦 Deploying to Fly.io..."
    echo "  Run: fly launch"
    echo ""
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "✅ After deployment, your app will be live!"
echo "   Updates will auto-deploy when you push to GitHub."

