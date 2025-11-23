# 🚀 Quick Start Guide

## Start the Web Dashboard

### Option 1: Use the startup script (Recommended)
```bash
./start.sh
```

### Option 2: Manual start
```bash
# Install dependencies (first time only)
pip3 install -r requirements.txt

# Start the app
python3 app.py
```

Then open: **http://localhost:5000**

## Set Up Grok API (Optional)

1. Get your API key from [xAI](https://x.ai)
2. Set it in your terminal:
   ```bash
   export GROK_API_KEY="your-api-key-here"
   ```
3. Or add to `~/.zshrc`:
   ```bash
   echo 'export GROK_API_KEY="your-api-key-here"' >> ~/.zshrc
   source ~/.zshrc
   ```

## What You'll See

- 📊 **Dashboard** with all your metrics
- 🤖 **Grok AI Advice** (if API key is set)
- 📈 **Interactive Charts** for macros, protein, seafood
- 📋 **Recent Days Table** with all your logs
- 📊 **7-Day Averages** summary

## Daily Workflow

1. Open dashboard: `./start.sh` → http://localhost:5000
2. Click "🔄 Refresh" to get new Grok advice
3. Update `transformation_log.md` with today's entry
4. Refresh the dashboard to see updated charts

## Troubleshooting

- **"Flask not found"**: Run `pip3 install -r requirements.txt`
- **"Grok API error"**: Check your API key is set correctly
- **Port 5000 in use**: Change port in `app.py` (last line)

