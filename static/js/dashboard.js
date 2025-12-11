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
    
    // Setup swipe gestures for mobile
    setupSwipeGestures();
    
    // Setup keyboard navigation
    setupKeyboardNavigation();
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

        // Update goal description
        if (data.goal) {
            updateGoalAndBaseline(data.goal, data.baseline || {});
        }

        // Update weight + hero highlights
        updateWeightHighlights(data.daily_logs || [], data.baseline || {});
        updateFishRing(data.daily_logs || []);
        updateTodayScore(data.daily_logs || []);
        updateHeroBadges(data.daily_logs || [], data.streak || 0);
        
        // Load and render body scan progress rings
        loadBodyScanRings();
        
        // Don't render chart by default - wait for user to click button
        // Chart will be rendered when graph is toggled visible

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
    console.log('updateGoalCards called with:', { baseline, targets, dailyLogsCount: dailyLogs.length });
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
            targetRaw: targets?.android_fat || targets?.androidFat || '≤25-28%',
            history: []
        },
        bodyFat: {
            unit: '%',
            decimals: 1,
            direction: 'down',
            baseline: toNumberOrNull(getBaselineValue(baseline, ['body_fat', 'bodyFat'])),
            currentRaw: toNumberOrNull(latestLog?.bodyFat ?? latestLog?.body_fat),
            targetRaw: targets?.body_fat || targets?.bodyFat || '≤17-19%',
            history: []
        },
        alt: {
            unit: '',
            decimals: 0,
            direction: 'down',
            baseline: toNumberOrNull(getBaselineValue(baseline, ['alt'])),
            currentRaw: toNumberOrNull(latestLog?.alt ?? latestLog?.ALT ?? latestLog?.labs?.alt),
            targetRaw: targets?.alt || targets?.ALT || '<80',
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
        console.log(`${key} snapshot:`, {
            baseline: snap.baseline,
            current: snap.current,
            currentRaw: snap.currentRaw,
            targetRaw: snap.targetRaw,
            targetValue: snap.targetValue
        });
    });
    
    updateMetricCardsUI(snapshots);
}

