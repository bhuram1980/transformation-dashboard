#!/usr/bin/env python3
"""
Consolidate all training data from daily log files into a single JSON file.
"""

import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

def load_all_training_data() -> Dict[str, Any]:
    """Load all training data from daily log files"""
    
    # Try both possible locations
    daily_logs_dirs = [
        Path('public/data/daily-logs'),
        Path('api/data/daily-logs'),
        Path('data/daily-logs')
    ]
    
    daily_logs_dir = None
    for dir_path in daily_logs_dirs:
        if dir_path.exists():
            daily_logs_dir = dir_path
            break
    
    if not daily_logs_dir:
        raise FileNotFoundError("Could not find daily-logs directory")
    
    print(f"Loading training data from: {daily_logs_dir}")
    
    # Get all JSON files sorted by date
    json_files = sorted(daily_logs_dir.glob("*.json"))
    print(f"Found {len(json_files)} daily log files")
    
    all_training_data = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "total_sessions": 0,
            "date_range": {
                "earliest": None,
                "latest": None
            },
            "total_exercises": 0,
            "total_sets": 0
        },
        "sessions": []
    }
    
    dates = []
    total_exercises = 0
    total_sets = 0
    
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                day_data = json.load(f)
            
            date = day_data.get('date', '')
            if not date:
                continue
            
            dates.append(date)
            
            training = day_data.get('training', {})
            
            # Skip if no training data
            if not training:
                continue
            
            # Handle both string and object formats
            if isinstance(training, str):
                # Simple string format
                session_data = {
                    "date": date,
                    "day": day_data.get('day'),
                    "fasted_weight": day_data.get('fastedWeight'),
                    "waist": day_data.get('waist'),
                    "feeling": day_data.get('feeling'),
                    "notes": day_data.get('notes'),
                    "session_type": "string",
                    "session_name": None,
                    "training_description": training,
                    "exercises": []
                }
            elif isinstance(training, dict):
                # Structured format
                session_name = training.get('session', '')
                workout = training.get('workout', [])
                
                exercises = []
                for exercise_obj in workout:
                    exercise_name = exercise_obj.get('exercise', '')
                    sets = exercise_obj.get('sets', [])
                    notes = exercise_obj.get('notes', '')
                    
                    # Collect all weight information
                    exercise_data = {
                        "exercise": exercise_name,
                        "weight_each_side_kg": exercise_obj.get('weight_each_side_kg'),
                        "weight_each_side_lbs": exercise_obj.get('weight_each_side_lbs'),
                        "total_added_weight_kg": exercise_obj.get('total_added_weight_kg'),
                        "total_added_weight_lbs": exercise_obj.get('total_added_weight_lbs'),
                        "sets": [],
                        "notes": notes
                    }
                    
                    # Process each set - handle both list and integer formats
                    if isinstance(sets, int):
                        # If sets is just a number, create placeholder entries
                        for i in range(sets):
                            set_info = {
                                "set_number": i + 1,
                                "reps": None,
                                "distance": None,
                                "weight_each_side_kg": None,
                                "weight_each_side_lbs": None,
                                "total_added_weight_kg": None,
                                "total_added_weight_lbs": None
                            }
                            exercise_data["sets"].append(set_info)
                    elif isinstance(sets, list):
                        # Normal case: sets is an array
                        for set_data in sets:
                            set_info = {
                                "set_number": set_data.get('set'),
                                "reps": set_data.get('reps'),
                                "distance": set_data.get('distance'),
                                "weight_each_side_kg": set_data.get('weight_each_side_kg'),
                                "weight_each_side_lbs": set_data.get('weight_each_side_lbs'),
                                "total_added_weight_kg": set_data.get('total_added_weight_kg'),
                                "total_added_weight_lbs": set_data.get('total_added_weight_lbs')
                            }
                            exercise_data["sets"].append(set_info)
                    
                    # Count sets for metadata
                    if isinstance(sets, int):
                        total_sets += sets
                    elif isinstance(sets, list):
                        total_sets += len(sets)
                    
                    exercises.append(exercise_data)
                    total_exercises += 1
                
                session_data = {
                    "date": date,
                    "day": day_data.get('day'),
                    "fasted_weight": day_data.get('fastedWeight'),
                    "waist": day_data.get('waist'),
                    "feeling": day_data.get('feeling'),
                    "notes": day_data.get('notes'),
                    "session_type": "structured",
                    "session_name": session_name,
                    "training_description": None,
                    "exercises": exercises
                }
            else:
                continue
            
            all_training_data["sessions"].append(session_data)
            
        except Exception as e:
            print(f"Error loading {json_file.name}: {e}")
            continue
    
    # Update metadata
    if dates:
        dates_sorted = sorted(dates)
        all_training_data["metadata"]["date_range"]["earliest"] = dates_sorted[0]
        all_training_data["metadata"]["date_range"]["latest"] = dates_sorted[-1]
    
    all_training_data["metadata"]["total_sessions"] = len(all_training_data["sessions"])
    all_training_data["metadata"]["total_exercises"] = total_exercises
    all_training_data["metadata"]["total_sets"] = total_sets
    
    # Sort sessions by date
    all_training_data["sessions"].sort(key=lambda x: x.get('date', ''))
    
    return all_training_data

def main():
    """Main function to consolidate training data"""
    try:
        print("Starting training data consolidation...")
        
        training_data = load_all_training_data()
        
        # Save to JSON file
        output_file = Path('public/data/all-training-data.json')
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(training_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Successfully consolidated training data!")
        print(f"   Output file: {output_file}")
        print(f"   Total sessions: {training_data['metadata']['total_sessions']}")
        print(f"   Total exercises: {training_data['metadata']['total_exercises']}")
        print(f"   Total sets: {training_data['metadata']['total_sets']}")
        print(f"   Date range: {training_data['metadata']['date_range']['earliest']} to {training_data['metadata']['date_range']['latest']}")
        
        # Also save to api/data
        api_output_file = Path('api/data/all-training-data.json')
        api_output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(api_output_file, 'w', encoding='utf-8') as f:
            json.dump(training_data, f, indent=2, ensure_ascii=False)
        print(f"   Also saved to: {api_output_file}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())
