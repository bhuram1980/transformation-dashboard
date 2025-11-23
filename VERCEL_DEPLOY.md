# 🚀 Deploy to Vercel

## Quick Deploy (2 minutes)

### Option 1: Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already):
   ```bash
   npm i -g vercel
   ```

2. **Login**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   cd /Users/jagdish/Documents/DH
   vercel
   ```
   
   Follow the prompts:
   - Link to existing project? **No** (first time) or **Yes** (updates)
   - Project name: `transformation-dashboard`
   - Directory: `.` (current directory)
   - Override settings? **No**

4. **Set Environment Variable**:
   ```bash
   vercel env add GROK_API_KEY
   ```
   Enter your Grok API key when prompted.

5. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

**Done!** Your app will be live at: `https://transformation-dashboard.vercel.app`

---

### Option 2: Vercel Dashboard (Web UI)

1. **Go to**: https://vercel.com/new
2. **Import Git Repository**:
   - Select `transformation-dashboard` from your GitHub
   - Or paste: `https://github.com/bhuram1980/transformation-dashboard`
3. **Configure**:
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: (leave empty, Vercel auto-detects)
   - **Output Directory**: (leave empty)
4. **Environment Variables**:
   - Add: `GROK_API_KEY` = `your-api-key-here`
5. **Deploy**: Click "Deploy"

---

## After Deployment

### Your App URL
- **Preview**: `https://transformation-dashboard-*.vercel.app`
- **Production**: `https://transformation-dashboard.vercel.app` (after `vercel --prod`)

### Automatic Updates
Every time you push to GitHub:
```bash
git push
```

Vercel automatically deploys a new version! 🎉

---

## Daily Updates Workflow

1. **Update log**:
   ```bash
   # Edit transformation_log.md
   ```

2. **Commit and push**:
   ```bash
   git add transformation_log.md
   git commit -m "Day X - $(date +%B\ %d)"
   git push
   ```

3. **Vercel auto-deploys** (takes ~1-2 minutes)

4. **Check deployment**:
   - Go to Vercel dashboard
   - See deployment status
   - Visit your live URL

---

## Environment Variables

To add/update environment variables:

**Via CLI**:
```bash
vercel env add GROK_API_KEY
vercel env pull  # Pull latest env vars
```

**Via Dashboard**:
1. Go to your project on Vercel
2. Settings → Environment Variables
3. Add/Edit variables
4. Redeploy (or wait for next push)

---

## Custom Domain (Optional)

1. Go to Vercel Dashboard → Your Project
2. Settings → Domains
3. Add your domain
4. Follow DNS instructions

---

## Troubleshooting

### "Module not found" errors
- Make sure all dependencies are in `requirements.txt`
- Vercel installs from `requirements.txt` automatically

### "Static files not loading"
- Check that `static/` and `templates/` folders are in the repo
- Verify `vercel.json` routes are correct

### "Grok API not working"
- Verify `GROK_API_KEY` is set in Vercel environment variables
- Redeploy after adding env vars: `vercel --prod`

### "Build failed"
- Check Vercel build logs in dashboard
- Ensure Python 3.x is specified (Vercel auto-detects)

---

## Pro Tips

- **Preview deployments**: Every push creates a preview URL
- **Production deployments**: Use `vercel --prod` for production
- **Analytics**: Enable in Vercel dashboard for usage stats
- **Logs**: View real-time logs in Vercel dashboard

---

## Quick Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# List deployments
vercel ls

# Remove deployment
vercel remove
```

