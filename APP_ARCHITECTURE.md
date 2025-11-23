# 🏗️ Transformation Dashboard - Complete Architecture Documentation

## Overview

This is a **Flask web application** deployed on **Vercel** that visualizes transformation progress data from a markdown log file and provides AI-powered daily advice using Grok API.

**Live URL:** https://transformation-dashboard-*.vercel.app  
**Repository:** https://github.com/bhuram1980/transformation-dashboard

---

## 📁 Project Structure

```
DH/
├── app.py                          # Main Flask application
├── transformation_log.md            # Primary data source (markdown log)
├── requirements.txt                # Python dependencies
├── vercel.json                     # Vercel deployment configuration
├── api/
│   ├── index.py                    # Vercel serverless function entry point
│   ├── upload-token.py             # Photo upload token generator (unused)
│   └── blob-upload.py              # Alternative blob upload handler (unused)
├── templates/
│   ├── dashboard.html              # Main dashboard UI
│   └── login.html                  # Login page (currently unused - auth disabled)
├── static/
│   ├── css/
│   │   └── style.css                 # Dashboard styling
│   └── js/
│       └── dashboard.js            # Client-side JavaScript (charts, uploads, etc.)
├── daily_advice.py                 # Standalone script for daily advice
├── daily.sh                        # Helper script for daily updates
└── Documentation files:
    ├── README.md
    ├── GROK_UPDATE_LOG.md
    ├── ADMIN_LOGIN_SETUP.md
    ├── DATA_FORMAT_COMPARISON.md
    └── APP_ARCHITECTURE.md (this file)
```

---

## 🗄️ Data Storage

### Primary Data Source: `transformation_log.md`

**Location:** Root directory (`/transformation_log.md`)

**Format:** Markdown file with structured sections:
- Baseline metrics (DEXA scan, blood work)
- 60-day targets
- Daily protocol (diet rules, supplements, training)
- Day-by-day log entries

**How it's read:**
- Flask app reads file on each API request
- Parsed by `TransformationLogParser` class using regex
- No database - file-based storage

**How it's updated:**
- **Manual:** Edit file directly, commit to Git
- **Via API:** `/api/update-log` endpoint (returns content for Git commit on Vercel)
- **Local dev:** API can write directly to file

**Git Integration:**
- File is version-controlled in Git
- Changes are committed and pushed
- Vercel auto-deploys on Git push

**Example structure:**
```markdown
### Day 1 – Nov 21, 2025
- Seafood: 1.3–1.4 kg (400 g salmon + 900 g tuna/seabass)
- Protein 395 g | Carbs 50 g | Fat 190 g | 3,620 kcal
- Training: 2.3 hr surfing
- Supplements: All except NAC
- Feeling: Legendary start
```

---

## 📸 Photo Storage

### Storage Location: Vercel Blob Storage

**Service:** Vercel Blob (cloud storage)  
**Store Name:** `transformation-photos`  
**Store ID:** `store_hAVpOQsDOW14w1w5`  
**Region:** `iad1` (US East)

**How photos are uploaded:**
1. User selects photo in dashboard
2. **Client-side compression** (JavaScript) - reduces file size before upload
3. POST to `/api/upload-photo` endpoint
4. Flask app uploads to Vercel Blob using HTTP API
5. Photo URL returned and stored in browser `localStorage` (backup)

**Photo URLs:**
- Format: `https://blob.vercel-storage.com/{filename}`
- Filename: `{timestamp}_{original_filename}`
- Access: Public (anyone with URL can view)

**Backup Storage:**
- Browser `localStorage` - stores photo URLs locally
- Key: `uploadedPhotos` (JSON array)
- Used as fallback if Blob list API fails

**Local Development:**
- Falls back to `static/uploads/` folder if Blob token not set
- Files saved locally for testing

**Photo Retrieval:**
- `/api/photos` endpoint lists photos from:
  1. Vercel Blob list API (primary)
  2. `localStorage` (backup)
  3. Local `static/uploads/` folder (dev fallback)

**Environment Variable:**
- `BLOB_READ_WRITE_TOKEN` - Required for Vercel Blob access

---

## 🏛️ Application Architecture

### Backend: Flask (Python)

**Framework:** Flask  
**Deployment:** Vercel Serverless Functions  
**Entry Point:** `api/index.py` → imports `app.py`

**Key Components:**

1. **TransformationLogParser** (`app.py`)
   - Parses `transformation_log.md`
   - Extracts baseline metrics, targets, daily logs
   - Uses regex pattern matching

2. **API Endpoints:**
   - `GET /` - Dashboard page
   - `GET /api/data` - All transformation data (JSON)
   - `GET /api/advice` - Grok AI advice
   - `GET /api/stats` - Aggregated statistics
   - `GET /api/photos` - List uploaded photos
   - `POST /api/upload-photo` - Upload photo to Vercel Blob
   - `POST /api/update-log` - Update transformation log (for Grok)

