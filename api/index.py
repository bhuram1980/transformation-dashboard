#!/usr/bin/env python3
"""
Vercel serverless function entry point for Flask app
"""
import sys
import os

# Log to stderr immediately (Vercel captures this)
def log(msg):
    try:
        sys.stderr.write(f"{msg}\n")
        sys.stderr.flush()
    except:
        pass

log("=" * 60)
log("api/index.py: STARTING")
log(f"Python: {sys.version}")
log(f"CWD: {os.getcwd()}")
log("=" * 60)

try:
    log("Importing Flask...")
    from flask import Flask, jsonify, send_from_directory
    log("✓ Flask imported")
    
    log("Creating Flask app...")
    app = Flask(__name__, static_folder='../static', static_url_path='/static')
    log("✓ Flask app created")
    
    @app.route('/')
    def home():
        log("Route / called")
        return jsonify({'status': 'ok', 'message': 'Flask app is working'})
    
    @app.route('/favicon.ico')
    @app.route('/favicon.png')
    def favicon():
        log("Favicon requested")
        # Return 204 No Content to stop browser from retrying
        return '', 204
    
    @app.route('/<path:path>')
    def catch_all(path):
        log(f"Route /{path} called")
        # Don't try to serve static files - let Vercel handle them
        if path.startswith('static/'):
            return '', 404
        return jsonify({'status': 'ok', 'path': path})
    
    log("Routes registered")
    log("Setting handler = app")
    
    # Export handler for Vercel
    handler = app
    
    log("=" * 60)
    log("✓ Flask app initialized successfully")
    log("=" * 60)
    
except Exception as e:
    log(f"✗ FATAL ERROR: {type(e).__name__}: {e}")
    import traceback
    error_trace = traceback.format_exc()
    log(error_trace)
    try:
        sys.stderr.write(error_trace)
        sys.stderr.flush()
    except:
        pass
    # Re-raise to ensure Vercel sees the error
    raise
