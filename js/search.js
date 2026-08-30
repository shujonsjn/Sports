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

function escSearch(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function performSearch(query, resultsId) {
    const searchResults = document.getElementById(resultsId || 'search-results');
    if (!searchResults) return;

    const allMatches = getMatchesForDate(currentDate) || currentRenderedMatches || [];
    const results = allMatches.filter(match => {
        const team1Name = (match.team1?.name || '').toLowerCase();
        const team2Name = (match.team2?.name || '').toLowerCase();
        const league = (match.league || '').toLowerCase();
        const sport = (match.sport || '').toLowerCase();
        return team1Name.includes(query) || team2Name.includes(query) || league.includes(query) || sport.includes(query);
    });

    if (results.length === 0) {
        searchResults.innerHTML = `<div class="search-no-results" role="status">
            <div style="margin-bottom:0.4rem;opacity:0.5;font-size:1.2rem">🔍</div>
            <div>No teams, leagues or matches found</div>
            <div style="font-size:0.72rem;margin-top:0.2rem;opacity:0.7">Try a different search term</div>
        </div>`;
        searchResults.classList.add('active');
        return;
    }

    const html = results.slice(0, 8).map(match => {
        const sportIcon = match.icon || '🏟️';
        const status = getMatchStatus(match);
        const statusText = status === 'live' ? 'LIVE' : status === 'finished' ? 'FT' : match.time || 'TBA';
        const statusClass = status;
        const t1 = escSearch(match.team1?.name || 'TBA');
        const t2 = escSearch(match.team2?.name || 'TBA');
        const league = escSearch(match.league || '');

        return `
            <div class="search-result-item" role="option" onclick="selectMatchFromSearch('${escSearch(String(match.id || ''))}')" tabindex="0">
                <div class="result-icon" aria-hidden="true">${sportIcon}</div>
                <div class="result-info">
                    <div class="result-name">${t1} vs ${t2}</div>
                    <div class="result-meta">${league}</div>
                </div>
                <span class="result-status ${statusClass}">${statusText}</span>
            </div>
        `;
    }).join('');

    searchResults.innerHTML = html;
    searchResults.classList.add('active');
}

function selectMatchFromSearch(matchId) {
    const searchResults = document.getElementById('search-results');
    const searchInput = document.getElementById('search-input');
    const mobileSearchInput = document.getElementById('mobile-search-input');
    const mobileSearchResults = document.getElementById('mobile-search-results');

    if (searchResults) searchResults.classList.remove('active');
    if (searchInput) searchInput.value = '';
    if (mobileSearchResults) mobileSearchResults.classList.remove('active');
    if (mobileSearchInput) mobileSearchInput.value = '';

    const allMatches = (typeof getMatchesForDate === 'function' ? getMatchesForDate(currentDate) : []) || currentRenderedMatches || [];
    const m = allMatches.find(x => String(x.id) === String(matchId));
    if (m && typeof showBlogView === 'function') {
        showBlogView(cleanDisplayName(m.team1?.name||'TBD')+' vs '+cleanDisplayName(m.team2?.name||'TBD'), m.date||'', m.time||'', m.league||'', m.sport||'football', getMatchStatus(m));
    } else if (typeof selectMatch === 'function') {
        selectMatch(matchId);
    }
}
