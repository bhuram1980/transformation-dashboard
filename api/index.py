#!/usr/bin/env python3
"""
Vercel serverless function entry point for Flask app
Using BaseHTTPRequestHandler pattern that works on Vercel
"""
import sys
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler

# Add parent directory to path to import app
current_dir = Path(__file__).parent
parent_dir = current_dir.parent
sys.path.insert(0, str(parent_dir))

# Change to parent directory so relative paths work
os.chdir(str(parent_dir))

# Import Flask app
try:
    from app import app
except Exception as e:
    # If import fails, create minimal error handler
    from flask import Flask, jsonify
    app = Flask(__name__)
    @app.route('/<path:path>')
    @app.route('/')
    def error_handler(path=''):
        return jsonify({'error': f'App import failed: {str(e)}', 'path': path}), 500

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._handle_request()
    
    def do_POST(self):
        self._handle_request()
    
    def do_PUT(self):
        self._handle_request()
    
    def do_DELETE(self):
        self._handle_request()
    
    def do_PATCH(self):
        self._handle_request()
    
    def _handle_request(self):
        # Convert Vercel's request to WSGI environment
        environ = {
            'REQUEST_METHOD': self.command,
            'PATH_INFO': self.path.split('?')[0],
            'QUERY_STRING': self.path.split('?')[1] if '?' in self.path else '',
            'SERVER_NAME': 'localhost',
            'SERVER_PORT': '80',
            'wsgi.version': (1, 0),
            'wsgi.url_scheme': 'https',
            'wsgi.input': self.rfile,
            'wsgi.errors': sys.stderr,
            'wsgi.multithread': False,
            'wsgi.multiprocess': False,
            'wsgi.run_once': False,
        }
        
        # Add headers to environ
        for header, value in self.headers.items():
            key = 'HTTP_' + header.upper().replace('-', '_')
            environ[key] = value
        
        # Add Content-Length if present
        if 'Content-Length' in self.headers:
            environ['CONTENT_LENGTH'] = self.headers['Content-Length']
        
        # Add Content-Type if present
        if 'Content-Type' in self.headers:
            environ['CONTENT_TYPE'] = self.headers['Content-Type']
        
        # Call Flask app
        response_status = []
        response_headers = []
        
        def start_response(status, headers):
            response_status.append(status)
            response_headers.extend(headers)
        
        # Get response from Flask
        response = app(environ, start_response)
        
        # Parse status code
        status_code = int(response_status[0].split()[0])
        
        # Send response
        self.send_response(status_code)
        
        # Send headers
        for header, value in response_headers:
            self.send_header(header, value)
        self.end_headers()
        
        # Send body
        for chunk in response:
            self.wfile.write(chunk)
