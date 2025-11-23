// Dashboard JavaScript

let macrosChart, proteinChart, seafoodChart;

// Load all data on page load
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    loadAdvice();
    loadStats();
});

async function loadData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        
        // Update streak
        document.getElementById('streakCount').textContent = data.streak;
        
        // Update goal
        document.getElementById('goalText').textContent = data.goal.goal || 'Loading...';
        
        // Update key metrics
        updateMetrics(data.baseline, data.targets);
        
        // Update charts
        updateCharts(data.daily_logs);
        
        // Update recent days table
        updateRecentDaysTable(data.daily_logs);
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function updateMetrics(baseline, targets) {
    // Android Fat
    const androidFat = baseline.android_fat || 0;
    const androidTarget = 15;
    document.getElementById('androidFat').textContent = androidFat.toFixed(1) + '%';
    const androidProgress = Math.min(100, (androidTarget / androidFat) * 100);
    document.getElementById('androidFatProgress').style.width = androidProgress + '%';
    
    // Body Fat
    const bodyFat = baseline.body_fat || 0;
    const bodyTarget = 13;
    document.getElementById('bodyFat').textContent = bodyFat.toFixed(1) + '%';
    const bodyProgress = Math.min(100, (bodyTarget / bodyFat) * 100);
    document.getElementById('bodyFatProgress').style.width = bodyProgress + '%';
    
    // ALT
    const alt = baseline.alt || 0;
    const altTarget = 80;
    document.getElementById('alt').textContent = alt.toFixed(0);
    const altProgress = Math.min(100, (altTarget / alt) * 100);
    document.getElementById('altProgress').style.width = altProgress + '%';
    
    // Glucose
    const glucose = baseline.fasting_glucose || 0;
    const glucoseTarget = 95;
    document.getElementById('glucose').textContent = glucose.toFixed(1);
    const glucoseProgress = Math.min(100, (glucoseTarget / glucose) * 100);
    document.getElementById('glucoseProgress').style.width = glucoseProgress + '%';
}

function updateCharts(dailyLogs) {
    // Get last 7 days
    const recentDays = dailyLogs.slice(-7);
    const labels = recentDays.map(d => `Day ${d.day}`);
    
    // Macros Chart
    const macrosCtx = document.getElementById('macrosChart').getContext('2d');
    if (macrosChart) macrosChart.destroy();
    
    macrosChart = new Chart(macrosCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Protein (g)',
                    data: recentDays.map(d => d.protein || 0),
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                },
                {
                    label: 'Carbs (g)',
                    data: recentDays.map(d => d.carbs || 0),
                    backgroundColor: 'rgba(245, 87, 108, 0.8)',
                },
                {
                    label: 'Fat (g)',
                    data: recentDays.map(d => d.fat || 0),
                    backgroundColor: 'rgba(118, 75, 162, 0.8)',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Protein Trend Chart
    const proteinCtx = document.getElementById('proteinChart').getContext('2d');
    if (proteinChart) proteinChart.destroy();
    
    proteinChart = new Chart(proteinCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Protein (g)',
                data: recentDays.map(d => d.protein || 0),
                borderColor: 'rgb(102, 126, 234)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: false,
                    min: 300
                }
            },
            plugins: {
                annotation: {
                    annotations: {
                        targetLine: {
                            type: 'line',
                            yMin: 350,
                            yMax: 350,
                            borderColor: 'rgb(255, 99, 132)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'Target: 350g',
                                enabled: true
                            }
                        }
                    }
                }
            }
        }
    });
    
    // Seafood Chart
    const seafoodCtx = document.getElementById('seafoodChart').getContext('2d');
    if (seafoodChart) seafoodChart.destroy();
    
    seafoodChart = new Chart(seafoodCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Seafood (kg)',
                data: recentDays.map(d => d.seafood_kg || 0),
                backgroundColor: 'rgba(118, 75, 162, 0.8)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 2.0
                }
            },
            plugins: {
                annotation: {
                    annotations: {
                        targetZone: {
                            type: 'box',
                            yMin: 1.0,
                            yMax: 1.5,
                            backgroundColor: 'rgba(102, 126, 234, 0.1)',
                            borderColor: 'rgba(102, 126, 234, 0.5)',
                            borderWidth: 1
                        }
                    }
                }
            }
        }
    });
}

function updateRecentDaysTable(dailyLogs) {
    const tbody = document.getElementById('recentDaysBody');
    const recentDays = dailyLogs.slice(-10).reverse(); // Last 10 days, newest first
    
    tbody.innerHTML = recentDays.map(day => `
        <tr>
            <td>${day.day}</td>
            <td>${day.date}</td>
            <td>${day.protein ? day.protein.toFixed(0) : '-'}</td>
            <td>${day.carbs ? day.carbs.toFixed(0) : '-'}</td>
            <td>${day.fat ? day.fat.toFixed(0) : '-'}</td>
            <td>${day.kcal ? day.kcal.toFixed(0) : '-'}</td>
            <td>${day.seafood_kg ? day.seafood_kg.toFixed(2) : '-'}</td>
            <td>${day.training || '-'}</td>
            <td>${day.feeling || '-'}</td>
        </tr>
    `).join('');
}

async function loadAdvice() {
    const adviceBox = document.getElementById('adviceBox');
    adviceBox.innerHTML = '<div class="loading">Loading advice from Grok...</div>';
    
    try {
        const response = await fetch('/api/advice');
        const data = await response.json();
        adviceBox.innerHTML = data.advice || 'No advice available.';
    } catch (error) {
        console.error('Error loading advice:', error);
        adviceBox.innerHTML = '⚠️ Error loading advice. Make sure GROK_API_KEY is set in your environment.';
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        document.getElementById('avgProtein').textContent = stats.avg_protein ? stats.avg_protein.toFixed(0) + 'g' : '-';
        document.getElementById('avgCarbs').textContent = stats.avg_carbs ? stats.avg_carbs.toFixed(0) + 'g' : '-';
        document.getElementById('avgFat').textContent = stats.avg_fat ? stats.avg_fat.toFixed(0) + 'g' : '-';
        document.getElementById('avgSeafood').textContent = stats.avg_seafood ? stats.avg_seafood.toFixed(2) + 'kg' : '-';
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

