// Body Scans Tracker JavaScript

let scansData = [];
let chartInstances = {};

document.addEventListener('DOMContentLoaded', () => {
    loadScansData();
});

async function loadScansData() {
    try {
        const response = await fetch('/api/body-scans');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        scansData = data.scans || [];
        
        renderStats();
        renderComparison();
        renderAllScans();
        renderCharts();
    } catch (error) {
        console.error('Error loading scans data:', error);
        document.getElementById('comparisonContainer').innerHTML = 
            '<div class="error-state">Error loading scan data. Please try again later.</div>';
        document.getElementById('scansContainer').innerHTML = 
            '<div class="error-state">Error loading scan data. Please try again later.</div>';
    }
}

function renderStats() {
    const totalScans = scansData.length;
    const latestScan = scansData.length > 0 ? scansData[scansData.length - 1] : null;
    
    document.getElementById('totalScans').textContent = totalScans;
    
    if (latestScan) {
        document.getElementById('latestBodyFat').textContent = 
            latestScan.body_fat_percent ? `${latestScan.body_fat_percent.toFixed(1)}%` : '--';
        
        const date = new Date(latestScan.date);
        document.getElementById('latestScanDate').textContent = 
            date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

function renderComparison() {
    if (scansData.length < 2) {
        document.getElementById('comparisonContainer').innerHTML = 
            '<div class="info-state">Need at least 2 scans to show comparison.</div>';
        return;
    }
    
    const baseline = scansData[0];
    const latest = scansData[scansData.length - 1];
    
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
        
        html += `
            <div class="metric-row">
                <span class="metric-label">${metric.label}</span>
                <div class="metric-values">
                    <span class="metric-value">${changeText}</span>
                    <span class="metric-change ${changeClass}">${changeClass === 'positive' ? '✓' : changeClass === 'negative' ? '✗' : '—'}</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
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