function updateMetricCardsUI(snapshots = {}) {
    const metricConfig = [
        { key: 'weight', ringId: 'weightRingProgress', valueId: 'weightRingValue', targetId: 'weightRingTarget', ringClass: 'weight-ring', unit: 'kg', decimals: 1 },
        { key: 'bodyFat', ringId: 'bodyFatRingProgress', valueId: 'bodyFatRingValue', targetId: 'bodyFatRingTarget', ringClass: 'bodyfat-ring', unit: '%', decimals: 1 },
        { key: 'android', ringId: 'androidRingProgress', valueId: 'androidRingValue', targetId: 'androidRingTarget', ringClass: 'android-ring', unit: '%', decimals: 1 },
        { key: 'alt', ringId: 'altRingProgress', valueId: 'altRingValue', targetId: 'altRingTarget', ringClass: 'alt-ring', unit: '', decimals: 0 },
        { key: 'glucose', ringId: 'glucoseRingProgress', valueId: 'glucoseRingValue', targetId: 'glucoseRingTarget', ringClass: 'glucose-ring', unit: 'mg/dL', decimals: 0 },
    ];
    
    metricConfig.forEach(config => {
        const snap = snapshots[config.key];
        if (!snap) {
            // Set defaults for missing data
            const valueEl = document.getElementById(config.valueId);
            const targetEl = document.getElementById(config.targetId);
            const ringEl = document.getElementById(config.ringId);
            if (valueEl) valueEl.textContent = '--';
            if (targetEl) targetEl.textContent = snap?.targetRaw || '--';
            if (ringEl) {
                ringEl.style.strokeDashoffset = '263.9';
                ringEl.className = 'ring-progress';
            }
            return;
        }
        
        // Update value
        const valueEl = document.getElementById(config.valueId);
        if (valueEl) {
            valueEl.textContent = formatMetricValue(snap.current, config.unit, config.decimals);
        }
        
        // Update target - display the raw target string
        const targetEl = document.getElementById(config.targetId);
        if (targetEl) {
            // Use targetRaw if available, otherwise format from targetValue
            if (snap.targetRaw) {
                targetEl.textContent = snap.targetRaw;
            } else if (snap.targetValue !== null && snap.targetValue !== undefined) {
                const prefix = snap.direction === 'down' ? '≤' : '≥';
                targetEl.textContent = `${prefix}${snap.targetValue}${config.unit ? ` ${config.unit}` : ''}`;
            } else {
                targetEl.textContent = '--';
            }
        }
        
        // Update ring progress
        const ringEl = document.getElementById(config.ringId);
        if (ringEl) {
            // For weight with range target (e.g., "82-85 kg"), use the upper bound for progress calculation
            let targetForProgress = snap.targetValue;
            if (config.key === 'weight' && snap.targetRaw && snap.targetRaw.includes('-')) {
                // Parse range like "82-85 kg" - use upper bound (85) for progress
                const rangeMatch = snap.targetRaw.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
                if (rangeMatch) {
                    targetForProgress = parseFloat(rangeMatch[2]); // Use upper bound
                }
            }
            
            // For body fat and android fat with range targets (e.g., "≤17-19%"), use the upper bound
            if ((config.key === 'bodyFat' || config.key === 'android') && snap.targetRaw && snap.targetRaw.includes('-')) {
                const rangeMatch = snap.targetRaw.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
                if (rangeMatch) {
                    targetForProgress = parseFloat(rangeMatch[2]); // Use upper bound
                }
            }
            
            const percent = computeProgressPercentage(snap.baseline, snap.current, targetForProgress, snap.direction);
            const circumference = 263.9; // 2 * PI * 42
            const progress = percent !== null ? Math.max(0, Math.min(percent, 100)) : 0;
            const offset = circumference - (progress / 100) * circumference;
            
            // Apply styles with !important to ensure they override CSS
            ringEl.style.strokeDashoffset = `${offset}px`;
            ringEl.style.strokeDasharray = `${circumference}px`;
            ringEl.className = `ring-progress ${config.ringClass}`;
            
            // Force a reflow to trigger animation
            ringEl.offsetHeight;
            
            // Debug logging
            if (config.key === 'weight') {
                console.log(`Weight ring: baseline=${snap.baseline}, current=${snap.current}, target=${targetForProgress}, progress=${progress}%, offset=${offset}, className=${ringEl.className}`);
            }
        }
    });
}

function toggleTargets() {
    const container = document.getElementById('targetsContainer');
    const icon = document.getElementById('targetsToggleIcon');
    
    if (!container || !icon) return;
    
    const isCollapsed = container.classList.contains('collapsed');
    
    if (isCollapsed) {
        container.classList.remove('collapsed');
        icon.textContent = '▼';
        icon.classList.remove('collapsed');
    } else {
        container.classList.add('collapsed');
        icon.textContent = '▶';
        icon.classList.add('collapsed');
    }
}

function computeProgressPercentage(baseline, current, target, direction = 'down') {
    if (baseline === null || current === null || target === null || isNaN(baseline) || isNaN(current) || isNaN(target)) {
        return null;
    }
    
    if (direction === 'down') {
        // For decreasing metrics (weight, body fat, ALT, etc.)
        // Progress = how much we've lost / how much we need to lose
        if (baseline <= target) {
            // Already at or below target
            return current <= target ? 100 : 0;
        }
        if (current <= target) {
            // Already reached target
            return 100;
        }
        if (current >= baseline) {
            // Gained weight/regressed
            return 0;
        }
        // Calculate progress: (baseline - current) / (baseline - target) * 100
        const progress = ((baseline - current) / (baseline - target)) * 100;
        return Math.max(0, Math.min(100, progress));
    } else {
        // For increasing metrics
        if (baseline >= target) {
            return current >= target ? 100 : 0;
        }
        if (current >= target) {
            return 100;
        }
        if (current <= baseline) {
            return 0;
        }
        const progress = ((current - baseline) / (target - baseline)) * 100;
        return Math.max(0, Math.min(100, progress));
    }
}

function renderMetricTrend() {
    // Trend graphs removed for now
}

