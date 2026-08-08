// ===== Calendar Module =====

let calendar = null;
let selectedCalendarDate = null;

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
            // Highlight today
            const today = getTodayString();
            if (info.dateStr === today) {
                info.el.classList.add('fc-day-today');
            }
        }
    });

    calendar.render();

    // Set initial selected date highlight
    setTimeout(() => {
        highlightDate(getTodayString());
    }, 100);
}

// Handle date click
function handleDateClick(dateStr) {
    highlightDate(dateStr);
    updateSelectedDateDisplay(dateStr);
    loadMatchesForDate(dateStr);
}

// Highlight selected date in calendar
function highlightDate(dateStr) {
    // Remove previous highlight
    if (selectedCalendarDate) {
        const prevEl = document.querySelector(`.fc-daygrid-day[data-date="${selectedCalendarDate}"]`);
        if (prevEl) {
            prevEl.classList.remove('selected-date');
        }
    }

    // Add new highlight
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

    // Check if we have data for this date
    const cached = DATE_CACHE[dateStr];
    const source = cached ? cached.source : 'loading';
    const sourceBadge = source === 'sportscore' ? ' <span class="source-badge sofascore">LIVE</span>' : '';

    dateElement.innerHTML = dateText + sourceBadge;
}

// Refresh calendar (no events needed)
function refreshCalendarEvents() {
    // Calendar shows only dates now
}
