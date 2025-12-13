// Training Tracker JavaScript

let trainingData = [];
let exerciseGroups = {};
let exercisesByCategory = {};
let currentFilterCategory = null;
let currentView = 'progression'; // 'progression' or 'day'
let availableDates = [];

// Load training data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadTrainingData();
    extractAvailableDates();
    setupDatePicker();
    renderExerciseProgression();
    setupBodyDiagram();
});

function setupBodyDiagram() {
    const bodyRegions = document.querySelectorAll('.body-region.clickable');
    
    bodyRegions.forEach(region => {
        region.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            if (category && category !== 'Other') {
                currentFilterCategory = category;
                
                // Update active state on body regions
                document.querySelectorAll('.body-region').forEach(r => {
                    r.classList.remove('active');
                });
                this.classList.add('active');
                
                // Update active state on category nav buttons
                document.querySelectorAll('.category-nav-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.getAttribute('data-category') === category) {
                        btn.classList.add('active');
                    }
                });
                
                // Filter and show exercises
                filterExercisesByCategory(category);
                
                // Show "Show All" button
                document.getElementById('showAllBtn').style.display = 'inline-block';
                
                // Scroll to exercises section
                document.getElementById('trainingExercises').scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }
        });
    });
}

function filterExercisesByCategory(category) {
    const container = document.getElementById('exerciseContainer');
    const allCategorySections = container.querySelectorAll('.category-section');
    
    allCategorySections.forEach(section => {
        const sectionCategory = section.getAttribute('data-category');
        if (sectionCategory === category) {
            section.style.display = 'block';
            // Scroll to this section
            setTimeout(() => {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } else {
            section.style.display = 'none';
        }
    });
}

function showAllExercises() {
    currentFilterCategory = null;
    
    // Remove active state from body regions
    document.querySelectorAll('.body-region').forEach(r => {
        r.classList.remove('active');
    });
    
    // Remove active state from category nav buttons
    document.querySelectorAll('.category-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show all exercises
    const container = document.getElementById('exerciseContainer');
    const allCategorySections = container.querySelectorAll('.category-section');
    allCategorySections.forEach(section => {
        section.style.display = 'block';
    });
    
    // Hide "Show All" button
    document.getElementById('showAllBtn').style.display = 'none';
    
    // Scroll to top of exercises
    document.getElementById('trainingExercises').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

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

function extractAvailableDates() {
    // Extract unique dates from training data
    const dates = new Set();
    trainingData.forEach(entry => {
        if (entry.date) {
            dates.add(entry.date);
        }
    });
    availableDates = Array.from(dates).sort().reverse(); // Most recent first
}

function setupDatePicker() {
    const datePicker = document.getElementById('workoutDatePicker');
    if (!datePicker || availableDates.length === 0) return;
    
    // Set min and max dates
    const minDate = availableDates[availableDates.length - 1];
    const maxDate = availableDates[0];
    
    datePicker.setAttribute('min', minDate);
    datePicker.setAttribute('max', maxDate);
    
    // Set default to most recent date
    datePicker.value = maxDate;
    
    // Populate quick dates list
    renderQuickDates();
}

function renderQuickDates() {
    const container = document.getElementById('quickDatesList');
    if (!container || availableDates.length === 0) return;
    
    // Show last 7 dates (or all if less than 7)
    const datesToShow = availableDates.slice(0, 7);
    
    container.innerHTML = datesToShow.map(date => {
        const dateObj = new Date(date);
        const dateStr = dateObj.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: dateObj.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
        const isToday = date === new Date().toISOString().split('T')[0];
        
        return `
            <button class="quick-date-btn" onclick="selectQuickDate('${date}')" data-date="${date}">
                ${isToday ? '⭐ ' : ''}${dateStr}
            </button>
        `;
    }).join('');
}

function selectQuickDate(date) {
    const datePicker = document.getElementById('workoutDatePicker');
    if (datePicker) {
        datePicker.value = date;
        loadDayView();
    }
    
    // Update active state
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-date') === date) {
            btn.classList.add('active');
        }
    });
}

function switchView(view) {
    currentView = view;
    
    // Update button states
    document.getElementById('progressionViewBtn').classList.toggle('active', view === 'progression');
    document.getElementById('dayViewBtn').classList.toggle('active', view === 'day');
    
    // Show/hide containers
    const exerciseContainer = document.getElementById('exerciseContainer');
    const dayViewContainer = document.getElementById('dayViewContainer');
    const categoryNav = document.getElementById('categoryNav');
    const sectionHeading = document.getElementById('sectionHeading');
    
    if (view === 'day') {
        exerciseContainer.style.display = 'none';
        categoryNav.style.display = 'none';
        sectionHeading.style.display = 'none';
        dayViewContainer.style.display = 'block';
        loadDayView();
    } else {
        exerciseContainer.style.display = 'block';
        categoryNav.style.display = 'flex';
        sectionHeading.style.display = 'block';
        dayViewContainer.style.display = 'none';
    }
}

function selectToday() {
    const datePicker = document.getElementById('workoutDatePicker');
    if (!datePicker || availableDates.length === 0) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    // If today has a workout, use it; otherwise use most recent
    const targetDate = availableDates.includes(today) ? today : availableDates[0];
    datePicker.value = targetDate;
    loadDayView();
}

function navigateDate(direction) {
    const datePicker = document.getElementById('workoutDatePicker');
    if (!datePicker || availableDates.length === 0) return;
    
    const currentDate = datePicker.value || availableDates[0];
    const currentIndex = availableDates.indexOf(currentDate);
    
    if (currentIndex === -1) {
        // Current date not in list, find closest
        const newIndex = direction > 0 ? 0 : availableDates.length - 1;
        datePicker.value = availableDates[newIndex];
    } else {
        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < availableDates.length) {
            datePicker.value = availableDates[newIndex];
        } else {
            // Wrap around
            datePicker.value = direction > 0 
                ? availableDates[0] 
                : availableDates[availableDates.length - 1];
        }
    }
    
    loadDayView();
}

