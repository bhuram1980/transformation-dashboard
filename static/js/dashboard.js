// Dashboard JavaScript - Apple/Stripe Style

let progressChart;
let dailyLogsCache = []; // Cache daily logs for navigation
let dashboardData = null;

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const DAILY_MACRO_TARGETS = {
    protein: 350,
    carbs: 50,
    fat: 180,
    kcal: 3200,
    seafoodKg: 1
};

// Load data on page load
document.addEventListener('DOMContentLoaded', async function() {
    await loadData();
    await loadStats();
    populateDaySelector();
    
    // View-only dashboard - no forms
});

document.addEventListener('click', function(event) {
    const pill = event.target.closest('.day-pill');
    if (!pill || !pill.dataset.day) return;
    const selector = document.getElementById('daySelect');
    if (!selector || selector.value === pill.dataset.day) return;
    selector.value = pill.dataset.day;
    loadDayMeals();
});

async function loadData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();

        dashboardData = data;
        
        console.log('Loaded data:', {
            streak: data.streak,
            daily_logs_count: data.daily_logs?.length || 0,
            baseline: data.baseline,
            daily_logs: data.daily_logs
        });
        
        // Update streak with animation
        const streakEl = document.getElementById('streakCount');
        if (streakEl) {
            const current = parseInt(streakEl.textContent) || 0;
            const newStreak = data.streak || 0;
            if (current !== newStreak && newStreak > 0) {
                animateStreak(streakEl, current, newStreak);
            } else {
                streakEl.textContent = newStreak;
            }
        }
        
        // Cache logs for navigation / highlights
        dailyLogsCache = data.daily_logs || [];

        // Update long-term cards
        updateGoalCards(data.baseline || {}, data.targets || {}, data.daily_logs || []);
        
        // Update goal description / baseline date
        if (data.goal && data.baseline) {
            updateGoalAndBaseline(data.goal, data.baseline);
        }

        // Update weight + hero highlights
        updateWeightHighlights(data.daily_logs || [], data.baseline || {});
        updateFishRing(data.daily_logs || []);
        updateTodayScore(data.daily_logs || []);
        updateHeroBadges(data.daily_logs || [], data.streak || 0);
        
        // Render progress chart (COMMENTED OUT - may add later)
        // if (data.daily_logs && data.daily_logs.length > 0) {
        //     renderProgressChart(data.daily_logs);
        // } else {
        //     console.warn('No daily logs found');
        // }

        return data;
    } catch (error) {
        console.error('Error loading data:', error);
        return null;
    }
}

function animateStreak(element, start, end) {
    element.classList.add('animate');
    let current = start;
    const increment = end > start ? 1 : -1;
    const duration = 500;
    const stepTime = duration / Math.abs(end - start);
    
    const timer = setInterval(() => {
        current += increment;
        element.textContent = current;
        if (current === end) {
            clearInterval(timer);
            setTimeout(() => element.classList.remove('animate'), 300);
        }
    }, stepTime);
}

function updateGoalCards(baseline = {}, targets = {}, dailyLogs = []) {
    const latestLog = dailyLogs.length ? dailyLogs[dailyLogs.length - 1] : null;
    
    const snapshots = {
        weight: {
            unit: 'kg',
            decimals: 1,
            direction: 'down',
            baseline: parseWeight(getBaselineValue(baseline, ['weight', 'weightKg'])),
            currentRaw: parseWeight(latestLog?.fastedWeight ?? latestLog?.fasted_weight),
            targetRaw: targets?.weight || targets?.weightKg || '82-85 kg',
            history: dailyLogs
                .map(log => {
                    const value = parseWeight(log.fastedWeight ?? log.fasted_weight);
                    if (value === null) return null;
                    const label = log.day ? `Day ${log.day}` : (log.date_display || log.date || '');
                    return { label, value };
                })
                .filter(Boolean)
        },
        android: {
            unit: '%',
            decimals: 1,
            direction: 'down',
            baseline: toNumberOrNull(getBaselineValue(baseline, ['android_fat', 'androidFat'])),
            currentRaw: toNumberOrNull(latestLog?.androidFat ?? latestLog?.android_fat),
            targetRaw: targets?.android_fat || targets?.androidFat || '≤15%',
            history: []
        },
        bodyFat: {
            unit: '%',
            decimals: 1,
            direction: 'down',
            baseline: toNumberOrNull(getBaselineValue(baseline, ['body_fat', 'bodyFat'])),
            currentRaw: toNumberOrNull(latestLog?.bodyFat ?? latestLog?.body_fat),
            targetRaw: targets?.body_fat || targets?.bodyFat || '≤13%',
            history: []
        },
        alt: {
            unit: '',
            decimals: 0,
            direction: 'down',
            baseline: toNumberOrNull(getBaselineValue(baseline, ['alt'])),
            currentRaw: toNumberOrNull(latestLog?.alt ?? latestLog?.ALT ?? latestLog?.labs?.alt),
            targetRaw: targets?.alt || '<80',
            history: []
        },
        glucose: {
            unit: 'mg/dL',
            decimals: 0,
            direction: 'down',
            baseline: toNumberOrNull(getBaselineValue(baseline, ['fasting_glucose', 'fastingGlucose'])),
            currentRaw: toNumberOrNull(latestLog?.glucose ?? latestLog?.fastingGlucose ?? latestLog?.labs?.fastingGlucose),
            targetRaw: targets?.glucose || '<95',
            history: []
        }
    };
    
    Object.keys(snapshots).forEach(key => {
        const snap = snapshots[key];
        snap.current = snap.currentRaw !== null && snap.currentRaw !== undefined ? snap.currentRaw : snap.baseline;
        snap.hasCurrent = snap.currentRaw !== null && snap.currentRaw !== undefined;
        snap.targetValue = parseTargetValue(snap.targetRaw);
    });
    
    updateBaselineCompareCards(snapshots);
    updateMetricCardsUI(snapshots);
}

