#!/usr/bin/env python3
"""
Minimal test handler for Vercel
"""
import sys

# Force immediate output
sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, 'reconfigure') else None
sys.stderr.reconfigure(line_buffering=True) if hasattr(sys.stderr, 'reconfigure') else None

print("=" * 60, flush=True)
print("MINIMAL HANDLER: Starting", flush=True)
print("=" * 60, flush=True)

try:
    from flask import Flask, jsonify
    print("Flask imported successfully", flush=True)
    
    app = Flask(__name__)
    
    @app.route('/')
    def home():
        return jsonify({'status': 'ok', 'message': 'Minimal handler working'})
    
    @app.route('/<path:path>')
    def catch_all(path):
        return jsonify({'status': 'ok', 'path': path})
    
    print("Flask app created", flush=True)
    handler = app
    print("Handler set", flush=True)
    
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}", flush=True)
    import traceback
    traceback.print_exc(file=sys.stdout)
    traceback.print_exc(file=sys.stderr)
    sys.stdout.flush()
    sys.stderr.flush()
    raise

print("=" * 60, flush=True)
print("MINIMAL HANDLER: Complete", flush=True)
print("=" * 60, flush=True)

