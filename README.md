# Transformation Log System

This repository tracks your daily transformation journey and provides automated daily advice based on your progress using **Grok AI**.

## Features

- 📊 **Web Dashboard** - Beautiful visualizations of your transformation progress
- 🤖 **Grok AI Integration** - Get personalized daily advice from Grok
- 📈 **Progress Charts** - Track macros, protein, seafood intake over time
- 📝 **Daily Logging** - Easy-to-use log format in markdown
- 🔥 **Streak Tracking** - See your consecutive days

## Files

- `transformation_log.md` - Your main daily log file (update this daily)
- `app.py` - Flask web application with Grok integration
- `daily_advice.py` - Standalone Python script for command-line advice
- `daily_advice.txt` - Generated daily advice (created when you run the script)
- `templates/dashboard.html` - Web dashboard interface
- `static/` - CSS and JavaScript for the web app

## Quick Start

### 1. Install Dependencies
```bash
pip3 install -r requirements.txt
```

### 2. Set Up Grok API Key (Optional but Recommended)
Get your API key from [xAI](https://x.ai) and set it:
```bash
export GROK_API_KEY="your-api-key-here"
```

Or add it to your shell profile (`~/.zshrc` or `~/.bash_profile`):
```bash
echo 'export GROK_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

### 3. Start the Web App
```bash
python3 app.py
```

Then open your browser to: **http://localhost:5000**

The dashboard will show:
- Your current metrics and progress
- Daily Grok AI advice
- Interactive charts for macros, protein, and seafood intake
- Recent days table
- 7-day averages

### 4. Alternative: Command-Line Advice
If you prefer command-line:
```bash
python3 daily_advice.py
```

### 5. Daily Workflow

1. **Morning**: Open the web dashboard or run `python3 daily_advice.py` for today's Grok advice
2. **Throughout the day**: Log your meals, training, and supplements in `transformation_log.md`
3. **Evening**: Commit your daily log entry:
   ```bash
   git add transformation_log.md
   git commit -m "Day X - [date]"
   ```

## Setting Up Daily Reminders

### Option 1: Cron Job (macOS/Linux)
Add to your crontab (`crontab -e`):
```bash
# Run daily at 7 AM
0 7 * * * cd /Users/jagdish/Documents/DH && /usr/bin/python3 daily_advice.py
```

### Option 2: macOS Launch Agent
Create `~/Library/LaunchAgents/com.transformation.daily.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.transformation.daily</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/jagdish/Documents/DH/daily_advice.py</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>7</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
</dict>
</plist>
```

Then load it:
```bash
launchctl load ~/Library/LaunchAgents/com.transformation.daily.plist
```

## Git Integration

### Push to Remote (Optional)
If you want to sync to GitHub/GitLab:
```bash
git remote add origin <your-repo-url>
git push -u origin main
```

### Daily Git Workflow
```bash
# Check status
git status

# Add changes
git add transformation_log.md

# Commit with date
git commit -m "Day $(date +%d) - $(date +%B\ %Y)"

# Push (if remote configured)
git push
```

## Tips

- **Keep it updated**: Log entries same day for accuracy
- **Be consistent**: Use the daily template in the log file
- **Review advice**: Check `daily_advice.txt` each morning
- **Track photos**: Take weekly progress photos and note dates in log

## Web App Features

### Dashboard Sections

1. **Goal Section** - Your transformation goal displayed prominently
2. **Key Metrics Cards** - Android fat, body fat, ALT, glucose with progress bars
3. **Grok AI Advice** - Personalized daily advice (refresh button to get new advice)
4. **Charts**:
   - Daily Macros (Protein, Carbs, Fat) - Last 7 days
   - Protein Intake Trend - Line chart with target line
   - Seafood Intake - Bar chart with target zone (1.0-1.5kg)
5. **Recent Days Table** - Last 10 days with all metrics
6. **7-Day Averages** - Quick stats summary

### API Endpoints

- `GET /` - Main dashboard
- `GET /api/data` - Get all transformation data (JSON)
- `GET /api/advice` - Get Grok AI advice (JSON)
- `GET /api/stats` - Get 7-day statistics (JSON)

## Requirements

- Python 3.6+ (usually pre-installed on macOS)
- Flask and requests (install via `pip3 install -r requirements.txt`)
- Git (for version control)
- Grok API key (optional but recommended for AI advice)

