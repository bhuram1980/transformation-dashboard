#!/usr/bin/env python3
"""
Vercel serverless function entry point for Flask app
"""

import sys
import os

# Add parent directory to path to import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

# Vercel serverless function handler
def handler(request):
    """Vercel WSGI handler"""
    return app(request.environ, lambda status, headers: None)