3. **Grok Integration:**
   - Function: `get_grok_advice()`
   - API: `https://api.x.ai/v1/chat/completions`
   - Models tried: `grok-beta`, `grok-2`, `grok`
   - Context: Baseline, recent days, targets, protocol

### Frontend: Vanilla JavaScript + Chart.js

**No Framework:** Pure JavaScript (no React/Vue)  
**Charts:** Chart.js (CDN)  
**Styling:** Custom CSS

**Key Features:**
- Real-time data visualization
- Client-side image compression
- Photo gallery with localStorage backup
- Macro calculator
- Responsive design (mobile-friendly)

**Data Flow:**
1. Page loads → Fetch `/api/data`
2. Parse JSON → Render charts
3. User interactions → Update UI
4. Photo upload → Compress → POST to API

---

## 🔧 Technology Stack

### Backend
- **Python 3.x**
- **Flask** - Web framework
- **requests** - HTTP client (for Grok API, Vercel Blob)
- **gunicorn** - Production WSGI server (not used on Vercel)

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling (custom, no framework)
- **JavaScript (ES6+)** - Interactivity
- **Chart.js 4.4.0** - Data visualization

### Deployment
- **Vercel** - Hosting platform
- **Vercel Blob** - Photo storage
- **GitHub** - Version control & auto-deploy

### External Services
- **Grok API (xAI)** - AI advice generation
- **Vercel Blob Storage** - Photo storage

---

## 🔐 Environment Variables

**Required:**
- `GROK_API_KEY` - xAI API key for Grok advice
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob access token

**Optional:**
- `FLASK_SECRET_KEY` - Session encryption (not used - auth disabled)
- `ADMIN_USERNAME` - Admin login username (not used - auth disabled)
- `ADMIN_PASSWORD` - Admin login password (not used - auth disabled)
- `PORT` - Server port (default: 5001 local, auto on Vercel)
- `VERCEL` - Auto-set by Vercel (indicates production environment)

---

## 📊 Data Flow

### Reading Data

```
User visits dashboard
    ↓
Flask app reads transformation_log.md
    ↓
TransformationLogParser extracts data
    ↓
API returns JSON
    ↓
JavaScript renders charts & tables
```

### Uploading Photos

```
User selects photo
    ↓
JavaScript compresses image (client-side)
    ↓
POST /api/upload-photo
    ↓
Flask uploads to Vercel Blob
    ↓
Photo URL returned
    ↓
Stored in localStorage + displayed in gallery
```

### Getting Grok Advice

```
User clicks "Refresh" button
    ↓
GET /api/advice
    ↓
Flask reads transformation_log.md
    ↓
Prepares context (baseline, recent days, targets)
    ↓
POST to Grok API (api.x.ai)
    ↓
Grok generates advice
    ↓
Displayed in dashboard
```

### Updating Log (Grok Integration)

```
Grok generates log entry
    ↓
POST /api/update-log (with markdown content)
    ↓
Flask processes update
    ↓
On Vercel: Returns updated content (for Git commit)
On Local: Writes directly to file
```

---

## 🚀 Deployment

### Vercel Configuration

**File:** `vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "app.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app.py"
    }
  ]
}
```

**How it works:**
- Vercel detects Python project
- Uses `@vercel/python` builder
- Converts Flask app to serverless functions
- All routes go to `app.py`

**Entry Point:** `api/index.py`
- Imports Flask app
- Vercel calls this as serverless function

### Auto-Deployment
- **Trigger:** Git push to `main` branch
- **Process:** Vercel detects push → Builds → Deploys
- **URL:** `https://transformation-dashboard-{hash}.vercel.app`

---

## 📝 Key Files Explained

### `app.py`
- Main Flask application
- Contains all routes and business logic
- Parses markdown log file
- Integrates with Grok API
- Handles photo uploads to Vercel Blob

### `transformation_log.md`
- Primary data source
- Human-readable markdown format
- Contains all metrics, targets, daily logs
- Version-controlled in Git

### `templates/dashboard.html`
- Main UI template
- Includes Chart.js for visualizations
- Photo upload interface
- Macro calculator
- Grok advice display

### `static/js/dashboard.js`
- Client-side logic
- Chart rendering
- Image compression
- Photo upload handling
- Data fetching and display

### `api/index.py`
- Vercel serverless function entry point
- Imports Flask app
- Required for Vercel deployment

---

## 🔄 Current Status

### Authentication
- **Status:** Disabled (public access)
- **Reason:** User requested all features publicly accessible
- **Previous:** Had viewer/admin roles (removed)

### Features Enabled
- ✅ View dashboard (public)
- ✅ Upload photos (public)
- ✅ Get Grok advice (public)
- ✅ View all data and charts (public)

