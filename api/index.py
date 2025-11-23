#!/usr/bin/env python3
"""
Vercel serverless function entry point for Flask app
"""

from app import app

# Vercel expects a handler function
def handler(request):
    """Vercel WSGI handler"""
    return app(request.environ, lambda status, headers: None)