function updateBaselineCompareCards(snapshots = {}) {
    const compareConfig = [
        { key: 'weight', unit: 'kg', decimals: 1, fallback: 'Log a new weigh-in' },
        { key: 'android', unit: '%', decimals: 1, fallback: 'Need Android update' },
        { key: 'bodyFat', unit: '%', decimals: 1, fallback: 'Need updated DEXA' },
        { key: 'alt', unit: '', decimals: 0, fallback: 'Need new labs' },
        { key: 'glucose', unit: 'mg/dL', decimals: 0, fallback: 'Need new labs' },
    ];
    
    compareConfig.forEach(({ key, unit, decimals, fallback }) => {
        const snap = snapshots[key];
        if (!snap) return;
        const baselineEl = document.getElementById(`${key}BaselineValue`);
        const currentEl = document.getElementById(`${key}CurrentValue`);
        const changeEl = document.getElementById(`${key}CompareDelta`);
        
        if (baselineEl) baselineEl.textContent = formatMetricValue(snap.baseline, unit, decimals);
        if (currentEl) currentEl.textContent = formatMetricValue(snap.current, unit, decimals);
        
        if (!changeEl) return;
        changeEl.classList.remove('positive', 'negative');
        
        if (snap.baseline === null || snap.current === null) {
            changeEl.textContent = fallback;
            return;
        }
        
        if (!snap.hasCurrent || Math.abs(snap.current - snap.baseline) < 0.01) {
            changeEl.textContent = snap.hasCurrent ? 'Holding baseline' : fallback;
            return;
        }
        
        const delta = snap.current - snap.baseline;
        const goodDirection = snap.direction === 'down' ? delta <= 0 : delta >= 0;
        changeEl.textContent = `${goodDirection ? '↓' : '↑'} ${Math.abs(delta).toFixed(decimals)}${unit ? ` ${unit}` : ''} since baseline`;
        changeEl.classList.add(goodDirection ? 'positive' : 'negative');
    });
}

function updateMetricCardsUI(snapshots = {}) {
    const metricConfig = [
        { key: 'weight', label: 'Weight', unit: 'kg', decimals: 1, targetId: 'metricWeightTarget', changeId: 'metricWeightChange', progressId: 'metricWeightProgress', currentId: 'metricWeightCurrent' },
        { key: 'android', label: 'Android Fat', unit: '%', decimals: 1, targetId: 'metricAndroidTarget', changeId: 'metricAndroidChange', progressId: 'metricAndroidProgress', currentId: 'metricAndroidCurrent' },
        { key: 'bodyFat', label: 'Body Fat', unit: '%', decimals: 1, targetId: 'metricBodyFatTarget', changeId: 'metricBodyFatChange', progressId: 'metricBodyFatProgress', currentId: 'metricBodyFatCurrent' },
        { key: 'alt', label: 'ALT', unit: '', decimals: 0, targetId: 'metricAltTarget', changeId: 'metricAltChange', progressId: 'metricAltProgress', currentId: 'metricAltCurrent' },
        { key: 'glucose', label: 'Fasting Glucose', unit: 'mg/dL', decimals: 0, targetId: 'metricGlucoseTarget', changeId: 'metricGlucoseChange', progressId: 'metricGlucoseProgress', currentId: 'metricGlucoseCurrent' },
    ];
    
    metricConfig.forEach(config => {
        const snap = snapshots[config.key];
        if (!snap) return;
        
        const currentEl = document.getElementById(config.currentId);
        if (currentEl) currentEl.textContent = formatMetricValue(snap.current, config.unit, config.decimals);
        
        const targetEl = document.getElementById(config.targetId);
        if (targetEl) {
            targetEl.textContent = snap.targetRaw || `Target ${snap.direction === 'down' ? '≤' : '≥'} ${snap.targetValue || '—'}${config.unit ? ` ${config.unit}` : ''}`;
        }
        
        const changeEl = document.getElementById(config.changeId);
        if (changeEl) {
            changeEl.classList.remove('positive', 'negative');
            if (snap.baseline !== null && snap.current !== null) {
                const delta = snap.current - snap.baseline;
                if (Math.abs(delta) < 0.01) {
                    changeEl.textContent = 'No change yet';
                } else {
                    const good = snap.direction === 'down' ? delta <= 0 : delta >= 0;
                    changeEl.textContent = `${good ? '↓' : '↑'} ${Math.abs(delta).toFixed(config.decimals)}${config.unit ? ` ${config.unit}` : ''} since baseline`;
                    changeEl.classList.add(good ? 'positive' : 'negative');
                }
            } else {
                changeEl.textContent = config.key === 'weight' ? 'Weigh-in to unlock change' : 'Need updated labs';
            }
        }
        
        const progressEl = document.getElementById(config.progressId);
        if (progressEl) {
            const percent = computeProgressPercentage(snap.baseline, snap.current, snap.targetValue, snap.direction);
            progressEl.style.width = percent !== null ? `${Math.max(0, Math.min(percent, 120))}%` : '0%';
            progressEl.classList.remove('positive', 'warning', 'danger');
            if (percent === null) {
                progressEl.classList.add('warning');
            } else if (percent >= 100) {
                progressEl.classList.add('positive');
            } else if (percent >= 60) {
                progressEl.classList.add('warning');
            } else {
                progressEl.classList.add('danger');
            }
        }
        
        if (config.trendCanvas) {
            renderMetricTrend(config.trendCanvas, config.trendLabel, snap.history);
        }
    });
}

