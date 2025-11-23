#!/bin/bash
# Start the transformation dashboard web app

cd "$(dirname "$0")"

echo "🚀 Starting Transformation Dashboard..."
echo ""

# Check if dependencies are installed
if ! python3 -c "import flask" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip3 install -r requirements.txt
    echo ""
fi

# Check for Grok API key
if [ -z "$GROK_API_KEY" ]; then
    echo "⚠️  Warning: GROK_API_KEY not set"
    echo "   The web app will work, but Grok advice won't be available."
    echo "   Set it with: export GROK_API_KEY='your-key-here'"
    echo ""
fi

echo "🌐 Starting Flask server..."
echo "📊 Dashboard will be available at: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python3 app.py

