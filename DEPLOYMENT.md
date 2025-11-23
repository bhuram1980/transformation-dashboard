# 🚀 Deployment Guide

## Quick Deploy Options

### Option 1: Render (Recommended - Free Tier Available)

1. **Sign up** at [render.com](https://render.com) (free account)

2. **Create a new Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub/GitLab repository
   - Or use "Public Git repository" and paste: `https://github.com/yourusername/transformation-log`

3. **Configure the service**:
   - **Name**: `transformation-dashboard`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt && pip install gunicorn`
   - **Start Command**: `gunicorn app:app`
   - **Plan**: Free

4. **Add Environment Variable**:
   - Go to "Environment" tab
   - Add: `GROK_API_KEY` = `your-api-key-here`

5. **Deploy**: Click "Create Web Service"

Your app will be live at: `https://transformation-dashboard.onrender.com`

---

### Option 2: Railway (Also Free Tier)

1. **Sign up** at [railway.app](https://railway.app)

2. **Create new project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo" (or upload files)

3. **Configure**:
   - Railway auto-detects Python
   - Add environment variable: `GROK_API_KEY`

4. **Deploy**: Railway auto-deploys on git push

Your app will be live at: `https://your-project-name.railway.app`

---

### Option 3: Fly.io (Free Tier)

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login**:
   ```bash
   fly auth login
   ```

3. **Create app**:
   ```bash
   fly launch
   ```

4. **Set environment variable**:
   ```bash
   fly secrets set GROK_API_KEY=your-api-key-here
   ```

5. **Deploy**:
   ```bash
   fly deploy
   ```

---

### Option 4: PythonAnywhere (Free Tier)

1. **Sign up** at [pythonanywhere.com](https://www.pythonanywhere.com)

2. **Upload files** via Files tab

3. **Create Web App**:
   - Go to Web tab
   - Click "Add a new web app"
   - Choose Flask
   - Point to your `app.py`

4. **Set environment variable** in Web tab → WSGI configuration

---

## Update Requirements for Production

For production deployment, you'll need `gunicorn`. Update `requirements.txt`:

```bash
echo "gunicorn==21.2.0" >> requirements.txt
```

Or install it:
```bash
pip install gunicorn
```

---

## Post-Deployment Checklist

- [ ] App is accessible via public URL
- [ ] GROK_API_KEY is set in environment variables
- [ ] Dashboard loads correctly
- [ ] Charts display data
- [ ] Grok advice works (test refresh button)

---

## Custom Domain (Optional)

Most platforms allow custom domains:
- **Render**: Settings → Custom Domain
- **Railway**: Settings → Domains
- **Fly.io**: `fly domains add yourdomain.com`

---

## Troubleshooting

### "Module not found: gunicorn"
```bash
pip install gunicorn
# Add to requirements.txt
echo "gunicorn==21.2.0" >> requirements.txt
```

### "Port already in use"
The deployment platform sets `PORT` environment variable automatically. Our app uses port 5001 locally, but production uses the platform's port.

### "Grok API not working"
- Verify `GROK_API_KEY` is set in environment variables
- Check API key is valid
- Review deployment logs for errors

---

## Monitoring

- **Render**: View logs in dashboard
- **Railway**: View logs in dashboard
- **Fly.io**: `fly logs`