function computeProgressPercentage(baseline, current, target, direction = 'down') {
    if (baseline === null || current === null || target === null) return null;
    if (direction === 'down') {
        if (baseline <= target) return current <= target ? 100 : 0;
        return ((baseline - current) / (baseline - target)) * 100;
    }
    if (baseline >= target) return current >= target ? 100 : 0;
    return ((current - baseline) / (target - baseline)) * 100;
}

function renderMetricTrend() {
    // Trend graphs removed for now
}

function updateWeightHighlights(dailyLogs = [], baseline = {}) {
    const weightValueEl = document.getElementById('weightValue');
    const weightDeltaEl = document.getElementById('weightDelta');
    const weightMetaEl = document.getElementById('weightMeta');
    const fishTotalEl = document.getElementById('fishTotal');
    
    if (!weightValueEl || !weightDeltaEl || !weightMetaEl || !fishTotalEl) {
        return;
    }
    
    if (!dailyLogs.length) {
        weightValueEl.textContent = '--';
        weightMetaEl.textContent = 'Awaiting latest log';
        weightDeltaEl.textContent = 'Upload today\'s file to see progress';
        fishTotalEl.textContent = '0.00 kg 🐟';
        return;
    }
    
    const latestLog = dailyLogs[dailyLogs.length - 1];
    const currentWeight = parseWeight(latestLog?.fastedWeight ?? latestLog?.fasted_weight);
    
    if (currentWeight !== null) {
        weightValueEl.textContent = `${currentWeight.toFixed(1)} kg`;
    } else {
        weightValueEl.textContent = '--';
    }
    
    const dateLabel = latestLog?.date_display || latestLog?.date || '';
    if (latestLog?.day) {
        weightMetaEl.textContent = `Day ${latestLog.day}${dateLabel ? ` • ${dateLabel}` : ''}`;
    } else {
        weightMetaEl.textContent = dateLabel || 'Latest entry';
    }
    
    const baselineWeight = parseWeight(
        baseline?.weight ??
        baseline?.weightKg ??
        dailyLogs[0]?.fastedWeight ??
        dailyLogs[0]?.fasted_weight
    );
    const previousWeight = parseWeight(
        dailyLogs.length > 1
            ? dailyLogs[dailyLogs.length - 2]?.fastedWeight ?? dailyLogs[dailyLogs.length - 2]?.fasted_weight
            : null
    );
    
    const deltaChips = [];
    if (currentWeight !== null && baselineWeight !== null) {
        deltaChips.push(buildWeightDeltaChip('vs Day 1', currentWeight - baselineWeight));
    }
    if (currentWeight !== null && previousWeight !== null) {
        deltaChips.push(buildWeightDeltaChip('vs yesterday', currentWeight - previousWeight));
    }
    
    if (deltaChips.length === 0) {
        weightDeltaEl.textContent = 'Need Day 1 + latest weight to compare';
    } else {
        weightDeltaEl.innerHTML = deltaChips.join('');
    }
    
    const fishTotal = dailyLogs.reduce((sum, log) => {
        const totals = getDailyTotals(log);
        return sum + (totals.seafoodKg || 0);
    }, 0);
    
    fishTotalEl.textContent = `${fishTotal.toFixed(2)} kg 🐟`;
}