function updateWeightHighlights(dailyLogs = [], baseline = {}) {
    const weightValueEl = document.getElementById('weightValue');
    const weightMetaEl = document.getElementById('weightMeta');
    const weightDeltaWrapper = document.getElementById('weightDelta');
    const weightDeltaArrow = document.getElementById('weightDeltaArrow');
    const weightDeltaText = document.getElementById('weightDeltaText');
    const fishTotalEl = document.getElementById('fishTotal');
    
    if (!weightValueEl || !weightMetaEl || !weightDeltaWrapper || !weightDeltaArrow || !weightDeltaText || !fishTotalEl) {
        return;
    }
    
    if (!dailyLogs.length) {
        weightValueEl.textContent = '-- kg';
        weightMetaEl.textContent = '';
        weightDeltaArrow.textContent = '—';
        weightDeltaText.textContent = '';
        weightDeltaWrapper.classList.remove('delta-positive', 'delta-negative');
        fishTotalEl.textContent = '0.00 kg';
        return;
    }
    
    const latestLog = dailyLogs[dailyLogs.length - 1];
    const currentWeight = parseWeight(latestLog?.fastedWeight ?? latestLog?.fasted_weight);
    
    if (currentWeight !== null) {
        weightValueEl.textContent = `${currentWeight.toFixed(1)} kg`;
    } else {
        weightValueEl.textContent = '-- kg';
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
    
    if (currentWeight !== null && baselineWeight !== null) {
        const delta = currentWeight - baselineWeight;
        const arrow = delta <= 0 ? '↓' : '↑';
        const deltaText = `(${delta >= 0 ? '+' : '-'}${Math.abs(delta).toFixed(1)} kg from ${baselineWeight.toFixed(1)} kg)`;
        weightDeltaArrow.textContent = arrow;
        weightDeltaText.textContent = deltaText;
        weightDeltaWrapper.classList.remove('delta-positive', 'delta-negative');
        weightDeltaWrapper.classList.add(delta <= 0 ? 'delta-positive' : 'delta-negative');
    } else {
        weightDeltaArrow.textContent = '—';
        weightDeltaText.textContent = '';
        weightDeltaWrapper.classList.remove('delta-positive', 'delta-negative');
    }
    
    const fishTotal = dailyLogs.reduce((sum, log) => {
        const totals = getDailyTotals(log);
        return sum + (totals.seafoodKg || 0);
    }, 0);
    
    fishTotalEl.textContent = `${fishTotal.toFixed(2)} kg`;
}

// Chart state management
window.chartState = {
    timeframe: 7,
    enabledMetrics: { weight: true, waist: false, protein: false },
    allLogs: [],
    baseline: {}
};

function filterLogsByTimeframe(logs, timeframe) {
    if (!logs || logs.length === 0) return [];
    if (timeframe === 'all') return logs;
    
    const numDays = parseInt(timeframe);
    if (isNaN(numDays) || numDays <= 0) return logs.slice(-7);
    
    return logs.slice(-numDays);
}

function renderWeightChart(dailyLogs = [], baseline = {}) {
    const canvas = document.getElementById('weightChart');
    if (!canvas) return;
    
    // Store data globally for filtering
    window.chartState.allLogs = dailyLogs;
    window.chartState.baseline = baseline;
    
    // Destroy existing chart if it exists
    if (window.weightChartInstance) {
        window.weightChartInstance.destroy();
    }
    
    // Filter logs based on timeframe
    const logsForChart = filterLogsByTimeframe(dailyLogs, window.chartState.timeframe);
    
    if (logsForChart.length === 0) {
        canvas.parentElement.innerHTML = '<p style="text-align: center; color: #999; padding: 40px; font-size: 14px;">Add data to see trend</p>';
        return;
    }
    
    // Create labels with full date info
    const labels = logsForChart.map(log => {
        if (log.day) return `Day ${log.day}`;
        if (log.date_display) return log.date_display;
        if (log.date) {
            try {
                const date = new Date(log.date);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } catch (e) {
                return log.date;
            }
        }
        return '';
    });
    
    // Build datasets based on enabled metrics
    const datasets = [];
    
    if (window.chartState.enabledMetrics.weight) {
        const weightData = logsForChart.map(log => parseWeight(log?.fastedWeight ?? log?.fasted_weight));
        datasets.push({
            label: 'Weight (kg)',
            data: weightData,
            borderColor: '#0066ff',
            backgroundColor: 'rgba(0, 102, 255, 0.15)',
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointBackgroundColor: '#0066ff',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y',
            order: 1
        });
    }
    
    if (window.chartState.enabledMetrics.waist) {
        const waistData = logsForChart.map(log => {
            const waist = parseNumber(log?.waist);
            return waist > 0 ? waist : null;
        });
        datasets.push({
            label: 'Waist (cm)',
            data: waistData,
            borderColor: '#00a3ff',
            backgroundColor: 'rgba(0, 163, 255, 0.15)',
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointBackgroundColor: '#00a3ff',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y',
            order: 2
        });
    }
    
    if (window.chartState.enabledMetrics.protein) {
        const proteinData = logsForChart.map(log => {
            const totals = getDailyTotals(log);
            return totals.protein > 0 ? totals.protein : null;
        });
        datasets.push({
            label: 'Protein (g)',
            data: proteinData,
            borderColor: '#ff6b00',
            backgroundColor: 'rgba(255, 107, 0, 0.15)',
            borderWidth: 2.5,
            tension: 0.4,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointBackgroundColor: '#ff6b00',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y1',
            order: 3
        });
    }
    
    // Add baseline reference line for weight if enabled
    if (window.chartState.enabledMetrics.weight) {
        const baselineWeight = parseWeight(
            baseline?.weight ?? baseline?.weightKg ??
            (dailyLogs[0] ? (dailyLogs[0]?.fastedWeight ?? dailyLogs[0]?.fasted_weight) : null)
        );
        if (baselineWeight !== null && !isNaN(baselineWeight)) {
            datasets.push({
                label: 'Baseline Weight',
                data: new Array(logsForChart.length).fill(baselineWeight),
                borderColor: 'rgba(150, 150, 150, 0.6)',
                borderWidth: 1.5,
                borderDash: [8, 4],
                fill: false,
                pointRadius: 0,
                tension: 0,
                yAxisID: 'y',
                order: 0
            });
        }
    }
    
    if (datasets.length === 0) {
        canvas.parentElement.innerHTML = '<p style="text-align: center; color: #999; padding: 40px; font-size: 14px;">Enable at least one metric to view</p>';
        return;
    }
    
    window.weightChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 12,
                        font: {
                            size: 12,
                            weight: 600,
                            family: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
                        },
                        color: '#333'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    padding: 14,
                    titleFont: {
                        size: 13,
                        weight: 600,
                        family: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
                    },
                    bodyFont: {
                        size: 12,
                        family: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
                    },
                    displayColors: true,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        title: function(context) {
                            const idx = context[0].dataIndex;
                            const log = logsForChart[idx];
                            if (log?.date) {
                                try {
                                    const date = new Date(log.date);
                                    return date.toLocaleDateString('en-US', { 
                                        weekday: 'short', 
                                        month: 'short', 
                                        day: 'numeric',
                                        year: 'numeric'
                                    });
                                } catch (e) {
                                    return log.date;
                                }
                            }
                            return labels[idx] || `Day ${idx + 1}`;
                        },
                        label: function(context) {
                            const value = context.parsed.y;
                            if (value === null || isNaN(value)) return '';
                            const label = context.dataset.label || '';
                            if (label.includes('Protein')) {
                                return `${label}: ${value.toFixed(0)} g`;
                            } else if (label.includes('Waist')) {
                                return `${label}: ${value.toFixed(1)} cm`;
                            } else {
                                return `${label}: ${value.toFixed(2)} kg`;
                            }
                        },
                        afterBody: function(context) {
                            const idx = context[0].dataIndex;
                            const log = logsForChart[idx];
                            if (!log) return [];
                            
                            const extras = [];
                            const totals = getDailyTotals(log);
                            
                            if (totals.seafoodKg > 0) {
                                extras.push(`🐟 Seafood: ${totals.seafoodKg.toFixed(2)} kg`);
                            }
                            if (log.training) {
                                extras.push(`💪 ${log.training}`);
                            }
                            if (log.feeling) {
                                extras.push(`😊 Feeling: ${log.feeling}/10`);
                            }
                            
                            return extras;
                        }
                    }
                },
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: null
                    },
                    limits: {
                        x: { min: 0, max: labels.length - 1 }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            family: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
                        },
                        color: '#666',
                        maxRotation: 45,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: window.chartState.timeframe === 'all' ? 20 : 15
                    },
                    border: {
                        display: false
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            family: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
                        },
                        color: '#666',
                        callback: function(value) {
                            if (window.chartState.enabledMetrics.weight || window.chartState.enabledMetrics.waist) {
                                return value.toFixed(1) + (window.chartState.enabledMetrics.weight ? ' kg' : ' cm');
                            }
                            return value.toFixed(1);
                        }
                    },
                    border: {
                        display: false
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            family: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
                        },
                        color: '#666',
                        callback: function(value) {
                            return value.toFixed(0) + ' g';
                        }
                    },
                    border: {
                        display: false
                    }
                }
            }
        }
    });
}

