#!/usr/bin/env python3
"""
Transformation Log Web App with Grok Integration
Flask web application to visualize transformation progress and get AI advice
"""

from flask import Flask, render_template, jsonify, request
import re
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import os

app = Flask(__name__, 
            static_folder='static',
            template_folder='templates')

# Grok API configuration (set via environment variable)
GROK_API_KEY = os.getenv('GROK_API_KEY', '')
GROK_API_URL = 'https://api.x.ai/v1/chat/completions'


class TransformationLogParser:
    """Parse and extract data from transformation_log.md"""
    
    def __init__(self, log_file: str = "transformation_log.md"):
        self.log_file = Path(log_file)
        self.log_content = self._read_log()
        
    def _read_log(self) -> str:
        """Read the transformation log file"""
        if not self.log_file.exists():
            return ""
        return self.log_file.read_text(encoding='utf-8')
    
    def get_baseline(self) -> Dict:
        """Extract baseline metrics"""
        baseline = {}
        
        # DEXA metrics
        dexa_match = re.search(r'Total Body Fat %\s+\|\s+\*\*(\d+\.?\d*)\s*%\*\*', self.log_content)
        if dexa_match:
            baseline['body_fat'] = float(dexa_match.group(1))
            
        android_match = re.search(r'Android \(visceral\) Fat %\s+\|\s+\*\*(\d+\.?\d*)\s*%\*\*', self.log_content)
        if android_match:
            baseline['android_fat'] = float(android_match.group(1))
            
        weight_match = re.search(r'Age / Height / Weight\s+\|\s+\d+\s+/\s+(\d+)\s+cm\s+/\s+(\d+\.?\d*)\s+kg', self.log_content)
        if weight_match:
            baseline['height'] = int(weight_match.group(1))
            baseline['weight'] = float(weight_match.group(2))
            
        lean_match = re.search(r'Lean Mass\s+\|\s+\*\*(\d+\.?\d*)\s+kg\*\*', self.log_content)
        if lean_match:
            baseline['lean_mass'] = float(lean_match.group(1))
        
        # Blood markers
        markers = ['ALT', 'AST', 'GGT', 'Fasting Glucose', 'Triglycerides', 'hs-CRP', 'Vitamin D', 'Ferritin']
        for marker in markers:
            pattern = rf'{re.escape(marker)}\s+\|\s+(\d+\.?\d*)'
            match = re.search(pattern, self.log_content)
            if match:
                key = marker.lower().replace(' ', '_')
                baseline[key] = float(match.group(1))
        
        return baseline
    
    def get_targets(self) -> Dict:
        """Extract 60-day targets"""
        targets = {}
        
        weight_match = re.search(r'Weight\s+\|\s+(\d+)–(\d+)\s+kg', self.log_content)
        if weight_match:
            targets['weight'] = {'min': float(weight_match.group(1)), 'max': float(weight_match.group(2))}
            
        bf_match = re.search(r'Body Fat %\s+\|\s+≤(\d+)–(\d+)\s*%', self.log_content)
        if bf_match:
            targets['body_fat'] = {'min': float(bf_match.group(1)), 'max': float(bf_match.group(2))}
            
        android_match = re.search(r'Android Fat %\s+\|\s+≤(\d+)–(\d+)\s*%', self.log_content)
        if android_match:
            targets['android_fat'] = {'min': float(android_match.group(1)), 'max': float(android_match.group(2))}
            
        alt_match = re.search(r'ALT\s+\|\s+<(\d+)', self.log_content)
        if alt_match:
            targets['ALT'] = float(alt_match.group(1))
            
        glucose_match = re.search(r'Glucose\s+\|\s+<(\d+)', self.log_content)
        if glucose_match:
            targets['glucose'] = float(glucose_match.group(1))
            
        trig_match = re.search(r'Triglycerides\s+\|\s+<(\d+)', self.log_content)
        if trig_match:
            targets['triglycerides'] = float(trig_match.group(1))
        
        return targets
    
    def get_daily_logs(self) -> List[Dict]:
        """Extract all daily log entries"""
        days = []
        day_pattern = r'### Day (\d+) – ([A-Za-z]+ \d+, \d{4})'
        
        for match in re.finditer(day_pattern, self.log_content):
            day_num = int(match.group(1))
            date_str = match.group(2)
            
            # Find the content for this day
            start_pos = match.end()
            next_day_match = re.search(day_pattern, self.log_content[start_pos:])
            if next_day_match:
                end_pos = start_pos + next_day_match.start()
            else:
                end_pos = len(self.log_content)
            
            day_content = self.log_content[start_pos:end_pos]
            
            # Parse macros
            protein_match = re.search(r'Protein\s+(\d+)\s+g', day_content)
            carbs_match = re.search(r'Carbs\s+(\d+)\s+g', day_content)
            fat_match = re.search(r'Fat\s+(\d+)\s+g', day_content)
            kcal_match = re.search(r'(\d+)\s+kcal', day_content)
            seafood_match = re.search(r'Seafood[:\s]+([\d\.]+)\s*kg|~?(\d+)\s*g', day_content)
            
            # Parse training
            training = []
            if 'surfing' in day_content.lower():
                surf_match = re.search(r'(\d+\.?\d*)\s*hr\s*surfing', day_content, re.I)
                if surf_match:
                    training.append(f"Surfing: {surf_match.group(1)}hr")
            if 'gym' in day_content.lower() or 'press' in day_content.lower() or 'squat' in day_content.lower():
                training.append("Gym")
            
            day_data = {
                'day': day_num,
                'date': date_str,
                'protein': float(protein_match.group(1)) if protein_match else None,
                'carbs': float(carbs_match.group(1)) if carbs_match else None,
                'fat': float(fat_match.group(1)) if fat_match else None,
                'kcal': float(kcal_match.group(1)) if kcal_match else None,
                'seafood_kg': None,
                'training': ', '.join(training) if training else None,
                'feeling': None,
                'content': day_content
            }
            
            if seafood_match:
                if 'kg' in day_content[seafood_match.start():seafood_match.end()+10]:
                    day_data['seafood_kg'] = float(seafood_match.group(1))
                elif seafood_match.group(2):
                    day_data['seafood_kg'] = float(seafood_match.group(2)) / 1000.0
            
            # Parse feeling
            feeling_match = re.search(r'Feeling[:\s]+([^\n]+)', day_content, re.I)
            if feeling_match:
                day_data['feeling'] = feeling_match.group(1).strip()
            
            days.append(day_data)
        
        return days
    
    def get_streak(self) -> int:
        """Calculate current streak"""
        days = self.get_daily_logs()
        return len(days)
    
    def get_goal_info(self) -> Dict:
        """Extract goal information"""
        goal_match = re.search(r'\*\*Goal:\*\* ([^\n]+)', self.log_content)
        start_match = re.search(r'\*\*Started:\*\* ([^\n]+)', self.log_content)
        
        return {
            'goal': goal_match.group(1) if goal_match else '',
            'started': start_match.group(1) if start_match else ''
        }


