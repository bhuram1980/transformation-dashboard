#!/bin/bash
# Quick deployment helper script

echo "🚀 Transformation Dashboard Deployment Helper"
echo ""

# Check if git remote is set
if ! git remote -v | grep -q "origin"; then
    echo "⚠️  No git remote found. You'll need to:"
    echo "   1. Create a repo on GitHub/GitLab"
    echo "   2. Run: git remote add origin <your-repo-url>"
    echo ""
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "📝 You have uncommitted changes."
    read -p "Commit them now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add -A
        git commit -m "Update before deployment"
    fi
fi

# Push to remote
echo ""
echo "📤 Pushing to remote repository..."
git push origin main || git push origin master

echo ""
echo "✅ Code pushed!"
echo ""
echo "🌐 Next steps for deployment:"
echo ""
echo "Option 1: Render (Recommended)"
echo "  1. Go to https://render.com"
echo "  2. New → Web Service"
echo "  3. Connect your GitHub repo"
echo "  4. Build: pip install -r requirements.txt"
echo "  5. Start: gunicorn app:app"
echo "  6. Add env var: GROK_API_KEY"
echo ""
echo "Option 2: Railway"
echo "  1. Go to https://railway.app"
echo "  2. New Project → Deploy from GitHub"
echo "  3. Add env var: GROK_API_KEY"
echo ""
echo "See DEPLOYMENT.md for detailed instructions!"

