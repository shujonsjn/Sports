// ===== Score Checker Agent =====
// Runs every 60s — finds finished matches with empty scores, fetches real data, updates them.

let _scoreCheckerInterval = null;

function startScoreChecker() {
    stopScoreChecker();
    _scoreCheckerInterval = setInterval(checkAndFixEmptyScores, 60000);
    console.log('🔍 Score Checker: started (every 60s)');
}

function stopScoreChecker() {
    if (_scoreCheckerInterval) {
        clearInterval(_scoreCheckerInterval);
        _scoreCheckerInterval = null;
    }
}

async function checkAndFixEmptyScores() {
    try {
        const today = getTodayString();
        const yesterday = getYesterdayString();
        const datesToCheck = [today, yesterday];

        for (const dateStr of datesToCheck) {
            const matches = getMatchesForDate(dateStr);
            if (!matches || matches.length === 0) continue;

            const needsFix = matches.filter(m => {
                const status = getMatchStatus(m);
                if (status !== 'finished') return false;
                const s1 = String(m.score?.team1 || '').trim();
                const s2 = String(m.score?.team2 || '').trim();
                if (s1 && s1 !== '-' && s2 && s2 !== '-') return false;
                if (m.innings && m.innings.some(arr => arr && arr.length > 0)) return false;
                return true;
            });

            if (needsFix.length === 0) continue;

            console.log(`🔍 Score Checker: ${needsFix.length} finished match(es) without score on ${dateStr}`);

            for (const match of needsFix) {
                await fetchAndUpdateMatchScore(match);
            }
        }
    } catch (e) {
        console.log('🔍 Score Checker error:', e.message);
    }
}

function getYesterdayString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
}

async function fetchAndUpdateMatchScore(match) {
    try {
        const t1 = match.team1?.name || '';
        const t2 = match.team2?.name || '';
        const sport = match.sport || '';
        console.log(`  ↳ Fetching score: ${t1} vs ${t2} (${sport})`);

        let updated = false;

        if (sport === 'nfl') {
            updated = await fetchNFLMatchScore(match);
            if (!updated) updated = await fetchESPNMatchScore(match);
        } else if (sport === 'cricket') {
            updated = await fetchCricketMatchScore(match);
        } else if (sport === 'football' || sport === 'basketball') {
            updated = await fetchSportMatchScore(match);
            if (!updated) updated = await fetchESPNMatchScore(match);
        }

        if (updated) {
            console.log(`  ✓ Score updated: ${match.team1?.name} ${match.score?.team1} - ${match.score?.team2} ${match.team2?.name}`);
            if (typeof currentDate !== 'undefined' && match.date === currentDate) {
                const container = document.getElementById('match-list');
                if (container) {
                    const fresh = getMatchesForDate(currentDate);
                    await enrichMatchLogos(fresh);
                    filterAndRender(fresh, container);
                }
            }
        }
    } catch (e) {
        console.log(`  ✗ Score fetch failed: ${match.team1?.name} vs ${match.team2?.name}: ${e.message}`);
    }
}

