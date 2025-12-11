// Body Scans Tracker JavaScript

let scansData = [];
let chartInstances = {};

document.addEventListener('DOMContentLoaded', () => {
    loadScansData();
});

async function loadScansData() {
    try {
        console.log('Loading scans data from /api/body-scans...');
        const response = await fetch('/api/body-scans');
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);
        scansData = data.scans || [];
        console.log('Loaded scans:', scansData.length, scansData);
        
        if (scansData.length === 0) {
            console.warn('No scans data found');
            document.getElementById('comparisonContainer').innerHTML = 
                '<div class="info-state">No scan data available. Please add scan data.</div>';
            document.getElementById('scansContainer').innerHTML = 
                '<div class="info-state">No scan data available. Please add scan data.</div>';
            return;
        }
        
        renderStats();
        renderAchievements();
        renderBodyComposition();
        renderComparison();
        renderAllScans();
        renderCharts();
    } catch (error) {
        console.error('Error loading scans data:', error);
        const errorMsg = error.message || 'Unknown error';
        document.getElementById('comparisonContainer').innerHTML = 
            `<div class="error-state">Error loading scan data: ${errorMsg}. Please check console for details.</div>`;
        document.getElementById('scansContainer').innerHTML = 
            `<div class="error-state">Error loading scan data: ${errorMsg}. Please check console for details.</div>`;
        document.getElementById('achievementsContainer').innerHTML = 
            `<div class="error-state">Error loading scan data: ${errorMsg}</div>`;
        document.getElementById('compositionContainer').innerHTML = 
            `<div class="error-state">Error loading scan data: ${errorMsg}</div>`;
    }
}

function renderStats() {
    const totalScans = scansData.length;
    const latestScan = scansData.length > 0 ? scansData[scansData.length - 1] : null;
    const baselineScan = scansData.length > 0 ? scansData[0] : null;
    
    document.getElementById('totalScans').textContent = totalScans;
    
    if (baselineScan && latestScan) {
        const daysDiff = Math.floor((new Date(latestScan.date) - new Date(baselineScan.date)) / (1000 * 60 * 60 * 24));
        document.getElementById('daysTracked').textContent = daysDiff;
    } else {
        document.getElementById('daysTracked').textContent = '--';
    }
    
    if (latestScan) {
        document.getElementById('latestBodyFat').textContent = 
            latestScan.body_fat_percent ? `${latestScan.body_fat_percent.toFixed(1)}%` : '--';
        
        const date = new Date(latestScan.date);
        document.getElementById('latestScanDate').textContent = 
            date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    renderProgressRings();
}

function renderProgressRings() {
    if (scansData.length < 2) return;
    
    const baseline = scansData[0];
    const latest = scansData[scansData.length - 1];
    
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
            baseline: baseline.skeletal_muscle_mass_kg,
            target: baseline.skeletal_muscle_mass_kg + 5,
            unit: 'kg',
            className: 'muscle-mass',
            positiveDirection: 'up'
        },
        {
            label: 'Visceral Fat',
            current: latest.visceral_fat_level,
            baseline: baseline.visceral_fat_level,
            target: 5,
            unit: '',
            className: 'visceral-fat',
            positiveDirection: 'down'
        }
    ];
    
    let html = '';
    rings.forEach(ring => {
        const progress = ring.positiveDirection === 'down' 
            ? ((ring.baseline - ring.current) / (ring.baseline - ring.target)) * 100
            : ((ring.current - ring.baseline) / (ring.target - ring.baseline)) * 100;
        const clampedProgress = Math.max(0, Math.min(100, progress));
        const circumference = 2 * Math.PI * 50;
        const offset = circumference - (clampedProgress / 100) * circumference;
        
        html += `
            <div class="progress-ring-card">
                <h4>${ring.label}</h4>
                <div class="ring-container">
                    <svg class="ring-svg" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" stroke="#e5e7eb" stroke-width="8" fill="none"/>
                        <circle class="ring-progress ${ring.className}" cx="60" cy="60" r="50" 
                                stroke-dasharray="${circumference}" 
                                stroke-dashoffset="${offset}"
                                fill="none"/>
                    </svg>
                    <div class="ring-value">${ring.current.toFixed(1)}${ring.unit ? ring.unit : ''}</div>
                </div>
                <div class="ring-label">Target: ${ring.target.toFixed(1)}${ring.unit ? ring.unit : ''}</div>
            </div>
        `;
    });
    
    document.getElementById('progressRingsContainer').innerHTML = html;
}