function updateFishRing(dailyLogs = []) {
    const ringEl = document.getElementById('fishRingProgress');
    const valueEl = document.getElementById('fishRingValue');
    const metaEl = document.getElementById('fishWeeklyMeta');
    if (!ringEl || !valueEl || !metaEl) return;
    
    if (!dailyLogs.length) {
        ringEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
        valueEl.textContent = '0%';
        metaEl.textContent = '0 / 7 kg this week';
        return;
    }
    
    const weeklyLogs = dailyLogs.slice(-7);
    const weeklyFish = weeklyLogs.reduce((sum, log) => {
        const totals = getDailyTotals(log);
        return sum + (totals.seafoodKg || 0);
    }, 0);
    
    const weeklyGoal = 7; // kg per week
    const ratio = Math.max(0, Math.min(weeklyFish / weeklyGoal, 1));
    ringEl.style.strokeDashoffset = RING_CIRCUMFERENCE - ratio * RING_CIRCUMFERENCE;
    valueEl.textContent = `${Math.round(ratio * 100)}%`;
    metaEl.textContent = `${weeklyFish.toFixed(2)} / ${weeklyGoal.toFixed(1)} kg this week`;
}

function updateTodayScore(dailyLogs = []) {
    const scoreValueEl = document.getElementById('todayScoreValue');
    const scoreMetaEl = document.getElementById('todayScoreMeta');
    const scoreRingValue = document.getElementById('scoreRingValue');
    const scoreRingProgress = document.getElementById('scoreRingProgress');
    const criteriaListEl = document.getElementById('scoreCriteriaList');
    
    if (!scoreValueEl || !scoreRingProgress || !criteriaListEl) return;
    
    if (!dailyLogs.length) {
        scoreValueEl.textContent = '-- / 5';
        scoreRingValue.textContent = '0';
        scoreRingProgress.style.strokeDashoffset = RING_CIRCUMFERENCE;
        criteriaListEl.innerHTML = `
            <li><span class="criteria-dot"></span><div class="criteria-text"><span class="criteria-title">Protein target</span><span class="criteria-detail">350 g goal</span></div></li>
            <li><span class="criteria-dot"></span><div class="criteria-text"><span class="criteria-title">Seafood goal</span><span class="criteria-detail">1.0 kg</span></div></li>
            <li><span class="criteria-dot"></span><div class="criteria-text"><span class="criteria-title">Supplements</span><span class="criteria-detail">Full stack</span></div></li>
            <li><span class="criteria-dot"></span><div class="criteria-text"><span class="criteria-title">Training logged</span><span class="criteria-detail">Surf / gym</span></div></li>
            <li><span class="criteria-dot"></span><div class="criteria-text"><span class="criteria-title">Feeling 8+</span><span class="criteria-detail">Energy check-in</span></div></li>
        `;
        if (scoreMetaEl) {
            scoreMetaEl.textContent = 'Score updates with new log';
        }
        return;
    }
    
    const today = dailyLogs[dailyLogs.length - 1];
    const totals = getDailyTotals(today);
    const supplements = today.supplements || {};
    const training = (today.training || '').trim();
    const feeling = parseNumber(today.feeling);
    
    const allSuppTaken = Object.values(supplements).every(val => {
        if (typeof val === 'object' && val !== null) {
            return Boolean(val.taken);
        }
        return Boolean(val);
    });
    
    const criteria = [
        {
            key: 'protein',
            label: 'Protein ≥ 350 g',
            detail: `${totals.protein || 0} g`,
            met: (totals.protein || 0) >= 350
        },
        {
            key: 'seafood',
            label: 'Seafood ≥ 1.0 kg',
            detail: `${(totals.seafoodKg || 0).toFixed(2)} kg`,
            met: (totals.seafoodKg || 0) >= 1
        },
        {
            key: 'supplements',
            label: 'Full supplement stack',
            detail: allSuppTaken ? 'All taken' : 'Missing dose',
            met: allSuppTaken
        },
        {
            key: 'training',
            label: 'Training logged',
            detail: training ? training : 'No entry',
            met: Boolean(training)
        },
        {
            key: 'feeling',
            label: 'Feeling ≥ 8/10',
            detail: feeling ? `${feeling}/10` : 'Unlogged',
            met: feeling >= 8
        }
    ];
    
    const score = criteria.filter(c => c.met).length;
    const totalCriteria = criteria.length;
    
    scoreValueEl.textContent = `${score} / ${totalCriteria}`;
    scoreRingValue.textContent = score.toString();
    const ratio = score / totalCriteria;
    scoreRingProgress.style.strokeDashoffset = RING_CIRCUMFERENCE - ratio * RING_CIRCUMFERENCE;
    
    const scoreLabels = {
        5: 'Legendary execution',
        4: 'Dominating momentum',
        3: 'Solid climb',
        2: 'Dial it up',
        1: 'Reset focus',
        0: 'Log a full day'
    };
    const label = scoreLabels[score] || 'Keep stacking data';
    if (scoreMetaEl) {
        const noteSnippet = (today.notes || '').split('\n')[0].trim();
        scoreMetaEl.textContent = noteSnippet ? `${label} • ${noteSnippet}` : label;
    }
    
    criteriaListEl.innerHTML = criteria.map(c => `
        <li class="${c.met ? 'met' : ''}">
            <span class="criteria-dot"></span>
            <div class="criteria-text">
                <span class="criteria-title">${c.label}</span>
                <span class="criteria-detail">${c.detail}</span>
            </div>
        </li>
    `).join('');
}

