# 📝 Daily Update Guide

## How to Update Your Transformation Log Every Day

### Quick Daily Workflow (5 minutes)

1. **Update the log file** (`transformation_log.md`)
   - Add a new day entry using the template
   - Fill in your meals, macros, training, supplements

2. **Commit to git**:
   ```bash
   git add transformation_log.md
   git commit -m "Day X - $(date +%B\ %d,\ %Y)"
   git push
   ```

3. **That's it!** The web app automatically reads the updated file.

---

## Detailed Steps

### Step 1: Update Your Log

Open `transformation_log.md` and add a new day entry at the end of the "Day-by-Day Log" section:

```markdown
### Day 4 – Nov 24, 2025

**Fasted weight:** 89.5 kg  **Waist:** 95 cm  
**Morning photos:** [ ] Front [ ] Side [ ] Back  

**Meals**  
- Breakfast: 4 whole eggs + veggies (28g P)
- Lunch: 500g salmon + veggies (120g P)
- Shake/Snack: Whey + creatine (27g P)
- Dinner: 600g seabass + skin (140g P)

**Macros**  Protein 415 g  Carbs 38 g  Fat 165 g  kcal 3,200  
**Seafood total:** 1.1 kg (skin on? Y)  
**Training:** 2hr surfing + gym (chest/back)  
**Supplements**  [✓] Omega-3 [✓] NAC×2 [✓] D3+K2 [✓] ZMB [✓] Whey [✓] Creatine  
**Feeling (1–10):** 9  **Notes:** Great energy, feeling strong
```

### Step 2: Save and Commit

**Option A: Command Line**
```bash
cd /Users/jagdish/Documents/DH
git add transformation_log.md
git commit -m "Day 4 - Nov 24, 2025"
git push
```

**Option B: Using the Helper Script**
```bash
./daily.sh
```
This will:
- Generate today's advice
- Open the log file for editing
- Commit when you're done

### Step 3: Verify Update

- **Local**: Refresh http://localhost:5001
- **Deployed**: Refresh your deployed URL (e.g., `https://your-app.onrender.com`)

The dashboard will automatically show:
- Updated streak count
- New day in the recent days table
- Updated charts with new data
- Fresh Grok advice (click refresh button)

---

## Automation Options

### Option 1: Git Hook (Auto-commit on save)

Create `.git/hooks/post-commit`:
```bash
#!/bin/bash
git push origin main
```

Make it executable:
```bash
chmod +x .git/hooks/post-commit
```

### Option 2: macOS Shortcut

Create a Shortcuts app automation:
1. Open Shortcuts app
2. Create new shortcut
3. Add "Run Shell Script" action:
   ```bash
   cd /Users/jagdish/Documents/DH
   git add transformation_log.md
   git commit -m "Daily update - $(date)"
   git push
   ```
4. Add to menu bar or assign keyboard shortcut

### Option 3: Scheduled Reminder

Add to your calendar:
- **Time**: Evening (e.g., 9 PM)
- **Action**: Update transformation log
- **Duration**: 5 minutes

---

## Mobile Access (Update from Phone)

### Option 1: GitHub Mobile App
1. Install GitHub mobile app
2. Edit `transformation_log.md` directly in app
3. Commit and push

### Option 2: VS Code Mobile / GitHub Codespaces
1. Use GitHub Codespaces in browser
2. Edit file
3. Commit via terminal

### Option 3: Git Client Apps
- **Working Copy** (iOS) - Full git client
- **MGit** (Android) - Git client

---

## Best Practices

1. **Update same day** - Don't wait, log while it's fresh
2. **Be consistent** - Use the template format
3. **Include details** - More data = better Grok advice
4. **Commit daily** - Even if incomplete, commit what you have
5. **Review weekly** - Check progress on dashboard

---

## Troubleshooting

### "File not updating on deployed site"
- Make sure you pushed to git: `git push`
- Check deployment logs for errors
- Wait 1-2 minutes for deployment to update

### "Git push failed"
```bash
# Check remote is set
git remote -v

# If not set, add remote:
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

### "Can't remember what to log"
- Check the daily template in `transformation_log.md`
- Review previous days for format
- Use the checklist in the dashboard

---

## Quick Reference

```bash
# Daily update (one command)
cd /Users/jagdish/Documents/DH && git add transformation_log.md && git commit -m "Day $(date +%d) - $(date +%B\ %Y)" && git push

# Or use the helper
./daily.sh
```

---

## Pro Tips

- **Set a daily reminder** on your phone
- **Bookmark the dashboard** URL for quick access
- **Use voice notes** during the day, transcribe to log at night
- **Take photos** weekly and note dates in log
- **Review Grok advice** each morning for motivation

