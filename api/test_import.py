#!/usr/bin/env python3
"""Test if Flask can be imported"""
import sys
sys.stderr.write("Testing Flask import...\n")
sys.stderr.flush()

try:
    from flask import Flask
    sys.stderr.write("SUCCESS: Flask imported\n")
    sys.stderr.flush()
    app = Flask(__name__)
    handler = app
    sys.stderr.write("SUCCESS: Handler created\n")
    sys.stderr.flush()
except Exception as e:
    sys.stderr.write(f"ERROR: {e}\n")
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.stderr.flush()
    raise

