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

# Debug: Log paths for troubleshooting
import sys
sys.stderr.write(f"api/index.py: current_dir = {current_dir}\n")
sys.stderr.write(f"api/index.py: parent_dir = {parent_dir}\n")
sys.stderr.write(f"api/index.py: cwd = {os.getcwd()}\n")
sys.stderr.write(f"api/index.py: public/data exists = {(parent_dir / 'public' / 'data').exists()}\n")
sys.stderr.flush()

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
        try:
            # Parse path and query string
            path_parts = self.path.split('?', 1)
            path = path_parts[0]
            query_string = path_parts[1] if len(path_parts) > 1 else ''
            
            # On Vercel, static files in public/ should be served automatically
            # But if they reach here (shouldn't happen), let Flask serve them
            # Flask's static_folder is set to 'public/static' so it can serve them
            
            # Read request body if present
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else b''
            
            # Convert Vercel's request to WSGI environment
            environ = {
                'REQUEST_METHOD': self.command,
                'PATH_INFO': path,
                'QUERY_STRING': query_string,
                'SERVER_NAME': 'localhost',
                'SERVER_PORT': '80',
                'wsgi.version': (1, 0),
                'wsgi.url_scheme': 'https',
                'wsgi.input': type('obj', (object,), {
                    'read': lambda size=-1: body[:size] if size > 0 else body,
                    'readline': lambda: b'',
                })(),
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
            status_code = int(response_status[0].split()[0]) if response_status else 200
            
            # Send response
            self.send_response(status_code)
            
            # Send headers
            for header, value in response_headers:
                self.send_header(header, value)
            self.end_headers()
            
            # Send body
            for chunk in response:
                if isinstance(chunk, bytes):
                    self.wfile.write(chunk)
                else:
                    self.wfile.write(chunk.encode('utf-8'))
        except Exception as e:
            # Error handling
            import traceback
            error_msg = f"Error handling request: {str(e)}\n{traceback.format_exc()}"
            sys.stderr.write(error_msg)
            sys.stderr.flush()
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
