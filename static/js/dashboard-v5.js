// V5 Dashboard JavaScript - Stripe-Inspired

let v5DashboardData = null;
let v5CurrentDay = null;

// Helper functions
function parseWeight(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(parsed) ? null : parsed;
}

function parseNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
}

function getDailyTotals(dayData = {}) {
    if (!dayData) return { protein: 0, carbs: 0, fat: 0, kcal: 0, seafoodKg: 0 };
    const total = dayData.total || {};
    return {
        protein: parseNumber(total.protein ?? dayData.protein),
        carbs: parseNumber(total.carbs ?? dayData.carbs),
        fat: parseNumber(total.fat ?? dayData.fat),
        kcal: parseNumber(total.kcal ?? dayData.kcal),
        seafoodKg: parseNumber(total.seafoodKg ?? total.seafood_kg ?? dayData.seafoodKg ?? dayData.seafood_kg)
    };
}

// Load data on page load
document.addEventListener('DOMContentLoaded', async function() {
    await v5LoadData();
    v5SetupNavigation();
    v5SetupSmoothScroll();
    v5InitializeHeroCarousel();
});

async function v5LoadData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        v5DashboardData = data;
        
        v5UpdateStats(data);
        v5UpdateHero(data);
        v5PopulateDaySelectors(data);
        v5UpdateProgressTable(data);
        v5UpdateFooter(data);
        
        // Load today's data by default
        if (data.daily_logs && data.daily_logs.length > 0) {
            v5CurrentDay = data.daily_logs[data.daily_logs.length - 1];
            v5LoadDayData();
        }
        
        return data;
    } catch (error) {
        console.error('Error loading data:', error);
        return null;
    }
}

function v5UpdateStats(data) {
    const dailyLogs = data.daily_logs || [];
    const streak = data.streak || 0;
    const baseline = data.baseline || {};
    
    // Streak
    const streakEl = document.getElementById('v5StatStreak');
    const streakProgress = document.getElementById('v5StreakProgress');
    if (streakEl) {
        streakEl.textContent = streak > 0 ? `${streak} days` : 'Fire it up!';
    }
    if (streakProgress) {
        streakProgress.style.width = Math.min(100, (streak / 30) * 100) + '%';
    }
    
    // Weight
    const latestLog = dailyLogs.length > 0 ? dailyLogs[dailyLogs.length - 1] : null;
    const currentWeight = latestLog ? parseWeight(latestLog.fastedWeight ?? latestLog.fasted_weight) : null;
    const baselineWeight = parseWeight(baseline.weight ?? baseline.weightKg ?? 90.0);
    
    const weightEl = document.getElementById('v5StatWeight');
    const weightProgress = document.getElementById('v5WeightProgress');
    if (weightEl) {
        if (currentWeight !== null) {
            const delta = baselineWeight && currentWeight ? (baselineWeight - currentWeight).toFixed(1) : '';
            weightEl.textContent = `${currentWeight.toFixed(1)} kg${delta ? ` (-${delta} kg)` : ''}`;
        } else {
            weightEl.textContent = 'Upload to unlock';
        }
    }
    if (weightProgress && baselineWeight && currentWeight) {
        const progress = Math.max(0, Math.min(100, ((baselineWeight - currentWeight) / (baselineWeight - 82)) * 100));
        weightProgress.style.width = progress + '%';
    }
    
    // Fish
    const totalFish = dailyLogs.reduce((sum, log) => {
        const totals = getDailyTotals(log);
        return sum + totals.seafoodKg;
    }, 0);
    
    const fishEl = document.getElementById('v5StatFish');
    const fishProgress = document.getElementById('v5FishProgress');
    if (fishEl) {
        fishEl.textContent = `${totalFish.toFixed(2)} kg`;
    }
    if (fishProgress) {
        fishProgress.style.width = Math.min(100, (totalFish / 10) * 100) + '%';
    }
    
    // Score
    if (latestLog) {
        const totals = getDailyTotals(latestLog);
        const supplements = latestLog.supplements || {};
        const training = (latestLog.training || '').trim();
        const feeling = parseNumber(latestLog.feeling);
        
        const allSuppTaken = Object.values(supplements).every(val => {
            if (typeof val === 'object' && val !== null) return Boolean(val.taken);
            return Boolean(val);
        });
        
        const criteria = [
            (totals.protein || 0) >= 350,
            (totals.seafoodKg || 0) >= 1,
            allSuppTaken,
            Boolean(training),
            feeling >= 8
        ];
        
        const score = criteria.filter(c => c).length;
        const scoreEl = document.getElementById('v5StatScore');
        const scoreRadial = document.getElementById('v5ScoreRadial');
        
        if (scoreEl) {
            scoreEl.textContent = `${score} / 5`;
        }
        if (scoreRadial) {
            const circumference = 2 * Math.PI * 26;
            const offset = circumference - (score / 5) * circumference;
            scoreRadial.style.strokeDashoffset = offset;
        }
    }
}

