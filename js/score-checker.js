// Score Checker Agent
// Runs every 60s — finds finished matches with empty scores, fetches from central API, updates them.

let _scoreCheckerInterval = null;

function startScoreChecker() {
    stopScoreChecker();
    _scoreCheckerInterval = setInterval(checkAndFixEmptyScores, 60000);
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
        const yesterday = getDateOffset(-1);
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

            // Fetch from central API to get updated scores
            try {
                const freshMatches = await fetchFromCentralAPI(dateStr);
                const freshMap = new Map();
                freshMatches.forEach(fm => {
                    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const key1 = `${norm(fm.team1?.name)}_vs_${norm(fm.team2?.name)}`;
                    const key2 = `${norm(fm.team2?.name)}_vs_${norm(fm.team1?.name)}`;
                    freshMap.set(key1, fm);
                    freshMap.set(key2, fm);
                });

                for (const match of needsFix) {
                    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const key = `${norm(match.team1?.name)}_vs_${norm(match.team2?.name)}`;
                    const fresh = freshMap.get(key);
                    if (fresh) {
                        const hasScore = v => v && v !== '-' && v !== '';
                        if (hasScore(fresh.score?.team1)) {
                            match.score = { ...match.score, team1: fresh.score.team1 };
                            match.team1 = match.team1 || {};
                            match.team1.score = fresh.score.team1;
                        }
                        if (hasScore(fresh.score?.team2)) {
                            match.score = { ...match.score, team2: fresh.score.team2 };
                            match.team2 = match.team2 || {};
                            match.team2.score = fresh.score.team2;
                        }
                        if (fresh.innings && fresh.innings.some(arr => arr && arr.length > 0)) {
                            match.innings = fresh.innings;
                        }
                        if (fresh.result) match.result = fresh.result;
                        if (fresh.team1?.logo && !match.team1?.logo) match.team1.logo = fresh.team1.logo;
                        if (fresh.team2?.logo && !match.team2?.logo) match.team2.logo = fresh.team2.logo;
                    }
                }
            } catch (e) {
                console.log('⚠️ Score checker central API failed:', e.message);
            }

            // Re-render if on this date
            if (dateStr === currentDate) {
                const container = document.getElementById('match-list');
                if (container) {
                    const fresh = getMatchesForDate(currentDate);
                    await enrichMatchLogos(fresh);
                    filterAndRender(fresh, container);
                }
            }
        }
    } catch (e) {
        console.log('⚠️ Score check error:', e.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(startScoreChecker, 5000);
});
