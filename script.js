// ========================================
// Data Structure & State Management
// ========================================

let appData = {
    currentSemester: 1,
    semesters: {},
    holidays: {} // Global holidays: { "2026-01-26": true }
};

let currentWeekStart = null;
let currentMonthStart = null;
let currentNoteContext = null;
let lastClickTime = 0;
let clickCount = 0;
let lastClickedCell = null; // Will store "subjectId-dateKey" string

// Initialize semester structure
function initSemester(semesterNum) {
    if (!appData.semesters[semesterNum]) {
        appData.semesters[semesterNum] = {
            subjects: [],
            attendance: {}
        };
    }
}

// ========================================
// Data Persistence
// ========================================

function loadData() {
    const saved = localStorage.getItem('attendanceTrackerData');
    if (saved) {
        try {
            const loaded = JSON.parse(saved);
            appData = loaded;
            // Ensure holidays exist
            if (!appData.holidays) {
                appData.holidays = {};
            }
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }

    // Ensure current semester is initialized  
    initSemester(appData.currentSemester);
}

function saveData() {
    localStorage.setItem('attendanceTrackerData', JSON.stringify(appData));
}

// ========================================
// Date Utilities
// ========================================

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDate(dateString) {
    const [year, month, day] = dateString.split('-');
    return new Date(year, month - 1, day);
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(d.setDate(diff));
}

function getWeekDates(weekStart) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        dates.push(date);
    }
    return dates;
}

function formatWeekRange(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const options = { month: 'short', day: 'numeric' };
    const start = weekStart.toLocaleDateString('en-US', options);
    const end = weekEnd.toLocaleDateString('en-US', options);
    const year = weekEnd.getFullYear();

    return `${start} - ${end}, ${year}`;
}

