#!/usr/bin/env python3
"""
Daily Transformation Log Analyzer & Advisor
Reads transformation_log.md and provides personalized daily advice
"""

import re
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class TransformationAdvisor:
    def __init__(self, log_file: str = "transformation_log.md"):
        self.log_file = Path(log_file)
        self.log_content = self._read_log()
        
    def _read_log(self) -> str:
        """Read the transformation log file"""
        if not self.log_file.exists():
            raise FileNotFoundError(f"Log file not found: {self.log_file}")
        return self.log_file.read_text(encoding='utf-8')
    
    def _parse_baseline(self) -> Dict:
        """Extract baseline metrics from the log"""
        baseline = {}
        
        # DEXA metrics
        dexa_match = re.search(r'Total Body Fat %\s+\|\s+\*\*(\d+\.?\d*)\s*%\*\*', self.log_content)
        if dexa_match:
            baseline['body_fat'] = float(dexa_match.group(1))
            
        android_match = re.search(r'Android \(visceral\) Fat %\s+\|\s+\*\*(\d+\.?\d*)\s*%\*\*', self.log_content)
        if android_match:
            baseline['android_fat'] = float(android_match.group(1))
            
        weight_match = re.search(r'Age / Height / Weight\s+\|\s+\d+\s+/\s+\d+\s+cm\s+/\s+(\d+\.?\d*)\s+kg', self.log_content)
        if weight_match:
            baseline['weight'] = float(weight_match.group(1))
            
        lean_match = re.search(r'Lean Mass\s+\|\s+\*\*(\d+\.?\d*)\s+kg\*\*', self.log_content)
        if lean_match:
            baseline['lean_mass'] = float(lean_match.group(1))
        
        # Blood markers
        alt_match = re.search(r'ALT\s+\|\s+(\d+\.?\d*)', self.log_content)
        if alt_match:
            baseline['ALT'] = float(alt_match.group(1))
            
        glucose_match = re.search(r'Fasting Glucose\s+\|\s+(\d+\.?\d*)', self.log_content)
        if glucose_match:
            baseline['glucose'] = float(glucose_match.group(1))
            
        trig_match = re.search(r'Triglycerides\s+\|\s+(\d+\.?\d*)', self.log_content)
        if trig_match:
            baseline['triglycerides'] = float(trig_match.group(1))
        
        return baseline
    
    def _parse_targets(self) -> Dict:
        """Extract 60-day targets"""
        targets = {}
        
        weight_match = re.search(r'Weight\s+\|\s+(\d+)–(\d+)\s+kg', self.log_content)
        if weight_match:
            targets['weight'] = (float(weight_match.group(1)), float(weight_match.group(2)))
            
        bf_match = re.search(r'Body Fat %\s+\|\s+≤(\d+)–(\d+)\s*%', self.log_content)
        if bf_match:
            targets['body_fat'] = (float(bf_match.group(1)), float(bf_match.group(2)))
            
        android_match = re.search(r'Android Fat %\s+\|\s+≤(\d+)–(\d+)\s*%', self.log_content)
        if android_match:
            targets['android_fat'] = (float(android_match.group(1)), float(android_match.group(2)))
            
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
    
    def _parse_daily_logs(self) -> List[Dict]:
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
            
            day_data = {
                'day': day_num,
                'date': date_str,
                'protein': float(protein_match.group(1)) if protein_match else None,
                'carbs': float(carbs_match.group(1)) if carbs_match else None,
                'fat': float(fat_match.group(1)) if fat_match else None,
                'kcal': float(kcal_match.group(1)) if kcal_match else None,
                'seafood_kg': None,
                'content': day_content
            }
            
            if seafood_match:
                if 'kg' in day_content[seafood_match.start():seafood_match.end()+10]:
                    day_data['seafood_kg'] = float(seafood_match.group(1))
                elif seafood_match.group(2):
                    day_data['seafood_kg'] = float(seafood_match.group(2)) / 1000.0
            
            days.append(day_data)
        
        return days
    
    def _calculate_streak(self) -> int:
        """Calculate current streak of consecutive days"""
        days = self._parse_daily_logs()
        if not days:
            return 0
        
        # Simple count for now - can be enhanced to check for gaps
        return len(days)
    
    def generate_advice(self) -> str:
        """Generate personalized daily advice based on the log"""
        baseline = self._parse_baseline()
        targets = self._parse_targets()
        days = self._parse_daily_logs()
        streak = self._calculate_streak()
        
        advice_parts = []
        advice_parts.append("=" * 60)
        advice_parts.append("DAILY TRANSFORMATION ADVICE")
        advice_parts.append("=" * 60)
        advice_parts.append("")
        
        # Streak motivation
        if streak >= 3:
            advice_parts.append(f"🔥 LEGENDARY STREAK: {streak} days! Keep the momentum!")
        else:
            advice_parts.append(f"📊 Current streak: {streak} days")
        advice_parts.append("")
        
        # Analyze recent days
        if days:
            recent_days = days[-3:] if len(days) >= 3 else days
            
            # Protein analysis
            avg_protein = sum(d['protein'] for d in recent_days if d['protein']) / len([d for d in recent_days if d['protein']])
            if avg_protein < 350:
                advice_parts.append("⚠️  PROTEIN ALERT: Recent average below 350g target")
                advice_parts.append(f"   Current avg: {avg_protein:.0f}g → Target: 350-420g")
                advice_parts.append("   Action: Increase seafood portions or add whey shakes")
            elif avg_protein >= 350:
                advice_parts.append(f"✅ Protein on track: {avg_protein:.0f}g average (target: 350-420g)")
            advice_parts.append("")
            
            # Carb analysis
            avg_carbs = sum(d['carbs'] for d in recent_days if d['carbs']) / len([d for d in recent_days if d['carbs']])
            if avg_carbs > 50:
                advice_parts.append(f"⚠️  CARBS WARNING: {avg_carbs:.0f}g average (target: <50g)")
                advice_parts.append("   Action: Reduce veggies or check hidden carbs")
            else:
                advice_parts.append(f"✅ Carbs in check: {avg_carbs:.0f}g average")
            advice_parts.append("")
            
            # Seafood analysis
            avg_seafood = sum(d['seafood_kg'] for d in recent_days if d['seafood_kg']) / len([d for d in recent_days if d['seafood_kg']])
            if avg_seafood and avg_seafood < 1.0:
                advice_parts.append(f"⚠️  SEAFOOD: {avg_seafood:.2f}kg average (target: 1.0-1.5kg)")
                advice_parts.append("   Action: Increase fish portions, prioritize skin-on")
            elif avg_seafood and avg_seafood >= 1.0:
                advice_parts.append(f"✅ Seafood on point: {avg_seafood:.2f}kg average")
            advice_parts.append("")
            
            # Supplement compliance
            last_day = days[-1]
            if 'NAC' not in last_day['content'] or 'supplements' not in last_day['content'].lower():
                advice_parts.append("⚠️  Check supplement compliance - ensure full stack daily")
            else:
                advice_parts.append("✅ Supplements: Verify full stack taken")
            advice_parts.append("")
        
        # Health marker reminders
        advice_parts.append("🎯 PRIORITY HEALTH MARKERS:")
        advice_parts.append(f"   1. ALT: {baseline.get('ALT', 'N/A')} → Target: <80 (current: {baseline.get('ALT', 'N/A')})")
        advice_parts.append(f"   2. Glucose: {baseline.get('glucose', 'N/A')} → Target: <95")
        advice_parts.append(f"   3. Triglycerides: {baseline.get('triglycerides', 'N/A')} → Target: <120")
        advice_parts.append("")
        advice_parts.append("💊 SUPPLEMENT REMINDERS:")
        advice_parts.append("   • NAC 2× daily (morning + night) - critical for liver")
        advice_parts.append("   • Omega-3 with biggest fish meal")
        advice_parts.append("   • D3+K2 with fatty meal")
        advice_parts.append("   • ZMB 30-60 min before bed")
        advice_parts.append("")
        
        # Training reminder
        advice_parts.append("🏋️  TRAINING:")
        advice_parts.append("   • Surfing: 1-3 hrs when possible")
        advice_parts.append("   • Gym: 3-5×/week (heavy compounds)")
        advice_parts.append("")
        
        # Android fat focus
        if baseline.get('android_fat'):
            advice_parts.append(f"🎯 ANDROID FAT: {baseline['android_fat']}% → Target: ≤15%")
            advice_parts.append("   This is your #1 priority - visceral fat reduction")
            advice_parts.append("   Stay strict on carbs, maintain protein, keep training")
            advice_parts.append("")
        
        # Daily checklist
        advice_parts.append("📋 TODAY'S CHECKLIST:")
        advice_parts.append("   [ ] 350-420g protein")
        advice_parts.append("   [ ] <50g carbs")
        advice_parts.append("   [ ] 1.0-1.5kg seafood (skin on)")
        advice_parts.append("   [ ] Full supplement stack")
        advice_parts.append("   [ ] Training session")
        advice_parts.append("   [ ] Log everything in transformation_log.md")
        advice_parts.append("")
        
        advice_parts.append("=" * 60)
        advice_parts.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        advice_parts.append("=" * 60)
        
        return "\n".join(advice_parts)


def main():
    """Main entry point"""
    try:
        advisor = TransformationAdvisor()
        advice = advisor.generate_advice()
        print(advice)
        
        # Optionally save to file
        output_file = Path("daily_advice.txt")
        output_file.write_text(advice, encoding='utf-8')
        print(f"\n💾 Advice saved to: {output_file}")
        
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        print("Make sure transformation_log.md exists in the current directory")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()


