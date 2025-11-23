#!/usr/bin/env python3
"""
Transformation Log Web App with Grok Integration
Flask web application to visualize transformation progress and get AI advice
"""

from flask import Flask, render_template, jsonify, request, session, redirect, url_for
import re
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import os
import hashlib
from functools import wraps
import tempfile

app = Flask(__name__, 
            static_folder='static',
            template_folder='templates')

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


@app.route('/api/data')
def get_data():
    """API endpoint to get all transformation data - public access"""
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
        
        # Build conversation messages
        messages = [
            {
                "role": "system",
                "content": """You are a helpful AI assistant for a transformation/fitness tracking app. 
You can help users:
- Add or update daily log entries
- Upload progress photos
- View current data and stats
- Provide advice based on their progress

Be friendly, concise, and actionable. When adding day entries, format them in markdown following the existing log format."""
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
            # Format day entry in markdown
            day = args.get('day')
            date = args.get('date')
            protein = args.get('protein')
            carbs = args.get('carbs')
            fat = args.get('fat')
            kcal = args.get('kcal')
            seafood_kg = args.get('seafood_kg')
            training = args.get('training', '')
            supplements = args.get('supplements', 'All')
            feeling = args.get('feeling', '')
            notes = args.get('notes', '')
            
            # Format seafood
            seafood_str = f"{seafood_kg} kg" if seafood_kg else ""
            
            # Build markdown entry
            entry = f"### Day {day} – {date}\n\n"
            if seafood_str:
                entry += f"- Seafood: {seafood_str}\n"
            entry += f"- Protein {protein} g | Carbs {carbs} g | Fat {fat} g"
            if kcal:
                entry += f" | {kcal} kcal"
            entry += "\n"
            if training:
                entry += f"- Training: {training}\n"
            if supplements:
                entry += f"- Supplements: {supplements}\n"
            if feeling:
                entry += f"- Feeling: {feeling}\n"
            if notes:
                entry += f"- Notes: {notes}\n"
            
            # Update log file
            log_file = Path('transformation_log.md')
            if log_file.exists():
                current_content = log_file.read_text(encoding='utf-8')
            else:
                current_content = "# D – Ripped 2026 Transformation Log\n\n"
            
            new_content = current_content + "\n\n" + entry
            
            # Write to file (or return for Git commit on Vercel)
            is_vercel = os.getenv('VERCEL') == '1'
            if is_vercel:
                return {
                    'success': True,
                    'message': 'Day entry created (Vercel read-only)',
                    'entry': entry,
                    'updated_content': new_content,
                    'instructions': 'Entry ready for Git commit'
                }
            else:
                log_file.write_text(new_content, encoding='utf-8')
                return {
                    'success': True,
                    'message': f'Day {day} entry added successfully',
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
            parser = TransformationLogParser()
            baseline = parser.get_baseline()
            daily_logs = parser.get_daily_logs()
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
    """API endpoint for aggregated statistics - public access"""
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