async function loadDayView() {
    const datePicker = document.getElementById('workoutDatePicker');
    if (!datePicker) return;
    
    const selectedDate = datePicker.value;
    if (!selectedDate) {
        renderDayViewPlaceholder();
        return;
    }
    
    // Update quick date active state
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-date') === selectedDate) {
            btn.classList.add('active');
        }
    });
    
    // Try to load full day data from API
    try {
        const response = await fetch(`/api/day/${selectedDate}`);
        if (response.ok) {
            const fullDayData = await response.json();
            renderFullDayView(fullDayData);
            return;
        }
    } catch (error) {
        console.log('Full day API not available, using training data only');
    }
    
    // Fallback to training data only
    const dayData = trainingData.find(entry => entry.date === selectedDate);
    
    if (!dayData || dayData.type !== 'structured') {
        renderNoWorkoutMessage(selectedDate);
        return;
    }
    
    renderDayView(dayData);
}

function renderDayViewPlaceholder() {
    const container = document.getElementById('dayViewContent');
    container.innerHTML = `
        <div class="day-view-placeholder">
            <div class="placeholder-icon">📅</div>
            <p>Select a date to view your workout</p>
        </div>
    `;
}

function renderNoWorkoutMessage(date) {
    const container = document.getElementById('dayViewContent');
    const dateObj = new Date(date);
    const dateStr = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    container.innerHTML = `
        <div class="no-workout-message">
            <div class="no-workout-icon">💪</div>
            <h3>No Workout Recorded</h3>
            <p>No training data found for ${dateStr}</p>
            <p style="margin-top: 1rem; font-size: 0.9rem; color: #999;">Try selecting a different date</p>
        </div>
    `;
}

