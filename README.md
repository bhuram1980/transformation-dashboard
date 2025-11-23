# Transformation Log System

This repository tracks your daily transformation journey and provides automated daily advice based on your progress.

## Files

- `transformation_log.md` - Your main daily log file (update this daily)
- `daily_advice.py` - Python script that analyzes your log and generates personalized advice
- `daily_advice.txt` - Generated daily advice (created when you run the script)

## Quick Start

### 1. Initialize Git (if not already done)
```bash
git init
git add .
git commit -m "Initial transformation log setup"
```

### 2. Get Daily Advice
Run the advice script anytime:
```bash
python3 daily_advice.py
```

This will:
- Read your `transformation_log.md`
- Analyze your recent progress
- Generate personalized advice
- Save it to `daily_advice.txt`

### 3. Daily Workflow

1. **Morning**: Run `python3 daily_advice.py` to get today's advice
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

## Requirements

- Python 3.6+ (usually pre-installed on macOS)
- Git (for version control)

