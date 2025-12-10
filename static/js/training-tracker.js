// Training Tracker JavaScript

let trainingData = [];
let exerciseGroups = {};

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
        
        console.log('Loaded training data:', {
            sessions: trainingData.length,
            exercises: Object.keys(exerciseGroups).length
        });
    } catch (error) {
        console.error('Error fetching training data:', error);
        showError('Failed to fetch training data');
    }
}

function renderTrainingStats() {
    const totalSessions = trainingData.length;
    const totalExercises = Object.keys(exerciseGroups).length;
    
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
    
    if (Object.keys(exerciseGroups).length === 0) {
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
    
    // Sort exercises by name
    const sortedExercises = Object.keys(exerciseGroups).sort();
    
    for (const exerciseName of sortedExercises) {
        const sessions = exerciseGroups[exerciseName];
        
        html += `
            <div class="exercise-card">
                <div class="exercise-header">
                    <h3 class="exercise-name">${escapeHtml(exerciseName)}</h3>
                    <span class="exercise-count">${sessions.length} session${sessions.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="exercise-content">
                    ${renderProgressionTable(exerciseName, sessions)}
                    ${renderNextWeightSuggestion(exerciseName, sessions)}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
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
        
        // Format weight - show both kg and lbs if available
        let weightStr = '--';
        if (session.weight_lbs !== null && session.weight_lbs !== undefined) {
            const weightLbs = Math.round(session.weight_lbs);
            if (session.weight_kg) {
                weightStr = `${session.weight_kg} kg (${weightLbs} lbs)`;
            } else {
                weightStr = `${weightLbs} lbs`;
            }
            if (session.weight_each_side_lbs) {
                const eachSide = Math.round(session.weight_each_side_lbs);
                weightStr += ` (${eachSide} lbs each side)`;
            }
        } else if (session.weight_kg) {
            weightStr = `${session.weight_kg} kg`;
        }
        
        // Format sets/reps - handle flexible structures
        let setsRepsStr = '--';
        if (session.sets_reps && session.sets_reps.length > 0) {
            const setsReps = session.sets_reps.map(sr => {
                let setStr = '';
                if (typeof sr.set === 'string') {
                    setStr = sr.set;
                } else {
                    setStr = `Set ${sr.set}`;
                }
                
                if (sr.reps !== null && sr.reps !== undefined) {
                    return `${setStr}: ${sr.reps} reps`;
                } else if (sr.distance) {
                    return `${setStr}: ${sr.distance}`;
                } else {
                    return setStr;
                }
            }).join(', ');
            setsRepsStr = setsReps;
        }
        
        const notes = session.notes || '';
        
        tableHtml += `
            <tr>
                <td class="date-col">${dateStr}</td>
                <td class="day-col">Day ${session.day}</td>
                <td class="weight-col">${weightStr}</td>
                <td class="sets-reps-col">${setsRepsStr}</td>
                <td class="notes-col">${escapeHtml(notes)}</td>
            </tr>
        `;
    }
    
    tableHtml += `
            </tbody>
        </table>
    `;
    
    return tableHtml;
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

