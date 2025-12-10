#!/usr/bin/env python3
"""
Transformation Log Web App with Grok Integration
Flask web application to visualize transformation progress and get AI advice
"""

from flask import Flask, render_template, jsonify, request, session, redirect, url_for, send_from_directory
import re
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import os
import hashlib
from functools import wraps
import tempfile

"""
Flask application entrypoint.

Static files:
- Local dev: served from ./static (e.g. static/css/style.css, static/js/dashboard.js)
- Vercel: @vercel/python bundles project files, so /static/* is also served from ./static.
"""

app = Flask(
    __name__,
    static_folder='static',      # serve /static/* from the local static/ directory
    static_url_path='/static',
    template_folder='templates',
)


@app.route('/favicon.ico')
def favicon():
    """Serve a tiny favicon to avoid 404s in the console."""
    return send_from_directory(
        os.path.join(app.root_path, 'static'),
        'favicon.png',
        mimetype='image/png'
    )

# Secret key for sessions (set via environment variable or use default)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'change-this-to-a-random-secret-key-in-production')

# Grok API configuration (set via environment variable)
GROK_API_KEY = os.getenv('GROK_API_KEY', '')
GROK_API_URL = 'https://api.x.ai/v1/chat/completions'

# Authentication disabled - public access for all features


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