function updateHeroBadges(dailyLogs = [], streak = 0) {
    const badgesEl = document.getElementById('heroBadges');
    if (!badgesEl) return;
    
    if (!dailyLogs.length) {
        badgesEl.innerHTML = '<span class="hero-badge">Drop today\'s JSON to unlock badges</span>';
        return;
    }
    
    const today = dailyLogs[dailyLogs.length - 1];
    const totals = getDailyTotals(today);
    const badges = [];
    
    if ((totals.protein || 0) >= 350) {
        badges.push({ text: `Protein overlord — ${totals.protein} g`, className: '' });
    }
    
    const maxProtein = Math.max(...dailyLogs.map(log => getDailyTotals(log).protein || 0));
    if ((totals.protein || 0) === maxProtein && dailyLogs.length > 1) {
        badges.push({ text: 'New PR — Most protein in a day', className: '' });
    }
    
    if ((totals.seafoodKg || 0) >= 1) {
        badges.push({ text: `Seafood massacre — ${(totals.seafoodKg || 0).toFixed(2)} kg`, className: 'seafood' });
    }
    
    if (streak >= 3) {
        badges.push({ text: `${streak}-day streak`, className: '' });
    }
    
    const noteSnippet = (today.notes || '').split('\n')[0].trim();
    if (noteSnippet) {
        badges.push({ text: noteSnippet, className: 'warning' });
    }
    
    if (!badges.length) {
        badgesEl.innerHTML = '<span class="hero-badge">Keep logging to unlock badges</span>';
        return;
    }
    
    badgesEl.innerHTML = badges.map(badge =>
        `<span class="hero-badge ${badge.className || ''}">${badge.text}</span>`
    ).join('');
}

function getDailyTotals(dayData = {}) {
    if (!dayData) {
        return { protein: 0, carbs: 0, fat: 0, kcal: 0, seafoodKg: 0 };
    }
    const total = dayData.total || {};
    return {
        protein: parseNumber(total.protein ?? dayData.protein),
        carbs: parseNumber(total.carbs ?? dayData.carbs),
        fat: parseNumber(total.fat ?? dayData.fat),
        kcal: parseNumber(total.kcal ?? dayData.kcal),
        seafoodKg: parseNumber(total.seafoodKg ?? total.seafood_kg ?? dayData.seafoodKg ?? dayData.seafood_kg)
    };
}

function parseNumber(value) {
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
}

function parseWeight(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(parsed) ? null : parsed;
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(parsed) ? null : parsed;
}

function getBaselineValue(baseline, keys = []) {
    if (!baseline || !keys.length) return null;
    for (const key of keys) {
        if (baseline[key] !== undefined && baseline[key] !== null) {
            return baseline[key];
        }
    }
    return null;
}

function parseTargetValue(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const matches = raw.match(/[\d.]+/g);
    if (!matches || !matches.length) return null;
    if (matches.length >= 2) {
        const first = parseFloat(matches[0]);
        const second = parseFloat(matches[1]);
        if (!isNaN(first) && !isNaN(second)) {
            return (first + second) / 2;
        }
    }
    const single = parseFloat(matches[0]);
    return isNaN(single) ? null : single;
}

function formatMetricValue(value, unit = '', decimals = 1) {
    if (value === null || value === undefined) return '--';
    const rounded = typeof decimals === 'number' ? value.toFixed(decimals) : value;
    return `${rounded}${unit ? ` ${unit}` : ''}`;
}

function buildWeightDeltaChip(label, delta) {
    const absDelta = Math.abs(delta);
    const directionDown = delta <= 0;
    const arrow = directionDown ? '↓' : '↑';
    const className = directionDown ? 'positive' : 'negative';
    if (absDelta < 0.05) {
        return `<span class="weight-delta-chip"><span class="chip-label">${label}</span> flat</span>`;
    }
    return `
        <span class="weight-delta-chip ${className}">
            <span class="chip-label">${label}</span>
            ${arrow} ${absDelta.toFixed(1)} kg
        </span>
    `;
}

// Progress chart rendering (COMMENTED OUT - may add later)
/*
function renderProgressChart(dailyLogs) {
    const ctx = document.getElementById('progressChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (progressChart) {
        progressChart.destroy();
    }
    
    const labels = dailyLogs.map(d => `Day ${d.day || d.date || ''}`);
    const weights = dailyLogs.map(d => d.fastedWeight || null);
    const waists = dailyLogs.map(d => d.waist || null);
    const proteins = dailyLogs.map(d => d.protein || null);
    
    // Filter out null values
    const validData = labels.map((label, i) => ({
        label,
        weight: weights[i],
        waist: waists[i],
        protein: proteins[i]
    })).filter(d => d.weight !== null || d.waist !== null || d.protein !== null);
    
    if (validData.length === 0) {
        ctx.parentElement.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">Add data to see progress</p>';
        return;
    }
    
    const validLabels = validData.map(d => d.label);
    const validWeights = validData.map(d => d.weight);
    const validWaists = validData.map(d => d.waist);
    const validProteins = validData.map(d => d.protein);
    
    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: validLabels,
            datasets: [
                {
                    label: 'Weight (kg)',
                    data: validWeights,
                    borderColor: '#0066ff',
                    backgroundColor: 'rgba(0, 102, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Waist (cm)',
                    data: validWaists,
                    borderColor: '#00a3ff',
                    backgroundColor: 'rgba(0, 163, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Protein (g)',
                    data: validProteins,
                    borderColor: '#ff6b00',
                    backgroundColor: 'rgba(255, 107, 0, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 13,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 13
                    },
                    borderColor: '#0066ff',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#666'
                    }
                },
                y: {
                    position: 'left',
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#666'
                    }
                },
                y1: {
                    position: 'right',
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#666'
                    }
                }
            }
        }
    });
}
*/