function v5UpdateHero(data) {
    const streak = data.streak || 0;
    const streakText = streak > 0 ? `Streak: ${streak} Days 🔥` : 'Streak: 0 Days → Let\'s Break It';
    
    const heroStreak1 = document.getElementById('v5HeroStreak');
    const heroStreak2 = document.getElementById('v5HeroStreak2');
    if (heroStreak1) heroStreak1.textContent = streakText;
    if (heroStreak2) heroStreak2.textContent = streakText;
}

function v5PopulateDaySelectors(data) {
    const dailyLogs = data.daily_logs || [];
    const navSelector = document.getElementById('v5DaySelector');
    const inlineSelector = document.getElementById('v5DaySelectInline');
    
    [navSelector, inlineSelector].forEach(selector => {
        if (!selector) return;
        selector.innerHTML = '<option value="">Select Day</option>';
        
        dailyLogs.forEach((log, idx) => {
            const option = document.createElement('option');
            option.value = log.day || idx + 1;
            const dateLabel = log.date_display || log.date || `Day ${log.day || idx + 1}`;
            option.textContent = `Day ${log.day || idx + 1} - ${dateLabel}`;
            if (idx === dailyLogs.length - 1) {
                option.selected = true;
            }
            selector.appendChild(option);
        });
    });
}

function v5LoadDay() {
    const selector = document.getElementById('v5DaySelector');
    if (!selector) return;
    const day = selector.value;
    if (day) {
        const inlineSelector = document.getElementById('v5DaySelectInline');
        if (inlineSelector) inlineSelector.value = day;
        v5LoadDayData(day);
    }
}

function v5LoadDayData(day = null) {
    if (!v5DashboardData) return;
    
    const dailyLogs = v5DashboardData.daily_logs || [];
    let selectedLog = null;
    
    if (day) {
        selectedLog = dailyLogs.find(log => (log.day || 0) == day);
    } else {
        const inlineSelector = document.getElementById('v5DaySelectInline');
        const selectedDay = inlineSelector ? inlineSelector.value : null;
        if (selectedDay) {
            selectedLog = dailyLogs.find(log => (log.day || 0) == selectedDay);
        } else {
            selectedLog = dailyLogs.length > 0 ? dailyLogs[dailyLogs.length - 1] : null;
        }
    }
    
    v5CurrentDay = selectedLog;
    
    if (selectedLog) {
        v5RenderMeals(selectedLog);
        v5RenderWorkouts(selectedLog);
        v5RenderSurf(selectedLog);
        v5RenderSupplements(selectedLog);
    } else {
        v5RenderEmptyStates();
    }
}