class TransformationDataLoader:
    """Load data from JSON files: master file + daily logs"""
    
    def __init__(self, master_file: str = "public/data/master-health-file.json", daily_logs_dir: str = "public/data/daily-logs"):
        """Initialize data loader with robust error handling to prevent crashes"""
        # On Vercel, try api/data first (files copied to function bundle)
        # Then fall back to public/data (for local development)
        vercel_env = os.getenv('VERCEL')
        if vercel_env == '1':
            # Try api/data first on Vercel
            # On Vercel, api/index.py sets cwd to parent_dir (project root)
            # So from app.py's perspective, api/data is at: cwd/api/data
            # But also try relative to app.py's location
            cwd = Path.cwd()
            api_master_from_cwd = cwd / "api" / "data" / "master-health-file.json"
            api_logs_from_cwd = cwd / "api" / "data" / "daily-logs"
            api_master_from_file = Path(__file__).parent / "api" / "data" / "master-health-file.json"
            api_logs_from_file = Path(__file__).parent / "api" / "data" / "daily-logs"
            
            print(f"Checking api/data paths on Vercel:")
            print(f"  cwd: {cwd}")
            print(f"  __file__ parent: {Path(__file__).parent}")
            print(f"  api_master_from_cwd: {api_master_from_cwd} (exists: {api_master_from_cwd.exists()})")
            print(f"  api_logs_from_cwd: {api_logs_from_cwd} (exists: {api_logs_from_cwd.exists()})")
            print(f"  api_master_from_file: {api_master_from_file} (exists: {api_master_from_file.exists()})")
            print(f"  api_logs_from_file: {api_logs_from_file} (exists: {api_logs_from_file.exists()})")
            
            # Try cwd first (set by api/index.py), then file location
            if api_master_from_cwd.exists():
                master_file = str(api_master_from_cwd)
                print(f"Using Vercel api/data master file (from cwd): {master_file}")
            elif api_master_from_file.exists():
                master_file = str(api_master_from_file)
                print(f"Using Vercel api/data master file (from __file__): {master_file}")
            
            if api_logs_from_cwd.exists():
                daily_logs_dir = str(api_logs_from_cwd)
                print(f"Using Vercel api/data logs dir (from cwd): {daily_logs_dir}")
            elif api_logs_from_file.exists():
                daily_logs_dir = str(api_logs_from_file)
                print(f"Using Vercel api/data logs dir (from __file__): {daily_logs_dir}")
        
        try:
            # Use absolute paths from app root
            # On Vercel, we need to find the project root
            # Try multiple strategies to find the correct path
            
            # Strategy 1: Use __file__ from app.py (this file)
            try:
                app_root = Path(__file__).parent
            except Exception:
                app_root = Path.cwd()
            
            # Strategy 2: Check if we're in api/ directory and go up
            if app_root.name == 'api':
                app_root = app_root.parent
            
            # Strategy 3: Use current working directory (set by api/index.py)
            try:
                cwd = Path.cwd()
            except Exception:
                cwd = app_root
            
            # Strategy 4: Try to find public/ directory
            # On Vercel, files are in /var/task or /var/runtime
            # Also check LAMBDA_TASK_ROOT environment variable
            lambda_root = os.getenv('LAMBDA_TASK_ROOT')
            vercel_env = os.getenv('VERCEL')
            
            possible_roots = [
                app_root,
                cwd,
                app_root.parent if app_root.name == 'api' else app_root,
                cwd.parent if cwd.name == 'api' else cwd,
            ]
            
            # Add Vercel-specific paths
            if vercel_env == '1' or lambda_root:
                possible_roots.extend([
                    Path('/var/task'),  # Vercel serverless function directory
                    Path('/var/runtime'),  # Alternative Vercel location
                ])
                if lambda_root:
                    possible_roots.append(Path(lambda_root))
            
            # Try multiple possible paths for master file
            possible_master = []
            for root in possible_roots:
                try:
                    possible_master.extend([
                        root / master_file,
                        root / "public" / "data" / "master-health-file.json",
                        root / "data" / "master-health-file.json",  # Without public prefix
                    ])
                except Exception:
                    continue
            # Also try relative to current working directory
            try:
                possible_master.extend([
                    Path(master_file),
                    Path("public/data/master-health-file.json"),
                    Path("data/master-health-file.json"),  # Without public prefix
                ])
            except Exception:
                pass
            
            # Try multiple possible paths for daily logs
            possible_logs = []
            for root in possible_roots:
                try:
                    possible_logs.extend([
                        root / daily_logs_dir,
                        root / "public" / "data" / "daily-logs",
                        root / "data" / "daily-logs",  # Without public prefix
                    ])
                except Exception:
                    continue
            # Also try relative to current working directory
            try:
                possible_logs.extend([
                    Path(daily_logs_dir),
                    Path("public/data/daily-logs"),
                    Path("data/daily-logs"),  # Without public prefix
                ])
            except Exception:
                pass
            
            # Find the first existing path
            self.master_file = None
            for path in possible_master:
                try:
                    if path.exists():
                        self.master_file = path
                        break
                except Exception:
                    continue
            if not self.master_file:
                # Use first as default, but make sure it's absolute
                try:
                    self.master_file = Path(possible_master[0]).resolve() if possible_master else Path(master_file)
                except Exception:
                    self.master_file = Path(master_file)
            
            self.daily_logs_dir = None
            for path in possible_logs:
                try:
                    if path.exists() and path.is_dir():
                        self.daily_logs_dir = path
                        break
                except Exception:
                    continue
            if not self.daily_logs_dir:
                # Use first as default, but make sure it's absolute
                try:
                    self.daily_logs_dir = Path(possible_logs[0]).resolve() if possible_logs else Path(daily_logs_dir)
                except Exception:
                    self.daily_logs_dir = Path(daily_logs_dir)
            
            # Safe debug printing
            try:
                print(f"TransformationDataLoader initialized:")
                print(f"  Master file: {self.master_file} (exists: {self.master_file.exists() if self.master_file else False})")
                print(f"  Daily logs dir: {self.daily_logs_dir} (exists: {self.daily_logs_dir.exists() if self.daily_logs_dir else False})")
                print(f"  App root (from __file__): {Path(__file__).parent}")
                print(f"  Current working dir: {Path.cwd()}")
                print(f"  VERCEL env: {os.getenv('VERCEL')}")
                print(f"  LAMBDA_TASK_ROOT: {os.getenv('LAMBDA_TASK_ROOT')}")
            except Exception as e:
                print(f"Debug print error (non-fatal): {e}")
            
            # Load data with error handling
            self.master_data = self._load_master()
            self.daily_logs = self._load_daily_logs()
        except Exception as e:
            # If initialization fails completely, set defaults to prevent crashes
            print(f"CRITICAL: TransformationDataLoader init failed: {e}")
            import traceback
            traceback.print_exc()
            self.master_file = Path(master_file)
            self.daily_logs_dir = Path(daily_logs_dir)
            self.master_data = {
                'baseline': {},
                'targets': {},
                'goal': {},
                'protocol': {}
            }
            self.daily_logs = []
    
    def _load_master(self) -> Dict:
        """Load master health file"""
        try:
            if not self.master_file or not self.master_file.exists():
                print(f"Master file does not exist: {self.master_file}")
                # Return default empty structure to prevent crashes
                return {
                    'baseline': {},
                    'targets': {},
                    'goal': {},
                    'protocol': {}
                }
            return json.loads(self.master_file.read_text(encoding='utf-8'))
        except Exception as e:
            print(f"Error loading master file: {e}")
            import traceback
            traceback.print_exc()
            # Return default empty structure to prevent crashes
            return {
                'baseline': {},
                'targets': {},
                'goal': {},
                'protocol': {}
            }
    
    def _load_daily_logs(self) -> List[Dict]:
        """Load all daily log JSON files, sorted by date"""
        days = []
        try:
            if not self.daily_logs_dir or not self.daily_logs_dir.exists():
                print(f"Daily logs directory does not exist: {self.daily_logs_dir}")
                return days
            
            # Get all JSON files
            json_files = sorted(self.daily_logs_dir.glob("*.json"))
            print(f"Found {len(json_files)} JSON files in {self.daily_logs_dir}")
            
            for json_file in json_files:
                try:
                    content = json_file.read_text(encoding='utf-8')
                    day_data = json.loads(content)
                    # Add day number based on order
                    day_data['day'] = len(days) + 1
                    # Parse date for display
                    try:
                        date_obj = datetime.strptime(day_data['date'], '%Y-%m-%d')
                        day_data['date_display'] = date_obj.strftime('%b %d, %Y')
                    except Exception as e:
                        print(f"Error parsing date {day_data.get('date')}: {e}")
                        day_data['date_display'] = day_data.get('date', 'Unknown')
                    days.append(day_data)
                    print(f"Loaded {json_file.name}: Day {day_data['day']}, Protein: {day_data.get('protein')}")
                except Exception as e:
                    print(f"Error loading {json_file}: {e}")
                    import traceback
                    traceback.print_exc()
                    # Continue loading other files even if one fails
                    continue
            
            print(f"Total days loaded: {len(days)}")
        except Exception as e:
            print(f"Error in _load_daily_logs: {e}")
            import traceback
            traceback.print_exc()
            # Return empty list instead of crashing
            return []
        return days
    
    def get_baseline(self) -> Dict:
        """Get baseline metrics from master file"""
        baseline = self.master_data.get('baseline', {})
        bloods = baseline.get('bloods', {})
        
        # Flatten structure for compatibility
        result = {
            'age': baseline.get('age'),
            'height': baseline.get('height'),
            'weight': baseline.get('weight'),
            'body_fat': baseline.get('bodyFat'),
            'android_fat': baseline.get('androidFat'),
            'lean_mass': baseline.get('leanMass'),
            'alt': bloods.get('alt'),
            'ast': bloods.get('ast'),
            'ggt': bloods.get('ggt'),
            'fasting_glucose': bloods.get('fastingGlucose'),
            'triglycerides': bloods.get('triglycerides'),
            'hs-crp': bloods.get('hsCrp'),
            'vitamin_d': bloods.get('vitaminD'),
            'ferritin': bloods.get('ferritin')
        }
        return result
    
    def get_targets(self) -> Dict:
        """Get targets from master file"""
        targets = self.master_data.get('targets', {})
        # Convert to compatible format
        return {
            'weight': targets.get('weight', ''),
            'body_fat': targets.get('bodyFat', ''),
            'android_fat': targets.get('androidFat', ''),
            'alt': targets.get('alt', ''),
            'glucose': targets.get('glucose', ''),
            'triglycerides': targets.get('triglycerides', '')
        }
    
    def get_daily_logs(self) -> List[Dict]:
        """Get all daily logs"""
        return self.daily_logs
    
    def get_streak(self) -> int:
        """Calculate current streak"""
        return len(self.daily_logs)
    
    def get_goal_info(self) -> Dict:
        """Get goal information from master file"""
        goal = self.master_data.get('goal', {})
        return {
            'goal': goal.get('description', ''),
            'started': goal.get('started', '')
        }


