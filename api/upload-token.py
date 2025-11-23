from http.server import BaseHTTPRequestHandler
import json
import os

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Generate upload token for client-side upload"""
        blob_token = os.getenv('BLOB_READ_WRITE_TOKEN')
        
        if not blob_token:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': 'BLOB_READ_WRITE_TOKEN not set'
            }).encode())
            return
        
        # Return token for client-side upload
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({
            'token': blob_token
        }).encode())

