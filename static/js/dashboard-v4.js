// V4 Dashboard JavaScript

let dashboardData = null;

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
    await loadData();
    setupSlider();
});

async function loadData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        dashboardData = data;
        
        updateHeader(data);
        updateHeroStats(data);
        updateMetrics(data);
        updateDoomsdayClock(data);
        
        return data;
    } catch (error) {
        console.error('Error loading data:', error);
        return null;
    }
}

function updateHeader(data) {
    // Update progress pic if available (placeholder for now)
    const progressPic = document.getElementById('v4ProgressPic');
    if (progressPic) {
        // TODO: Add actual photo when available
    }
}

function updateHeroStats(data) {
    const baseline = data.baseline || {};
    const dailyLogs = data.daily_logs || [];
    const latestLog = dailyLogs.length > 0 ? dailyLogs[dailyLogs.length - 1] : null;
    
    // Weight loss
    const baselineWeight = parseWeight(baseline.weight ?? baseline.weightKg ?? 90.0);
    const currentWeight = latestLog ? parseWeight(latestLog.fastedWeight ?? latestLog.fasted_weight) : null;
    const weightLoss = baselineWeight && currentWeight ? (baselineWeight - currentWeight).toFixed(1) : '0.0';
    
    const weightLossEl = document.getElementById('v4WeightLoss');
    if (weightLossEl) {
        weightLossEl.textContent = `–${weightLoss} kg`;
    }
    
    // Body fat (placeholder - would need DEXA data)
    const bodyFatEl = document.getElementById('v4BodyFat');
    if (bodyFatEl) {
        // Calculate estimated body fat if we have weight and baseline
        if (baselineWeight && currentWeight && baseline.bodyFat) {
            // Simple estimation (not accurate, but for display)
            const estimatedBF = ((baseline.bodyFat / 100) * baselineWeight - (baselineWeight - currentWeight)) / currentWeight * 100;
            bodyFatEl.textContent = `${Math.max(0, estimatedBF).toFixed(1)}% body fat`;
        } else {
            bodyFatEl.textContent = `${baseline.bodyFat || '--'}% body fat`;
        }
    }
    
    // Fish count
    const totalFish = dailyLogs.reduce((sum, log) => {
        const totals = getDailyTotals(log);
        return sum + totals.seafoodKg;
    }, 0);
    
    const fishCountEl = document.getElementById('v4FishCount');
    if (fishCountEl) {
        fishCountEl.textContent = `${totalFish.toFixed(0)} fish sacrificed`;
    }
}

function updateMetrics(data) {
    const baseline = data.baseline || {};
    const dailyLogs = data.daily_logs || [];
    const latestLog = dailyLogs.length > 0 ? dailyLogs[dailyLogs.length - 1] : null;
    const streak = data.streak || 0;
    
    // Weight
    const weightEl = document.getElementById('v4MetricWeight');
    if (weightEl && latestLog) {
        const weight = parseWeight(latestLog.fastedWeight ?? latestLog.fasted_weight);
        if (weight !== null) {
            weightEl.innerHTML = `${weight.toFixed(1)} <span class="v4-gold">kg</span>`;
        }
    }
    
    // Body Fat
    const bodyFatEl = document.getElementById('v4MetricBodyFat');
    if (bodyFatEl) {
        const bf = baseline.bodyFat || '--';
        bodyFatEl.innerHTML = `${bf} <span class="v4-gold">%</span>`;
    }
    
    // Muscle Mass (estimated)
    const muscleEl = document.getElementById('v4MetricMuscle');
    if (muscleEl && baseline.weight && baseline.bodyFat) {
        const leanMass = baseline.leanMass || (baseline.weight * (1 - baseline.bodyFat / 100));
        muscleEl.innerHTML = `${leanMass.toFixed(1)} <span class="v4-gold">kg</span>`;
    }
    
    // Daily Protein
    const proteinEl = document.getElementById('v4MetricProtein');
    if (proteinEl && latestLog) {
        const totals = getDailyTotals(latestLog);
        proteinEl.innerHTML = `${totals.protein} <span class="v4-gold">g</span>`;
    }
    
    // Fish This Week (last 7 days)
    const fishWeekEl = document.getElementById('v4MetricFishWeek');
    if (fishWeekEl) {
        const weekLogs = dailyLogs.slice(-7);
        const weekFish = weekLogs.reduce((sum, log) => {
            const totals = getDailyTotals(log);
            return sum + totals.seafoodKg;
        }, 0);
        fishWeekEl.innerHTML = `${weekFish.toFixed(2)} <span class="v4-gold">kg</span>`;
    }
    
    // Streak
    const streakEl = document.getElementById('v4MetricStreak');
    if (streakEl) {
        streakEl.innerHTML = `${streak} <span class="v4-gold">days</span>`;
    }
    
    // Current Body Fat for Physique card
    const currentBFEl = document.getElementById('v4CurrentBodyFat');
    if (currentBFEl && baseline.bodyFat) {
        currentBFEl.textContent = `${baseline.bodyFat}%`;
    }
}

function updateDoomsdayClock(data) {
    // Calculate days until deadline (April 2026 = target date)
    const targetDate = new Date('2026-04-01');
    const today = new Date();
    const daysRemaining = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    
    const clockDaysEl = document.getElementById('v4ClockDays');
    if (clockDaysEl) {
        clockDaysEl.textContent = Math.max(0, daysRemaining);
    }
    
    // Update progress ring
    const totalDays = 130; // Days from Nov 21, 2025 to April 1, 2026
    const progress = Math.max(0, Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100));
    const circumference = 2 * Math.PI * 90; // radius = 90
    const offset = circumference - (progress / 100) * circumference;
    
    const progressRing = document.querySelector('.v4-ring-progress');
    if (progressRing) {
        progressRing.style.strokeDashoffset = offset;
        
        // Change color based on urgency
        progressRing.classList.remove('warning', 'danger');
        if (daysRemaining <= 30) {
            progressRing.classList.add('danger');
        } else if (daysRemaining <= 60) {
            progressRing.classList.add('warning');
        }
    }
}

function setupSlider() {
    const slider = document.getElementById('v4SliderControl');
    const beforeDiv = document.querySelector('.v4-slider-before');
    
    if (!slider || !beforeDiv) return;
    
    slider.addEventListener('input', function(e) {
        const value = e.target.value;
        beforeDiv.style.width = value + '%';
    });
    
    // Add mouse drag support
    let isDragging = false;
    
    slider.addEventListener('mousedown', () => {
        isDragging = true;
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const sliderWrapper = document.querySelector('.v4-slider-wrapper');
        if (!sliderWrapper) return;
        
        const rect = sliderWrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
        slider.value = percent;
        beforeDiv.style.width = percent + '%';
    });
}