function renderFullDayView(dayData) {
    const container = document.getElementById('dayViewContent');
    const dateObj = new Date(dayData.date);
    const dateStr = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const training = dayData.training || {};
    const session = training.session || 'Training Session';
    const exercises = training.workout || [];
    const meals = dayData.meals || {};
    const supplements = dayData.supplements || {};
    const total = dayData.total || {};
    const fastedWeight = dayData.fastedWeight;
    
    // Calculate training stats
    const totalExercises = exercises.length;
    const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
    
    let html = `
        <div class="day-view-header">
            <div class="day-view-date">${dateStr}</div>
            ${fastedWeight ? `<div class="day-view-weight">Fasted Weight: <strong>${fastedWeight} kg</strong></div>` : ''}
        </div>
        
        <div class="day-sections-grid">
            <!-- Training Section -->
            <div class="day-section-card">
                <div class="day-section-header">
                    <h3 class="day-section-title">💪 Training</h3>
                    <div class="day-section-session">${escapeHtml(session)}</div>
                </div>
                <div class="day-section-stats">
                    <div class="day-stat-mini">
                        <span class="day-stat-mini-label">Exercises</span>
                        <span class="day-stat-mini-value">${totalExercises}</span>
                    </div>
                    <div class="day-stat-mini">
                        <span class="day-stat-mini-label">Total Sets</span>
                        <span class="day-stat-mini-value">${totalSets}</span>
                    </div>
                </div>
                <div class="day-exercises-list">
    `;
    
    exercises.forEach((exercise) => {
        const exerciseName = exercise.exercise || 'Unknown Exercise';
        const sets = exercise.sets || [];
        const notes = exercise.notes || '';
        
        // Format weight display
        let weightDisplay = '--';
        if (exercise.weight_each_side_kg !== null && exercise.weight_each_side_kg !== undefined) {
            weightDisplay = `${exercise.weight_each_side_kg} kg each side`;
        } else if (exercise.weight_each_side_lbs !== null && exercise.weight_each_side_lbs !== undefined) {
            weightDisplay = `${Math.round(exercise.weight_each_side_lbs)} lbs each side`;
        } else if (exercise.total_added_weight_kg !== null && exercise.total_added_weight_kg !== undefined) {
            weightDisplay = `${exercise.total_added_weight_kg} kg`;
        } else if (exercise.total_added_weight_lbs !== null && exercise.total_added_weight_lbs !== undefined) {
            weightDisplay = `${Math.round(exercise.total_added_weight_lbs)} lbs`;
        }
        
        html += `
            <div class="day-exercise-item">
                <div class="day-exercise-item-header">
                    <h4 class="day-exercise-item-name">${escapeHtml(exerciseName)}</h4>
                    ${weightDisplay !== '--' ? `<span class="day-exercise-item-weight">${weightDisplay}</span>` : ''}
                </div>
                <div class="day-exercise-item-sets">
        `;
        
        sets.forEach((set, setIndex) => {
            const setNum = typeof set.set === 'string' 
                ? set.set.charAt(0).toUpperCase() + set.set.slice(1)
                : `Set ${set.set || setIndex + 1}`;
            
            let setWeight = '--';
            if (set.weight_each_side_kg !== null && set.weight_each_side_kg !== undefined) {
                setWeight = `${set.weight_each_side_kg} kg each side`;
            } else if (set.weight_each_side_lbs !== null && set.weight_each_side_lbs !== undefined) {
                setWeight = `${Math.round(set.weight_each_side_lbs)} lbs each side`;
            } else if (set.total_added_weight_kg !== null && set.total_added_weight_kg !== undefined) {
                setWeight = `${set.total_added_weight_kg} kg`;
            } else if (set.total_added_weight_lbs !== null && set.total_added_weight_lbs !== undefined) {
                setWeight = `${Math.round(set.total_added_weight_lbs)} lbs`;
            } else if (weightDisplay !== '--') {
                setWeight = weightDisplay;
            }
            
            const reps = set.reps !== null && set.reps !== undefined 
                ? `${set.reps} reps`
                : set.distance || '--';
            
            html += `
                <div class="day-set-mini">
                    <span class="day-set-mini-number">${setNum}</span>
                    <span class="day-set-mini-details">${setWeight} × ${reps}</span>
                </div>
            `;
        });
        
        html += `</div>`;
        
        if (notes) {
            html += `<div class="day-exercise-item-notes">${escapeHtml(notes)}</div>`;
        }
        
        html += `</div>`;
    });
    
    html += `
                </div>
            </div>
            
            <!-- Nutrition Section -->
            <div class="day-section-card">
                <div class="day-section-header">
                    <h3 class="day-section-title">🍽️ Nutrition</h3>
                </div>
                <div class="day-nutrition-totals">
                    <div class="nutrition-total-item">
                        <span class="nutrition-total-label">Protein</span>
                        <span class="nutrition-total-value">${total.protein || 0}g</span>
                    </div>
                    <div class="nutrition-total-item">
                        <span class="nutrition-total-label">Carbs</span>
                        <span class="nutrition-total-value">${total.carbs || 0}g</span>
                    </div>
                    <div class="nutrition-total-item">
                        <span class="nutrition-total-label">Fat</span>
                        <span class="nutrition-total-value">${total.fat || 0}g</span>
                    </div>
                    <div class="nutrition-total-item">
                        <span class="nutrition-total-label">Calories</span>
                        <span class="nutrition-total-value">${total.kcal || 0}</span>
                    </div>
                    ${total.seafoodKg ? `
                    <div class="nutrition-total-item">
                        <span class="nutrition-total-label">Seafood</span>
                        <span class="nutrition-total-value">${total.seafoodKg} kg</span>
                    </div>
                    ` : ''}
                </div>
                <div class="day-meals-list">
    `;
    
    Object.entries(meals).forEach(([mealName, meal]) => {
        html += `
            <div class="day-meal-item">
                <div class="day-meal-header">
                    <h4 class="day-meal-name">${escapeHtml(mealName)}</h4>
                    <span class="day-meal-kcal">${meal.kcal || 0} kcal</span>
                </div>
                <div class="day-meal-description">${escapeHtml(meal.description || '')}</div>
                <div class="day-meal-macros">
                    <span>P: ${meal.protein || 0}g</span>
                    <span>C: ${meal.carbs || 0}g</span>
                    <span>F: ${meal.fat || 0}g</span>
                    ${meal.seafoodKg ? `<span>🐟 ${meal.seafoodKg} kg</span>` : ''}
                </div>
            </div>
        `;
    });
    
    html += `
                </div>
            </div>
            
            <!-- Supplements Section -->
            <div class="day-section-card">
                <div class="day-section-header">
                    <h3 class="day-section-title">💊 Supplements</h3>
                </div>
                <div class="day-supplements-list">
    `;
    
    Object.entries(supplements).forEach(([suppName, supp]) => {
        const taken = supp.taken;
        const dose = supp.dose || supp.scoops ? `${supp.scoops} scoops` : '';
        
        html += `
            <div class="day-supplement-item ${taken ? 'taken' : 'missed'}">
                <div class="day-supplement-name">
                    <span class="day-supplement-icon">${taken ? '✅' : '❌'}</span>
                    ${escapeHtml(suppName.toUpperCase())}
                </div>
                ${dose ? `<div class="day-supplement-dose">${escapeHtml(dose)}</div>` : ''}
            </div>
        `;
    });
    
    html += `
                </div>
            </div>
        </div>
    `;
    
    if (dayData.notes) {
        html += `
            <div class="day-notes-section">
                <h3 class="day-notes-title">📝 Notes</h3>
                <p class="day-notes-content">${escapeHtml(dayData.notes)}</p>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function renderDayView(dayData) {
    // Fallback to original renderDayView for training-only data
    const container = document.getElementById('dayViewContent');
    const dateObj = new Date(dayData.date);
    const dateStr = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const session = dayData.session || 'Training Session';
    const exercises = dayData.exercises || [];
    
    // Calculate stats
    const totalExercises = exercises.length;
    const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
    
    let html = `
        <div class="day-view-header">
            <div class="day-view-date">${dateStr}</div>
            <div class="day-view-session">${escapeHtml(session)}</div>
            <div class="day-view-stats">
                <div class="day-stat-card">
                    <div class="day-stat-label">Exercises</div>
                    <div class="day-stat-value">${totalExercises}</div>
                </div>
                <div class="day-stat-card">
                    <div class="day-stat-label">Total Sets</div>
                    <div class="day-stat-value">${totalSets}</div>
                </div>
                <div class="day-stat-card">
                    <div class="day-stat-label">Day</div>
                    <div class="day-stat-value">${dayData.day || 'N/A'}</div>
                </div>
            </div>
        </div>
        <div class="day-exercises-grid">
    `;
    
    exercises.forEach((exercise, index) => {
        const exerciseName = exercise.name || 'Unknown Exercise';
        const sets = exercise.sets || [];
        const notes = exercise.notes || '';
        
        // Format weight display
        let weightDisplay = '--';
        if (exercise.weight_each_side_kg !== null && exercise.weight_each_side_kg !== undefined) {
            weightDisplay = `${exercise.weight_each_side_kg} kg each side`;
        } else if (exercise.weight_each_side_lbs !== null && exercise.weight_each_side_lbs !== undefined) {
            weightDisplay = `${Math.round(exercise.weight_each_side_lbs)} lbs each side`;
        } else if (exercise.total_added_weight_kg !== null && exercise.total_added_weight_kg !== undefined) {
            weightDisplay = `${exercise.total_added_weight_kg} kg`;
        } else if (exercise.total_added_weight_lbs !== null && exercise.total_added_weight_lbs !== undefined) {
            weightDisplay = `${Math.round(exercise.total_added_weight_lbs)} lbs`;
        }
        
        html += `
            <div class="day-exercise-card">
                <div class="day-exercise-header">
                    <h3 class="day-exercise-name">${escapeHtml(exerciseName)}</h3>
                    <span class="day-exercise-weight">${weightDisplay}</span>
                </div>
                <div class="day-exercise-sets">
        `;
        
        sets.forEach((set, setIndex) => {
            const setNum = typeof set.set === 'string' 
                ? set.set.charAt(0).toUpperCase() + set.set.slice(1)
                : `Set ${set.set || setIndex + 1}`;
            
            let setWeight = '--';
            if (set.weight_each_side_kg !== null && set.weight_each_side_kg !== undefined) {
                setWeight = `${set.weight_each_side_kg} kg each side`;
            } else if (set.weight_each_side_lbs !== null && set.weight_each_side_lbs !== undefined) {
                setWeight = `${Math.round(set.weight_each_side_lbs)} lbs each side`;
            } else if (set.total_added_weight_kg !== null && set.total_added_weight_kg !== undefined) {
                setWeight = `${set.total_added_weight_kg} kg`;
            } else if (set.total_added_weight_lbs !== null && set.total_added_weight_lbs !== undefined) {
                setWeight = `${Math.round(set.total_added_weight_lbs)} lbs`;
            } else if (weightDisplay !== '--') {
                setWeight = weightDisplay; // Use exercise-level weight
            }
            
            const reps = set.reps !== null && set.reps !== undefined 
                ? `${set.reps} reps`
                : set.distance || '--';
            
            html += `
                <div class="day-set-item">
                    <div class="day-set-info">
                        <span class="day-set-number">${setNum}</span>
                        <div class="day-set-details">
                            <span class="day-set-weight">${setWeight}</span>
                            <span>×</span>
                            <span>${reps}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
        `;
        
        if (notes) {
            html += `
                <div class="day-exercise-notes">${escapeHtml(notes)}</div>
            `;
        }
        
        html += `
            </div>
        `;
    });
    
    html += `
        </div>
    `;
    
    container.innerHTML = html;
}

function renderTrainingStats() {
    // Stats cards removed - function kept for compatibility but does nothing
    // Stats are now shown via the interactive body diagram
    return;
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
            <div class="category-section" id="category-${category}" data-category="${category}">
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
    
    // Ensure all category sections are visible by default
    const allCategorySections = container.querySelectorAll('.category-section');
    allCategorySections.forEach(section => {
        section.style.display = 'block';
    });
    
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