function setTimeframe(days) {
    window.chartState.timeframe = days;
    
    // Update button states
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.timeframe === String(days)) {
            btn.classList.add('active');
        }
    });
    
    // Re-render chart
    if (window.chartState.allLogs.length > 0) {
        renderWeightChart(window.chartState.allLogs, window.chartState.baseline);
    }
}

function toggleMetric(metric, enabled) {
    window.chartState.enabledMetrics[metric] = enabled;
    
    // Re-render chart
    if (window.chartState.allLogs.length > 0) {
        renderWeightChart(window.chartState.allLogs, window.chartState.baseline);
    }
}

function resetChartZoom() {
    if (window.weightChartInstance && window.weightChartInstance.resetZoom) {
        window.weightChartInstance.resetZoom();
    }
}

function updateFishRing(dailyLogs = []) {
    const metaEl = document.getElementById('fishWeeklyMeta');
    if (!metaEl) return;
    
    if (!dailyLogs.length) {
        metaEl.textContent = '0.0 / 7.0 kg this week';
        return;
    }
    
    const weeklyLogs = dailyLogs.slice(-7);
    const weeklyFish = weeklyLogs.reduce((sum, log) => {
        const totals = getDailyTotals(log);
        return sum + (totals.seafoodKg || 0);
    }, 0);
    
    const weeklyGoal = 7;
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
        criteriaListEl.innerHTML = '';
        if (scoreMetaEl) {
            scoreMetaEl.textContent = '';
        }
        return;
    }
    
    const today = dailyLogs[dailyLogs.length - 1];
    const totals = getDailyTotals(today);
    const supplements = today.supplements || {};
    
    // Handle training - can be string or object
    let training = '';
    if (today.training) {
        if (typeof today.training === 'string') {
            training = today.training.trim();
        } else if (typeof today.training === 'object' && today.training !== null) {
            // Structured training data - check if it has content
            const hasWorkout = today.training.workout && Array.isArray(today.training.workout) && today.training.workout.length > 0;
            const hasSession = today.training.session && today.training.session.trim();
            training = hasWorkout || hasSession ? 'Training logged' : '';
        }
    }
    
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
        scoreMetaEl.textContent = label;
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
    
    // Initialize day display
    if (dailyLogs.length > 0) {
        const today = dailyLogs[dailyLogs.length - 1];
        updateDayDisplay(today);
    }
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
    
    // Update button states and display
    updateNavButtons();
    updatePillSelection();
    scrollActivePillIntoView();
    updateDayDisplay(newDay);
    
    // Smooth scroll to keep selector in view (if not sticky)
    const selectorEl = document.getElementById('daySelectorSticky');
    if (selectorEl) {
        selectorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function updateDayDisplay(dayData) {
    const valueEl = document.getElementById('dayCurrentValue');
    const dateEl = document.getElementById('dayCurrentDate');
    
    if (valueEl && dayData) {
        valueEl.textContent = dayData.day || '--';
    }
    
    if (dateEl && dayData) {
        dateEl.textContent = dayData.date_display || dayData.date || '';
    }
}

function setupSwipeGestures() {
    const swipeContainer = document.getElementById('daySelectorSticky');
    if (!swipeContainer) return;
    
    let touchStartX = 0;
    let touchEndX = 0;
    let isSwiping = false;
    
    swipeContainer.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        isSwiping = true;
    }, { passive: true });
    
    swipeContainer.addEventListener('touchmove', function(e) {
        if (!isSwiping) return;
        const currentX = e.changedTouches[0].screenX;
        const diff = currentX - touchStartX;
        
        // Visual feedback during swipe
        if (Math.abs(diff) > 10) {
            swipeContainer.style.transform = `translateX(${diff * 0.3}px)`;
            swipeContainer.style.opacity = `${1 - Math.abs(diff) / 200}`;
        }
    }, { passive: true });
    
    swipeContainer.addEventListener('touchend', function(e) {
        if (!isSwiping) return;
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        
        // Reset transform
        swipeContainer.style.transform = '';
        swipeContainer.style.opacity = '';
        
        // Swipe threshold: 50px
        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                // Swipe right = previous day
                navigateDay(-1);
            } else {
                // Swipe left = next day
                navigateDay(1);
            }
        }
        
        isSwiping = false;
    }, { passive: true });
}

