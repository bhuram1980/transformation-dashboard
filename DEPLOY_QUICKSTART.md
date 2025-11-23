# ⚡ Quick Deploy (5 Minutes)

## Step 1: Push to GitHub

```bash
# If you haven't created a repo yet:
# 1. Go to github.com and create a new repository
# 2. Then run:

git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Or use the helper:
```bash
./deploy.sh
```

## Step 2: Deploy to Render (Easiest)

1. **Go to**: https://render.com
2. **Sign up** (free, use GitHub login)
3. **Click**: "New +" → "Web Service"
4. **Connect**: Your GitHub repository
5. **Configure**:
   - **Name**: `transformation-dashboard`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Plan**: Free
6. **Environment Variables**:
   - Click "Environment" tab
   - Add: `GROK_API_KEY` = `your-api-key-here`
7. **Deploy**: Click "Create Web Service"

**Done!** Your app will be live at: `https://transformation-dashboard.onrender.com`

---

## Step 3: Daily Updates

Every day, just:

```bash
# 1. Update transformation_log.md
# 2. Commit and push:
git add transformation_log.md
git commit -m "Day X - $(date +%B\ %d)"
git push
```

The deployed app automatically updates! 🎉

---

## Alternative: Railway (Also Easy)

1. Go to https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Select your repo
4. Add environment variable: `GROK_API_KEY`
5. Done! Auto-deploys on every push.

---

## Need Help?

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions and troubleshooting.