### Data Storage
- ✅ Markdown file (Git version-controlled)
- ✅ Vercel Blob (photo storage)
- ✅ Browser localStorage (photo URL backup)

---

## 🛠️ Development Workflow

### Local Development

```bash
# Install dependencies
pip3 install -r requirements.txt

# Run locally
python3 app.py

# Access at http://localhost:5001
```

### Production Deployment

```bash
# Push to GitHub
git add .
git commit -m "Update"
git push

# Vercel auto-deploys
# Or manually:
vercel --prod
```

### Daily Updates

1. Edit `transformation_log.md`
2. Add new day entry
3. Commit to Git: `git commit -m "Day X"`
4. Push: `git push`
5. Vercel auto-deploys
6. Dashboard updates automatically

---

## 🔌 API Endpoints Reference

### `GET /`
- Returns dashboard HTML page
- Public access

### `GET /api/data`
- Returns all transformation data (JSON)
- Includes: baseline, targets, daily logs, streak, goal
- Public access

### `GET /api/advice`
- Returns Grok AI advice (JSON)
- Requires: `GROK_API_KEY` environment variable
- Public access

### `GET /api/stats`
- Returns aggregated statistics (JSON)
- Includes: averages, totals, recent days
- Public access

### `GET /api/photos`
- Returns list of uploaded photos (JSON)
- Sources: Vercel Blob, localStorage, local files
- Public access

### `POST /api/upload-photo`
- Uploads photo to Vercel Blob
- Requires: `BLOB_READ_WRITE_TOKEN`
- Returns: Photo URL
- Public access

### `POST /api/update-log`
- Updates transformation log file
- Body: `{"type": "append|update_day|replace", "content": "...", "day": 4}`
- On Vercel: Returns updated content (for Git commit)
- On Local: Writes directly to file
- Public access

---

## 📦 Dependencies

**requirements.txt:**
```
Flask==3.0.0
requests==2.31.0
Werkzeug==3.0.1
gunicorn==21.2.0
```

**Frontend (CDN):**
- Chart.js 4.4.0
- No npm/node_modules

---

## 🗂️ Data Locations Summary

| Data Type | Storage Location | Access Method |
|-----------|-----------------|---------------|
| Transformation Log | `transformation_log.md` (Git) | File read/write |
| Photos | Vercel Blob Storage | HTTP API |
| Photo URLs (backup) | Browser localStorage | JavaScript |
| Environment Config | Vercel Environment Variables | Dashboard/CLI |
| Code | GitHub Repository | Git |
| Deployed App | Vercel Serverless Functions | HTTP |

---

## 🔍 How Grok Can Interact

### Reading Data
- Grok can read `transformation_log.md` via Git
- Or call `/api/data` endpoint to get JSON

### Updating Data
- Grok can call `/api/update-log` endpoint
- On Vercel: Returns content for Git commit
- On Local: Writes directly to file

### Generating Advice
- Grok API is called by `/api/advice` endpoint
- Context includes: baseline, recent days, targets
- Returns personalized advice

### Function Calling (Future)
- Can register `update_transformation_log` as Grok function
- Grok can call API directly when user requests update

---

## 🐛 Known Limitations

1. **Vercel Filesystem:** Read-only in production
   - Solution: Return content for Git commit, or use database

2. **Photo List API:** Vercel Blob list API may not work reliably
   - Solution: Use localStorage as backup

3. **File Size:** Serverless function limit (4.5MB)
   - Solution: Client-side image compression before upload

4. **Session Storage:** No persistent sessions (auth disabled anyway)

---

## 📚 Additional Documentation

- `README.md` - Quick start guide
- `GROK_UPDATE_LOG.md` - How Grok can update the log
- `ADMIN_LOGIN_SETUP.md` - Admin authentication (disabled)
- `DATA_FORMAT_COMPARISON.md` - Markdown vs table format
- `DAILY_UPDATE_GUIDE.md` - How to update daily logs

---

## 🎯 Future Enhancements (Potential)

1. **Database Storage** - Replace file with database (Postgres/MongoDB)
2. **Git Auto-Commit** - Automate Git commits from API
3. **Dashboard UI for Grok** - Interface for Grok-assisted updates
4. **Real-time Updates** - WebSocket for live data
5. **Export Features** - CSV/PDF export of data
6. **Mobile App** - Native app for easier updates

---

## 📞 Support & Maintenance

**Repository:** https://github.com/bhuram1980/transformation-dashboard  
**Deployment:** Vercel Dashboard  
**Logs:** Vercel deployment logs

**Key Commands:**
```bash
# Local dev
python3 app.py

# Deploy
vercel --prod

# Check logs
vercel logs
```

---

**Last Updated:** December 2024  
**Version:** 1.0  
**Status:** Production (Public Access)

