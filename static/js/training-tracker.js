// Training Tracker JavaScript

let trainingData = [];
let exerciseGroups = {};
let exercisesByCategory = {};

// Load training data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadTrainingData();
    renderTrainingStats();
    renderExerciseProgression();
});

async function loadTrainingData() {
    try {
        const response = await fetch('/api/training');
        const data = await response.json();
        
        if (data.error) {
            console.error('Error loading training data:', data.error);
            showError('Failed to load training data');
            return;
        }
        
        trainingData = data.training_data || [];
        exerciseGroups = data.exercise_groups || {};
        exercisesByCategory = data.exercises_by_category || {};
        
        console.log('Loaded training data:', {
            sessions: trainingData.length,
            exercises: Object.keys(exerciseGroups).length,
            categories: exercisesByCategory
        });
    } catch (error) {
        console.error('Error fetching training data:', error);
        showError('Failed to fetch training data');
    }
}

function renderTrainingStats() {
    const totalSessions = trainingData.length;
    
    // Count total exercises from categories
    let totalExercises = 0;
    if (exercisesByCategory) {
        for (const category in exercisesByCategory) {
            totalExercises += (exercisesByCategory[category] || []).length;
        }
    } else {
        totalExercises = Object.keys(exerciseGroups).length;
    }
    
    // Get last session date
    let lastSession = '--';
    if (trainingData.length > 0) {
        const last = trainingData[trainingData.length - 1];
        const date = new Date(last.date);
        lastSession = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    document.getElementById('totalSessions').textContent = totalSessions;
    document.getElementById('totalExercises').textContent = totalExercises;
    document.getElementById('lastSession').textContent = lastSession;
}

function renderExerciseProgression() {
    const container = document.getElementById('exerciseContainer');
    
    if (!exercisesByCategory || Object.keys(exercisesByCategory).length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <div class="no-data-icon">💪</div>
                <p>No structured training data found yet.</p>
                <p>Start logging workouts with exercise details to see progression here.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    // Define category order and icons
    const categoryOrder = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Other'];
    const categoryIcons = {
        'Chest': '💪',
        'Back': '🏋️',
        'Legs': '🦵',
        'Shoulders': '🤲',
        'Arms': '💪',
        'Other': '⚙️'
    };
    
    // Render each category section
    for (const category of categoryOrder) {
        const exercises = exercisesByCategory[category] || [];
        
        if (exercises.length === 0) {
            continue; // Skip empty categories
        }
        
        html += `
            <div class="category-section" id="category-${category}">
                <div class="category-header">
                    <h2 class="category-title">
                        <span class="category-icon">${categoryIcons[category] || '⚙️'}</span>
                        ${category}
                    </h2>
                    <span class="category-count">${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="category-exercises">
        `;
        
        // Render exercises in this category
        for (const exercise of exercises) {
            const exerciseName = exercise.name;
            const sessions = exercise.sessions;
            
            html += `
                <div class="exercise-card">
                    <div class="exercise-header">
                        <h3 class="exercise-name">${escapeHtml(exerciseName)}</h3>
                        <span class="exercise-count">${sessions.length} session${sessions.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="exercise-content">
                        ${renderProgressionTable(exerciseName, sessions)}
                        ${renderProgressionChart(exerciseName, sessions)}
                        ${renderNextWeightSuggestion(exerciseName, sessions)}
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Initialize charts after rendering
    initializeCharts();
    
    // Update nav button visibility based on available categories
    updateNavButtonsVisibility();
}

function updateNavButtonsVisibility() {
    const navButtons = document.querySelectorAll('.category-nav-btn');
    navButtons.forEach(btn => {
        const category = btn.getAttribute('data-category');
        const section = document.getElementById(`category-${category}`);
        if (!section) {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'flex';
        }
    });
}

function renderProgressionTable(exerciseName, sessions) {
    if (sessions.length === 0) {
        return '<p class="no-data">No data available</p>';
    }
    
    let tableHtml = `
        <table class="progression-table">
            <thead>
                <tr>
                    <th class="date-col">Date</th>
                    <th class="day-col">Day</th>
                    <th class="weight-col">Weight (lbs)</th>
                    <th class="sets-reps-col">Sets × Reps</th>
                    <th class="notes-col">Notes</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (const session of sessions) {
        const date = new Date(session.date);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const notes = session.notes || '';
        
        // Show each set individually as a separate row
        if (session.sets_reps && session.sets_reps.length > 0) {
            session.sets_reps.forEach((sr, index) => {
                // Format set label
                let setStr = '';
                if (typeof sr.set === 'string') {
                    setStr = sr.set.charAt(0).toUpperCase() + sr.set.slice(1);
                } else {
                    setStr = `Set ${sr.set}`;
                }
                
                // Format weight for this set - show kg or lbs as provided
                let weightStr = '--';
                if (sr.weight_each_side_lbs !== null && sr.weight_each_side_lbs !== undefined) {
                    const eachSide = Math.round(sr.weight_each_side_lbs);
                    weightStr = `${eachSide} lbs each side`;
                } else if (sr.weight_each_side_kg !== null && sr.weight_each_side_kg !== undefined) {
                    const eachSide = sr.weight_each_side_kg;
                    weightStr = `${eachSide} kg each side`;
                } else if (sr.total_added_weight_lbs !== null && sr.total_added_weight_lbs !== undefined) {
                    const total = Math.round(sr.total_added_weight_lbs);
                    weightStr = `${total} lbs`;
                } else if (sr.total_added_weight_kg !== null && sr.total_added_weight_kg !== undefined) {
                    const total = sr.total_added_weight_kg;
                    weightStr = `${total} kg`;
                } else if (session.weight_each_side_lbs && index === 0) {
                    // Fallback to session-level weight if set doesn't have individual weight
                    const eachSide = Math.round(session.weight_each_side_lbs);
                    weightStr = `${eachSide} lbs each side`;
                } else if (session.weight_each_side_kg && index === 0) {
                    // Fallback to session-level weight in kg
                    const eachSide = session.weight_each_side_kg;
                    weightStr = `${eachSide} kg each side`;
                } else if (session.weight_kg && index === 0) {
                    // Fallback to session-level total weight in kg
                    weightStr = `${session.weight_kg} kg`;
                } else if (session.weight_lbs && index === 0) {
                    // Fallback to session-level total weight in lbs
                    weightStr = `${Math.round(session.weight_lbs)} lbs`;
                }
                
                // Format reps for this set
                let repsStr = '--';
                if (sr.reps !== null && sr.reps !== undefined) {
                    repsStr = `${sr.reps} reps`;
                } else if (sr.distance) {
                    repsStr = sr.distance;
                }
                
                // Show date and notes only on first row of each session
                const dateCell = index === 0 ? `<td class="date-col" rowspan="${session.sets_reps.length}">${dateStr}</td>` : '';
                const dayCell = index === 0 ? `<td class="day-col" rowspan="${session.sets_reps.length}">Day ${session.day}</td>` : '';
                const notesCell = index === 0 ? `<td class="notes-col" rowspan="${session.sets_reps.length}">${escapeHtml(notes)}</td>` : '';
                
                tableHtml += `
                    <tr>
                        ${dateCell}
                        ${dayCell}
                        <td class="weight-col">${weightStr}</td>
                        <td class="sets-reps-col">${setStr}: ${repsStr}</td>
                        ${notesCell}
                    </tr>
                `;
            });
        } else {
            // Fallback: if no sets_reps, show session-level info
            let weightStr = '--';
            if (session.weight_lbs !== null && session.weight_lbs !== undefined) {
                const weightLbs = Math.round(session.weight_lbs);
                weightStr = `${weightLbs} lbs`;
                if (session.weight_each_side_lbs) {
                    const eachSide = Math.round(session.weight_each_side_lbs);
                    weightStr = `${eachSide} lbs each side`;
                }
            }
            
            tableHtml += `
                <tr>
                    <td class="date-col">${dateStr}</td>
                    <td class="day-col">Day ${session.day}</td>
                    <td class="weight-col">${weightStr}</td>
                    <td class="sets-reps-col">--</td>
                    <td class="notes-col">${escapeHtml(notes)}</td>
                </tr>
            `;
        }
    }
    
    tableHtml += `
            </tbody>
        </table>
    `;
    
    return tableHtml;
}

function renderProgressionChart(exerciseName, sessions) {
    if (sessions.length < 2) {
        return ''; // Need at least 2 data points for a chart
    }
    
    // Get weights from sessions
    const weights = sessions
        .map(s => {
            if (s.weight_lbs !== null && s.weight_lbs !== undefined && s.weight_lbs > 0) {
                return s.weight_lbs;
            }
            // Try to get weight from working sets
            if (s.sets_reps && s.sets_reps.length > 0) {
                const workingSet = s.sets_reps.find(sr => sr.set === 'working' || sr.set === s.sets_reps.length);
                if (workingSet && workingSet.weight_each_side_lbs) {
                    return workingSet.weight_each_side_lbs * 2;
                }
            }
            return null;
        })
        .filter(w => w !== null && w !== undefined && w > 0);
    
    if (weights.length < 2) {
        return ''; // Need at least 2 weights for a chart
    }
    
    const chartId = `chart-${exerciseName.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    return `
        <div class="chart-container" style="margin-top: 1.5rem;">
            <button class="chart-toggle-btn" onclick="toggleChart('${chartId}')" id="toggle-${chartId}">
                <span class="chart-toggle-icon" id="icon-${chartId}">▶</span>
                <span>View Weight Progression Graph</span>
            </button>
            <div class="chart-wrapper" id="${chartId}" style="display: none;">
                <canvas id="canvas-${chartId}"></canvas>
            </div>
        </div>
    `;
}

function initializeCharts() {
    // Charts will be initialized when toggled
}

function toggleChart(chartId) {
    const chartWrapper = document.getElementById(chartId);
    const toggleIcon = document.getElementById(`icon-${chartId}`);
    const canvas = document.getElementById(`canvas-${chartId}`);
    
    if (!chartWrapper || !canvas) return;
    
    const isVisible = chartWrapper.style.display !== 'none';
    
    if (isVisible) {
        // Hide chart
        chartWrapper.style.display = 'none';
        toggleIcon.textContent = '▶';
        
        // Destroy chart if it exists
        if (window[`chart_${chartId}`]) {
            window[`chart_${chartId}`].destroy();
            window[`chart_${chartId}`] = null;
        }
    } else {
        // Show chart
        chartWrapper.style.display = 'block';
        toggleIcon.textContent = '▼';
        
        // Initialize chart if not already created
        if (!window[`chart_${chartId}`]) {
            createProgressionChart(chartId, canvas);
        }
    }
}

function createProgressionChart(chartId, canvas) {
    // Find the exercise name from chartId
    const exerciseCard = canvas.closest('.exercise-card');
    if (!exerciseCard) return;
    
    const exerciseName = exerciseCard.querySelector('.exercise-name').textContent;
    
    // Find sessions for this exercise
    const sessions = exerciseGroups[exerciseName];
    if (!sessions || sessions.length < 2) return;
    
    // Prepare data
    const labels = [];
    const weightData = [];
    const dates = [];
    
    for (const session of sessions) {
        const date = new Date(session.date);
        dates.push(date);
        labels.push(`Day ${session.day}`);
        
        // Get weight
        let weight = null;
        if (session.weight_lbs !== null && session.weight_lbs !== undefined && session.weight_lbs > 0) {
            weight = session.weight_lbs;
        } else if (session.sets_reps && session.sets_reps.length > 0) {
            const workingSet = session.sets_reps.find(sr => sr.set === 'working' || sr.set === session.sets_reps.length);
            if (workingSet && workingSet.weight_each_side_lbs) {
                weight = workingSet.weight_each_side_lbs * 2;
            }
        }
        
        weightData.push(weight);
    }
    
    // Filter out null values but keep labels aligned
    const filteredData = [];
    const filteredLabels = [];
    for (let i = 0; i < weightData.length; i++) {
        if (weightData[i] !== null && weightData[i] !== undefined) {
            filteredData.push(weightData[i]);
            filteredLabels.push(labels[i]);
        }
    }
    
    if (filteredData.length < 2) return;
    
    // Create chart
    const ctx = canvas.getContext('2d');
    
    window[`chart_${chartId}`] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: filteredLabels,
            datasets: [{
                label: 'Weight (lbs)',
                data: filteredData,
                borderColor: '#0066ff',
                backgroundColor: 'rgba(0, 102, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#0066ff',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            const session = sessions[context.dataIndex];
                            const date = new Date(session.date);
                            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            return `${dateStr}: ${context.parsed.y.toFixed(1)} lbs`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Weight (lbs)',
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Session',
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderNextWeightSuggestion(exerciseName, sessions) {
    if (sessions.length < 2) {
        return '<div class="next-weight-suggestion"><p>Need at least 2 sessions to suggest progression</p></div>';
    }
    
    // Get weights from sessions (filter out null/undefined)
    // Use weight_lbs if available, otherwise try to extract from sets
    const weights = sessions
        .map(s => {
            if (s.weight_lbs !== null && s.weight_lbs !== undefined && s.weight_lbs > 0) {
                return s.weight_lbs;
            }
            // Try to get weight from working sets
            if (s.sets_reps && s.sets_reps.length > 0) {
                const workingSet = s.sets_reps.find(sr => sr.set === 'working' || sr.set === s.sets_reps.length);
                if (workingSet && workingSet.weight_each_side_lbs) {
                    return workingSet.weight_each_side_lbs * 2;
                }
            }
            return null;
        })
        .filter(w => w !== null && w !== undefined && w > 0);
    
    if (weights.length < 2) {
        return '<div class="next-weight-suggestion"><p>Need weight data to suggest progression</p></div>';
    }
    
    // Calculate progression
    const latestWeight = weights[weights.length - 1];
    const previousWeight = weights[weights.length - 2];
    const weightDiff = latestWeight - previousWeight;
    
    // Get latest sets/reps to determine if we should increase weight
    const latestSession = sessions[sessions.length - 1];
    const latestSetsReps = latestSession.sets_reps || [];
    
    // Calculate average reps from latest session
    let avgReps = 0;
    if (latestSetsReps.length > 0) {
        const reps = latestSetsReps.map(sr => sr.reps || 0).filter(r => r > 0);
        if (reps.length > 0) {
            avgReps = reps.reduce((a, b) => a + b, 0) / reps.length;
        }
    }
    
    // Suggest next weight based on progression pattern
    let suggestedWeight = latestWeight;
    let suggestion = '';
    
    if (weightDiff > 0) {
        // Progressive overload detected - suggest continuing the pattern
        suggestedWeight = latestWeight + weightDiff;
        suggestion = `Based on your progression (+${weightDiff} lbs), try <strong>${suggestedWeight} lbs</strong> next session.`;
    } else if (weightDiff === 0 && avgReps >= 8) {
        // Same weight, good reps - suggest small increase
        suggestedWeight = latestWeight + 5; // Conservative 5lb increase
        suggestion = `You've been hitting ${Math.round(avgReps)} reps consistently. Try <strong>${suggestedWeight} lbs</strong> for progressive overload.`;
    } else if (weightDiff < 0) {
        // Weight decreased - suggest returning to previous or maintaining
        suggestedWeight = latestWeight;
        suggestion = `Weight decreased last session. Maintain <strong>${suggestedWeight} lbs</strong> and focus on form/volume.`;
    } else {
        // No clear pattern - conservative suggestion
        suggestedWeight = latestWeight + 2.5;
        suggestion = `Try a small increase to <strong>${suggestedWeight} lbs</strong> if you're hitting 8+ reps consistently.`;
    }
    
    // Check if using each-side format
    let displayWeight = suggestedWeight;
    if (latestSession.weight_each_side_lbs) {
        displayWeight = `${suggestedWeight / 2} lbs each side (${suggestedWeight} lbs total)`;
    } else {
        displayWeight = `${suggestedWeight} lbs`;
    }
    
    return `
        <div class="next-weight-suggestion">
            <h4>💡 Next Weight Suggestion</h4>
            <p class="next-weight-value">${displayWeight}</p>
            <p>${suggestion}</p>
        </div>
    `;
}

function showError(message) {
    const container = document.getElementById('exerciseContainer');
    container.innerHTML = `
        <div class="no-data">
            <div class="no-data-icon">⚠️</div>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToCategory(category) {
    const categorySection = document.getElementById(`category-${category}`);
    if (categorySection) {
        // Update active button
        document.querySelectorAll('.category-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`[data-category="${category}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Smooth scroll to section
        categorySection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
}

// Update active button on scroll
function updateActiveCategoryOnScroll() {
    const sections = document.querySelectorAll('.category-section');
    const navButtons = document.querySelectorAll('.category-nav-btn');
    
    let currentSection = '';
    sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 150 && rect.bottom >= 150) {
            const category = section.id.replace('category-', '');
            currentSection = category;
        }
    });
    
    navButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-category') === currentSection) {
            btn.classList.add('active');
        }
    });
}

// Add scroll listener after rendering
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('scroll', updateActiveCategoryOnScroll);
});

