from http.server import BaseHTTPRequestHandler
import json
import os
import sys

def handler(req):
    """Vercel serverless function handler for blob upload"""
    try:
        # Get blob token
        blob_token = os.getenv('BLOB_READ_WRITE_TOKEN')
        if not blob_token:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'BLOB_READ_WRITE_TOKEN not set'})
            }
        
        # Get request body
        if hasattr(req, 'body'):
            body = req.body
        elif hasattr(req, 'get_body'):
            body = req.get_body()
        else:
            body = b''
        
        if not body:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'No file data'})
            }
        
        # Get filename from headers
        filename = req.headers.get('x-filename') or req.headers.get('X-Filename', 'upload.jpg')
        
        # Import requests here to avoid issues if not available
        try:
            import requests
        except ImportError:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'requests library not available'})
            }
        
        # Upload to Vercel Blob
        response = requests.put(
            f'https://blob.vercel-storage.com/{filename}',
            data=body,
            headers={
                'Authorization': f'Bearer {blob_token}',
                'Content-Type': req.headers.get('content-type', 'image/jpeg')
            },
            params={'access': 'public'},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            blob_url = result.get('url') or result.get('downloadUrl') or f'https://blob.vercel-storage.com/{filename}'
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'url': blob_url
                })
            }
        else:
            error_text = response.text
            return {
                'statusCode': response.status_code,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': f'Upload failed: {response.status_code} - {error_text}'
                })
            }
            
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Server error: {error_msg}'})
        }

