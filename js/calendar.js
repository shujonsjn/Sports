// ===== Calendar Module =====

let calendar = null;

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
        }
    });

    calendar.render();
}

// Handle date click
function handleDateClick(dateStr) {
    updateSelectedDateDisplay(dateStr);
    loadMatchesForDate(dateStr);
}

// Update selected date display
function updateSelectedDateDisplay(dateStr) {
    const dateElement = document.getElementById('selected-date');
    const date = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateText = date.toLocaleDateString('en-US', options);

    // Check if we have Sofascore data for this date
    const cached = DATE_CACHE[dateStr];
    const source = cached ? cached.source : 'loading';
    const sourceBadge = source === 'sofascore' ? ' <span class="source-badge sofascore">LIVE</span>' : '';

    dateElement.innerHTML = dateText + sourceBadge;
}

// Refresh calendar (no events needed)
function refreshCalendarEvents() {
    // Calendar shows only dates now
}
