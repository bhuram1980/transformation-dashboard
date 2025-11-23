// Dashboard JavaScript - Apple/Stripe Style

let progressChart;

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    loadStats();
    populateDaySelector();
    
    // View-only dashboard - no forms
});

async function loadData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        
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
        
        // Update goals
        if (data.baseline) {
            updateGoals(data.baseline, data.targets);
        }
        
        // Update goal and baseline metrics
        if (data.goal && data.baseline) {
            updateGoalAndBaseline(data.goal, data.baseline);
        }
        
        // Render progress chart (COMMENTED OUT - may add later)
        // if (data.daily_logs && data.daily_logs.length > 0) {
        //     renderProgressChart(data.daily_logs);
        // } else {
        //     console.warn('No daily logs found');
        // }
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
    
    // Update baseline metrics
    if (baseline) {
        const weightEl = document.getElementById('baselineWeight');
        if (weightEl && baseline.weight !== undefined && baseline.weight !== null) {
            weightEl.textContent = `${baseline.weight} kg`;
        }
        
        const bodyFatEl = document.getElementById('baselineBodyFat');
        if (bodyFatEl && baseline.body_fat !== undefined && baseline.body_fat !== null) {
            bodyFatEl.textContent = `${baseline.body_fat}%`;
        }
        
        const androidFatEl = document.getElementById('baselineAndroidFat');
        if (androidFatEl && baseline.android_fat !== undefined && baseline.android_fat !== null) {
            androidFatEl.textContent = `${baseline.android_fat}%`;
        }
        
        const altEl = document.getElementById('baselineALT');
        if (altEl && baseline.alt !== undefined && baseline.alt !== null) {
            altEl.textContent = `${baseline.alt}`;
        }
        
        const glucoseEl = document.getElementById('baselineGlucose');
        if (glucoseEl && baseline.fasting_glucose !== undefined && baseline.fasting_glucose !== null) {
            glucoseEl.textContent = `${baseline.fasting_glucose} mg/dL`;
        }
        
        const triglyceridesEl = document.getElementById('baselineTriglycerides');
        if (triglyceridesEl && baseline.triglycerides !== undefined && baseline.triglycerides !== null) {
            triglyceridesEl.textContent = `${baseline.triglycerides} mg/dL`;
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

function populateDaySelector() {
    const selector = document.getElementById('daySelect');
    if (!selector) return;
    
    // Load data and populate dropdown
    fetch('/api/data')
        .then(response => response.json())
        .then(data => {
            const dailyLogs = data.daily_logs || [];
            
            // Clear existing options
            selector.innerHTML = '';
            
            if (dailyLogs.length === 0) {
                selector.innerHTML = '<option value="">No days logged yet</option>';
                return;
            }
            
            // Add "Today" option (most recent day)
            const today = dailyLogs[dailyLogs.length - 1];
            selector.innerHTML = `<option value="${today.day}" selected>Today (Day ${today.day})</option>`;
            
            // Add previous days in reverse order
            for (let i = dailyLogs.length - 2; i >= 0; i--) {
                const day = dailyLogs[i];
                const option = document.createElement('option');
                option.value = day.day;
                option.textContent = `Day ${day.day} - ${day.date_display || day.date}`;
                selector.appendChild(option);
            }
            
            // Load today's meals by default
            loadDayMeals();
        })
        .catch(error => {
            console.error('Error loading days:', error);
            selector.innerHTML = '<option value="">Error loading days</option>';
        });
}

function loadDayMeals() {
    const selector = document.getElementById('daySelect');
    const mealsContainer = document.getElementById('dayMeals');
    
    if (!selector || !mealsContainer) return;
    
    const selectedDay = selector.value;
    if (!selectedDay) {
        mealsContainer.innerHTML = '<p class="meals-placeholder">Select a day to view meals</p>';
        return;
    }
    
    // Load data
    fetch('/api/data')
        .then(response => response.json())
        .then(data => {
            const dailyLogs = data.daily_logs || [];
            const selectedDayData = dailyLogs.find(d => d.day == selectedDay);
            
            if (!selectedDayData) {
                mealsContainer.innerHTML = '<p class="meals-placeholder">Day not found</p>';
                return;
            }
            
            // Build meals display
            let mealsHTML = `
                <div class="meals-day-header">
                    <h3>Day ${selectedDayData.day} - ${selectedDayData.date_display || selectedDayData.date}</h3>
                </div>
                
                <div class="meals-macros">
                    <div class="macro-item">
                        <span class="macro-label">Protein:</span>
                        <span class="macro-value">${selectedDayData.protein || 0}g</span>
                    </div>
                    <div class="macro-item">
                        <span class="macro-label">Carbs:</span>
                        <span class="macro-value">${selectedDayData.carbs || 0}g</span>
                    </div>
                    <div class="macro-item">
                        <span class="macro-label">Fat:</span>
                        <span class="macro-value">${selectedDayData.fat || 0}g</span>
                    </div>
                    <div class="macro-item">
                        <span class="macro-label">Kcal:</span>
                        <span class="macro-value">${selectedDayData.kcal || 0}</span>
                    </div>
                    <div class="macro-item">
                        <span class="macro-label">Seafood:</span>
                        <span class="macro-value">${selectedDayData.seafoodKg || selectedDayData.seafood_kg || 0}kg</span>
                    </div>
                </div>
            `;
            
            // Display meals if available
            if (selectedDayData.meals && typeof selectedDayData.meals === 'object') {
                mealsHTML += `
                    <div class="meals-section-card">
                        <h4 class="meals-section-title">Meals</h4>
                        <div class="meals-list">
                `;
                
                const mealLabels = {
                    breakfast: 'Breakfast',
                    midMorning: 'Mid Morning',
                    lunch: 'Lunch',
                    dinner: 'Dinner',
                    snacks: 'Snacks'
                };
                
                let hasMeals = false;
                Object.keys(mealLabels).forEach(mealKey => {
                    const mealValue = selectedDayData.meals[mealKey];
                    if (mealValue && mealValue.trim() && mealValue.toLowerCase() !== 'none') {
                        hasMeals = true;
                        mealsHTML += `
                            <div class="meal-item">
                                <span class="meal-label">${mealLabels[mealKey]}:</span>
                                <span class="meal-content">${mealValue}</span>
                            </div>
                        `;
                    }
                });
                
                if (!hasMeals) {
                    mealsHTML += '<p class="meals-placeholder" style="text-align: center; padding: 20px; color: #999;">No meals logged</p>';
                }
                
                mealsHTML += `
                        </div>
                    </div>
                `;
            }
            
            // Display supplements if available (supports both old and new schema)
            if (selectedDayData.supplements && typeof selectedDayData.supplements === 'object') {
                mealsHTML += `
                    <div class="supplements-section-card">
                        <h4 class="supplements-section-title">Supplements</h4>
                        <div class="supplements-list">
                `;
                
                const supplementLabels = {
                    omega3: 'Omega-3',
                    nac: 'NAC',
                    nacMorning: 'NAC (Morning)',
                    nacNight: 'NAC (Night)',
                    d3k2: 'D3 + K2',
                    zmb: 'ZMB Pro',
                    whey: 'Whey',
                    wheyScoops: 'Whey',
                    creatine: 'Creatine'
                };
                
                let hasSupplements = false;
                
                // Check if new schema (objects with "taken" property) or old schema (booleans/numbers)
                const isNewSchema = Object.values(selectedDayData.supplements).some(v => 
                    typeof v === 'object' && v !== null && 'taken' in v
                );
                
                Object.keys(selectedDayData.supplements).forEach(suppKey => {
                    const supp = selectedDayData.supplements[suppKey];
                    const label = supplementLabels[suppKey] || suppKey;
                    
                    if (isNewSchema) {
                        // New schema: { "taken": true, "dose": "...", "scoops": 1 }
                        if (supp && typeof supp === 'object' && supp !== null) {
                            hasSupplements = true;
                            const taken = supp.taken === true;
                            const dose = supp.dose || supp.note || '';
                            const scoops = supp.scoops !== undefined ? supp.scoops : null;
                            
                            mealsHTML += `
                                <div class="supplement-item ${taken ? 'taken' : 'not-taken'}">
                                    <div class="supplement-header">
                                        <span class="supplement-check">${taken ? '✓' : '○'}</span>
                                        <span class="supplement-name">${label}</span>
                                    </div>
                                    ${dose || scoops !== null ? `
                                        <div class="supplement-details">
                                            ${scoops !== null && scoops > 0 ? `<span class="supplement-scoops">${scoops} scoop${scoops !== 1 ? 's' : ''}</span>` : ''}
                                            ${dose ? `<span class="supplement-dose">${dose}</span>` : ''}
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }
                    } else {
                        // Old schema: boolean or number values
                        hasSupplements = true;
                        let taken = false;
                        let dose = '';
                        let scoops = null;
                        
                        if (suppKey === 'wheyScoops') {
                            taken = supp > 0;
                            scoops = supp;
                            dose = supp > 0 ? `${supp} scoop${supp !== 1 ? 's' : ''}` : '';
                        } else {
                            taken = supp === true || supp === 1;
                        }
                        
                        mealsHTML += `
                            <div class="supplement-item ${taken ? 'taken' : 'not-taken'}">
                                <div class="supplement-header">
                                    <span class="supplement-check">${taken ? '✓' : '○'}</span>
                                    <span class="supplement-name">${label}</span>
                                </div>
                                ${dose ? `
                                    <div class="supplement-details">
                                        <span class="supplement-dose">${dose}</span>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }
                });
                
                if (!hasSupplements) {
                    mealsHTML += '<p class="meals-placeholder" style="text-align: center; padding: 20px; color: #999;">No supplements logged</p>';
                }
                
                mealsHTML += `
                        </div>
                    </div>
                `;
            }
            
            if (selectedDayData.training) {
                mealsHTML += `
                    <div class="meals-training">
                        <span class="training-label">Training:</span>
                        <span class="training-value">${selectedDayData.training}</span>
                    </div>
                `;
            }
            
            if (selectedDayData.feeling !== undefined && selectedDayData.feeling !== null) {
                mealsHTML += `
                    <div class="meals-feeling">
                        <span class="feeling-label">Feeling:</span>
                        <span class="feeling-value">${selectedDayData.feeling}/10</span>
                    </div>
                `;
            }
            
            if (selectedDayData.notes) {
                mealsHTML += `
                    <div class="meals-notes">
                        <span class="notes-label">Notes:</span>
                        <p class="notes-value">${selectedDayData.notes}</p>
                    </div>
                `;
            }
            
            mealsContainer.innerHTML = mealsHTML;
        })
        .catch(error => {
            console.error('Error loading day meals:', error);
            mealsContainer.innerHTML = '<p class="meals-placeholder">Error loading meals</p>';
        });
}