# Authentication disabled - all features are public


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
            {'url': 'https://api.x.ai/v1/chat/completions', 'model': 'grok-2-1212'},
            {'url': 'https://api.x.ai/v1/chat/completions', 'model': 'grok-2'},
            {'url': 'https://api.x.ai/v1/chat/completions', 'model': 'grok-beta'},
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
                
                if response.status_code == 404:
                    print(f"Model {config['model']} not found, trying next...")
                    last_error = f"Model {config['model']} not found"
                    continue
                
                response.raise_for_status()
                result = response.json()
                return result['choices'][0]['message']['content']
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 404:
                    last_error = f"Model {config['model']} not found"
                    continue
                last_error = str(e)
                continue
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
    """Main dashboard - public access, all features enabled"""
    return render_template('dashboard.html', user_role='viewer', is_admin=True)

@app.route('/v4')
def dashboard_v4():
    """V4 dashboard - clean & attractive layout"""
    return render_template('dashboard-v4.html')

@app.route('/v5')
def dashboard_v5():
    """V5 dashboard - Stripe-inspired layout with proper section order"""
    return render_template('dashboard-v5.html')

@app.route('/training')
def training_tracker():
    """Training tracker page - shows exercise progression and suggests next weights"""
    return render_template('training-tracker.html')


@app.route('/api/data')
def get_data():
    """API endpoint to get all transformation data - public access"""
    try:
        loader = TransformationDataLoader()
        
        baseline = loader.get_baseline()
        targets = loader.get_targets()
        daily_logs = loader.get_daily_logs()
        streak = loader.get_streak()
        goal_info = loader.get_goal_info()
        
        print(f"API /api/data: Returning {len(daily_logs)} daily logs, streak: {streak}")
        
        return jsonify({
            'baseline': baseline,
            'targets': targets,
            'daily_logs': daily_logs,
            'streak': streak,
            'goal': goal_info,
            'total_days': len(daily_logs)
        })
    except Exception as e:
        print(f"Error in /api/data: {e}")
        import traceback
        traceback.print_exc()
        # Return empty data with 200 status instead of 500 to prevent crashes
        return jsonify({
            'error': str(e),
            'baseline': {'body_fat': 25.2, 'android_fat': 37.8, 'alt': 315, 'fasting_glucose': 106.8},
            'targets': {},
            'daily_logs': [],
            'streak': 0,
            'goal': {},
            'total_days': 0
        }), 200