function v5RenderMeals(dayData) {
    const container = document.getElementById('v5MealsContent');
    if (!container) return;
    
    const meals = dayData.meals || {};
    const totals = getDailyTotals(dayData);
    
    if (!meals || Object.keys(meals).length === 0) {
        container.innerHTML = '<div class="v5-empty-state"><p>Upload to unlock meals</p></div>';
        return;
    }
    
    const mealOrder = ['breakfast', 'lunch', 'dinner', 'snacks'];
    const mealLabels = {
        breakfast: 'Breakfast',
        lunch: 'Lunch',
        dinner: 'Dinner',
        snacks: 'Snacks'
    };
    
    let html = '<div class="v5-meals-list">';
    
    mealOrder.forEach(key => {
        const meal = meals[key];
        if (!meal) return;
        
        if (typeof meal === 'object') {
            html += `
                <div class="v5-meal-item">
                    <div class="v5-meal-header">
                        <h4>${mealLabels[key] || key}</h4>
                        <div class="v5-meal-macros">
                            ${meal.protein ? `<span>P: ${meal.protein}g</span>` : ''}
                            ${meal.carbs ? `<span>C: ${meal.carbs}g</span>` : ''}
                            ${meal.fat ? `<span>F: ${meal.fat}g</span>` : ''}
                            ${meal.kcal ? `<span>${meal.kcal} kcal</span>` : ''}
                        </div>
                    </div>
                    <p class="v5-meal-desc">${meal.description || ''}</p>
                </div>
            `;
        }
    });
    
    html += `
        <div class="v5-meal-totals">
            <h4>Daily Totals</h4>
            <div class="v5-totals-grid">
                <div>Protein: <strong>${totals.protein}g</strong></div>
                <div>Carbs: <strong>${totals.carbs}g</strong></div>
                <div>Fat: <strong>${totals.fat}g</strong></div>
                <div>Calories: <strong>${totals.kcal}</strong></div>
                <div>Seafood: <strong>${totals.seafoodKg.toFixed(2)} kg</strong></div>
            </div>
        </div>
    `;
    
    html += '</div>';
    container.innerHTML = html;
}