function renderAchievements() {
    if (scansData.length < 2) {
        document.getElementById('achievementsContainer').innerHTML = 
            '<div class="info-state">Need at least 2 scans to show achievements.</div>';
        return;
    }
    
    const baseline = scansData[0];
    const latest = scansData[scansData.length - 1];
    const daysDiff = Math.floor((new Date(latest.date) - new Date(baseline.date)) / (1000 * 60 * 60 * 24));
    
    const achievements = [];
    
    // Body fat reduction
    const bfChange = baseline.body_fat_percent - latest.body_fat_percent;
    if (bfChange > 0) {
        achievements.push({
            title: 'Body Fat Reduction',
            value: `${bfChange.toFixed(1)}%`,
            label: `Dropped from ${baseline.body_fat_percent.toFixed(1)}% to ${latest.body_fat_percent.toFixed(1)}%`,
            positive: true
        });
    }
    
    // Muscle gain
    const muscleGain = latest.skeletal_muscle_mass_kg - baseline.skeletal_muscle_mass_kg;
    if (muscleGain > 0) {
        achievements.push({
            title: 'Muscle Gained',
            value: `+${muscleGain.toFixed(1)} kg`,
            label: `Gained ${muscleGain.toFixed(1)} kg of muscle mass`,
            positive: true
        });
    }
    
    // Fat loss
    const fatLoss = baseline.fat_mass_kg - latest.fat_mass_kg;
    if (fatLoss > 0) {
        achievements.push({
            title: 'Fat Lost',
            value: `-${fatLoss.toFixed(1)} kg`,
            label: `Lost ${fatLoss.toFixed(1)} kg of fat`,
            positive: true
        });
    }
    
    // Visceral fat reduction
    const visceralChange = baseline.visceral_fat_level - latest.visceral_fat_level;
    if (visceralChange > 0) {
        achievements.push({
            title: 'Visceral Fat Drop',
            value: `-${visceralChange}`,
            label: `Reduced visceral fat level from ${baseline.visceral_fat_level} to ${latest.visceral_fat_level}`,
            positive: true
        });
    }
    
    // Body recomposition score
    if (muscleGain > 0 && fatLoss > 0) {
        const recompositionRatio = muscleGain / fatLoss;
        achievements.push({
            title: 'Recomposition Ratio',
            value: `${recompositionRatio.toFixed(2)}:1`,
            label: `${muscleGain.toFixed(1)} kg muscle gained per ${fatLoss.toFixed(1)} kg fat lost`,
            positive: recompositionRatio >= 0.5
        });
    }
    
    // Rate of change
    if (daysDiff > 0) {
        const weeklyBFChange = (bfChange / daysDiff) * 7;
        const weeklyMuscleGain = (muscleGain / daysDiff) * 7;
        achievements.push({
            title: 'Weekly Rate',
            value: `${weeklyBFChange.toFixed(2)}% BF/week`,
            label: `Body fat dropping ${weeklyBFChange.toFixed(2)}% per week`,
            positive: true
        });
    }
    
    if (achievements.length === 0) {
        document.getElementById('achievementsContainer').innerHTML = 
            '<div class="info-state">Keep tracking to see achievements!</div>';
        return;
    }
    
    let html = '<div class="achievements-grid">';
    achievements.forEach(achievement => {
        html += `
            <div class="achievement-card ${achievement.positive ? 'positive' : ''}">
                <h3>${achievement.title}</h3>
                <div class="achievement-value">${achievement.value}</div>
                <div class="achievement-label">${achievement.label}</div>
            </div>
        `;
    });
    html += '</div>';
    
    document.getElementById('achievementsContainer').innerHTML = html;
}

