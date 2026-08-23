// ===== Calendar Module =====

let calendar = null;
let selectedCalendarDate = null;
let calendarEvents = [];

// Initialize FullCalendar
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || typeof FullCalendar === 'undefined') {
        console.warn('⚠️ FullCalendar not available or #calendar not found');
        return;
    }

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        initialDate: new Date(),
        headerToolbar: {
            left: 'prev',
            center: 'title',
            right: 'next'
        },
        height: 'auto',
        events: [],
        dateClick: function(info) {
            handleDateClick(info.dateStr);
        },
        eventClick: function(info) {
            info.jsEvent.preventDefault();
        },
        datesSet: function() {
            setTimeout(() => {
                loadCalendarEvents();
            }, 100);
        },
        titleFormat: { year: 'numeric', month: 'short' },
        buttonText: {
            today: 'Today'
        },
        dayCellDidMount: function(info) {
            const today = getTodayString();
            if (info.dateStr === today) {
                info.el.classList.add('fc-day-today');
            }
        }
    });

    calendar.render();

    setTimeout(() => {
        highlightDate(getTodayString());
        loadCalendarEvents();
    }, 100);
}

async function loadCalendarEvents() {
    try {
        const categories = ['football', 'cricket', 'basketball', 'tennis', 'mma', 'ufc', 'nfl'];
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        // Use calendar's visible range if available
        let startDate, endDate;
        if (calendar) {
            const view = calendar.view;
            startDate = view.activeStart.toLocaleDateString('en-CA');
            endDate = view.activeEnd.toLocaleDateString('en-CA');
        } else {
            startDate = new Date(year, month, 1).toLocaleDateString('en-CA');
            endDate = new Date(year, month + 2, 0).toLocaleDateString('en-CA');
        }

        const allEvents = [];

        const today = getTodayString();
        const liveData = LIVE_MATCHES || {};
        const dateCacheData = DATE_CACHE || {};

        for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
            const dateStr = d.toLocaleDateString('en-CA');

            let dayData = null;
            if (dateStr === today && (liveData.football || liveData.cricket || liveData.nfl)) {
                dayData = liveData;
            } else if (dateCacheData[dateStr]) {
                dayData = dateCacheData[dateStr];
            } else {
                dayData = getCachedData(dateStr);
            }

            if (!dayData && dateStr.startsWith('2026-08')) {
                const augMatches = filterAugust2026(dateStr);
                if (augMatches.length) {
                    dayData = {};
                    augMatches.forEach(m => {
                        const cat = m.sport === 'tennis' ? 'tabletennis' : m.sport;
                        if (!dayData[cat]) dayData[cat] = [];
                        dayData[cat].push(m);
                    });
                }
            }

            if (dayData) {
                categories.forEach(cat => {
                    const matches = dayData[cat] || dayData[cat === 'tennis' ? 'tabletennis' : cat] || [];
                    matches.forEach(m => {
                        allEvents.push({
                            title: `${getSportIcon(cat)} ${m.team1?.name || 'TBA'} vs ${m.team2?.name || 'TBA'}`,
                            date: dateStr,
                            color: cat === 'football' ? '#2563eb' : cat === 'cricket' ? '#16a34a' : cat === 'basketball' ? '#ea580c' : cat === 'mma' ? '#dc2626' : cat === 'ufc' ? '#dc2626' : cat === 'nfl' ? '#0284c7' : '#9333ea',
                            textColor: '#fff',
                            display: 'list-item'
                        });
                    });
                });
            }
        }

        calendarEvents = allEvents;
        if (calendar) {
            calendar.removeAllEvents();
            calendar.addEventSource(allEvents);
            setTimeout(addMatchDots, 200);
        }
    } catch (e) {
        console.log('Calendar events load failed');
    }
}

// Handle date click
function handleDateClick(dateStr) {
    highlightDate(dateStr);
    updateSelectedDateDisplay(dateStr);
    loadMatchesForDate(dateStr);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof updateUrl === 'function') {
        updateUrl(currentSport, dateStr, null);
    }
    const sidebar = document.querySelector('.sidebar-left');
    const overlay = document.getElementById('calendar-overlay');
    if (sidebar && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
    }
}

// Highlight selected date in calendar
function highlightDate(dateStr) {
    if (selectedCalendarDate) {
        const prevEl = document.querySelector(`.fc-daygrid-day[data-date="${selectedCalendarDate}"]`);
        if (prevEl) {
            prevEl.classList.remove('selected-date');
        }
    }

    const newEl = document.querySelector(`.fc-daygrid-day[data-date="${dateStr}"]`);
    if (newEl) {
        newEl.classList.add('selected-date');
    }

    selectedCalendarDate = dateStr;
}

// Update selected date display
function updateSelectedDateDisplay(dateStr) {
    const dateElement = document.getElementById('selected-date');
    if (!dateElement) return;
    const date = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateText = date.toLocaleDateString('en-US', options);

    const cached = DATE_CACHE[dateStr];
    const source = cached ? cached.source : 'loading';
    const sourceBadge = source === 'sportscore' ? ' <span class="source-badge sofascore">LIVE</span>' : 
                        source === 'sportsrc' ? ' <span class="source-badge sportsrc">SportSRC</span>' : '';

    dateElement.innerHTML = dateText + sourceBadge;
}

function refreshCalendarEvents() {
    loadCalendarEvents();
}

function addMatchDots() {
    document.querySelectorAll('.fc-match-dot').forEach(d => d.remove());
    const today = getTodayString();
    const liveData = LIVE_MATCHES || {};
    const dateCacheData = DATE_CACHE || {};

    const sportColors = {
        football: '#2563eb',
        cricket: '#16a34a',
        basketball: '#ea580c',
        tennis: '#9333ea',
        mma: '#dc2626',
        ufc: '#dc2626',
        nfl: '#0284c7'
    };

    const activeSport = currentSport || 'football';

    document.querySelectorAll('.fc-daygrid-day').forEach(cell => {
        const dateStr = cell.getAttribute('data-date');
        if (!dateStr) return;

        let dayData = null;
        if (dateStr === today && (liveData.football || liveData.cricket || liveData.nfl)) {
            dayData = liveData;
        } else if (dateCacheData[dateStr]) {
            dayData = dateCacheData[dateStr];
        } else {
            dayData = getCachedData(dateStr);
        }

        if (!dayData && dateStr.startsWith('2026-08')) {
            const augMatches = filterAugust2026(dateStr);
            if (augMatches.length) {
                dayData = {};
                augMatches.forEach(m => {
                    const cat = m.sport === 'tennis' ? 'tabletennis' : m.sport;
                    if (!dayData[cat]) dayData[cat] = [];
                    dayData[cat].push(m);
                });
            }
        }
        if (!dayData) return;

        const key = activeSport === 'tennis' ? 'tabletennis' : activeSport;
        const matches = dayData[key] || [];
        if (matches.length === 0) return;

        const num = cell.querySelector('.fc-daygrid-day-number');
        if (!num) return;

        const dot = document.createElement('div');
        dot.className = 'fc-match-dot';
        dot.style.background = sportColors[activeSport] || '#3b82f6';
        dot.title = `${activeSport}: ${matches.length} match${matches.length > 1 ? 'es' : ''}`;
        num.after(dot);
    });
}
