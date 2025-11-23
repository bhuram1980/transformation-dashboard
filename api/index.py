#!/usr/bin/env python3
"""
Vercel serverless function entry point for Flask app
Using the simplest possible approach
"""
from flask import Flask, jsonify
import sys
import os

# Log to stderr (Vercel captures this)
def log(msg):
    sys.stderr.write(f"{msg}\n")
    sys.stderr.flush()

log("Starting Flask app initialization...")

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({'status': 'ok', 'message': 'Flask app is working'})

@app.route('/<path:path>')
def catch_all(path):
    return jsonify({'status': 'ok', 'path': path})

# Export handler for Vercel
handler = app

log("Flask app initialized successfully")
