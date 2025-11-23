#!/usr/bin/env python3
"""
Vercel serverless function entry point for Flask app
"""

import sys
import os
from pathlib import Path

# Add parent directory to path to import app
current_dir = Path(__file__).parent
parent_dir = current_dir.parent
sys.path.insert(0, str(parent_dir))

# Change to parent directory so relative paths work
os.chdir(str(parent_dir))

# Force immediate output flushing (critical for Vercel logs)
import sys
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(line_buffering=True)
        sys.stderr.reconfigure(line_buffering=True)
    except Exception:
        pass

# Print debug info (with flush)
def log(msg):
    print(msg, flush=True)

log(f"api/index.py: current_dir = {current_dir}")
log(f"api/index.py: parent_dir = {parent_dir}")
log(f"api/index.py: cwd = {os.getcwd()}")
log(f"api/index.py: VERCEL env = {os.getenv('VERCEL')}")
log(f"api/index.py: LAMBDA_TASK_ROOT = {os.getenv('LAMBDA_TASK_ROOT')}")
log(f"api/index.py: public/data exists = {(parent_dir / 'public' / 'data').exists()}")
log(f"api/index.py: Listing parent_dir contents:")
try:
    for item in parent_dir.iterdir():
        log(f"  - {item.name} ({'dir' if item.is_dir() else 'file'})")
except Exception as e:
    log(f"  Error listing: {e}")

log("api/index.py: About to import app...")

# @vercel/python automatically handles Flask WSGI apps
# We just need to import and export the app
try:
    from app import app
    log("SUCCESS: Successfully imported Flask app")
except ImportError as e:
    log(f"CRITICAL ImportError: {e}")
    import traceback
    traceback.print_exc(file=sys.stdout)
    sys.stdout.flush()
    # Create a minimal error handler app instead of crashing
    from flask import Flask, jsonify
    app = Flask(__name__)
    @app.route('/<path:path>')
    @app.route('/')
    def error_handler(path=''):
        return jsonify({'error': f'App import failed (ImportError): {str(e)}', 'path': path}), 500
except Exception as e:
    log(f"CRITICAL Exception: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc(file=sys.stdout)
    sys.stdout.flush()
    # Create a minimal error handler app instead of crashing
    from flask import Flask, jsonify
    app = Flask(__name__)
    @app.route('/<path:path>')
    @app.route('/')
    def error_handler(path=''):
        return jsonify({'error': f'App import failed ({type(e).__name__}): {str(e)}', 'path': path}), 500

log("api/index.py: Setting handler = app")

# Vercel expects a handler function
# @vercel/python runtime automatically handles WSGI apps (Flask)
handler = app

log("api/index.py: Handler set successfully")
