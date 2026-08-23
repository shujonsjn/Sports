// ===== Search Module =====

let searchTimeout = null;

function initSearch() {
    function bindSearch(inputId, resultsId) {
        const searchInput = document.getElementById(inputId);
        const searchResults = document.getElementById(resultsId);
        if (!searchInput || !searchResults) return;

        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value.trim().toLowerCase();
            if (query.length < 2) {
                searchResults.classList.remove('active');
                searchResults.innerHTML = '';
                return;
            }
            searchTimeout = setTimeout(() => {
                performSearch(query, resultsId);
            }, 250);
        });

        searchInput.addEventListener('focus', function() {
            if (this.value.trim().length >= 2) {
                searchResults.classList.add('active');
            }
        });

        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                searchResults.classList.remove('active');
                this.blur();
            }
        });
    }

    bindSearch('search-input', 'search-results');
    bindSearch('mobile-search-input', 'mobile-search-results');

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-bar')) {
            document.querySelectorAll('.search-results').forEach(r => r.classList.remove('active'));
        }
    });
}

function performSearch(query, resultsId) {
    const searchResults = document.getElementById(resultsId || 'search-results');
    if (!searchResults) return;

    const allMatches = getMatchesForDate(currentDate) || currentRenderedMatches || [];
    const results = allMatches.filter(match => {
        const team1Name = (match.team1?.name || '').toLowerCase();
        const team2Name = (match.team2?.name || '').toLowerCase();
        const league = (match.league || '').toLowerCase();
        return team1Name.includes(query) || team2Name.includes(query) || league.includes(query);
    });

    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
        searchResults.classList.add('active');
        return;
    }

    const html = results.slice(0, 8).map(match => {
        const sportIcon = match.icon || '🏟️';
        const status = getMatchStatus(match);
        const statusText = status === 'live' ? ' • LIVE' : status === 'finished' ? ' • FT' : ` • ${match.time}`;

        return `
            <div class="search-result-item" onclick="selectMatchFromSearch('${escHtml(String(match.id || ''))}')">
                <div class="result-icon">${sportIcon}</div>
                <div class="result-info">
                    <div class="result-name">${match.team1.name} vs ${match.team2.name}</div>
                    <div class="result-meta">${match.league}${statusText}</div>
                </div>
            </div>
        `;
    }).join('');

    searchResults.innerHTML = html;
    searchResults.classList.add('active');
}

function selectMatchFromSearch(matchId) {
    const searchResults = document.getElementById('search-results');
    const searchInput = document.getElementById('search-input');

    if (searchResults) searchResults.classList.remove('active');
    if (searchInput) searchInput.value = '';

    selectMatch(matchId);

    const matchCard = document.querySelector(`[data-match-id="${CSS.escape(matchId)}"]`);
    if (matchCard) {
        matchCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
