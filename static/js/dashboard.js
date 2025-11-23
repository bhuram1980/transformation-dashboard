// Dashboard JavaScript

let macrosChart, proteinChart, seafoodChart, weightChart, waistChart;

// Macro calculation data (per kg of fish, skin on)
const fishMacros = {
    salmon: { protein: 200, fat: 120, kcal: 1800 },
    tuna: { protein: 240, fat: 10, kcal: 1100 },
    seabass: { protein: 180, fat: 60, kcal: 1000 },
    lobster: { protein: 200, fat: 20, kcal: 900 },
    mixed: { protein: 210, fat: 70, kcal: 1200 }
};

// Load all data on page load
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    loadAdvice();
    loadStats();
    loadPhotos();
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
        updateProgressCharts(data.daily_logs);
        
        // Update recent days table
        updateRecentDaysTable(data.daily_logs);
        
        // Check for glowing streak badge (350g+ protein)
        checkStreakGlow(data.daily_logs);
        
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

// Macro Calculator
function calculateMacros() {
    const fishKg = parseFloat(document.getElementById('fishKg').value) || 0;
    const fishType = document.getElementById('fishType').value;
    const macros = fishMacros[fishType];
    
    if (fishKg > 0 && macros) {
        const protein = Math.round(fishKg * macros.protein);
        const fat = Math.round(fishKg * macros.fat);
        const kcal = Math.round(fishKg * macros.kcal);
        
        document.getElementById('calcProtein').textContent = protein + ' g';
        document.getElementById('calcFat').textContent = fat + ' g';
        document.getElementById('calcKcal').textContent = kcal + ' kcal';
    } else {
        document.getElementById('calcProtein').textContent = '0 g';
        document.getElementById('calcFat').textContent = '0 g';
        document.getElementById('calcKcal').textContent = '0 kcal';
    }
}

// Progress Charts (Weight & Waist)
function updateProgressCharts(dailyLogs) {
    // Extract weight and waist data (if available in logs)
    // For now, we'll create placeholder charts that can be populated when data is available
    const labels = dailyLogs.map(d => `Day ${d.day}`);
    
    // Weight Chart
    const weightCtx = document.getElementById('weightChart');
    if (weightCtx) {
        if (weightChart) weightChart.destroy();
        
        // Extract weight from logs (if available in content)
        const weights = dailyLogs.map(d => {
            const weightMatch = d.content.match(/weight[:\s]+(\d+\.?\d*)\s*kg/i);
            return weightMatch ? parseFloat(weightMatch[1]) : null;
        }).filter(w => w !== null);
        
        if (weights.length > 0) {
            weightChart = new Chart(weightCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels.slice(-weights.length),
                    datasets: [{
                        label: 'Weight (kg)',
                        data: weights,
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
                            beginAtZero: false
                        }
                    }
                }
            });
        } else {
            weightCtx.parentElement.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Add weight data to your daily logs to see progress</p>';
        }
    }
    
    // Waist Chart
    const waistCtx = document.getElementById('waistChart');
    if (waistCtx) {
        if (waistChart) waistChart.destroy();
        
        // Extract waist from logs (if available in content)
        const waists = dailyLogs.map(d => {
            const waistMatch = d.content.match(/waist[:\s]+(\d+\.?\d*)\s*cm/i);
            return waistMatch ? parseFloat(waistMatch[1]) : null;
        }).filter(w => w !== null);
        
        if (waists.length > 0) {
            waistChart = new Chart(waistCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels.slice(-waists.length),
                    datasets: [{
                        label: 'Waist (cm)',
                        data: waists,
                        borderColor: 'rgb(245, 87, 108)',
                        backgroundColor: 'rgba(245, 87, 108, 0.1)',
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
                            reverse: true // Lower is better for waist
                        }
                    }
                }
            });
        } else {
            waistCtx.parentElement.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Add waist measurements to your daily logs to see progress</p>';
        }
    }
}

// Glowing Streak Badge (when hitting 350g+ protein)
function checkStreakGlow(dailyLogs) {
    if (dailyLogs.length === 0) return;
    
    const lastDay = dailyLogs[dailyLogs.length - 1];
    const protein = lastDay.protein || 0;
    const streakBadge = document.getElementById('streakBadge');
    
    if (protein >= 350 && streakBadge) {
        streakBadge.classList.add('glowing');
    } else {
        streakBadge.classList.remove('glowing');
    }
}

// Photo Upload Handler
async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('photoPreview');
        preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; border-radius: 8px;">`;
    };
    reader.readAsDataURL(file);
    
    // Try client-side direct upload first, then fallback to server
    try {
        // Get upload token from server
        const tokenResponse = await fetch('/api/upload-token');
        if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            const blobToken = tokenData.token;
            
            if (blobToken) {
                // Generate filename
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const filename = `${timestamp}_${file.name}`;
                
                // Upload directly to Vercel Blob
                const formData = new FormData();
                formData.append('file', file);
                
                const uploadResponse = await fetch(`https://blob.vercel-storage.com/${filename}?access=public`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${blobToken}`,
                        'Content-Type': file.type || 'image/jpeg'
                    },
                    body: file
                });
                
                if (uploadResponse.ok) {
                    const result = await uploadResponse.json();
                    const blobUrl = result.url || result.downloadUrl || `https://blob.vercel-storage.com/${filename}`;
                    
                    // Add to gallery
                    loadPhotos();
                    document.getElementById('photoPreview').innerHTML = '';
                    document.getElementById('photoInput').value = '';
                    alert('Photo uploaded successfully! 📸');
                    return;
                }
            }
        }
        
        // Fallback to server-side upload
        const formData = new FormData();
        formData.append('photo', file);
        
        const response = await fetch('/api/upload-photo', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Add to gallery
            loadPhotos();
            document.getElementById('photoPreview').innerHTML = '';
            document.getElementById('photoInput').value = '';
            alert('Photo uploaded successfully! 📸');
        } else {
            alert('Upload failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Error uploading photo: ' + error.message);
    }
}

// Load Photos
async function loadPhotos() {
    try {
        const response = await fetch('/api/photos');
        const data = await response.json();
        
        const gallery = document.getElementById('photoGallery');
        if (data.photos && data.photos.length > 0) {
            gallery.innerHTML = data.photos.map(photo => `
                <img src="${photo.url}" alt="Progress photo" onclick="window.open('${photo.url}', '_blank')">
            `).join('');
        } else {
            gallery.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1 / -1;">No photos yet. Upload your first progress photo!</p>';
        }
    } catch (error) {
        console.error('Error loading photos:', error);
    }
}

