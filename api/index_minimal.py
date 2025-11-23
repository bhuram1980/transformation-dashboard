#!/usr/bin/env python3
"""
Minimal test handler for Vercel - using Vercel's recommended pattern
"""
import sys
import os

# Write to stderr immediately (Vercel captures this better)
def log(msg):
    msg_str = str(msg) + "\n"
    sys.stderr.write(msg_str)
    sys.stderr.flush()
    sys.stdout.write(msg_str)
    sys.stdout.flush()

log("=" * 60)
log("MINIMAL HANDLER: Starting")
log(f"Python: {sys.version}")
log(f"CWD: {os.getcwd()}")
log("=" * 60)

try:
    log("Importing Flask...")
    from flask import Flask, jsonify
    log("✓ Flask imported")
    
    log("Creating Flask app...")
    app = Flask(__name__)
    log("✓ Flask app created")
    
    @app.route('/')
    def home():
        log("Route / called")
        return jsonify({'status': 'ok', 'message': 'Minimal handler working'})
    
    @app.route('/<path:path>')
    def catch_all(path):
        log(f"Route /{path} called")
        return jsonify({'status': 'ok', 'path': path})
    
    log("Routes registered")
    log("Setting handler = app")
    
    # Vercel expects 'handler' to be exported
    handler = app
    
    log("✓ Handler set successfully")
    log("=" * 60)
    log("MINIMAL HANDLER: Complete")
    log("=" * 60)
    
except Exception as e:
    log(f"✗ ERROR: {type(e).__name__}: {e}")
    import traceback
    error_trace = traceback.format_exc()
    log(error_trace)
    sys.stderr.write(error_trace)
    sys.stderr.flush()
    raise

