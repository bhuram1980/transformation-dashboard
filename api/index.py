#!/usr/bin/env python3
"""
Vercel serverless function entry point for Flask app
"""

# Wrap everything in try-except to catch ANY error
try:
    import sys
    import os
    from pathlib import Path
    
    # Force immediate output flushing (critical for Vercel logs)
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(line_buffering=True)
            sys.stderr.reconfigure(line_buffering=True)
        except Exception:
            pass
    
    # Print debug info (with flush to both stdout and stderr)
    def log(msg):
        msg_str = str(msg)
        print(msg_str, flush=True)
        sys.stderr.write(msg_str + "\n")
        sys.stderr.flush()
    
    log("=" * 60)
    log("api/index.py: STARTING")
    log("=" * 60)
    
    # Add parent directory to path to import app
    current_dir = Path(__file__).parent
    parent_dir = current_dir.parent
    sys.path.insert(0, str(parent_dir))
    
    log(f"api/index.py: current_dir = {current_dir}")
    log(f"api/index.py: parent_dir = {parent_dir}")
    
    # Change to parent directory so relative paths work
    try:
        os.chdir(str(parent_dir))
        log(f"api/index.py: cwd = {os.getcwd()}")
    except Exception as e:
        log(f"api/index.py: Failed to chdir: {e}")
    
    log(f"api/index.py: VERCEL env = {os.getenv('VERCEL')}")
    log(f"api/index.py: LAMBDA_TASK_ROOT = {os.getenv('LAMBDA_TASK_ROOT')}")
    log(f"api/index.py: public/data exists = {(parent_dir / 'public' / 'data').exists()}")
    
    log("api/index.py: Listing parent_dir contents:")
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
        log(f"app type: {type(app)}")
    except ImportError as e:
        log(f"CRITICAL ImportError: {e}")
        import traceback
        traceback.print_exc(file=sys.stdout)
        traceback.print_exc(file=sys.stderr)
        sys.stdout.flush()
        sys.stderr.flush()
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
        traceback.print_exc(file=sys.stderr)
        sys.stdout.flush()
        sys.stderr.flush()
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
    log("=" * 60)
    log("api/index.py: COMPLETE")
    log("=" * 60)
    
except Exception as e:
    # Last resort - catch ANY error at module level
    import traceback
    error_msg = f"FATAL ERROR in api/index.py: {type(e).__name__}: {e}\n{traceback.format_exc()}"
    print(error_msg, flush=True)
    sys.stderr.write(error_msg)
    sys.stderr.flush()
    
    # Try to create a minimal handler
    try:
        from flask import Flask, jsonify
        app = Flask(__name__)
        @app.route('/<path:path>')
        @app.route('/')
        def error_handler(path=''):
            return jsonify({'error': f'Fatal error during initialization: {str(e)}', 'path': path}), 500
        handler = app
    except Exception:
        # If even Flask can't be imported, we're doomed
        def handler(request):
            return {'statusCode': 500, 'body': f'Fatal initialization error: {str(e)}'}