def get_grok_advice(log_content: str, recent_days: List[Dict], baseline: Dict, targets: Dict) -> str:
    """Get advice from Grok API"""
    if not GROK_API_KEY:
        return "⚠️ Grok API key not configured. Set GROK_API_KEY environment variable.\n\nFor now, here's basic advice:\n\n✅ Keep protein at 350-420g daily\n✅ Maintain carbs <50g\n✅ Get 1.0-1.5kg seafood daily\n✅ Take all supplements as scheduled\n✅ Train 3-5× per week\n\nYour streak is strong - keep going! 🔥"
    
    try:
        import requests
        
        # Prepare context for Grok
        recent_summary = ""
        if recent_days:
            last_3 = recent_days[-3:]
            for day in last_3:
                recent_summary += f"Day {day['day']} ({day['date']}): "
                recent_summary += f"Protein: {day.get('protein', 'N/A')}g, "
                recent_summary += f"Carbs: {day.get('carbs', 'N/A')}g, "
                recent_summary += f"Seafood: {day.get('seafood_kg', 'N/A')}kg\n"
        
        context = f"""You are a health and fitness transformation coach. Analyze this transformation log and provide personalized daily advice.

BASELINE METRICS:
- Body Fat: {baseline.get('body_fat', 'N/A')}%
- Android (Visceral) Fat: {baseline.get('android_fat', 'N/A')}% (TARGET: ≤15%)
- Weight: {baseline.get('weight', 'N/A')} kg
- ALT: {baseline.get('alt', 'N/A')} (TARGET: <80)
- Glucose: {baseline.get('fasting_glucose', 'N/A')} (TARGET: <95)
- Triglycerides: {baseline.get('triglycerides', 'N/A')} (TARGET: <120)

RECENT 3 DAYS:
{recent_summary if recent_summary else 'No recent data'}

GOAL: Reverse NAFLD, drop android fat from 37.8% → ≤15%, reach 11-13% body fat, +8-10 kg muscle by April 2026

PROTOCOL:
- Protein: 350-420g daily
- Carbs: <50g (only from veggies + pickles)
- Fat: 150-200g
- Seafood: 1.0-1.5kg daily (skin on)
- Supplements: NAC 2×, Omega-3, D3+K2, ZMB, Whey, Creatine

Provide specific, actionable advice for today. Focus on:
1. What's working well
2. Areas needing attention
3. Specific actions for today
4. Motivation based on progress

Keep it concise, actionable, and motivating."""
        
        headers = {
            'Authorization': f'Bearer {GROK_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        # Try different possible API endpoints/models
        api_configs = [
            {'url': 'https://api.x.ai/v1/chat/completions', 'model': 'grok-beta'},
            {'url': 'https://api.x.ai/v1/chat/completions', 'model': 'grok-2'},
            {'url': 'https://api.x.ai/v1/chat/completions', 'model': 'grok'},
        ]
        
        data = {
            'messages': [
                {
                    'role': 'system',
                    'content': 'You are an expert health and fitness transformation coach specializing in NAFLD reversal, visceral fat reduction, and body recomposition. Be concise, actionable, and motivating.'
                },
                {
                    'role': 'user',
                    'content': context
                }
            ],
            'temperature': 0.7,
            'max_tokens': 1000
        }
        
        last_error = None
        for config in api_configs:
            try:
                data['model'] = config['model']
                response = requests.post(config['url'], headers=headers, json=data, timeout=30)
                response.raise_for_status()
                result = response.json()
                return result['choices'][0]['message']['content']
            except Exception as e:
                last_error = e
                continue
        
        # If all API attempts failed, return error with fallback
        return f"⚠️ Error connecting to Grok API: {str(last_error)}\n\nBasic advice: Stay consistent with your protocol - you're doing great! 🔥"
        
    except ImportError:
        return "⚠️ 'requests' library not installed. Run: pip install requests"
    except Exception as e:
        return f"⚠️ Error getting Grok advice: {str(e)}\n\nKeep following your protocol - consistency is key! 🔥"


@app.route('/')
def index():
    """Main dashboard"""
    return render_template('dashboard.html')


@app.route('/api/data')
def get_data():
    """API endpoint to get all transformation data"""
    parser = TransformationLogParser()
    
    baseline = parser.get_baseline()
    targets = parser.get_targets()
    daily_logs = parser.get_daily_logs()
    streak = parser.get_streak()
    goal_info = parser.get_goal_info()
    
    return jsonify({
        'baseline': baseline,
        'targets': targets,
        'daily_logs': daily_logs,
        'streak': streak,
        'goal': goal_info,
        'total_days': len(daily_logs)
    })


@app.route('/api/advice')
def get_advice():
    """API endpoint to get Grok advice"""
    parser = TransformationLogParser()
    
    baseline = parser.get_baseline()
    targets = parser.get_targets()
    daily_logs = parser.get_daily_logs()
    
    advice = get_grok_advice(parser.log_content, daily_logs, baseline, targets)
    
    return jsonify({
        'advice': advice,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/stats')
def get_stats():
    """API endpoint for aggregated statistics"""
    parser = TransformationLogParser()
    daily_logs = parser.get_daily_logs()
    
    if not daily_logs:
        return jsonify({'error': 'No data available'})
    
    recent_days = daily_logs[-7:] if len(daily_logs) >= 7 else daily_logs
    
    # Calculate averages
    proteins = [d['protein'] for d in recent_days if d['protein']]
    carbs = [d['carbs'] for d in recent_days if d['carbs']]
    fats = [d['fat'] for d in recent_days if d['fat']]
    kcals = [d['kcal'] for d in recent_days if d['kcal']]
    seafoods = [d['seafood_kg'] for d in recent_days if d['seafood_kg']]
    
    stats = {
        'avg_protein': sum(proteins) / len(proteins) if proteins else 0,
        'avg_carbs': sum(carbs) / len(carbs) if carbs else 0,
        'avg_fat': sum(fats) / len(fats) if fats else 0,
        'avg_kcal': sum(kcals) / len(kcals) if kcals else 0,
        'avg_seafood': sum(seafoods) / len(seafoods) if seafoods else 0,
        'days_tracked': len(daily_logs),
        'recent_days': len(recent_days)
    }
    
    return jsonify(stats)


@app.route('/api/upload-photo', methods=['POST'])
def upload_photo():
    """Upload photo to Vercel Blob storage - Flask fallback endpoint"""
    try:
        if 'photo' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['photo']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        # Try to use Vercel Blob if available
        blob_token = os.getenv('BLOB_READ_WRITE_TOKEN')
        
        if not blob_token:
            is_vercel = os.getenv('VERCEL') == '1'
            if is_vercel:
                return jsonify({
                    'success': False,
                    'error': 'BLOB_READ_WRITE_TOKEN not set. Please add it in Vercel project settings → Environment Variables.'
                }), 500
            # Local dev fallback
            try:
                upload_folder = Path('static/uploads')
                upload_folder.mkdir(exist_ok=True)
                filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
                filepath = upload_folder / filename
                file.save(filepath)
                url = f"/static/uploads/{filename}"
                return jsonify({'success': True, 'url': url})
            except Exception as e:
                return jsonify({
                    'success': False,
                    'error': f'Failed to save file locally: {str(e)}'
                }), 500
        
        # Try uploading to Vercel Blob
        try:
            import requests
            
            filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
            file_data = file.read()
            
            # Use PUT method with filename in URL
            response = requests.put(
                f'https://blob.vercel-storage.com/{filename}',
                data=file_data,
                headers={
                    'Authorization': f'Bearer {blob_token}',
                    'Content-Type': file.content_type or 'image/jpeg'
                },
                params={'access': 'public'},
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                blob_url = result.get('url') or result.get('downloadUrl') or f'https://blob.vercel-storage.com/{filename}'
                return jsonify({'success': True, 'url': blob_url})
            else:
                error_msg = response.text or f"Status {response.status_code}"
                raise Exception(f"Blob upload failed: {response.status_code} - {error_msg}")
                
        except Exception as e:
            error_msg = str(e)
            print(f"Blob upload error: {error_msg}")
            return jsonify({
                'success': False, 
                'error': f'Vercel Blob upload failed: {error_msg}. Please check BLOB_READ_WRITE_TOKEN is set correctly.'
            }), 500
            
    except Exception as e:
        error_msg = str(e)
        print(f"Upload error: {error_msg}")
        return jsonify({'success': False, 'error': error_msg}), 500


@app.route('/api/photos')
def get_photos():
    """Get list of uploaded photos"""
    try:
        photos = []
        blob_token = os.getenv('BLOB_READ_WRITE_TOKEN')
        
        # Try to list from Vercel Blob if token is available
        if blob_token:
            try:
                import requests
                # Vercel Blob list endpoint - try different possible formats
                # First try: GET /list
                response = requests.get(
                    'https://blob.vercel-storage.com/list',
                    headers={'Authorization': f'Bearer {blob_token}'},
                    params={'limit': 100},
                    timeout=10
                )
                
                if response.status_code == 200:
                    blob_data = response.json()
                    # Handle different response formats
                    blobs_list = []
                    if isinstance(blob_data, list):
                        blobs_list = blob_data
                    elif 'blobs' in blob_data:
                        blobs_list = blob_data['blobs']
                    elif 'data' in blob_data:
                        blobs_list = blob_data['data']
                    
                    for blob in blobs_list:
                        # Get URL - try different possible fields
                        url = (blob.get('url') or 
                               blob.get('downloadUrl') or 
                               blob.get('pathname') or
                               blob.get('key'))
                        
                        if url:
                            # Construct full URL if it's just a pathname
                            if not url.startswith('http'):
                                url = f'https://blob.vercel-storage.com/{url}'
                            
                            photos.append({
                                'url': url,
                                'date': (blob.get('uploadedAt') or 
                                        blob.get('createdAt') or 
                                        blob.get('uploaded') or
                                        datetime.now().isoformat())
                            })
                else:
                    print(f"Blob list API returned {response.status_code}: {response.text}")
            except Exception as e:
                print(f"Error fetching from Blob: {e}")
                import traceback
                traceback.print_exc()
        
        # Also check local uploads folder (development/fallback)
        upload_folder = Path('static/uploads')
        if upload_folder.exists():
            for file in upload_folder.glob('*'):
                if file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    photos.append({
                        'url': f"/static/uploads/{file.name}",
                        'date': datetime.fromtimestamp(file.stat().st_mtime).isoformat()
                    })
        
        # Sort by date, newest first
        photos.sort(key=lambda x: x['date'], reverse=True)
        return jsonify({'photos': photos})
    except Exception as e:
        return jsonify({'photos': [], 'error': str(e)})


if __name__ == '__main__':
    # Use PORT from environment (for production) or default to 5001 (local dev)
    port = int(os.getenv('PORT', 5001))
    debug = os.getenv('FLASK_ENV') != 'production'
    app.run(debug=debug, host='0.0.0.0', port=port)

