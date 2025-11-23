# 🔑 How to Set Grok API Key

## Quick Setup for Vercel (Production)

### Step 1: Get Your Grok API Key
1. Go to [xAI Console](https://console.x.ai) or [xAI API](https://x.ai/api)
2. Sign in with your account
3. Navigate to **API Keys** section
4. Create a new API key or copy an existing one

### Step 2: Add to Vercel Environment Variables

**Option A: Via Vercel Dashboard (Easiest)**
1. Go to: https://vercel.com/bhuram1980s-projects/transformation-dashboard/settings/environment-variables
2. Click **"Add New"**
3. Enter:
   - **Key**: `GROK_API_KEY`
   - **Value**: `your-api-key-here` (paste your actual key)
4. Select all environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
5. Click **"Save"**

**Option B: Via Vercel CLI**
```bash
vercel env add GROK_API_KEY
# When prompted, paste your API key
# Select: Production, Preview, Development
```

### Step 3: Redeploy
After adding the environment variable, you need to redeploy:

```bash
vercel --prod
```

Or just push to GitHub (Vercel auto-deploys):
```bash
git commit --allow-empty -m "Trigger redeploy for GROK_API_KEY"
git push
```

### Step 4: Test
1. Go to your dashboard: https://transformation-dashboard-*.vercel.app
2. Click the **"🔄 Refresh"** button in the "Daily Grok Advice" section
3. You should see personalized advice from Grok!

---

## Local Development Setup

If you want to test locally:

### Option 1: Temporary (Current Terminal Session)
```bash
export GROK_API_KEY="your-api-key-here"
python3 app.py
```

### Option 2: Permanent (Add to Shell Config)
```bash
# For zsh (macOS default)
echo 'export GROK_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc

# For bash
echo 'export GROK_API_KEY="your-api-key-here"' >> ~/.bashrc
source ~/.bashrc
```

### Option 3: Create `.env` File (Not Currently Used)
The app doesn't use `.env` files yet, but you could add support. For now, use environment variables directly.

---

## Verify It's Working

### Check in Vercel Dashboard
1. Go to your project settings
2. Check **Environment Variables** tab
3. You should see `GROK_API_KEY` listed

### Check in App
1. Open your dashboard
2. Look at the "Daily Grok Advice" section
3. If you see: "⚠️ Grok API key not configured" → Key is missing
4. If you see personalized advice → Key is working! ✅

---

## Troubleshooting

### "Grok API key not configured"
- ✅ Check `GROK_API_KEY` is set in Vercel environment variables
- ✅ Make sure you selected all environments (Production, Preview, Development)
- ✅ Redeploy after adding the variable

### "Error connecting to Grok API"
- ✅ Verify your API key is correct (no extra spaces)
- ✅ Check your xAI account has API access enabled
- ✅ Check your API key hasn't expired
- ✅ Try generating a new API key

### "API key works locally but not on Vercel"
- ✅ Make sure you added it to Vercel (not just locally)
- ✅ Redeploy after adding the variable
- ✅ Check Vercel deployment logs for errors

---

## Security Notes

- ⚠️ **Never commit API keys to Git** - They're stored in Vercel environment variables only
- ✅ API keys in Vercel are encrypted and secure
- ✅ Each environment (Production/Preview/Development) can have different keys
- ✅ You can rotate keys anytime in xAI console

---

## Need Help?

1. Check Vercel deployment logs: https://vercel.com/bhuram1980s-projects/transformation-dashboard/logs
2. Test API key directly:
   ```bash
   curl https://api.x.ai/v1/chat/completions \
     -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"grok-beta","messages":[{"role":"user","content":"test"}]}'
   ```
3. Check xAI API status: https://status.x.ai