function updateGoalAndBaseline(goalInfo, baseline) {
    // Update goal description
    const goalDescEl = document.getElementById('goalDescription');
    if (goalDescEl && goalInfo && goalInfo.goal) {
        goalDescEl.textContent = goalInfo.goal;
    }
    
    // Update baseline date
    const baselineDateEl = document.getElementById('baselineDate');
    if (baselineDateEl && goalInfo && goalInfo.started) {
        // Extract date from "November 21, 2025 (Sri Lanka)" format
        const dateMatch = goalInfo.started.match(/([A-Za-z]+ \d+, \d{4})/);
        if (dateMatch) {
            baselineDateEl.textContent = `(${dateMatch[1]})`;
        } else {
            baselineDateEl.textContent = `(${goalInfo.started})`;
        }
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        // Stats are used for calculations, no UI elements to update in new design
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Form submission and photo upload removed - view-only dashboard

function ensureDashboardData() {
    if (dashboardData) {
        return Promise.resolve(dashboardData);
    }
    return fetch('/api/data')
        .then(response => response.json())
        .then(data => {
            dashboardData = data;
            dailyLogsCache = data.daily_logs || [];
            return data;
        })
        .catch(error => {
            console.error('Error loading dashboard data:', error);
            return { daily_logs: [] };
        });
}

function setDaySelectorOptions(selector, dailyLogs) {
    selector.innerHTML = '';
    
    if (!dailyLogs.length) {
        selector.innerHTML = '<option value="">No days logged yet</option>';
        updateNavButtons();
        return;
    }
    
    const today = dailyLogs[dailyLogs.length - 1];
    selector.innerHTML = `<option value="${today.day}" selected>Today (Day ${today.day})</option>`;
    
    for (let i = dailyLogs.length - 2; i >= 0; i--) {
        const day = dailyLogs[i];
        const option = document.createElement('option');
        option.value = day.day;
        option.textContent = `Day ${day.day} - ${day.date_display || day.date}`;
        selector.appendChild(option);
    }
    
    updateNavButtons();
    loadDayMeals();
}

function renderDayPills(dailyLogs = []) {
    const container = document.getElementById('dayPillContainer');
    const selector = document.getElementById('daySelect');
    if (!container || !selector) return;
    
    container.innerHTML = '';
    
    if (!dailyLogs.length) {
        container.innerHTML = '<div class="day-pill-placeholder">Add your first log to unlock this view.</div>';
        return;
    }
    
    const maxPills = 8;
    const logsToShow = dailyLogs.slice(-maxPills).reverse();
    const latestDay = dailyLogs[dailyLogs.length - 1]?.day;
    
    logsToShow.forEach(log => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'day-pill';
        if (log.day === latestDay) pill.classList.add('today');
        pill.dataset.day = log.day;
        const label = log.day ? `Day ${log.day}` : (log.date_display || log.date || 'Day');
        const subLabel = log.date_display || log.date || '';
        pill.innerHTML = `<span>${label}</span>${subLabel ? `<span class="day-pill-sub">${subLabel}</span>` : ''}`;
        if (selector.value === String(log.day)) {
            pill.classList.add('active');
        }
        container.appendChild(pill);
    });

    updatePillSelection();
}

function updatePillSelection() {
    const selector = document.getElementById('daySelect');
    const container = document.getElementById('dayPillContainer');
    if (!selector || !container) return;
    const selectedDay = selector.value;
    container.querySelectorAll('.day-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.day === selectedDay);
    });
}