function setupKeyboardNavigation() {
    document.addEventListener('keydown', function(e) {
        // Only handle arrow keys when not typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateDay(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateDay(1);
        }
    });
}

function updateNavButtons() {
    const selector = document.getElementById('daySelect');
    if (!selector || dailyLogsCache.length === 0) {
        // Disable all nav buttons
        document.querySelectorAll('.day-pill-nav, .day-nav-button, .day-nav-btn, .day-nav-btn-mobile').forEach(btn => {
            btn.disabled = true;
        });
        return;
    }
    
    const currentDay = parseInt(selector.value);
    if (!currentDay) {
        document.querySelectorAll('.day-pill-nav, .day-nav-button, .day-nav-btn, .day-nav-btn-mobile').forEach(btn => {
            btn.disabled = true;
        });
        return;
    }
    
    const currentIndex = dailyLogsCache.findIndex(d => d.day == currentDay);
    const canGoPrev = currentIndex > 0;
    const canGoNext = currentIndex < dailyLogsCache.length - 1;
    
    // Update all nav buttons (desktop and mobile)
    const prevBtns = document.querySelectorAll('#prevDayBtnDesktop, #prevDayBtnMobile, #prevDayBtn');
    const nextBtns = document.querySelectorAll('#nextDayBtnDesktop, #nextDayBtnMobile, #nextDayBtn');
    
    prevBtns.forEach(btn => {
        if (btn) btn.disabled = !canGoPrev;
    });
    nextBtns.forEach(btn => {
        if (btn) btn.disabled = !canGoNext;
    });
    
    // Update current day display
    if (currentIndex >= 0) {
        const currentDayData = dailyLogsCache[currentIndex];
        updateDayDisplay(currentDayData);
    }
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

function toggleWeightGraph() {
    const graphCard = document.getElementById('weightGraphCard');
    const toggleBtn = document.getElementById('weightGraphToggle');
    
    if (!graphCard || !toggleBtn) return;
    
    const isVisible = graphCard.style.display !== 'none' && graphCard.style.display !== '';
    
    if (isVisible) {
        // Hide graph
        graphCard.style.display = 'none';
        toggleBtn.querySelector('.toggle-btn-text').textContent = 'View Weight Trend Graph';
        toggleBtn.querySelector('.toggle-btn-icon').textContent = '📊';
    } else {
        // Show graph
        graphCard.style.display = 'flex';
        toggleBtn.querySelector('.toggle-btn-text').textContent = 'Hide Weight Trend Graph';
        toggleBtn.querySelector('.toggle-btn-icon').textContent = '📉';
        
        // Always render to ensure latest data is shown
        if (dashboardData && dashboardData.daily_logs && dashboardData.daily_logs.length > 0) {
            renderWeightChart(dashboardData.daily_logs, dashboardData.baseline || {});
        }
    }
}

async function loadBodyScanRings() {
    try {
        const response = await fetch('/api/body-scans');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const scans = data.scans || [];
        
        if (scans.length < 2) {
            document.getElementById('dashboardRingsContainer').innerHTML = 
                '<div class="info-state" style="grid-column: 1 / -1; padding: 1rem; text-align: center; color: #6b7280; font-size: 0.85rem;">Need at least 2 scans to show progress</div>';
            return;
        }
        
        const baseline = scans[0];
        const latest = scans[scans.length - 1];
        
        if (!baseline || !latest) {
            return;
        }
        
        const rings = [
            {
                label: 'Body Fat %',
                current: latest.body_fat_percent,
                baseline: baseline.body_fat_percent,
                target: 13,
                unit: '%',
                className: 'body-fat',
                positiveDirection: 'down'
            },
            {
                label: 'Lean Mass',
                current: latest.lean_mass_kg,
                baseline: baseline.lean_mass_kg,
                target: baseline.lean_mass_kg + 8,
                unit: 'kg',
                className: 'lean-mass',
                positiveDirection: 'up'
            },
            {
                label: 'Muscle Mass',
                current: latest.skeletal_muscle_mass_kg,
                baseline: baseline.skeletal_muscle_mass_kg || 0,
                target: (baseline.skeletal_muscle_mass_kg || 0) + 5,
                unit: 'kg',
                className: 'muscle-mass',
                positiveDirection: 'up'
            },
            {
                label: 'Visceral Fat',
                current: latest.visceral_fat_level,
                baseline: baseline.visceral_fat_level || 10,
                target: 5,
                unit: '',
                className: 'visceral-fat',
                positiveDirection: 'down'
            }
        ];
        
        let html = '';
        rings.forEach(ring => {
            // Skip if current value is null/undefined
            if (ring.current == null || ring.baseline == null) {
                html += `
                    <div class="dashboard-ring-card">
                        <h4>${ring.label}</h4>
                        <div class="dashboard-ring-container">
                            <svg class="dashboard-ring-svg" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" stroke="#e5e7eb" stroke-width="7" fill="none"/>
                            </svg>
                            <div class="dashboard-ring-value">--</div>
                        </div>
                        <div class="dashboard-ring-label">Target: ${ring.target.toFixed(1)}${ring.unit ? ring.unit : ''}</div>
                    </div>
                `;
                return;
            }
            
            let progress;
            if (ring.positiveDirection === 'down') {
                // For "down" metrics (body fat, visceral fat): progress = how much we've reduced from baseline toward target
                // If current <= target, we're at 100%
                // If current >= baseline, we're at 0%
                if (ring.current <= ring.target) {
                    progress = 100;
                } else if (ring.current >= ring.baseline) {
                    progress = 0;
                } else {
                    // Calculate progress: (baseline - current) / (baseline - target) * 100
                    progress = ((ring.baseline - ring.current) / (ring.baseline - ring.target)) * 100;
                }
            } else {
                // For "up" metrics (lean mass, muscle mass): progress = how much we've gained from baseline toward target
                // If current >= target, we're at 100%
                // If current <= baseline, we're at 0%
                if (ring.current >= ring.target) {
                    progress = 100;
                } else if (ring.current <= ring.baseline) {
                    progress = 0;
                } else {
                    // Calculate progress: (current - baseline) / (target - baseline) * 100
                    progress = ((ring.current - ring.baseline) / (ring.target - ring.baseline)) * 100;
                }
            }
            
            const clampedProgress = Math.max(0, Math.min(100, progress));
            const radius = 45;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (clampedProgress / 100) * circumference;
            
            html += `
                <div class="dashboard-ring-card">
                    <h4>${ring.label}</h4>
                    <div class="dashboard-ring-container">
                        <svg class="dashboard-ring-svg" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="${radius}" stroke="#e5e7eb" stroke-width="7" fill="none"/>
                            <circle class="dashboard-ring-progress ${ring.className}" cx="50" cy="50" r="${radius}" 
                                    stroke-dasharray="${circumference}" 
                                    stroke-dashoffset="${offset}"
                                    fill="none"/>
                        </svg>
                        <div class="dashboard-ring-value">${ring.current.toFixed(1)}${ring.unit ? ring.unit : ''}</div>
                    </div>
                    <div class="dashboard-ring-label">Target: ${ring.target.toFixed(1)}${ring.unit ? ring.unit : ''}</div>
                </div>
            `;
        });
        
        document.getElementById('dashboardRingsContainer').innerHTML = html;
    } catch (error) {
        console.error('Error loading body scan rings:', error);
        document.getElementById('dashboardRingsContainer').innerHTML = 
            '<div class="info-state" style="grid-column: 1 / -1; padding: 1rem; text-align: center; color: #6b7280; font-size: 0.85rem;">Unable to load scan data</div>';
    }
}