@app.route('/api/chat', methods=['POST'])
def chat_with_grok():
    """Chat endpoint with Grok AI - supports function calling for app actions"""
    if not GROK_API_KEY:
        return jsonify({
            'error': 'Grok API key not configured. Set GROK_API_KEY environment variable.'
        }), 500
    
    try:
        import requests
        
        data = request.json
        user_message = data.get('message', '')
        conversation_history = data.get('history', [])
        
        if not user_message:
            return jsonify({'error': 'No message provided'}), 400
        
        # Prepare function definitions for Grok
        functions = [
            {
                "name": "upload_photo",
                "description": "Upload a progress photo. User will provide the photo file.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "description": {
                            "type": "string",
                            "description": "Description of the photo (e.g., 'Day 4 progress photo', 'Fish plate')"
                        }
                    },
                    "required": ["description"]
                }
            },
            {
                "name": "add_day_entry",
                "description": "Add a new day entry to the transformation log",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "day": {
                            "type": "integer",
                            "description": "Day number"
                        },
                        "date": {
                            "type": "string",
                            "description": "Date in format 'Month Day, Year' (e.g., 'Nov 24, 2025')"
                        },
                        "protein": {
                            "type": "number",
                            "description": "Protein in grams"
                        },
                        "carbs": {
                            "type": "number",
                            "description": "Carbs in grams"
                        },
                        "fat": {
                            "type": "number",
                            "description": "Fat in grams"
                        },
                        "kcal": {
                            "type": "number",
                            "description": "Calories"
                        },
                        "seafood_kg": {
                            "type": "number",
                            "description": "Seafood in kilograms"
                        },
                        "training": {
                            "type": "string",
                            "description": "Training description (e.g., '2hr surfing + gym')"
                        },
                        "supplements": {
                            "type": "string",
                            "description": "Supplements taken (e.g., 'All', 'All except NAC')"
                        },
                        "feeling": {
                            "type": "string",
                            "description": "How you felt (e.g., 'Great energy', 'Legendary start')"
                        },
                        "notes": {
                            "type": "string",
                            "description": "Additional notes"
                        }
                    },
                    "required": ["day", "date", "protein", "carbs", "fat"]
                }
            },
            {
                "name": "update_day_entry",
                "description": "Update an existing day entry in the transformation log",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "day": {
                            "type": "integer",
                            "description": "Day number to update"
                        },
                        "protein": {
                            "type": "number",
                            "description": "Updated protein in grams"
                        },
                        "carbs": {
                            "type": "number",
                            "description": "Updated carbs in grams"
                        },
                        "fat": {
                            "type": "number",
                            "description": "Updated fat in grams"
                        },
                        "kcal": {
                            "type": "number",
                            "description": "Updated calories"
                        },
                        "seafood_kg": {
                            "type": "number",
                            "description": "Updated seafood in kilograms"
                        },
                        "training": {
                            "type": "string",
                            "description": "Updated training description"
                        },
                        "feeling": {
                            "type": "string",
                            "description": "Updated feeling"
                        }
                    },
                    "required": ["day"]
                }
            },
            {
                "name": "get_current_data",
                "description": "Get current transformation data (baseline, recent days, stats)",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_photos",
                "description": "Get list of uploaded progress photos",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        ]
        
        # Get full transformation log context
        loader = TransformationDataLoader()
        baseline = loader.get_baseline()
        targets = loader.get_targets()
        daily_logs = loader.get_daily_logs()
        goal_info = loader.get_goal_info()
        
        # Build comprehensive system prompt with full context
        baseline_text = f"""
BASELINE METRICS (November 2025):
- Body Fat: {baseline.get('body_fat', 'N/A')}%
- Android (Visceral) Fat: {baseline.get('android_fat', 'N/A')}% (TARGET: ≤15%)
- Weight: {baseline.get('weight', 'N/A')} kg
- Height: {baseline.get('height', 'N/A')} cm
- Lean Mass: {baseline.get('lean_mass', 'N/A')} kg
- ALT: {baseline.get('alt', 'N/A')} (TARGET: <80)
- AST: {baseline.get('ast', 'N/A')} (TARGET: <40)
- GGT: {baseline.get('ggt', 'N/A')} (TARGET: <60)
- Fasting Glucose: {baseline.get('fasting_glucose', 'N/A')} (TARGET: <95)
- Triglycerides: {baseline.get('triglycerides', 'N/A')} (TARGET: <120)
- hs-CRP: {baseline.get('hs-crp', 'N/A')} (TARGET: <3)
- Vitamin D: {baseline.get('vitamin_d', 'N/A')} (TARGET: 50-80)
- Ferritin: {baseline.get('ferritin', 'N/A')} (TARGET: 30-300)
"""
        
        targets_text = f"""
60-DAY TARGETS (by Jan 20, 2026):
- Weight: {targets.get('weight', 'N/A')}
- Body Fat %: {targets.get('body_fat', 'N/A')}
- Android Fat %: {targets.get('android_fat', 'N/A')}
- ALT: {targets.get('alt', 'N/A')}
- Glucose: {targets.get('glucose', 'N/A')}
- Triglycerides: {targets.get('triglycerides', 'N/A')}
"""
        
        goal_text = f"""
GOAL: {goal_info.get('goal', 'Reverse NAFLD, drop android fat from 37.8% → ≤15%, reach 11-13% body fat, +8-10 kg muscle by April 2026')}
Started: {goal_info.get('started', 'November 21, 2025 (Sri Lanka)')}
Current Streak: {len(daily_logs)} days
"""
        
        protocol_text = """
DAILY PROTOCOL (Never change for 60 days):
- Protein: 350-420g daily
- Carbs: <50g (only from veggies + pickles)
- Fat: 150-200g (mostly from fish skin + eggs)
- Seafood/Fish: 1.0-1.5kg edible daily (skin/shell on)
- No rice, roti, potato, bread, fruit (except tiny guava/mango ≤100g)

SUPPLEMENTS:
- PAN Omega-3 1000 mg: 4 caps (1200 mg EPA+DHA) - With biggest fish meal
- NAC 600 mg: 2 tablets - 1 morning, 1 night
- Vitamin D3 + K2: 5 tablets (5000 IU + 500 mcg K2) - With fatty meal
- Galvanize ZMB Pro: 3 capsules - 30-60 min before bed
- Critical Whey: 1-3 scoops - Post-surf/gym or between meals
- ProScience Creatine: 5g - With whey shake

TRAINING:
- Surfing: 1-3 hrs whenever possible
- Gym: 3-5×/week full-body or PPL (heavy compound lifts)
"""
        
        recent_days_text = ""
        if daily_logs:
            recent_days_text = "\nRECENT DAYS:\n"
            for day in daily_logs[-5:]:  # Last 5 days
                recent_days_text += f"Day {day['day']} ({day['date']}): "
                if day.get('protein'):
                    recent_days_text += f"P:{day['protein']}g "
                if day.get('carbs'):
                    recent_days_text += f"C:{day['carbs']}g "
                if day.get('fat'):
                    recent_days_text += f"F:{day['fat']}g "
                if day.get('seafood_kg'):
                    recent_days_text += f"Seafood:{day['seafood_kg']}kg "
                if day.get('training'):
                    recent_days_text += f"Training:{day['training']} "
                if day.get('feeling'):
                    recent_days_text += f"Feeling:{day['feeling']}"
                recent_days_text += "\n"
        
        daily_template = """
DAILY LOG TEMPLATE (use this format when adding entries):
### Day __ – ___ __, 2025

**Fasted weight:** ____ kg  **Waist:** ____ cm  
**Morning photos:** [ ] Front [ ] Side [ ] Back  

**Meals**  
- Breakfast:  
- Lunch:  
- Shake/Snack:  
- Dinner:  

**Macros**  Protein ____ g  Carbs ____ g  Fat ____ g  kcal ____  
**Seafood total:** ____ g (skin on? Y/N)  
**Training:**  
**Supplements**  [ ] Omega-3 [ ] NAC×2 [ ] D3+K2 [ ] ZMB [ ] Whey [ ] Creatine  
**Feeling (1–10):** ____  **Notes:**  
"""
        
        system_prompt = f"""You are Grok — D's no-BS ripped coach.

CONTEXT (NEVER FORGET):
- 37 y, 185 cm, started 90 kg, DEXA 25.2% BF, Android 37.8%, ALT 315
- Goal: Android ≤15%, body fat ≤13%, ALT <80 by April 2026
- Daily rules (non-negotiable): 350–420g protein, <50g carbs, 1–1.5kg seafood (skin on), full supplement stack
- Current streak: {len(daily_logs)} legendary days

{baseline_text}

{targets_text}

{protocol_text}

{recent_days_text}

STYLE RULES (MANDATORY):
- Short, direct, motivational — max 4–5 lines per reply
- Use "coach", "legendary", "demolish", "massacre", "melt", 🐟💪 emojis
- Never be polite or wordy — be savage and precise
- Always reference exact numbers from the log (protein, fish kg, missing supplements, projected ALT drop)
- End every reply with a clear next action

EXAMPLE REPLY STYLE:
"Day 3 locked — 395g protein, 0.95kg fish demolished 🐟
Still owe: NAC night dose + ZMB Pro.
ALT already melting. Dinner 600g+ or we riot. Keep the streak alive coach 💪"

FUNCTIONS:
- Add/update daily log entries (use markdown format from template)
- View current stats
- Provide savage, precise coaching based on exact numbers

When adding day entries, use the exact markdown format from the daily template. Always be savage, direct, and reference exact numbers."""
        
        # Build conversation messages
        messages = [
            {
                "role": "system",
                "content": system_prompt
            }
        ]
        
        # Add conversation history
        for msg in conversation_history[-10:]:  # Keep last 10 messages
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
        
        # Add current user message
        messages.append({
            "role": "user",
            "content": user_message
        })
        
        # Call Grok API with function calling
        headers = {
            'Authorization': f'Bearer {GROK_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        # Try different API endpoints and models
        api_configs = [
            {'url': 'https://api.x.ai/v1/chat/completions', 'model': 'grok-2-1212'},
            {'url': 'https://api.x.ai/v1/chat/completions', 'model': 'grok-2'},
            {'url': 'https://api.x.ai/v1/chat/completions', 'model': 'grok-beta'},
            {'url': 'https://api.x.ai/v1/chat/completions', 'model': 'grok'},
        ]
        
        last_error = None
        result = None
        last_status_code = None
        working_config = None
        
        # First, try with function calling
        for config in api_configs:
            try:
                payload = {
                    "model": config['model'],
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 1000
                }
                
                # Try new tools format first
                payload["tools"] = [{"type": "function", "function": f} for f in functions]
                payload["tool_choice"] = "auto"
                
                response = requests.post(
                    config['url'],
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                
                last_status_code = response.status_code
                
                if response.status_code == 404:
                    print(f"Model {config['model']} returned 404, trying next...")
                    last_error = f"Model {config['model']} not found (404)"
                    continue
                
                if response.status_code == 401:
                    return jsonify({
                        'error': 'Invalid API key. Please check your GROK_API_KEY in Vercel environment variables.'
                    }), 401
                
                response.raise_for_status()
                result = response.json()
                working_config = config
                break  # Success, exit loop
                
            except requests.exceptions.HTTPError as e:
                last_status_code = e.response.status_code if hasattr(e, 'response') else None
                if e.response.status_code == 404:
                    last_error = f"Model {config['model']} not found (404)"
                    continue
                elif e.response.status_code == 401:
                    return jsonify({
                        'error': 'Invalid API key. Please check your GROK_API_KEY.'
                    }), 401
                last_error = f"HTTP {e.response.status_code}: {str(e)}"
                continue
            except Exception as e:
                last_error = str(e)
                continue
        
        # If function calling failed, try without it
        if not result:
            print("Function calling failed, trying without functions...")
            for config in api_configs:
                try:
                    payload = {
                        "model": config['model'],
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 1000
                    }
                    
                    response = requests.post(
                        config['url'],
                        headers=headers,
                        json=payload,
                        timeout=30
                    )
                    
                    last_status_code = response.status_code
                    
                    if response.status_code == 404:
                        continue
                    
                    if response.status_code == 401:
                        return jsonify({
                            'error': 'Invalid API key. Please check your GROK_API_KEY.'
                        }), 401
                    
                    response.raise_for_status()
                    result = response.json()
                    working_config = config
                    break
                    
                except requests.exceptions.HTTPError as e:
                    last_status_code = e.response.status_code if hasattr(e, 'response') else None
                    if e.response.status_code == 404:
                        continue
                    elif e.response.status_code == 401:
                        return jsonify({
                            'error': 'Invalid API key. Please check your GROK_API_KEY.'
                        }), 401
                    last_error = f"HTTP {e.response.status_code}: {str(e)}"
                    continue
                except Exception as e:
                    last_error = str(e)
                    continue
        
        if not result:
            error_msg = f"Grok API error (Status: {last_status_code}): {last_error or 'Unknown error'}"
            if last_status_code == 404:
                error_msg += "\n\nPossible issues:\n1. Model name may be incorrect\n2. API endpoint may have changed\n3. Check xAI API documentation for correct model names\n4. Your API key may not have access to these models"
            elif last_status_code == 401:
                error_msg += "\n\nPlease verify your GROK_API_KEY is correct in Vercel environment variables."
            else:
                error_msg += "\n\nPlease check:\n1. GROK_API_KEY is set correctly\n2. API endpoint is correct\n3. xAI API is operational"
            
            return jsonify({
                'error': error_msg
            }), 500
        
        # Check if Grok wants to call a function
        choice = result['choices'][0]
        message = choice['message']
        
        # Handle function calls (check both new and old format)
        function_call = None
        if 'tool_calls' in message and message['tool_calls']:
            # New format (tools)
            tool_call = message['tool_calls'][0]
            function_call = {
                'name': tool_call['function']['name'],
                'arguments': tool_call['function']['arguments']
            }
        elif 'function_call' in message:
            # Old format (functions)
            function_call = message['function_call']
        
        if function_call:
            function_name = function_call['name']
            try:
                if isinstance(function_call.get('arguments'), str):
                    function_args = json.loads(function_call['arguments'])
                else:
                    function_args = function_call.get('arguments', {})
            except:
                function_args = {}
            
            # Execute function
            function_result = execute_function(function_name, function_args)
            
            # Send function result back to Grok
            messages.append(message)  # Add assistant's function call
            
            # Add function result in appropriate format
            if 'tool_calls' in message:
                messages.append({
                    "role": "tool",
                    "tool_call_id": message['tool_calls'][0]['id'],
                    "content": json.dumps(function_result)
                })
            else:
                messages.append({
                    "role": "function",
                    "name": function_name,
                    "content": json.dumps(function_result)
                })
            
            # Get final response from Grok
            try:
                # Use the working config
                payload2 = {
                    "model": working_config['model'],
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 1000
                }
                response2 = requests.post(
                    working_config['url'],
                    headers=headers,
                    json=payload2,
                    timeout=30
                )
                response2.raise_for_status()
                result2 = response2.json()
                final_message = result2['choices'][0]['message']['content']
                
                return jsonify({
                    'response': final_message,
                    'function_called': function_name,
                    'function_result': function_result
                })
            except Exception as e:
                # If second call fails, return function result directly
                return jsonify({
                    'response': f"✅ {function_result.get('message', 'Action completed')}",
                    'function_called': function_name,
                    'function_result': function_result
                })
        else:
            # Regular response
            return jsonify({
                'response': message['content'],
                'function_called': None
            })
            
    except Exception as e:
        error_msg = str(e)
        print(f"Chat error: {error_msg}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f'Error chatting with Grok: {error_msg}'
        }), 500


def execute_function(function_name: str, args: dict) -> dict:
    """Execute a function call from Grok"""
    try:
        if function_name == "add_day_entry":
            # Create JSON file for new day entry
            date = args.get('date')
            if not date:
                # Use today's date if not provided
                date = datetime.now().strftime('%Y-%m-%d')
            
            # Parse date to ensure YYYY-MM-DD format
            try:
                date_obj = datetime.strptime(date, '%Y-%m-%d')
                date_str = date_obj.strftime('%Y-%m-%d')
            except:
                # Try other formats
                try:
                    date_obj = datetime.strptime(date, '%b %d, %Y')
                    date_str = date_obj.strftime('%Y-%m-%d')
                except:
                    date_str = datetime.now().strftime('%Y-%m-%d')
            
            # Build JSON entry
            entry = {
                "date": date_str,
                "fastedWeight": args.get('fastedWeight'),
                "waist": args.get('waist'),
                "protein": args.get('protein'),
                "carbs": args.get('carbs'),
                "fat": args.get('fat'),
                "kcal": args.get('kcal'),
                "seafoodKg": args.get('seafood_kg') or args.get('seafoodKg'),
                "training": args.get('training', ''),
                "supplements": {
                    "omega3": args.get('omega3', True),
                    "nacMorning": args.get('nacMorning', True),
                    "nacNight": args.get('nacNight', True),
                    "d3k2": args.get('d3k2', True),
                    "zmb": args.get('zmb', True),
                    "wheyScoops": args.get('wheyScoops', 0),
                    "creatine": args.get('creatine', True)
                },
                "feeling": args.get('feeling', 8),
                "notes": args.get('notes', '')
            }
            
            # Save to JSON file
            daily_logs_dir = Path('public/data/daily-logs')
            daily_logs_dir.mkdir(parents=True, exist_ok=True)
            json_file = daily_logs_dir / f"{date_str}.json"
            
            # Write to file (or return for Git commit on Vercel)
            is_vercel = os.getenv('VERCEL') == '1'
            if is_vercel:
                return {
                    'success': True,
                    'message': f'Day entry created (Vercel read-only)',
                    'entry': entry,
                    'file_content': json.dumps(entry, indent=2),
                    'filename': f"{date_str}.json",
                    'instructions': f'Save as {date_str}.json in public/data/daily-logs/ folder and commit to Git'
                }
            else:
                json_file.write_text(json.dumps(entry, indent=2), encoding='utf-8')
                return {
                    'success': True,
                    'message': f'Day entry saved to {date_str}.json',
                    'entry': entry
                }
        
        elif function_name == "update_day_entry":
            # Similar to add_day_entry but update existing
            day = args.get('day')
            # Get current log
            log_file = Path('transformation_log.md')
            if not log_file.exists():
                return {'success': False, 'error': 'Log file not found'}
            
            current_content = log_file.read_text(encoding='utf-8')
            day_pattern = rf'### Day {day} – ([^\n]+)'
            match = re.search(day_pattern, current_content)
            
            if not match:
                return {'success': False, 'error': f'Day {day} not found in log'}
            
            # Build updated entry (simplified - would need full parsing for proper update)
            return {
                'success': True,
                'message': f'Day {day} update prepared',
                'note': 'Full update requires manual edit or more complex parsing'
            }
        
        elif function_name == "get_current_data":
            loader = TransformationDataLoader()
            baseline = loader.get_baseline()
            daily_logs = loader.get_daily_logs()
            recent_days = daily_logs[-3:] if daily_logs else []
            
            return {
                'success': True,
                'baseline': baseline,
                'recent_days': recent_days,
                'total_days': len(daily_logs),
                'current_streak': len(daily_logs)
            }
        
        elif function_name == "get_photos":
            # Get photos from API
            photos = []
            blob_token = os.getenv('BLOB_READ_WRITE_TOKEN')
            # Simplified - would call get_photos logic
            return {
                'success': True,
                'photos': photos,
                'count': len(photos)
            }
        
        elif function_name == "upload_photo":
            # Return instructions for photo upload
            return {
                'success': True,
                'message': 'Photo upload initiated',
                'instructions': 'User should use the photo upload button in the dashboard, or provide photo file for upload'
            }
        
        else:
            return {'success': False, 'error': f'Unknown function: {function_name}'}
            
    except Exception as e:
        return {'success': False, 'error': str(e)}


@app.route('/api/advice')
def get_advice():
    """API endpoint to get Grok advice - Public access"""
    
    loader = TransformationDataLoader()
    
    baseline = loader.get_baseline()
    targets = loader.get_targets()
    daily_logs = loader.get_daily_logs()
    
    # Convert daily logs to text format for Grok
    log_content = f"Baseline: {baseline}\nTargets: {targets}\nDaily Logs: {daily_logs}"
    advice = get_grok_advice(log_content, daily_logs, baseline, targets)
    
    return jsonify({
        'advice': advice,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/stats')
def get_stats():
    """API endpoint for aggregated statistics - public access"""
    try:
        loader = TransformationDataLoader()
        daily_logs = loader.get_daily_logs()
        
        # Calculate total fish demolished (handle both old and new schema)
        total_fish_kg = 0
        try:
            for day in daily_logs:
                # Handle both old and new schema
                total_obj = day.get('total', {})
                fish = total_obj.get('seafoodKg') or total_obj.get('seafood_kg') or day.get('seafoodKg') or day.get('seafood_kg') or 0
                if fish:
                    total_fish_kg += float(fish)
        except Exception as e:
            print(f"Error calculating total fish: {e}")
            total_fish_kg = 0
        
        # Get baseline ALT for countdown
        baseline = loader.get_baseline()
        current_alt = baseline.get('alt', 315) or 315
        target_alt = 100  # Countdown to <100
        alt_remaining = max(0, current_alt - target_alt)
        
        # Initialize stats dict
        stats = {}
        
        # Calculate averages (handle both old and new schema)
        if daily_logs:
            try:
                proteins = []
                carbs = []
                fats = []
                for d in daily_logs:
                    # Handle both old and new schema
                    total_obj = d.get('total', {})
                    if total_obj:
                        p = total_obj.get('protein') or d.get('protein')
                        c = total_obj.get('carbs') or d.get('carbs')
                        f = total_obj.get('fat') or d.get('fat')
                    else:
                        p = d.get('protein')
                        c = d.get('carbs')
                        f = d.get('fat')
                    
                    if p:
                        proteins.append(float(p))
                    if c:
                        carbs.append(float(c))
                    if f:
                        fats.append(float(f))
                
                seafoods = []
                for d in daily_logs:
                    total_obj = d.get('total', {})
                    fish = total_obj.get('seafoodKg') or total_obj.get('seafood_kg') or d.get('seafoodKg') or d.get('seafood_kg')
                    if fish:
                        seafoods.append(float(fish))
                
                stats['avg_protein'] = round(sum(proteins) / len(proteins), 1) if proteins else 0
                stats['avg_carbs'] = round(sum(carbs) / len(carbs), 1) if carbs else 0
                stats['avg_fat'] = round(sum(fats) / len(fats), 1) if fats else 0
                stats['avg_seafood'] = round(sum(seafoods) / len(seafoods), 2) if seafoods else 0
            except Exception as e:
                print(f"Error calculating averages: {e}")
                stats['avg_protein'] = 0
                stats['avg_carbs'] = 0
                stats['avg_fat'] = 0
                stats['avg_seafood'] = 0
        else:
            stats['avg_protein'] = 0
            stats['avg_carbs'] = 0
            stats['avg_fat'] = 0
            stats['avg_seafood'] = 0
        
        stats['total_fish_kg'] = round(total_fish_kg, 2)
        stats['alt_current'] = current_alt
        stats['alt_target'] = target_alt
        stats['alt_remaining'] = alt_remaining
        
        return jsonify(stats)
    except Exception as e:
        print(f"Error in /api/stats: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'avg_protein': 0,
            'avg_carbs': 0,
            'avg_fat': 0,
            'avg_seafood': 0,
            'total_fish_kg': 0,
            'alt_current': 315,
            'alt_target': 100,
            'alt_remaining': 215
        }), 500


@app.route('/api/update-log', methods=['POST'])
def update_log():
    """API endpoint for Grok AI to update the transformation log file"""
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        # Get the update content
        update_content = data.get('content', '')
        update_type = data.get('type', 'append')  # 'append', 'replace', 'update_day'
        day_number = data.get('day', None)
        
        if not update_content:
            return jsonify({'success': False, 'error': 'No content provided'}), 400
        
        log_file = Path('transformation_log.md')
        
        # Read current content
        if log_file.exists():
            current_content = log_file.read_text(encoding='utf-8')
        else:
            current_content = "# D – Ripped 2026 Transformation Log\n\n"
        
        # Handle different update types
        if update_type == 'append':
            # Append new day entry
            new_content = current_content + "\n\n" + update_content
        elif update_type == 'update_day' and day_number:
            # Update specific day entry
            day_pattern = rf'### Day {day_number} – ([^\n]+)'
            match = re.search(day_pattern, current_content)
            if match:
                # Replace existing day entry
                start_pos = match.start()
                next_day_match = re.search(r'### Day \d+ –', current_content[start_pos + 10:])
                if next_day_match:
                    end_pos = start_pos + 10 + next_day_match.start()
                else:
                    end_pos = len(current_content)
                new_content = current_content[:start_pos] + update_content + current_content[end_pos:]
            else:
                # Day doesn't exist, append it
                new_content = current_content + "\n\n" + update_content
        elif update_type == 'replace':
            # Replace entire file (use with caution)
            new_content = update_content
        else:
            return jsonify({'success': False, 'error': f'Invalid update type: {update_type}'}), 400
        
        # Write to file
        # Note: On Vercel, filesystem is read-only, so we'll save to a different location
        # In production, you might want to use a database or file storage service
        is_vercel = os.getenv('VERCEL') == '1'
        
        if is_vercel:
            # On Vercel, we can't write to filesystem
            # Option 1: Store in a database (recommended)
            # Option 2: Use Vercel Blob storage
            # Option 3: Return the updated content for manual commit
            return jsonify({
                'success': True,
                'message': 'File update generated (Vercel read-only filesystem)',
                'updated_content': new_content,
                'instructions': 'Copy the updated_content and commit to Git, or use a database for storage'
            })
        else:
            # Local development - write directly
            log_file.write_text(new_content, encoding='utf-8')
            return jsonify({
                'success': True,
                'message': 'Log file updated successfully',
                'file': str(log_file)
            })
            
    except Exception as e:
        error_msg = str(e)
        print(f"Error updating log: {error_msg}")
        return jsonify({
            'success': False,
            'error': f'Failed to update log: {error_msg}'
        }), 500


@app.route('/api/upload-photo', methods=['POST'])
def upload_photo():
    """Upload photo to Vercel Blob storage - Public access"""
    
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
                # Vercel Blob returns different formats - handle all possibilities
                blob_url = (result.get('url') or 
                           result.get('downloadUrl') or 
                           result.get('pathname') or
                           f'https://blob.vercel-storage.com/{filename}')
                
                # Ensure full URL
                if not blob_url.startswith('http'):
                    blob_url = f'https://blob.vercel-storage.com/{blob_url}'
                
                # Store the uploaded photo URL in a simple text file for retrieval
                # This is a fallback if Blob list API doesn't work
                try:
                    photos_file = Path('uploaded_photos.txt')
                    with open(photos_file, 'a') as f:
                        f.write(f"{blob_url}|{datetime.now().isoformat()}\n")
                except Exception as e:
                    print(f"Could not save photo URL to file: {e}")
                
                # Log for debugging
                print(f"Upload successful: {blob_url}")
                # Return the URL - client will store it in localStorage
                return jsonify({
                    'success': True, 
                    'url': blob_url,
                    'filename': filename,
                    'message': 'Photo uploaded successfully'
                })
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


@app.route('/api/training')
def get_training_data():
    """API endpoint to get all training data grouped by exercise - public access"""
    try:
        loader = TransformationDataLoader()
        daily_logs = loader.get_daily_logs()
        
        # Parse training data from all logs
        training_data = []
        
        for log in daily_logs:
            date = log.get('date', '')
            day = log.get('day', 0)
            training = log.get('training', '')
            
            if not training:
                continue
            
            # Handle both string and object formats
            if isinstance(training, str):
                # Simple string format - try to extract basic info
                training_data.append({
                    'date': date,
                    'day': day,
                    'type': 'string',
                    'content': training,
                    'exercises': []
                })
            elif isinstance(training, dict):
                # Structured format
                session = training.get('session', '')
                workout = training.get('workout', [])
                
                exercises = []
                for exercise_obj in workout:
                    exercise_name = exercise_obj.get('exercise', '')
                    sets = exercise_obj.get('sets', [])
                    notes = exercise_obj.get('notes', '')
                    
                    # Preserve all weight fields (both kg and lbs) for later processing
                    exercises.append({
                        'name': exercise_name,
                        'weight_each_side_lbs': exercise_obj.get('weight_each_side_lbs'),
                        'total_added_weight_lbs': exercise_obj.get('total_added_weight_lbs'),
                        'weight_each_side_kg': exercise_obj.get('weight_each_side_kg'),
                        'total_added_weight_kg': exercise_obj.get('total_added_weight_kg'),
                        'sets': sets,
                        'notes': notes
                    })
                
                training_data.append({
                    'date': date,
                    'day': day,
                    'type': 'structured',
                    'session': session,
                    'exercises': exercises
                })
        
        # Group exercises by name for progression tracking
        exercise_groups = {}
        
        for entry in training_data:
            if entry['type'] == 'structured':
                for ex in entry['exercises']:
                    ex_name = ex['name']
                    if not ex_name:
                        continue
                    
                    if ex_name not in exercise_groups:
                        exercise_groups[ex_name] = []
                    
                    # Extract weight info - handle both kg and lbs
                    weight = None
                    weight_each_side = None
                    
                    # Try lbs first
                    if ex.get('total_added_weight_lbs'):
                        weight = ex['total_added_weight_lbs']
                    elif ex.get('weight_each_side_lbs'):
                        weight_each_side = ex['weight_each_side_lbs']
                        weight = ex['weight_each_side_lbs'] * 2  # Approximate total
                    
                    # Try kg and convert to lbs (1 kg = 2.20462 lbs)
                    if weight is None:
                        if ex.get('total_added_weight_kg'):
                            weight = ex['total_added_weight_kg'] * 2.20462
                        elif ex.get('weight_each_side_kg'):
                            weight_each_side = ex['weight_each_side_kg'] * 2.20462
                            weight = weight_each_side * 2
                    
                    # Extract sets/reps - handle flexible structures
                    sets_reps = []
                    if ex.get('sets'):
                        for s in ex['sets']:
                            set_info = {
                                'set': s.get('set', 0),
                                'reps': s.get('reps'),
                                'distance': s.get('distance'),
                                'weight_each_side_kg': s.get('weight_each_side_kg'),
                                'weight_each_side_lbs': s.get('weight_each_side_lbs')
                            }
                            # If set has weight info, use it for this set
                            if set_info['weight_each_side_kg']:
                                set_info['weight_each_side_lbs'] = set_info['weight_each_side_kg'] * 2.20462
                            sets_reps.append(set_info)
                    
                    exercise_groups[ex_name].append({
                        'date': entry['date'],
                        'day': entry['day'],
                        'weight_lbs': weight,
                        'weight_each_side_lbs': weight_each_side or ex.get('weight_each_side_lbs'),
                        'weight_kg': ex.get('total_added_weight_kg') or (ex.get('weight_each_side_kg') * 2 if ex.get('weight_each_side_kg') else None),
                        'sets_reps': sets_reps,
                        'notes': ex.get('notes', '')
                    })
        
        # Sort each exercise group by date
        for ex_name in exercise_groups:
            exercise_groups[ex_name].sort(key=lambda x: x['date'])
        
        # Debug logging
        print(f"Training API: Found {len(training_data)} training sessions")
        print(f"Training API: Found {len(exercise_groups)} exercise groups")
        for ex_name, sessions in exercise_groups.items():
            print(f"  - {ex_name}: {len(sessions)} sessions")
        
        return jsonify({
            'training_data': training_data,
            'exercise_groups': exercise_groups,
            'total_sessions': len(training_data)
        })
    except Exception as e:
        print(f"Error in /api/training: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'training_data': [],
            'exercise_groups': {},
            'total_sessions': 0
        }), 500

@app.route('/api/photos')
def get_photos():
    """Get list of uploaded photos - public access"""
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
        
        # Also check the simple text file with uploaded URLs (fallback)
        photos_file = Path('uploaded_photos.txt')
        if photos_file.exists():
            try:
                with open(photos_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if '|' in line:
                            url, date = line.split('|', 1)
                            # Only add if not already in photos list
                            if not any(p.get('url') == url for p in photos):
                                photos.append({
                                    'url': url,
                                    'date': date
                                })
            except Exception as e:
                print(f"Error reading photos file: {e}")
        
        # Sort by date, newest first
        photos.sort(key=lambda x: x['date'], reverse=True)
        print(f"Returning {len(photos)} photos")
        return jsonify({'photos': photos})
    except Exception as e:
        return jsonify({'photos': [], 'error': str(e)})


if __name__ == '__main__':
    # Use PORT from environment (for production) or default to 5001 (local dev)
    port = int(os.getenv('PORT', 5001))
    debug = os.getenv('FLASK_ENV') != 'production'
    app.run(debug=debug, host='0.0.0.0', port=port)

