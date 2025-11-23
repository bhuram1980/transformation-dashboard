// Dashboard JavaScript

let macrosChart, proteinChart, seafoodChart, weightChart, waistChart;

// Get user role and admin status from window (set by Flask template)
const userRole = window.userRole || 'viewer';
const isAdmin = window.isAdmin || false;

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
    // Load Grok advice (public access)
    loadAdvice();
    loadStats();
    // Load photos after a short delay to ensure DOM is ready
    setTimeout(() => loadPhotos(), 500);
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

// Load Advice (Public access)
async function loadAdvice() {
    const adviceBox = document.getElementById('adviceBox');
    if (!adviceBox) return;
    
    adviceBox.innerHTML = '<div class="loading">Loading advice from Grok...</div>';
    
    try {
        const response = await fetch('/api/advice');
        const data = await response.json();
        
        if (data.advice) {
            // Format advice with line breaks
            const formattedAdvice = data.advice.replace(/\n/g, '<br>');
            adviceBox.innerHTML = `<div class="advice-content">${formattedAdvice}</div>`;
        } else {
            adviceBox.innerHTML = '⚠️ Error loading advice. Make sure GROK_API_KEY is set in your environment.';
        }
    } catch (error) {
        console.error('Error loading advice:', error);
        adviceBox.innerHTML = '⚠️ Error loading advice. Check console for details.';
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

// Image Compression Function
function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.8, maxSizeMB = 1.5) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                // Calculate new dimensions
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
                
                // Create canvas and compress
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to blob with compression
                canvas.toBlob(function(blob) {
                    // Check file size and reduce quality if needed
                    const fileSizeMB = blob.size / (1024 * 1024);
                    
                    if (fileSizeMB > maxSizeMB && quality > 0.5) {
                        // Recursively compress with lower quality
                        canvas.toBlob(function(compressedBlob) {
                            resolve(compressedBlob);
                        }, 'image/jpeg', quality * 0.8);
                    } else {
                        resolve(blob);
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Photo Upload Handler with Compression
async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size first
    const fileSizeMB = file.size / (1024 * 1024);
    const maxSizeMB = 10; // Allow up to 10MB original, will compress
    
    if (fileSizeMB > maxSizeMB) {
        alert(`File is too large (${fileSizeMB.toFixed(1)}MB). Please select a smaller image.`);
        return;
    }
    
    // Show loading state
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = '<p style="text-align: center; color: #666;">Compressing image... ⏳</p>';
    
    try {
        // Compress image
        const compressedBlob = await compressImage(file, 1920, 1920, 0.8, 1.5);
        
        const compressedSizeMB = compressedBlob.size / (1024 * 1024);
        const compressionRatio = ((1 - compressedBlob.size / file.size) * 100).toFixed(0);
        
        console.log(`Original: ${fileSizeMB.toFixed(2)}MB → Compressed: ${compressedSizeMB.toFixed(2)}MB (${compressionRatio}% reduction)`);
        
        // Show preview of compressed image
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; border-radius: 8px;">
                <p style="text-align: center; color: #666; font-size: 0.9em; margin-top: 10px;">
                    Compressed: ${compressedSizeMB.toFixed(2)}MB (${compressionRatio}% smaller) - Uploading...
                </p>`;
        };
        reader.readAsDataURL(compressedBlob);
        
        // Create a File object from the compressed blob
        const compressedFile = new File([compressedBlob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
        });
        
        // Upload compressed file
        const formData = new FormData();
        formData.append('photo', compressedFile);
        
        const response = await fetch('/api/upload-photo', {
            method: 'POST',
            body: formData
        });
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Server returned non-JSON: ${text.substring(0, 100)}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Store the uploaded photo URL
            const uploadedUrl = result.url;
            
            // Store in localStorage (PRIMARY storage - most reliable)
            try {
                const storedStr = localStorage.getItem('uploadedPhotos') || '[]';
                const storedPhotos = JSON.parse(storedStr);
                if (!Array.isArray(storedPhotos)) {
                    console.warn('localStorage photos was not an array, resetting');
                    localStorage.setItem('uploadedPhotos', JSON.stringify([]));
                }
                
                // Check if URL already exists (avoid duplicates)
                if (!storedPhotos.find(p => p.url === uploadedUrl)) {
                    storedPhotos.push({
                        url: uploadedUrl,
                        date: new Date().toISOString()
                    });
                    localStorage.setItem('uploadedPhotos', JSON.stringify(storedPhotos));
                    console.log('Photo saved to localStorage:', uploadedUrl);
                    console.log('Total photos in localStorage:', storedPhotos.length);
                } else {
                    console.log('Photo already in localStorage, skipping duplicate');
                }
            } catch (e) {
                console.error('Error storing photo in localStorage:', e);
                // Try to recover by resetting
                try {
                    localStorage.setItem('uploadedPhotos', JSON.stringify([{
                        url: uploadedUrl,
                        date: new Date().toISOString()
                    }]));
                    console.log('Reset localStorage and saved photo');
                } catch (e2) {
                    console.error('Failed to reset localStorage:', e2);
                }
            }
            
            // Add to gallery immediately (optimistic update)
            const gallery = document.getElementById('photoGallery');
            if (!gallery) {
                console.error('Gallery element not found!');
                alert('Photo uploaded but gallery not found. URL: ' + uploadedUrl);
                return;
            }
            
            // Clear "no photos" message
            if (gallery.innerHTML.includes('No photos yet') || gallery.innerHTML.includes('no photos')) {
                gallery.innerHTML = '';
            }
            
            // Create photo item
            const photoDiv = document.createElement('div');
            photoDiv.className = 'photo-item';
            const img = document.createElement('img');
            img.src = uploadedUrl;
            img.alt = 'Progress photo';
            img.onclick = () => window.open(uploadedUrl, '_blank');
            img.style.cssText = 'width: 100%; height: 150px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.2s;';
            img.onmouseover = () => img.style.transform = 'scale(1.05)';
            img.onmouseout = () => img.style.transform = 'scale(1)';
            img.onerror = function() {
                console.error('Failed to load image:', uploadedUrl);
                this.style.border = '2px solid #f5576c';
                this.alt = 'Failed to load - click to open URL';
            };
            photoDiv.appendChild(img);
            gallery.insertBefore(photoDiv, gallery.firstChild);
            
            // Also reload from server to get all photos
            setTimeout(() => loadPhotos(), 1000);
            
            preview.innerHTML = '';
            document.getElementById('photoInput').value = '';
            alert(`Photo uploaded successfully! 📸\n\nSaved ${compressionRatio}% storage space!`);
        } else {
            alert('Upload failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Upload error:', error);
        preview.innerHTML = '<p style="text-align: center; color: #f5576c;">Error: ' + error.message + '</p>';
        alert('Error uploading photo: ' + error.message);
    }
}

// Load Photos
async function loadPhotos() {
    try {
        const gallery = document.getElementById('photoGallery');
        if (!gallery) {
            console.error('Photo gallery element not found!');
            return;
        }
        
        // PRIMARY: Load from localStorage (most reliable)
        let photos = [];
        try {
            const storedStr = localStorage.getItem('uploadedPhotos');
            console.log('localStorage raw:', storedStr);
            if (storedStr) {
                const storedPhotos = JSON.parse(storedStr);
                console.log('Photos from localStorage:', storedPhotos);
                photos = Array.isArray(storedPhotos) ? storedPhotos : [];
            }
        } catch (error) {
            console.error('Error reading localStorage:', error);
        }
        
        // SECONDARY: Try to load from server (may not work with Vercel Blob)
        try {
            const response = await fetch('/api/photos');
            if (response.ok) {
                const data = await response.json();
                console.log('Photos from server:', data);
                if (data.photos && Array.isArray(data.photos)) {
                    // Merge with localStorage, avoiding duplicates
                    for (const serverPhoto of data.photos) {
                        if (!photos.find(p => p.url === serverPhoto.url)) {
                            photos.push(serverPhoto);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching from server:', error);
            // Not critical - localStorage is primary source
        }
        
        // Sort by date, newest first
        photos.sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateB - dateA;
        });
        
        console.log(`Displaying ${photos.length} photos:`, photos);
        
        if (photos.length > 0) {
            gallery.innerHTML = photos.map((photo, index) => {
                const url = photo.url;
                // Escape URL for HTML
                const safeUrl = url.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                return `
                    <div class="photo-item" style="position: relative;">
                        <img src="${safeUrl}" 
                             alt="Progress photo ${index + 1}" 
                             onclick="window.open('${safeUrl}', '_blank')"
                             style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.2s; display: block;"
                             onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)';"
                             onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';"
                             onerror="console.error('Failed to load image:', '${safeUrl}'); this.style.border='2px solid #f5576c'; this.alt='Failed to load - click to open';">
                    </div>
                `;
            }).join('');
        } else {
            gallery.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1 / -1; padding: 40px 20px;">No photos yet. Upload your first progress photo!</p>';
        }
    } catch (error) {
        console.error('Error loading photos:', error);
        const gallery = document.getElementById('photoGallery');
        if (gallery) {
            gallery.innerHTML = `<p style="text-align: center; color: #f5576c; grid-column: 1 / -1;">Error loading photos. Check console (F12) for details.</p>`;
        }
    }
}

// Debug function - can be called from console
window.debugPhotos = function() {
    const stored = localStorage.getItem('uploadedPhotos');
    console.log('=== PHOTO DEBUG ===');
    console.log('localStorage key "uploadedPhotos":', stored);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            console.log('Parsed photos:', parsed);
            console.log('Number of photos:', parsed.length);
            parsed.forEach((p, i) => {
                console.log(`Photo ${i + 1}:`, p.url);
            });
        } catch (e) {
            console.error('Failed to parse:', e);
        }
    } else {
        console.log('No photos in localStorage');
    }
    console.log('==================');
    return stored;
};