function formatMonthYear(date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthDates(monthStart) {
    const dates = [];
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();

    // Get first day of calendar (might be previous month)
    const firstDay = new Date(year, month, 1);
    const dayOfWeek = firstDay.getDay();
    const startDate = new Date(firstDay);
    startDate.setDate(1 - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    // Get all dates to fill calendar (6 weeks)
    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        dates.push(date);
    }

    return dates;
}

function getDayName(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function getDayDate(date) {
    return date.getDate();
}

function isHoliday(date) {
    const dateKey = formatDate(date);
    return appData.holidays[dateKey] === true;
}

function toggleHoliday(date) {
    const dateKey = formatDate(date);
    if (appData.holidays[dateKey]) {
        delete appData.holidays[dateKey];
    } else {
        appData.holidays[dateKey] = true;
    }
    saveData();
}

// ========================================
// Subject Management
// ========================================

function getCurrentSemesterData() {
    initSemester(appData.currentSemester);
    return appData.semesters[appData.currentSemester];
}

function addSubject(name, code = '') {
    if (!name || name.trim() === '') return;

    const semesterData = getCurrentSemesterData();
    const subject = {
        id: Date.now().toString(),
        name: name.trim(),
        code: code.trim()
    };

    semesterData.subjects.push(subject);
    saveData();
    renderSubjects();
    renderDashboard();
}

function deleteSubject(id) {
    if (!confirm('Delete this subject? All attendance data will be removed.')) return;

    const semesterData = getCurrentSemesterData();
    semesterData.subjects = semesterData.subjects.filter(s => s.id !== id);

    // Clean up attendance data
    Object.keys(semesterData.attendance).forEach(date => {
        delete semesterData.attendance[date][id];
    });

    saveData();
    renderSubjects();
    renderDashboard();
    renderWeeklyView();
    renderMonthlyView();
}

function renderSubjects() {
    const semesterData = getCurrentSemesterData();
    const subjectsList = document.getElementById('subjectsList');
    const subjectCount = document.getElementById('subjectCount');

    subjectCount.textContent = `${semesterData.subjects.length} subject${semesterData.subjects.length !== 1 ? 's' : ''}`;

    if (semesterData.subjects.length === 0) {
        subjectsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <div class="empty-state-text">No subjects added yet. Add your first subject above!</div>
            </div>
        `;
        return;
    }

    subjectsList.innerHTML = semesterData.subjects.map(subject => `
        <div class="subject-card">
            <div class="subject-card-header">
                <div class="subject-card-info">
                    <h4>${subject.name}</h4>
                    ${subject.code ? `<div class="subject-card-code">${subject.code}</div>` : ''}
                </div>
                <div class="subject-card-actions">
                    <button class="btn btn-danger btn-sm" onclick="deleteSubject('${subject.id}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

// ========================================
// Attendance Management
// ========================================

function toggleAttendance(subjectId, date) {
    const semesterData = getCurrentSemesterData();
    const dateKey = formatDate(date);

    if (!semesterData.attendance[dateKey]) {
        semesterData.attendance[dateKey] = {};
    }

    if (!semesterData.attendance[dateKey][subjectId]) {
        semesterData.attendance[dateKey][subjectId] = { attended: false, note: '' };
    }

    const current = semesterData.attendance[dateKey][subjectId];
    current.attended = !current.attended;

    // Clear note if marking as present
    if (current.attended) {
        current.note = '';
    }

    saveData();
    renderWeeklyView();
    renderMonthlyView();
    renderDashboard();
}

function getAttendance(subjectId, date) {
    const semesterData = getCurrentSemesterData();
    const dateKey = formatDate(date);

    if (!semesterData.attendance[dateKey] || !semesterData.attendance[dateKey][subjectId]) {
        return null;
    }

    return semesterData.attendance[dateKey][subjectId];
}

function saveNote(subjectId, date, note) {
    const semesterData = getCurrentSemesterData();
    const dateKey = formatDate(date);

    if (!semesterData.attendance[dateKey]) {
        semesterData.attendance[dateKey] = {};
    }

    if (!semesterData.attendance[dateKey][subjectId]) {
        semesterData.attendance[dateKey][subjectId] = { attended: false, note: '' };
    }

    semesterData.attendance[dateKey][subjectId].note = note;
    saveData();
    renderWeeklyView();
    renderMonthlyView();
}

// ========================================
// Analytics & Calculations
// ========================================

// Helper function to check if a subject is a lab
function isLabSubject(subjectId) {
    const semesterData = getCurrentSemesterData();
    const subject = semesterData.subjects.find(s => s.id === subjectId);
    return subject && subject.name.toUpperCase().includes('LAB');
}

// Get weight multiplier for a subject (2 for labs, 1 for regular)
function getSubjectWeight(subjectId) {
    return isLabSubject(subjectId) ? 2 : 1;
}

function calculateSubjectStats(subjectId, excludeHolidays = true) {
    const semesterData = getCurrentSemesterData();
    const weight = getSubjectWeight(subjectId);
    let attended = 0;
    let total = 0;

    Object.keys(semesterData.attendance).forEach(dateStr => {
        // Skip holidays if requested
        if (excludeHolidays && isHoliday(parseDate(dateStr))) {
            return;
        }

        if (semesterData.attendance[dateStr][subjectId]) {
            total += weight;
            if (semesterData.attendance[dateStr][subjectId].attended) {
                attended += weight;
            }
        }
    });

    const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

    return {
        attended,
        missed: total - attended,
        total,
        percentage
    };
}

function calculateOverallStats() {
    const semesterData = getCurrentSemesterData();
    let totalAttended = 0;
    let totalClasses = 0;

    semesterData.subjects.forEach(subject => {
        const stats = calculateSubjectStats(subject.id);
        totalAttended += stats.attended;
        totalClasses += stats.total;
    });

    const percentage = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;

    return {
        attended: totalAttended,
        missed: totalClasses - totalAttended,
        total: totalClasses,
        percentage,
        subjectCount: semesterData.subjects.length
    };
}

function calculatePeriodStats(dates) {
    const semesterData = getCurrentSemesterData();
    let totalAttended = 0;
    let totalMissed = 0;

    dates.forEach(date => {
        if (isHoliday(date)) return;

        semesterData.subjects.forEach(subject => {
            const attendance = getAttendance(subject.id, date);
            if (attendance) {
                const weight = getSubjectWeight(subject.id);
                if (attendance.attended) totalAttended += weight;
                else totalMissed += weight;
            }
        });
    });

    const total = totalAttended + totalMissed;
    const percentage = total > 0 ? Math.round((totalAttended / total) * 100) : 0;

    return {
        attended: totalAttended,
        missed: totalMissed,
        total,
        percentage
    };
}

function getStatusClass(percentage) {
    if (percentage >= 85) return 'good';
    if (percentage >= 75) return 'warning';
    return 'critical';
}

// ========================================
// Dashboard Rendering
// ========================================

function renderDashboard() {
    const stats = calculateOverallStats();
    const semesterData = getCurrentSemesterData();

    // Update overall statistics
    document.getElementById('overallPercentage').textContent = `${stats.percentage}%`;
    document.getElementById('totalAttended').textContent = stats.attended;
    document.getElementById('totalMissed').textContent = stats.missed;
    document.getElementById('totalSubjects').textContent = stats.subjectCount;

    // Render subject performance
    const performanceList = document.getElementById('subjectPerformance');

    if (semesterData.subjects.length === 0) {
        performanceList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <div class="empty-state-text">Add subjects to start tracking attendance</div>
                <button class="btn btn-primary" onclick="showView('subjects')" style="margin-top: 1rem;">Add Subjects</button>
            </div>
        `;
        return;
    }

    performanceList.innerHTML = semesterData.subjects.map(subject => {
        const subjectStats = calculateSubjectStats(subject.id);
        const statusClass = getStatusClass(subjectStats.percentage);

        return `
            <div class="subject-performance-item">
                <div class="subject-performance-header">
                    <div class="subject-info">
                        <h4>${subject.name}</h4>
                        ${subject.code ? `<div class="subject-code">${subject.code}</div>` : ''}
                    </div>
                    <div class="subject-percentage ${statusClass}">
                        ${subjectStats.percentage}%
                    </div>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar">
                        <div class="progress-fill ${statusClass}" style="width: ${subjectStats.percentage}%"></div>
                    </div>
                </div>
                <div class="subject-stats">
                    <span class="subject-stat">
                        Attended: <strong>${subjectStats.attended}</strong>
                    </span>
                    <span class="subject-stat">
                        Missed: <strong>${subjectStats.missed}</strong>
                    </span>
                    <span class="subject-stat">
                        Total: <strong>${subjectStats.total}</strong>
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// Weekly View Rendering
// ========================================

function renderWeeklyView() {
    const semesterData = getCurrentSemesterData();
    const weekDates = getWeekDates(currentWeekStart);
    const grid = document.getElementById('attendanceGrid');

    // Update week range display
    document.getElementById('weekRange').textContent = formatWeekRange(currentWeekStart);

    if (semesterData.subjects.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <div class="empty-state-text">Add subjects to start marking attendance</div>
                <button class="btn btn-primary" onclick="showView('subjects')" style="margin-top: 1rem;">Add Subjects</button>
            </div>
        `;
        document.getElementById('weekTotalAttended').textContent = '0';
        document.getElementById('weekTotalMissed').textContent = '0';
        document.getElementById('weekPercentage').textContent = '0%';
        return;
    }

    // Build grid HTML
    let html = '<div class="grid-header">';
    html += '<div class="grid-header-cell">Subject</div>';
    weekDates.forEach(date => {
        html += `
            <div class="grid-header-cell">
                <div>${getDayName(date)}</div>
                <div>${getDayDate(date)}</div>
            </div>
        `;
    });
    html += '</div>';

    // Add rows for each subject
    semesterData.subjects.forEach(subject => {
        html += '<div class="grid-row">';
        html += `<div class="grid-subject">${subject.name}</div>`;

        weekDates.forEach(date => {
            const attendance = getAttendance(subject.id, date);
            const dateKey = formatDate(date);
            const holiday = isHoliday(date);
            let cellClass = 'grid-cell';

            if (holiday) {
                cellClass += ' holiday';
            } else if (attendance) {
                cellClass += attendance.attended ? ' present' : ' absent';
                // Show note indicator for any class with a note
                if (attendance.note && attendance.note.trim()) {
                    cellClass += ' has-note';
                }
            }

            html += `
                <div class="${cellClass}" 
                     data-subject-id="${subject.id}"
                     data-date="${dateKey}"
                     onclick="handleCellClick('${subject.id}', '${dateKey}', this)"
                     oncontextmenu="handleCellRightClick(event, '${subject.id}', '${dateKey}')">
                    <span class="cell-icon"></span>
                    ${attendance && attendance.note && attendance.note.trim() ?
                    `<span class="cell-note">${attendance.note.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>` :
                    ''}
                </div>
            `;
        });

        html += '</div>';
    });

    grid.innerHTML = html;

    // Render week summary
    renderWeekSummary(weekDates);
}

function renderWeekSummary(weekDates) {
    const semesterData = getCurrentSemesterData();
    const summary = document.getElementById('weekSummary');

    // Calculate overall week stats
    const weekStats = calculatePeriodStats(weekDates);
    document.getElementById('weekTotalAttended').textContent = weekStats.attended;
    document.getElementById('weekTotalMissed').textContent = weekStats.missed;
    document.getElementById('weekPercentage').textContent = `${weekStats.percentage}%`;

    if (semesterData.subjects.length === 0) {
        summary.innerHTML = '';
        return;
    }

    // Calculate weekly stats for each subject
    const subjectSummaries = semesterData.subjects.map(subject => {
        let attended = 0;
        let absent = 0;

        weekDates.forEach(date => {
            if (isHoliday(date)) return;
            const attendance = getAttendance(subject.id, date);
            if (attendance) {
                if (attendance.attended) attended++;
                else absent++;
            }
        });

        return { subject, attended, absent };
    });

    summary.innerHTML = subjectSummaries.map(({ subject, attended, absent }) => `
        <div class="week-summary-card">
            <h4>${subject.name}</h4>
            <div class="week-summary-stat">
                <span>Attended:</span>
                <span class="week-summary-value">${attended}</span>
            </div>
            <div class="week-summary-stat">
                <span>Missed:</span>
                <span class="week-summary-value">${absent}</span>
            </div>
        </div>
    `).join('');
}

// ========================================
// Monthly View Rendering
// ========================================

function renderMonthlyView() {
    const semesterData = getCurrentSemesterData();
    const monthDates = getMonthDates(currentMonthStart);
    const grid = document.getElementById('monthlyGrid');

    // Update month range display
    document.getElementById('monthRange').textContent = formatMonthYear(currentMonthStart);

    if (semesterData.subjects.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <div class="empty-state-text">Add subjects to start marking attendance</div>
                <button class="btn btn-primary" onclick="showView('subjects')" style="margin-top: 1rem;">Add Subjects</button>
            </div>
        `;
        document.getElementById('monthTotalAttended').textContent = '0';
        document.getElementById('monthTotalMissed').textContent = '0';
        document.getElementById('monthPercentage').textContent = '0%';
        return;
    }

    // Build calendar HTML
    let html = '<div class="monthly-calendar">';

    // Day headers
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayNames.forEach(day => {
        html += `<div class="monthly-day-header">${day}</div>`;
    });

    // Date cells
    const today = formatDate(new Date());
    monthDates.forEach(date => {
        const dateKey = formatDate(date);
        const isCurrentMonth = date.getMonth() === currentMonthStart.getMonth();
        const holiday = isHoliday(date);
        let cellClass = 'monthly-date-cell';

        if (!isCurrentMonth) cellClass += ' other-month';
        if (dateKey === today) cellClass += ' today';
        if (holiday) cellClass += ' holiday';

        html += `<div class="${cellClass}">`;
        html += `<div class="monthly-date-number">${date.getDate()}</div>`;
        html += '<div class="monthly-subjects">';

        // Add indicator for each subject
        semesterData.subjects.forEach(subject => {
            const attendance = getAttendance(subject.id, date);
            let indicatorClass = 'monthly-subject-indicator unmarked';

            if (holiday) {
                indicatorClass = 'monthly-subject-indicator unmarked';
            } else if (attendance) {
                indicatorClass = attendance.attended ?
                    'monthly-subject-indicator present' :
                    'monthly-subject-indicator absent';
            }

            html += `<div class="${indicatorClass}" 
                         data-subject-id="${subject.id}"
                         data-date="${dateKey}"
                         onclick="handleMonthlyClick('${subject.id}', '${dateKey}')"
                         title="${subject.name}"></div>`;
        });

        html += '</div></div>';
    });

    html += '</div>';
    grid.innerHTML = html;

    // Render month summary
    renderMonthSummary(monthDates);
}

function renderMonthSummary(monthDates) {
    const semesterData = getCurrentSemesterData();
    const summary = document.getElementById('monthSummary');

    // Filter to current month only
    const currentMonthDates = monthDates.filter(d => d.getMonth() === currentMonthStart.getMonth());

    // Calculate overall month stats
    const monthStats = calculatePeriodStats(currentMonthDates);
    document.getElementById('monthTotalAttended').textContent = monthStats.attended;
    document.getElementById('monthTotalMissed').textContent = monthStats.missed;
    document.getElementById('monthPercentage').textContent = `${monthStats.percentage}%`;

    if (semesterData.subjects.length === 0) {
        summary.innerHTML = '';
        return;
    }

    // Calculate monthly stats for each subject
    const subjectSummaries = semesterData.subjects.map(subject => {
        let attended = 0;
        let absent = 0;

        currentMonthDates.forEach(date => {
            if (isHoliday(date)) return;
            const attendance = getAttendance(subject.id, date);
            if (attendance) {
                if (attendance.attended) attended++;
                else absent++;
            }
        });

        return { subject, attended, absent };
    });

    summary.innerHTML = subjectSummaries.map(({ subject, attended, absent }) => `
        <div class="week-summary-card">
            <h4>${subject.name}</h4>
            <div class="week-summary-stat">
                <span>Attended:</span>
                <span class="week-summary-value">${attended}</span>
            </div>
            <div class="week-summary-stat">
                <span>Missed:</span>
<span class="week-summary-value">${absent}</span>
            </div>
        </div>
    `).join('');
}

// ========================================
// Event Handlers
// ========================================

function handleCellClick(subjectId, dateKey, element) {
    const date = parseDate(dateKey);
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTime;

    // Use data attributes to identify cells (element reference breaks on re-render)
    const cellIdentifier = `${subjectId}-${dateKey}`;
    const isSameCell = lastClickedCell === cellIdentifier;

    // Triple click detection (within 500ms between clicks)
    if (isSameCell && timeSinceLastClick < 500) {
        clickCount++;

        if (clickCount >= 3) {
            // Triple click - clear cell completely
            const holiday = isHoliday(date);
            if (holiday) {
                // Remove holiday
                toggleHoliday(date);
            } else {
                // Clear the attendance for this specific subject
                const semesterData = getCurrentSemesterData();
                if (semesterData.attendance[dateKey] && semesterData.attendance[dateKey][subjectId]) {
                    delete semesterData.attendance[dateKey][subjectId];
                    // Clean up empty date entries
                    if (Object.keys(semesterData.attendance[dateKey]).length === 0) {
                        delete semesterData.attendance[dateKey];
                    }
                    saveData();
                }
            }
            renderWeeklyView();
            renderMonthlyView();
            renderDashboard();
            clickCount = 0;
            lastClickedCell = null;
            return;
        }
    } else {
        // Reset click count for new cell or timeout
        clickCount = 1;
    }

    lastClickTime = currentTime;
    lastClickedCell = cellIdentifier;

    // Single/double click - toggle attendance (only if not triple-clicking)
    if (clickCount < 3) {
        const holiday = isHoliday(date);
        if (!holiday) {
            toggleAttendance(subjectId, date);
        }
    }
}

function handleCellRightClick(event, subjectId, dateKey) {
    event.preventDefault();
    const semesterData = getCurrentSemesterData();
    const date = parseDate(dateKey);
    const holiday = isHoliday(date);

    // Allow marking/unmarking holidays on right-click
    if (event.shiftKey) {
        toggleHoliday(date);
        renderWeeklyView();
        renderMonthlyView();
        return;
    }

    if (holiday) return; // Don't allow notes for holidays

    const attendance = getAttendance(subjectId, date);

    // Only allow notes for absent classes
    if (!attendance || attendance.attended) {
        return;
    }

    const subject = semesterData.subjects.find(s => s.id === subjectId);
    openNoteModal(subject, date, attendance.note || '');
}

function handleMonthlyClick(subjectId, dateKey) {
    const date = parseDate(dateKey);
    const holiday = isHoliday(date);

    if (!holiday) {
        toggleAttendance(subjectId, date);
    }
}

function openNoteModal(subject, date, currentNote) {
    currentNoteContext = { subjectId: subject.id, date };

    const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    document.getElementById('modalSubjectInfo').textContent = `${subject.name} - ${formattedDate}`;
    document.getElementById('absenceNote').value = currentNote;
    document.getElementById('noteModal').classList.add('active');
    document.getElementById('absenceNote').focus();
}

function closeNoteModal() {
    document.getElementById('noteModal').classList.remove('active');
    currentNoteContext = null;
}

function saveNoteHandler() {
    if (!currentNoteContext) return;

    const note = document.getElementById('absenceNote').value;
    saveNote(currentNoteContext.subjectId, currentNoteContext.date, note);
    closeNoteModal();
}

// ========================================
// View Management
// ========================================

function showView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        }
    });

    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    const viewMap = {
        dashboard: 'dashboardView',
        weekly: 'weeklyView',
        monthly: 'monthlyView',
        subjects: 'subjectsView'
    };

    const targetView = document.getElementById(viewMap[viewName]);
    if (targetView) {
        targetView.classList.add('active');

        // Refresh view content
        if (viewName === 'dashboard') renderDashboard();
        if (viewName === 'weekly') renderWeeklyView();
        if (viewName === 'monthly') renderMonthlyView();
        if (viewName === 'subjects') renderSubjects();
    }
}

// ========================================
// Week Navigation
// ========================================

function goToPreviousWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderWeeklyView();
}

function goToNextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderWeeklyView();
}

