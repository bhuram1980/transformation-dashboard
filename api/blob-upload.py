from http.server import BaseHTTPRequestHandler
import json
import os

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle file upload to Vercel Blob"""
        try:
            # Get content length
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self._send_json_response(400, {'error': 'No file data'})
                return
            
            # Read file data
            file_data = self.rfile.read(content_length)
            
            # Get blob token
            blob_token = os.getenv('BLOB_READ_WRITE_TOKEN')
            if not blob_token:
                self._send_json_response(500, {'error': 'BLOB_READ_WRITE_TOKEN not set'})
                return
            
            # Get filename from headers
            filename = self.headers.get('X-Filename') or self.headers.get('x-filename', 'upload.jpg')
            
            # Import requests
            try:
                import requests
            except ImportError:
                self._send_json_response(500, {'error': 'requests library not available'})
                return
            
            # Upload to Vercel Blob using PUT
            response = requests.put(
                f'https://blob.vercel-storage.com/{filename}',
                data=file_data,
                headers={
                    'Authorization': f'Bearer {blob_token}',
                    'Content-Type': self.headers.get('Content-Type', 'image/jpeg')
                },
                params={'access': 'public'},
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                blob_url = result.get('url') or result.get('downloadUrl') or f'https://blob.vercel-storage.com/{filename}'
                self._send_json_response(200, {'success': True, 'url': blob_url})
            else:
                error_text = response.text
                self._send_json_response(response.status_code, {
                    'error': f'Upload failed: {response.status_code} - {error_text}'
                })
                
        except Exception as e:
            self._send_json_response(500, {'error': str(e)})
    
    def _send_json_response(self, status_code, data):
        """Helper to send JSON response"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

