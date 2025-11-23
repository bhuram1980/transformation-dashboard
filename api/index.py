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

from app import app

# Vercel expects a handler function
# The @vercel/python runtime automatically handles WSGI apps
# We just need to export the Flask app
handler = app
