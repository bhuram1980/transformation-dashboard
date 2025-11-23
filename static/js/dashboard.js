// Dashboard JavaScript - Apple/Stripe Style

let progressChart;

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    loadStats();
    loadPhotos();
    
    // Feeling slider update
    const feelingSlider = document.getElementById('feeling');
    const feelingValue = document.getElementById('feelingValue');
    if (feelingSlider && feelingValue) {
        feelingSlider.addEventListener('input', function() {
            feelingValue.textContent = this.value;
        });
    }
    
    // Form submission
    const form = document.getElementById('dailyLogForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
});

async function loadData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        
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
        
        // Update goals
        if (data.baseline) {
            updateGoals(data.baseline, data.targets);
        }
        
        // Render progress chart
        if (data.daily_logs && data.daily_logs.length > 0) {
            renderProgressChart(data.daily_logs);
        }
    } catch (error) {
        console.error('Error loading data:', error);
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

function updateGoals(baseline, targets) {
    // Android Fat
    const androidFat = baseline.android_fat || 0;
    const androidEl = document.getElementById('androidFatValue');
    const androidProgressEl = document.getElementById('androidFatProgress');
    if (androidEl) androidEl.textContent = androidFat.toFixed(1) + '%';
    if (androidProgressEl) {
        const progress = Math.min(100, (15 / androidFat) * 100);
        setTimeout(() => {
            androidProgressEl.style.width = progress + '%';
        }, 100);
    }
    
    // Body Fat
    const bodyFat = baseline.body_fat || 0;
    const bodyFatEl = document.getElementById('bodyFatValue');
    const bodyProgressEl = document.getElementById('bodyFatProgress');
    if (bodyFatEl) bodyFatEl.textContent = bodyFat.toFixed(1) + '%';
    if (bodyProgressEl) {
        const progress = Math.min(100, (13 / bodyFat) * 100);
        setTimeout(() => {
            bodyProgressEl.style.width = progress + '%';
        }, 200);
    }
    
    // ALT
    const alt = baseline.alt || 0;
    const altEl = document.getElementById('altValue');
    const altProgressEl = document.getElementById('altProgress');
    if (altEl) altEl.textContent = alt.toFixed(0);
    if (altProgressEl) {
        const progress = Math.min(100, (80 / alt) * 100);
        setTimeout(() => {
            altProgressEl.style.width = progress + '%';
        }, 300);
    }
    
    // Glucose
    const glucose = baseline.fasting_glucose || 0;
    const glucoseEl = document.getElementById('glucoseValue');
    const glucoseProgressEl = document.getElementById('glucoseProgress');
    if (glucoseEl) glucoseEl.textContent = glucose.toFixed(1);
    if (glucoseProgressEl) {
        const progress = Math.min(100, (95 / glucose) * 100);
        setTimeout(() => {
            glucoseProgressEl.style.width = progress + '%';
        }, 400);
    }
}

function renderProgressChart(dailyLogs) {
    const ctx = document.getElementById('progressChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (progressChart) {
        progressChart.destroy();
    }
    
    const labels = dailyLogs.map(d => `Day ${d.day}`);
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

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        // Stats are used for calculations, no UI elements to update in new design
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('.submit-btn');
    const messageEl = document.getElementById('formMessage');
    
    // Get form values
    const today = new Date().toISOString().split('T')[0];
    const formData = {
        date: today,
        protein: parseFloat(document.getElementById('protein').value),
        carbs: parseFloat(document.getElementById('carbs').value),
        fat: parseFloat(document.getElementById('fat').value),
        kcal: parseFloat(document.getElementById('kcal').value) || null,
        seafoodKg: parseFloat(document.getElementById('seafoodKg').value) || null,
        fastedWeight: parseFloat(document.getElementById('fastedWeight').value) || null,
        waist: parseFloat(document.getElementById('waist').value) || null,
        training: document.getElementById('training').value || '',
        feeling: parseInt(document.getElementById('feeling').value),
        notes: document.getElementById('notes').value || ''
    };
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging...';
    
    try {
        // Call Grok API to add day entry
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Add Day ${formData.date}: ${formData.protein}g protein, ${formData.carbs}g carbs, ${formData.fat}g fat, ${formData.seafoodKg || 0}kg seafood, ${formData.training || 'no training'}, feeling ${formData.feeling}/10`,
                history: []
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Show success message
        if (messageEl) {
            messageEl.textContent = `Day logged successfully! ${data.function_result?.message || ''}`;
            messageEl.className = 'form-message success';
            messageEl.style.display = 'block';
        }
        
        // Reset form
        form.reset();
        document.getElementById('feelingValue').textContent = '8';
        
        // Reload data after a delay
        setTimeout(() => {
            loadData();
            loadStats();
            if (messageEl) {
                messageEl.style.display = 'none';
            }
        }, 2000);
        
    } catch (error) {
        console.error('Error submitting form:', error);
        if (messageEl) {
            messageEl.textContent = `Error: ${error.message}`;
            messageEl.className = 'form-message error';
            messageEl.style.display = 'block';
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log Day';
    }
}

async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Compress image
    const compressedBlob = await compressImage(file);
    if (!compressedBlob) return;
    
    // Upload
    const formData = new FormData();
    formData.append('photo', compressedBlob, file.name);
    
    try {
        const response = await fetch('/api/upload-photo', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Reload photos
            loadPhotos();
        } else {
            alert('Upload failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
    }
    
    // Reset input
    event.target.value = '';
}

function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.8) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    } else {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function loadPhotos() {
    try {
        const response = await fetch('/api/photos');
        const data = await response.json();
        const photos = data.photos || [];
        
        const gallery = document.getElementById('photoGallery');
        if (!gallery) return;
        
        // Also check localStorage
        try {
            const stored = localStorage.getItem('uploadedPhotos');
            if (stored) {
                const storedPhotos = JSON.parse(stored);
                storedPhotos.forEach(stored => {
                    if (!photos.find(p => p.url === stored.url)) {
                        photos.push(stored);
                    }
                });
            }
        } catch (e) {
            console.error('Error reading localStorage:', e);
        }
        
        if (photos.length > 0) {
            gallery.innerHTML = photos.map(photo => {
                const url = photo.url;
                return `
                    <div class="photo-item">
                        <img src="${url}" alt="Progress photo" onclick="window.open('${url}', '_blank')">
                    </div>
                `;
            }).join('');
        } else {
            gallery.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1 / -1; padding: 40px;">No photos yet</p>';
        }
    } catch (error) {
        console.error('Error loading photos:', error);
    }
}