function goToCurrentWeek() {
    currentWeekStart = getWeekStart(new Date());
    renderWeeklyView();
}

// ========================================
// Month Navigation
// ========================================

function goToPreviousMonth() {
    currentMonthStart.setMonth(currentMonthStart.getMonth() - 1);
    renderMonthlyView();
}

function goToNextMonth() {
    currentMonthStart.setMonth(currentMonthStart.getMonth() + 1);
    renderMonthlyView();
}

function goToCurrentMonth() {
    currentMonthStart = getMonthStart(new Date());
    renderMonthlyView();
}

// ========================================
// Semester Management
// ========================================

function changeSemester(semesterNum) {
    appData.currentSemester = parseInt(semesterNum);
    initSemester(appData.currentSemester);
    saveData();

    // Refresh all views
    renderDashboard();
    renderWeeklyView();
    renderMonthlyView();
    renderSubjects();
}

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Load data
    loadData();

    // Initialize current week and month
    currentWeekStart = getWeekStart(new Date());
    currentMonthStart = getMonthStart(new Date());

    // Set semester selector
    document.getElementById('semesterSelect').value = appData.currentSemester;

    // Initial render
    renderDashboard();
    renderWeeklyView();
    renderMonthlyView();
    renderSubjects();

    // Event listeners
    document.getElementById('semesterSelect').addEventListener('change', (e) => {
        changeSemester(e.target.value);
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showView(btn.dataset.view);
        });
    });

    document.getElementById('addSubjectBtn').addEventListener('click', () => {
        const name = document.getElementById('subjectNameInput').value;
        const code = document.getElementById('subjectCodeInput').value;
        addSubject(name, code);
        document.getElementById('subjectNameInput').value = '';
        document.getElementById('subjectCodeInput').value = '';
    });

    document.getElementById('subjectNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('addSubjectBtn').click();
        }
    });

    // Weekly navigation
    document.getElementById('prevWeekBtn').addEventListener('click', goToPreviousWeek);
    document.getElementById('nextWeekBtn').addEventListener('click', goToNextWeek);
    document.getElementById('currentWeekBtn').addEventListener('click', goToCurrentWeek);

    // Monthly navigation
    document.getElementById('prevMonthBtn').addEventListener('click', goToPreviousMonth);
    document.getElementById('nextMonthBtn').addEventListener('click', goToNextMonth);
    document.getElementById('currentMonthBtn').addEventListener('click', goToCurrentMonth);

    document.getElementById('saveNoteBtn').addEventListener('click', saveNoteHandler);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('noteModal').classList.contains('active')) {
            closeNoteModal();
        }
    });
});