function renderBodyComposition() {
    if (scansData.length === 0) {
        document.getElementById('compositionContainer').innerHTML = 
            '<div class="info-state">No scan data available.</div>';
        return;
    }
    
    const latest = scansData[scansData.length - 1];
    const baseline = scansData.length > 1 ? scansData[0] : null;
    
    const fatMass = latest.fat_mass_kg;
    const leanMass = latest.lean_mass_kg;
    const total = fatMass + leanMass;
    
    let html = '<div class="composition-grid">';
    
    // Latest composition pie chart
    html += '<div class="composition-card">';
    html += '<h3>Latest Scan Composition</h3>';
    html += `<div class="composition-chart-container"><canvas id="compositionChart"></canvas></div>`;
    html += '</div>';
    
    // Comparison breakdown
    if (baseline) {
        html += '<div class="composition-card">';
        html += '<h3>Composition Changes</h3>';
        html += '<div class="scan-metrics-grid">';
        html += `<div class="scan-metric"><div class="scan-metric-label">Fat Mass</div><div class="scan-metric-value">${fatMass.toFixed(1)} kg <span style="color: #059669; font-size: 0.8rem;">(${baseline.fat_mass_kg > fatMass ? '-' : '+'}${Math.abs(baseline.fat_mass_kg - fatMass).toFixed(1)} kg)</span></div></div>`;
        html += `<div class="scan-metric"><div class="scan-metric-label">Lean Mass</div><div class="scan-metric-value">${leanMass.toFixed(1)} kg <span style="color: #059669; font-size: 0.8rem;">(${leanMass > baseline.lean_mass_kg ? '+' : ''}${(leanMass - baseline.lean_mass_kg).toFixed(1)} kg)</span></div></div>`;
        html += `<div class="scan-metric"><div class="scan-metric-label">Fat %</div><div class="scan-metric-value">${latest.body_fat_percent.toFixed(1)}% <span style="color: #059669; font-size: 0.8rem;">(${baseline.body_fat_percent > latest.body_fat_percent ? '-' : '+'}${Math.abs(baseline.body_fat_percent - latest.body_fat_percent).toFixed(1)}%)</span></div></div>`;
        html += `<div class="scan-metric"><div class="scan-metric-label">Lean %</div><div class="scan-metric-value">${(100 - latest.body_fat_percent).toFixed(1)}% <span style="color: #059669; font-size: 0.8rem;">(${(100 - latest.body_fat_percent) > (100 - baseline.body_fat_percent) ? '+' : ''}${((100 - latest.body_fat_percent) - (100 - baseline.body_fat_percent)).toFixed(1)}%)</span></div></div>`;
        html += '</div>';
        html += '</div>';
    }
    
    html += '</div>';
    
    document.getElementById('compositionContainer').innerHTML = html;
    
    // Render pie chart
    setTimeout(() => {
        const ctx = document.getElementById('compositionChart');
        if (ctx) {
            if (chartInstances['compositionChart']) {
                chartInstances['compositionChart'].destroy();
            }
            
            chartInstances['compositionChart'] = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Fat Mass', 'Lean Mass'],
                    datasets: [{
                        data: [fatMass, leanMass],
                        backgroundColor: ['#ef4444', '#10b981'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 15,
                                font: {
                                    size: 12,
                                    weight: '600'
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value.toFixed(1)} kg (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }, 100);
}

function renderComparison() {
    if (scansData.length < 2) {
        document.getElementById('comparisonContainer').innerHTML = 
            '<div class="info-state">Need at least 2 scans to show comparison.</div>';
        return;
    }
    
    // Setup scan selector
    const baselineSelect = document.getElementById('baselineSelect');
    const latestSelect = document.getElementById('latestSelect');
    
    if (scansData.length > 2) {
        document.getElementById('scanSelector').style.display = 'block';
        baselineSelect.innerHTML = '';
        latestSelect.innerHTML = '';
        
        scansData.forEach((scan, index) => {
            const option1 = document.createElement('option');
            option1.value = index;
            option1.textContent = `${formatDate(scan.date)} (${scan.scan_type})`;
            if (index === 0) option1.selected = true;
            baselineSelect.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = index;
            option2.textContent = `${formatDate(scan.date)} (${scan.scan_type})`;
            if (index === scansData.length - 1) option2.selected = true;
            latestSelect.appendChild(option2);
        });
        
        baselineSelect.addEventListener('change', updateComparison);
        latestSelect.addEventListener('change', updateComparison);
    }
    
    updateComparison();
}

function updateComparison() {
    const baselineSelect = document.getElementById('baselineSelect');
    const latestSelect = document.getElementById('latestSelect');
    
    let baselineIndex = 0;
    let latestIndex = scansData.length - 1;
    
    if (baselineSelect && latestSelect) {
        baselineIndex = parseInt(baselineSelect.value);
        latestIndex = parseInt(latestSelect.value);
    }
    
    const baseline = scansData[baselineIndex];
    const latest = scansData[latestIndex];
    
    const daysDiff = Math.floor((new Date(latest.date) - new Date(baseline.date)) / (1000 * 60 * 60 * 24));
    
    const metrics = [
        {
            label: 'Weight',
            baseline: baseline.weight_kg,
            latest: latest.weight_kg,
            unit: 'kg',
            positiveDirection: 'down'
        },
        {
            label: 'Body Fat %',
            baseline: baseline.body_fat_percent,
            latest: latest.body_fat_percent,
            unit: '%',
            positiveDirection: 'down'
        },
        {
            label: 'Lean Mass',
            baseline: baseline.lean_mass_kg,
            latest: latest.lean_mass_kg,
            unit: 'kg',
            positiveDirection: 'up'
        },
        {
            label: 'Skeletal Muscle Mass',
            baseline: baseline.skeletal_muscle_mass_kg,
            latest: latest.skeletal_muscle_mass_kg,
            unit: 'kg',
            positiveDirection: 'up'
        },
        {
            label: 'Fat Mass',
            baseline: baseline.fat_mass_kg,
            latest: latest.fat_mass_kg,
            unit: 'kg',
            positiveDirection: 'down'
        },
        {
            label: 'Visceral Fat Level',
            baseline: baseline.visceral_fat_level,
            latest: latest.visceral_fat_level,
            unit: '',
            positiveDirection: 'down'
        },
        {
            label: 'Visceral Fat Area',
            baseline: baseline.visceral_fat_area_cm2,
            latest: latest.visceral_fat_area_cm2,
            unit: 'cm²',
            positiveDirection: 'down'
        },
        {
            label: 'Android Fat',
            baseline: baseline.android_fat_kg,
            latest: latest.android_fat_kg,
            unit: 'kg',
            positiveDirection: 'down'
        },
        {
            label: 'Gynoid Fat',
            baseline: baseline.gynoid_fat_kg,
            latest: latest.gynoid_fat_kg,
            unit: 'kg',
            positiveDirection: 'down'
        },
        {
            label: 'BMR',
            baseline: baseline.basal_metabolic_rate_kcal,
            latest: latest.basal_metabolic_rate_kcal,
            unit: 'kcal',
            positiveDirection: 'up'
        },
        {
            label: 'BMI',
            baseline: baseline.bmi,
            latest: latest.bmi,
            unit: '',
            positiveDirection: 'down'
        }
    ];
    
    let html = '<div class="comparison-grid">';
    
    // Baseline Card
    html += '<div class="comparison-card">';
    html += '<h3>Baseline</h3>';
    html += `<div class="metric-row"><span class="metric-label">Date</span><span class="metric-value">${formatDate(baseline.date)}</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Scan Type</span><span class="metric-value">${baseline.scan_type}</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Weight</span><span class="metric-value">${baseline.weight_kg.toFixed(1)} kg</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Body Fat</span><span class="metric-value">${baseline.body_fat_percent.toFixed(1)}%</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Lean Mass</span><span class="metric-value">${baseline.lean_mass_kg.toFixed(1)} kg</span></div>`;
    html += '</div>';
    
    // Latest Card
    html += '<div class="comparison-card">';
    html += '<h3>Latest</h3>';
    html += `<div class="metric-row"><span class="metric-label">Date</span><span class="metric-value">${formatDate(latest.date)}</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Scan Type</span><span class="metric-value">${latest.scan_type}</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Weight</span><span class="metric-value">${latest.weight_kg.toFixed(1)} kg</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Body Fat</span><span class="metric-value">${latest.body_fat_percent.toFixed(1)}%</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Lean Mass</span><span class="metric-value">${latest.lean_mass_kg.toFixed(1)} kg</span></div>`;
    html += '</div>';
    
    // Changes Card
    html += '<div class="comparison-card">';
    html += '<h3>Change</h3>';
    
    metrics.forEach(metric => {
        if (metric.baseline == null || metric.latest == null) return;
        
        const change = metric.latest - metric.baseline;
        const changePercent = metric.baseline !== 0 ? ((change / metric.baseline) * 100) : 0;
        
        let changeClass = 'neutral';
        let changeText = '';
        
        if (change === 0) {
            changeText = '0';
            changeClass = 'neutral';
        } else {
            const isPositive = metric.positiveDirection === 'down' ? change < 0 : change > 0;
            changeClass = isPositive ? 'positive' : 'negative';
            const sign = change > 0 ? '+' : '';
            changeText = `${sign}${change.toFixed(1)} ${metric.unit}`;
            if (Math.abs(changePercent) > 0.1) {
                changeText += ` (${sign}${changePercent.toFixed(1)}%)`;
            }
        }
        
        // Calculate rate of change
        let rateText = '';
        if (daysDiff > 0) {
            const weeklyRate = (change / daysDiff) * 7;
            const monthlyRate = (change / daysDiff) * 30;
            rateText = `<div class="rate-of-change ${changeClass}">${weeklyRate > 0 ? '+' : ''}${weeklyRate.toFixed(2)} ${metric.unit}/week • ${monthlyRate > 0 ? '+' : ''}${monthlyRate.toFixed(2)} ${metric.unit}/month</div>`;
        }
        
        html += `
            <div class="metric-row">
                <span class="metric-label">${metric.label}</span>
                <div class="metric-values">
                    <div>
                        <span class="metric-value">${changeText}</span>
                        ${rateText}
                    </div>
                    <span class="metric-change ${changeClass}">${changeClass === 'positive' ? '✓' : changeClass === 'negative' ? '✗' : '—'}</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // Add days between scans
    html += `<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #f3f4f6; text-align: center; color: #6b7280; font-size: 0.875rem;">
        <strong>${daysDiff} days</strong> between scans
    </div>`;
    html += '</div>';
    
    document.getElementById('comparisonContainer').innerHTML = html;
}

function renderAllScans() {
    if (scansData.length === 0) {
        document.getElementById('scansContainer').innerHTML = 
            '<div class="info-state">No scan data available.</div>';
        return;
    }
    
    let html = '';
    
    // Sort by date, newest first
    const sortedScans = [...scansData].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedScans.forEach(scan => {
        html += '<div class="scan-card">';
        html += '<div class="scan-card-header">';
        html += `<div><span class="scan-card-title">${formatDate(scan.date)}</span><span class="scan-card-type ${scan.scan_type.toLowerCase()}">${scan.scan_type}</span></div>`;
        html += `<div class="scan-card-date">${scan.scan_time ? scan.scan_time.replace(/_/g, ' ') : ''}</div>`;
        html += '</div>';
        
        html += '<div class="scan-metrics-grid">';
        
        const keyMetrics = [
            { label: 'Weight', value: scan.weight_kg, unit: 'kg' },
            { label: 'Body Fat %', value: scan.body_fat_percent, unit: '%' },
            { label: 'Lean Mass', value: scan.lean_mass_kg, unit: 'kg' },
            { label: 'Muscle Mass', value: scan.skeletal_muscle_mass_kg, unit: 'kg' },
            { label: 'Fat Mass', value: scan.fat_mass_kg, unit: 'kg' },
            { label: 'Visceral Fat Level', value: scan.visceral_fat_level, unit: '' },
            { label: 'Visceral Fat Area', value: scan.visceral_fat_area_cm2, unit: 'cm²' },
            { label: 'Android Fat', value: scan.android_fat_kg, unit: 'kg' },
            { label: 'Gynoid Fat', value: scan.gynoid_fat_kg, unit: 'kg' },
            { label: 'A/G Ratio', value: scan.android_gynoid_ratio, unit: '' },
            { label: 'BMR', value: scan.basal_metabolic_rate_kcal, unit: 'kcal' },
            { label: 'BMI', value: scan.bmi, unit: '' }
        ];
        
        keyMetrics.forEach(metric => {
            if (metric.value != null) {
                html += `
                    <div class="scan-metric">
                        <div class="scan-metric-label">${metric.label}</div>
                        <div class="scan-metric-value">${metric.value.toFixed(metric.unit === '%' ? 1 : metric.unit === 'kg' ? 1 : metric.unit === 'cm²' ? 0 : metric.unit === 'kcal' ? 0 : 2)}${metric.unit ? ' ' + metric.unit : ''}</div>
                    </div>
                `;
            }
        });
        
        html += '</div>';
        
        if (scan.notes) {
            html += `<div class="scan-card-notes">${escapeHtml(scan.notes)}</div>`;
        }
        
        html += '</div>';
    });
    
    document.getElementById('scansContainer').innerHTML = html;
}

function renderCharts() {
    if (scansData.length < 2) {
        document.getElementById('chartsContainer').innerHTML = 
            '<div class="info-state">Need at least 2 scans to show progression charts.</div>';
        return;
    }
    
    // Sort by date
    const sortedScans = [...scansData].sort((a, b) => new Date(a.date) - new Date(b.date));
    const dates = sortedScans.map(s => formatDate(s.date));
    
    const charts = [
        {
            title: 'Body Fat %',
            data: sortedScans.map(s => s.body_fat_percent),
            color: '#ef4444',
            unit: '%'
        },
        {
            title: 'Weight',
            data: sortedScans.map(s => s.weight_kg),
            color: '#3b82f6',
            unit: 'kg'
        },
        {
            title: 'Lean Mass',
            data: sortedScans.map(s => s.lean_mass_kg),
            color: '#10b981',
            unit: 'kg'
        },
        {
            title: 'Skeletal Muscle Mass',
            data: sortedScans.map(s => s.skeletal_muscle_mass_kg),
            color: '#8b5cf6',
            unit: 'kg'
        },
        {
            title: 'Fat Mass',
            data: sortedScans.map(s => s.fat_mass_kg),
            color: '#f59e0b',
            unit: 'kg'
        },
        {
            title: 'Visceral Fat Level',
            data: sortedScans.map(s => s.visceral_fat_level),
            color: '#ec4899',
            unit: ''
        }
    ];
    
    let html = '';
    
    charts.forEach((chart, index) => {
        const chartId = `chart-${index}`;
        html += `
            <div class="chart-card">
                <h3>${chart.title}</h3>
                <div class="chart-container">
                    <canvas id="${chartId}"></canvas>
                </div>
            </div>
        `;
    });
    
    document.getElementById('chartsContainer').innerHTML = html;
    
    // Initialize charts
    charts.forEach((chart, index) => {
        const chartId = `chart-${index}`;
        const ctx = document.getElementById(chartId);
        if (ctx) {
            if (chartInstances[chartId]) {
                chartInstances[chartId].destroy();
            }
            
            chartInstances[chartId] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: chart.title,
                        data: chart.data,
                        borderColor: chart.color,
                        backgroundColor: chart.color + '20',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.parsed.y.toFixed(1)}${chart.unit ? ' ' + chart.unit : ''}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            ticks: {
                                callback: function(value) {
                                    return value.toFixed(1) + (chart.unit ? ' ' + chart.unit : '');
                                }
                            }
                        }
                    }
                }
            });
        }
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