function scrollActivePillIntoView() {
    const container = document.getElementById('dayPillContainer');
    if (!container) return;
    const active = container.querySelector('.day-pill.active');
    if (active) {
        active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}

function populateDaySelector() {
    const selector = document.getElementById('daySelect');
    if (!selector) return;
    
    ensureDashboardData()
        .then(data => {
            const dailyLogs = data.daily_logs || [];
            dailyLogsCache = dailyLogs;
            setDaySelectorOptions(selector, dailyLogs);
            renderDayPills(dailyLogs);
        })
        .catch(error => {
            console.error('Error loading days:', error);
            selector.innerHTML = '<option value="">Error loading days</option>';
            updateNavButtons();
            renderDayPills([]);
        });
}

function navigateDay(direction) {
    const selector = document.getElementById('daySelect');
    if (!selector || dailyLogsCache.length === 0) return;
    
    const currentDay = parseInt(selector.value);
    if (!currentDay) return;
    
    // Find current day index
    const currentIndex = dailyLogsCache.findIndex(d => d.day == currentDay);
    if (currentIndex === -1) return;
    
    // Calculate new index
    const newIndex = currentIndex + direction;
    
    // Check bounds
    if (newIndex < 0 || newIndex >= dailyLogsCache.length) return;
    
    // Select new day
    const newDay = dailyLogsCache[newIndex];
    selector.value = newDay.day;
    
    // Load meals for new day
    loadDayMeals();
    
    // Update button states
    updateNavButtons();
    updatePillSelection();
    scrollActivePillIntoView();
}

function updateNavButtons() {
    const selector = document.getElementById('daySelect');
    const prevBtn = document.getElementById('prevDayBtn');
    const nextBtn = document.getElementById('nextDayBtn');
    
    if (!selector || !prevBtn || !nextBtn || dailyLogsCache.length === 0) {
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        return;
    }
    
    const currentDay = parseInt(selector.value);
    if (!currentDay) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }
    
    const currentIndex = dailyLogsCache.findIndex(d => d.day == currentDay);
    
    // Disable prev if at first day, disable next if at last day
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= dailyLogsCache.length - 1;
}

function loadDayMeals() {
    const selector = document.getElementById('daySelect');
    const mealsContainer = document.getElementById('dayMeals');
    
    if (!selector || !mealsContainer) return;
    
    const selectedDay = selector.value;
    if (!selectedDay) {
        mealsContainer.innerHTML = '<p class="meals-placeholder">Select a day to view meals</p>';
        updateNavButtons();
        return;
    }
    
    // Update navigation buttons when day changes
    updateNavButtons();
    
    ensureDashboardData()
        .then(data => {
            const dailyLogs = data.daily_logs || [];
            dailyLogsCache = dailyLogs;
            renderDayPills(dailyLogs);
            
            const selectedDayData = dailyLogs.find(d => d.day == selectedDay);
            if (!selectedDayData) {
                mealsContainer.innerHTML = '<div class="meals-placeholder-card">Day not found.</div>';
                return;
            }
            
            const dailyTotal = getDailyTotals(selectedDayData);
            const viewHtml = renderDayDetailView(selectedDayData, dailyTotal);
            mealsContainer.innerHTML = viewHtml;
            mealsContainer.style.opacity = '0';
            requestAnimationFrame(() => {
                mealsContainer.style.transition = 'opacity 0.4s ease';
                mealsContainer.style.opacity = '1';
            });
        })
        .catch(error => {
            console.error('Error loading day meals:', error);
            mealsContainer.innerHTML = '<div class="meals-placeholder-card">Error loading meals.</div>';
        });
}

function renderDayDetailView(dayData, totals) {
    const dateLabel = dayData.date_display || dayData.date || '';
    const headerHtml = `
        <div class="meals-day-header">
            <div>
                <p class="section-eyebrow">Day ${dayData.day || '-'}</p>
                <h3>${dateLabel}</h3>
            </div>
        </div>
    `;
    
    const macroHtml = renderMacroGrid(totals);
    const mealsHtml = renderMealCards(dayData.meals || {});
    const supplementsHtml = renderSupplementsSection(dayData.supplements || {});
    const infoHtml = renderDayInfoCards(dayData);
    
    return `${headerHtml}${macroHtml}${mealsHtml}${supplementsHtml}${infoHtml}`;
}

