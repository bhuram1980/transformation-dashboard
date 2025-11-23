from http.server import BaseHTTPRequestHandler
import json
import os
import requests

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle file upload to Vercel Blob"""
        try:
            # Get content length
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'No file data'}).encode())
                return
            
            # Read file data
            file_data = self.rfile.read(content_length)
            
            # Get blob token
            blob_token = os.getenv('BLOB_READ_WRITE_TOKEN')
            if not blob_token:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'BLOB_READ_WRITE_TOKEN not set'}).encode())
                return
            
            # Get filename from headers or generate one
            filename = self.headers.get('X-Filename', 'upload.jpg')
            
            # Upload to Vercel Blob using the correct API
            # Based on Vercel Blob docs, use PUT with the filename in the path
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
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'url': blob_url
                }).encode())
            else:
                error_text = response.text
                self.send_response(response.status_code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': f'Upload failed: {response.status_code} - {error_text}'
                }).encode())
                
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