function v5RenderWorkouts(dayData) {
    const container = document.getElementById('v5WorkoutsContent');
    if (!container) return;
    
    const training = (dayData.training || '').trim();
    
    if (!training) {
        container.innerHTML = '<div class="v5-empty-state"><p>No workouts logged yet</p></div>';
        return;
    }
    
    // Parse workout from training string
    const analysis = analyzeTraining(training);
    
    let html = '<div class="v5-workouts-list">';
    
    if (analysis.workouts.length > 0) {
        analysis.workouts.forEach(workout => {
            html += `
                <div class="v5-workout-item">
                    <h4>${workout.name}</h4>
                    ${workout.weight ? `<p class="v5-workout-weight">${workout.weight}</p>` : ''}
                    ${workout.setsReps ? `<p class="v5-workout-sets">${workout.setsReps}</p>` : ''}
                    ${workout.bodyParts.length ? `<div class="v5-workout-parts">${workout.bodyParts.join(', ')}</div>` : ''}
                </div>
            `;
        });
    } else {
        html += `<div class="v5-workout-item"><p>${training}</p></div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function v5RenderSurf(dayData) {
    const container = document.getElementById('v5SurfContent');
    if (!container) return;
    
    const training = (dayData.training || '').trim();
    const analysis = analyzeTraining(training);
    
    if (!analysis.surfing) {
        container.innerHTML = '<div class="v5-empty-state"><p>Log your surf sessions here</p></div>';
        return;
    }
    
    container.innerHTML = `
        <div class="v5-surf-session">
            <div class="v5-surf-icon">🌊</div>
            <h4>${analysis.surfing.durationText || 'Surf Session'}</h4>
            <p>${analysis.surfing.description || training}</p>
        </div>
    `;
}

function v5RenderSupplements(dayData) {
    const container = document.getElementById('v5SupplementsContent');
    if (!container) return;
    
    const supplements = dayData.supplements || {};
    
    if (!supplements || Object.keys(supplements).length === 0) {
        container.innerHTML = '<div class="v5-empty-state"><p>Supplement stack will appear here</p></div>';
        return;
    }
    
    const labels = {
        omega3: 'Omega-3',
        nac: 'NAC',
        d3k2: 'D3 + K2',
        zmb: 'ZMB Pro',
        whey: 'Whey',
        creatine: 'Creatine'
    };
    
    let html = '<div class="v5-supplements-list">';
    
    Object.entries(supplements).forEach(([key, value]) => {
        const taken = typeof value === 'object' ? Boolean(value.taken) : Boolean(value);
        html += `
            <div class="v5-supplement-item ${taken ? 'taken' : ''}">
                <span class="v5-supplement-check">${taken ? '✔' : '○'}</span>
                <span class="v5-supplement-name">${labels[key] || key}</span>
                ${typeof value === 'object' && value.dose ? `<span class="v5-supplement-dose">${value.dose}</span>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function v5RenderEmptyStates() {
    document.getElementById('v5MealsContent').innerHTML = '<div class="v5-empty-state"><p>Upload to unlock meals</p></div>';
    document.getElementById('v5WorkoutsContent').innerHTML = '<div class="v5-empty-state"><p>No workouts logged yet</p></div>';
    document.getElementById('v5SurfContent').innerHTML = '<div class="v5-empty-state"><p>Log your surf sessions here</p></div>';
    document.getElementById('v5SupplementsContent').innerHTML = '<div class="v5-empty-state"><p>Supplement stack will appear here</p></div>';
}

function v5SwitchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.v5-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active from all tab buttons
    document.querySelectorAll('.v5-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const tabContent = document.getElementById(`v5Tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    
    if (tabContent) tabContent.classList.add('active');
    if (tabButton) tabButton.classList.add('active');
}

function v5UpdateProgressTable(data) {
    const tbody = document.getElementById('v5ProgressTableBody');
    if (!tbody) return;
    
    const baseline = data.baseline || {};
    const targets = data.targets || {};
    const dailyLogs = data.daily_logs || [];
    const latestLog = dailyLogs.length > 0 ? dailyLogs[dailyLogs.length - 1] : null;
    
    const metrics = [
        {
            name: 'Weight',
            baseline: parseWeight(baseline.weight ?? baseline.weightKg ?? 90.0),
            current: latestLog ? parseWeight(latestLog.fastedWeight ?? latestLog.fasted_weight) : null,
            target: targets.weight || '82-85 kg',
            unit: 'kg'
        },
        {
            name: 'Body Fat',
            baseline: baseline.bodyFat || null,
            current: latestLog ? (latestLog.bodyFat || null) : null,
            target: targets.bodyFat || '≤13%',
            unit: '%'
        },
        {
            name: 'Android Fat',
            baseline: baseline.androidFat || null,
            current: latestLog ? (latestLog.androidFat || null) : null,
            target: targets.androidFat || '≤15%',
            unit: '%'
        },
        {
            name: 'ALT',
            baseline: baseline.bloods?.alt || baseline.alt || null,
            current: latestLog ? (latestLog.alt || latestLog.labs?.alt || null) : null,
            target: targets.alt || '<80',
            unit: ''
        }
    ];
    
    let html = '';
    metrics.forEach(metric => {
        const baselineText = metric.baseline !== null ? `${metric.baseline}${metric.unit ? ' ' + metric.unit : ''}` : '--';
        const currentText = metric.current !== null ? `${metric.current}${metric.unit ? ' ' + metric.unit : ''}` : '--';
        const statusClass = metric.current !== null && metric.baseline !== null ? 'on-track' : 'needs-data';
        
        html += `
            <tr class="${statusClass}">
                <td><strong>${metric.name}</strong></td>
                <td>${baselineText}</td>
                <td>${currentText}</td>
                <td>${metric.target}</td>
                <td><canvas class="v5-sparkline" width="80" height="20"></canvas></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function v5UpdateFooter(data) {
    const dailyLogs = data.daily_logs || [];
    const latestLog = dailyLogs.length > 0 ? dailyLogs[dailyLogs.length - 1] : null;
    const teaseEl = document.getElementById('v5LastLogTease');
    
    if (teaseEl && latestLog) {
        const dateLabel = latestLog.date_display || latestLog.date || '';
        const totals = getDailyTotals(latestLog);
        teaseEl.textContent = `Last log: ${dateLabel} - ${totals.protein}g protein, ${totals.seafoodKg.toFixed(2)}kg fish`;
    }
}

function v5FilterProgress() {
    // Filter logic for progress table
    const filter = document.getElementById('v5ProgressFilter').value;
    // Implementation for filtering metrics
}

function v5GenerateShareLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        alert('Share link copied to clipboard!');
    });
}

function v5ScrollToLog() {
    document.getElementById('log').scrollIntoView({ behavior: 'smooth' });
}

function v5SetupNavigation() {
    // Smooth scroll for nav pills
    document.querySelectorAll('.v5-nav-pill').forEach(pill => {
        pill.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const target = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
    
    // Sticky nav behavior
    let lastScroll = 0;
    window.addEventListener('scroll', function() {
        const nav = document.getElementById('v5Nav');
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            nav.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
        } else {
            nav.style.boxShadow = '0 2px 8px rgba(10, 59, 7, 0.1)';
        }
        
        lastScroll = currentScroll;
    });
}

function v5SetupSmoothScroll() {
    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.v5-section').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });
}

function v5InitializeHeroCarousel() {
    const carousel = document.getElementById('v5HeroCarousel');
    if (!carousel) return;
    
    // Simple slider control
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = '50';
    slider.className = 'v5-carousel-slider';
    slider.style.cssText = 'position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 10; width: 300px;';
    
    slider.addEventListener('input', function(e) {
        const before = document.querySelector('.v5-carousel-before');
        if (before) {
            before.style.width = e.target.value + '%';
        }
    });
    
    carousel.appendChild(slider);
}

// Training analysis functions (reused from main dashboard)
function analyzeTraining(trainingStr = '') {
    const result = {
        surfing: null,
        workouts: []
    };
    
    if (!trainingStr) return result;
    
    const segments = trainingStr
        .split(/[\+\|\/]/)
        .map(seg => seg.trim())
        .filter(Boolean);
    
    segments.forEach(segment => {
        const lower = segment.toLowerCase();
        if (lower.includes('surf')) {
            result.surfing = parseSurfSession(segment);
            return;
        }
        
        const workout = parseWorkoutSegment(segment);
        if (workout) {
            result.workouts.push(workout);
        }
    });
    
    if (!result.surfing && trainingStr.toLowerCase().includes('surf')) {
        result.surfing = parseSurfSession(trainingStr);
    }
    
    return result;
}

function parseSurfSession(segment) {
    const duration = extractDuration(segment);
    return {
        durationText: duration.text || 'Surf logged',
        hours: duration.hours,
        description: segment
    };
}

function parseWorkoutSegment(segment) {
    if (!segment) return null;
    const lower = segment.toLowerCase();
    if (!/[a-z]/i.test(lower)) return null;
    
    const weightMatch = segment.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms|lb|lbs|pounds)/i);
    const setRepMatch = segment.match(/(\d+)\s*[x×]\s*(\d+)/i);
    
    let name = segment;
    if (weightMatch) {
        name = segment.slice(0, weightMatch.index).trim();
    } else if (setRepMatch) {
        name = segment.slice(0, setRepMatch.index).trim();
    }
    name = name.replace(/@.*$/, '').trim();
    if (!name) name = segment.trim();
    name = name.replace(/^\d+\s*/, '');
    
    const bodyParts = getBodyPartsForExercise(lower);
    
    return {
        name: titleCase(name),
        weight: weightMatch ? `${weightMatch[1]} ${weightMatch[2].toUpperCase()}` : '',
        setsReps: setRepMatch ? `${setRepMatch[1]} × ${setRepMatch[2]}` : '',
        bodyParts,
        notes: ''
    };
}

function extractDuration(text = '') {
    const match = text.match(/(\d+(?:\.\d+)?)\s*(hr|hrs|hour|hours|h|min|mins|minutes)/i);
    if (!match) {
        return { hours: null, text: '' };
    }
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('h')) {
        const formatted = value % 1 === 0 ? `${value.toFixed(0)} hr` : `${value.toFixed(1)} hr`;
        return { hours: value, text: `${formatted} surf` };
    }
    const hours = value / 60;
    return { hours, text: `${value.toFixed(0)} min surf` };
}

function getBodyPartsForExercise(lowerName = '') {
    const mapping = [
        { keywords: ['chest press', 'bench'], parts: ['Chest', 'Triceps'] },
        { keywords: ['leg press', 'smith squat', 'squat', 'deadlift', 'lunges'], parts: ['Quads', 'Glutes'] },
        { keywords: ['shoulder', 'overhead', 'military'], parts: ['Shoulders', 'Traps'] },
        { keywords: ['row', 'pull', 'lat'], parts: ['Back', 'Biceps'] },
        { keywords: ['curl'], parts: ['Biceps'] },
        { keywords: ['tricep', 'dip'], parts: ['Triceps'] },
        { keywords: ['core', 'abs', 'plank'], parts: ['Core'] },
        { keywords: ['cardio', 'treadmill'], parts: ['Cardio Engine'] }
    ];
    const parts = new Set();
    mapping.forEach(map => {
        if (map.keywords.some(keyword => lowerName.includes(keyword))) {
            map.parts.forEach(part => parts.add(part));
        }
    });
    if (parts.size === 0) {
        parts.add('Full body');
    }
    return Array.from(parts);
}

function titleCase(str = '') {
    return str.replace(/\w\S*/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

