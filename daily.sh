#!/bin/bash
# Daily transformation log helper script

cd "$(dirname "$0")"

echo "📊 Getting your daily transformation advice..."
python3 daily_advice.py

echo ""
echo "📝 Opening transformation log for today's entry..."
echo "   (Update it with your meals, training, and supplements)"
echo ""

# Open the log file in default editor (or you can specify your preferred editor)
if command -v code &> /dev/null; then
    code transformation_log.md
elif command -v nano &> /dev/null; then
    nano transformation_log.md
else
    open transformation_log.md
fi

echo ""
read -p "Press Enter after you've updated your log, then we'll commit it to git..."

# Commit to git
git add transformation_log.md
git commit -m "Day $(date +%d) - $(date +%B\ %Y)"

echo "✅ Log committed to git!"
echo ""
echo "💡 Tip: Run 'git push' if you have a remote repository set up"