function renderMacroGrid(totals = {}) {
    const cards = [
        { key: 'protein', label: 'Protein', unit: 'g', value: totals.protein || 0 },
        { key: 'carbs', label: 'Carbs', unit: 'g', value: totals.carbs || 0 },
        { key: 'fat', label: 'Fat', unit: 'g', value: totals.fat || 0 },
        { key: 'kcal', label: 'Calories', unit: '', value: totals.kcal || 0 },
        { key: 'seafoodKg', label: 'Seafood', unit: 'kg', value: totals.seafoodKg || 0 },
    ];
    
    const cardsHtml = cards.map(card => {
        const target = DAILY_MACRO_TARGETS[card.key] || null;
        const percent = target ? Math.min(100, (card.value / target) * 100) : 0;
        const overTarget = target && card.value > target;
        return `
            <div class="macro-card">
                <div class="macro-label">${card.label}</div>
                <div class="macro-value">${card.value}${card.unit}</div>
                ${target ? `<div class="macro-target">Target ${target}${card.unit}</div>` : ''}
                ${target ? `
                    <div class="macro-progress-bar">
                        <div class="macro-progress-fill ${overTarget ? 'over' : ''}" style="width:${percent}%"></div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    return `<div class="macro-grid">${cardsHtml}</div>`;
}

function renderMealCards(meals = {}) {
    if (!meals || typeof meals !== 'object') {
        return '<div class="meals-placeholder-card">Meals will appear here once logged.</div>';
    }
    
    const mealOrder = [
        { key: 'breakfast', label: 'Breakfast', icon: '☀️' },
        { key: 'midMorning', label: 'Mid Morning', icon: '🌤️' },
        { key: 'lunch', label: 'Lunch', icon: '🌊' },
        { key: 'dinner', label: 'Dinner', icon: '🌙' },
        { key: 'snacks', label: 'Snacks', icon: '⚡' }
    ];
    
    const cards = mealOrder.map(cfg => {
        const meal = meals[cfg.key];
        if (!meal) return '';
        
        if (typeof meal === 'string') {
            if (!meal.trim() || meal.toLowerCase() === 'none') return '';
            return `
                <div class="meal-card">
                    <div class="meal-card-header">
                        <div class="meal-name">${cfg.icon} ${cfg.label}</div>
                    </div>
                    <p class="meal-desc">${meal}</p>
                </div>
            `;
        }
        
        if (typeof meal === 'object') {
            const desc = meal.description && meal.description.toLowerCase() !== 'none' ? meal.description : '';
            const macros = [
                { label: 'Protein', value: meal.protein || 0, unit: 'g' },
                { label: 'Carbs', value: meal.carbs || 0, unit: 'g' },
                { label: 'Fat', value: meal.fat || 0, unit: 'g' },
                { label: 'Kcal', value: meal.kcal || 0, unit: '' }
            ];
            const chips = macros
                .filter(m => m.value)
                .map(m => `<span class="macro-chip">${m.label} ${m.value}${m.unit}</span>`).join('');
            
            return `
                <div class="meal-card">
                    <div class="meal-card-header">
                        <div>
                            <div class="meal-name">${cfg.icon} ${cfg.label}</div>
                            ${chips ? `<div class="meal-macros">${chips}</div>` : ''}
                        </div>
                    </div>
                    ${desc ? `<p class="meal-desc">${desc}</p>` : '<p class="meal-desc">Log description</p>'}
                </div>
            `;
        }
        
        return '';
    }).filter(Boolean);
    
    if (!cards.length) {
        return '<div class="meals-placeholder-card">Meals will appear here once logged.</div>';
    }
    
    return `<div class="meals-stack">${cards.join('')}</div>`;
}

function renderSupplementsSection(supplements = {}) {
    if (!supplements || typeof supplements !== 'object') {
        return '';
    }
    
    const entries = Object.entries(supplements);
    if (!entries.length) {
        return '';
    }
    
    const supplementLabels = {
        omega3: 'Omega-3',
        nac: 'NAC',
        nacMorning: 'NAC (AM)',
        nacNight: 'NAC (PM)',
        d3k2: 'D3 + K2',
        zmb: 'ZMB Pro',
        whey: 'Whey',
        wheyScoops: 'Whey',
        creatine: 'Creatine'
    };
    
    const tiles = entries.map(([key, value]) => {
        const label = supplementLabels[key] || key;
        if (typeof value === 'object' && value !== null) {
            const taken = Boolean(value.taken);
            const details = [value.dose, value.note, value.scoops ? `${value.scoops} scoops` : null]
                .filter(Boolean).join(' • ');
            return `
                <div class="supplement-tile ${taken ? 'taken' : ''}">
                    <div class="supplement-name">${label}</div>
                    <div class="supplement-status">${taken ? '✔ Taken' : '○ Missed'}</div>
                    ${details ? `<div class="supplement-details">${details}</div>` : ''}
                </div>
            `;
        }
        
        const taken = value === true || value === 1 || value > 0;
        const detail = key === 'wheyScoops' && value ? `${value} scoops` : '';
        return `
            <div class="supplement-tile ${taken ? 'taken' : ''}">
                <div class="supplement-name">${label}</div>
                <div class="supplement-status">${taken ? '✔ Taken' : '○ Missed'}</div>
                ${detail ? `<div class="supplement-details">${detail}</div>` : ''}
            </div>
        `;
    }).join('');
    
    return `
        <div class="supplements-card">
            <div class="supplements-header">
                <p class="section-eyebrow">Supplement stack</p>
            </div>
            <div class="supplements-grid">
                ${tiles}
            </div>
        </div>
    `;
}

function renderDayInfoCards(dayData) {
    const cards = [];
    
    cards.push(`
        <div class="day-info-card">
            <p class="day-info-title">Training</p>
            <p class="day-info-value">${dayData.training || 'Not logged'}</p>
        </div>
    `);
    
    cards.push(`
        <div class="day-info-card">
            <p class="day-info-title">Feeling</p>
            <p class="day-info-value">${dayData.feeling !== undefined && dayData.feeling !== null ? `${dayData.feeling}/10` : 'Not logged'}</p>
        </div>
    `);
    
    cards.push(`
        <div class="day-info-card notes-card">
            <p class="day-info-title">Notes</p>
            <p class="day-info-note">${dayData.notes ? dayData.notes : 'Add notes to capture energy, compliance, and mindset.'}</p>
        </div>
    `);
    
    return `<div class="day-grid">${cards.join('')}</div>`;
}
