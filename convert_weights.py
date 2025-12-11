#!/usr/bin/env python3
"""
Convert all training weights from kg to lbs in daily log files.
1 kg = 2.20462 lbs
"""

import json
import os
import glob
from pathlib import Path

KG_TO_LBS = 2.20462

def convert_kg_to_lbs(kg_value):
    """Convert kg to lbs, rounding to nearest whole number"""
    if kg_value is None:
        return None
    return round(kg_value * KG_TO_LBS)

def convert_exercise(exercise):
    """Convert all kg fields to lbs in an exercise object"""
    converted = exercise.copy()
    
    # Convert weight_each_side_kg to weight_each_side_lbs
    if 'weight_each_side_kg' in converted:
        if converted['weight_each_side_kg'] is not None:
            converted['weight_each_side_lbs'] = convert_kg_to_lbs(converted['weight_each_side_kg'])
        del converted['weight_each_side_kg']
    
    # Convert total_added_weight_kg to total_added_weight_lbs
    if 'total_added_weight_kg' in converted:
        if converted['total_added_weight_kg'] is not None:
            converted['total_added_weight_lbs'] = convert_kg_to_lbs(converted['total_added_weight_kg'])
        del converted['total_added_weight_kg']
    
    # Convert sets if they exist
    if 'sets' in converted and isinstance(converted['sets'], list):
        converted_sets = []
        for set_item in converted['sets']:
            if isinstance(set_item, dict):
                converted_set = set_item.copy()
                if 'weight_each_side_kg' in converted_set and converted_set['weight_each_side_kg'] is not None:
                    converted_set['weight_each_side_lbs'] = convert_kg_to_lbs(converted_set['weight_each_side_kg'])
                    del converted_set['weight_each_side_kg']
                converted_sets.append(converted_set)
            else:
                converted_sets.append(set_item)
        converted['sets'] = converted_sets
    
    return converted

def process_daily_log_file(file_path):
    """Process a single daily log file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        modified = False
        
        # Process training data if it exists
        if 'training' in data and isinstance(data['training'], dict):
            if 'workout' in data['training'] and isinstance(data['training']['workout'], list):
                converted_workout = []
                for exercise in data['training']['workout']:
                    if isinstance(exercise, dict):
                        converted_ex = convert_exercise(exercise)
                        if converted_ex != exercise:
                            modified = True
                        converted_workout.append(converted_ex)
                    else:
                        converted_workout.append(exercise)
                data['training']['workout'] = converted_workout
        
        # Write back if modified
        if modified:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Process all daily log files"""
    base_dir = Path(__file__).parent
    
    # Process files in api/data/daily-logs/
    api_dir = base_dir / 'api' / 'data' / 'daily-logs'
    api_files = list(api_dir.glob('*.json'))
    
    # Process files in public/data/daily-logs/
    public_dir = base_dir / 'public' / 'data' / 'daily-logs'
    public_files = list(public_dir.glob('*.json'))
    
    all_files = api_files + public_files
    
    print(f"Found {len(all_files)} daily log files")
    
    converted_count = 0
    for file_path in sorted(all_files):
        if process_daily_log_file(file_path):
            converted_count += 1
            print(f"Converted: {file_path.name}")
    
    print(f"\nConversion complete! {converted_count} files modified.")

if __name__ == '__main__':
    main()

