// ===== Calendar Module =====

let calendar = null;
let selectedCalendarDate = null;
let calendarEvents = [];

// Initialize FullCalendar
function initCalendar() {
    const calendarEl = document.getElementById('calendar');

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
        const categories = ['football', 'cricket', 'basketball', 'tennis'];
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 2, 0).toISOString().split('T')[0];

        const allEvents = [];

        for (const cat of categories) {
            try {
                const res = await fetch(`${SPORTSRC_BASE}?data=matches&category=${cat}`);
                if (!res.ok) continue;
                const json = await res.json();
                const items = json.data || [];

                items.forEach(m => {
                    const matchDate = new Date(m.date).toISOString().split('T')[0];
                    if (matchDate >= startDate && matchDate <= endDate) {
                        allEvents.push({
                            title: `${getSportIcon(cat)} ${m.teams?.home?.name || 'TBA'} vs ${m.teams?.away?.name || 'TBA'}`,
                            date: matchDate,
                            color: cat === 'football' ? '#2563eb' : cat === 'cricket' ? '#16a34a' : cat === 'basketball' ? '#ea580c' : '#9333ea',
                            textColor: '#fff',
                            display: 'list-item'
                        });
                    }
                });
            } catch (e) {
                console.log(`Calendar ${cat} fetch failed`);
            }
        }

        calendarEvents = allEvents;
        calendar.removeAllEvents();
        calendar.addEventSource(allEvents);
    } catch (e) {
        console.log('Calendar events load failed');
    }
}

// Handle date click
function handleDateClick(dateStr) {
    highlightDate(dateStr);
    updateSelectedDateDisplay(dateStr);
    loadMatchesForDate(dateStr);
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