async function fetchNFLMatchScore(match) {
    try {
        const t1 = match.team1?.name || '';
        const t2 = match.team2?.name || '';
        const year = new Date(match.date).getFullYear();
        const res = await fetch(`/api/nfldata?season=${year}&season_type=2`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return false;
        const json = await res.json();
        const games = json?.data || [];
        const norm = s => (s || '').toLowerCase().replace(/[^a-z]/g, '');
        const game = games.find(g => {
            const h = norm(g.home_team);
            const a = norm(g.away_team);
            return (norm(t1).includes(h) || h.includes(norm(t1))) &&
                   (norm(t2).includes(a) || a.includes(norm(t2))) ||
                   (norm(t1).includes(a) || a.includes(norm(t1))) &&
                   (norm(t2).includes(h) || h.includes(norm(t2)));
        });
        if (!game) return false;
        if (game.home_score == null || game.away_score == null) return false;
        const home = norm(t1);
        const homeAbbr = norm(game.home_team);
        const isHome = home.includes(homeAbbr) || homeAbbr.includes(home);
        match.score = { team1: isHome ? String(game.home_score) : String(game.away_score), team2: isHome ? String(game.away_score) : String(game.home_score) };
        match.team1 = match.team1 || {};
        match.team2 = match.team2 || {};
        match.team1.score = match.score.team1;
        match.team2.score = match.score.team2;
        return true;
    } catch (e) { return false; }
}

async function fetchCricketMatchScore(match) {
    try {
        const day = DATE_CACHE[match.date] || {};
        const cricket = day.cricket || [];
        const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const t1n = norm(match.team1?.name);
        const t2n = norm(match.team2?.name);
        const existing = cricket.find(m => {
            const e1 = norm(m.team1?.name);
            const e2 = norm(m.team2?.name);
            return (e1 === t1n && e2 === t2n) || (e1 === t2n && e2 === t1n);
        });
        if (existing && existing.innings && existing.innings.some(arr => arr && arr.length > 0)) {
            const inn = existing.innings;
            const t1inn = inn[0] || [];
            const t2inn = inn[1] || [];
            const last1 = t1inn.filter(i => i && i.runs && i.runs !== '-');
            const last2 = t2inn.filter(i => i && i.runs && i.runs !== '-');
            if (last1.length > 0 || last2.length > 0) {
                match.innings = inn;
                match.score = {
                    team1: last1.length > 0 ? last1[last1.length - 1].runs : '-',
                    team2: last2.length > 0 ? last2[last2.length - 1].runs : '-'
                };
                if (existing.result) match.result = existing.result;
                return true;
            }
        }
        return false;
    } catch (e) { return false; }
}

async function fetchSportMatchScore(match) {
    try {
        const sportKey = match.sport === 'football' ? 'football' : match.sport === 'basketball' ? 'basketball' : '';
        if (!sportKey) return false;
        const isLocal = window.location.hostname === 'localhost';
        const url = isLocal
            ? `https://sportscore.com/api/widget/matches/?sport=${sportKey}&limit=30`
            : `/api/sportscore?sport=${sportKey}&limit=30`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return false;
        const json = await res.json();
        const apiMatches = json?.matches || json?.data || [];
        const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const t1n = norm(match.team1?.name);
        const t2n = norm(match.team2?.name);
        const found = apiMatches.find(m => {
            const m1 = norm(m.teams?.home?.name || m.home_team || m.home);
            const m2 = norm(m.teams?.away?.name || m.away_team || m.away);
            return (m1 === t1n && m2 === t2n) || (m1 === t2n && m2 === t1n);
        });
        if (!found) return false;
        const hs = found.home_score ?? found.score?.home;
        const as = found.away_score ?? found.score?.away;
        if (hs == null || as == null) return false;
        match.score = { team1: String(hs), team2: String(as) };
        match.team1 = match.team1 || {};
        match.team2 = match.team2 || {};
        match.team1.score = match.score.team1;
        match.team2.score = match.score.team2;
        return true;
    } catch (e) { return false; }
}

async function fetchESPNMatchScore(match) {
    try {
        const sportKey = match.sport === 'nfl' ? 'nfl' : match.sport;
        const espnSport = match.sport === 'nfl' ? 'nfl' : match.sport;
        const url = `/api/espn-scores?sport=${espnSport}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return false;
        const json = await res.json();
        const espnMatches = json?.matches || [];
        const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const t1n = norm(match.team1?.name);
        const t2n = norm(match.team2?.name);
        const found = espnMatches.find(m => {
            const m1 = norm(m.team1?.name);
            const m2 = norm(m.team2?.name);
            return (m1 === t1n && m2 === t2n) || (m1 === t2n && m2 === t1n);
        });
        if (!found) return false;
        const hasScore = v => v && v !== '-' && v !== '';
        if (!hasScore(found.score?.team1) && !hasScore(found.score?.team2)) return false;
        match.score = { team1: found.score.team1 || '-', team2: found.score.team2 || '-' };
        match.team1 = match.team1 || {};
        match.team2 = match.team2 || {};
        match.team1.score = match.score.team1;
        match.team2.score = match.score.team2;
        if (found.team1?.logo && !match.team1?.logo) match.team1.logo = found.team1.logo;
        if (found.team2?.logo && !match.team2?.logo) match.team2.logo = found.team2.logo;
        return true;
    } catch (e) { return false; }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(startScoreChecker, 5000);
});
