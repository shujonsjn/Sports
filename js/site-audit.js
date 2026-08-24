// ===== Site Audit Agent =====
// Runs every 10 minutes — checks APIs, DOM, errors, and auto-fixes issues.

let _auditInterval = null;
let _auditLog = [];
const MAX_AUDIT_LOG = 50;

function startAuditAgent() {
    stopAuditAgent();
    _auditInterval = setInterval(runSiteAudit, 600000);
    console.log('🔍 Audit Agent: started (every 10 min)');
    setTimeout(runSiteAudit, 30000);
}

function stopAuditAgent() {
    if (_auditInterval) {
        clearInterval(_auditInterval);
        _auditInterval = null;
    }
}

async function runSiteAudit() {
    const report = { time: new Date().toISOString(), issues: [], fixes: [], passed: [] };

    try {
        await auditAPIs(report);
        auditDOM(report);
        auditMatchData(report);
        auditConsoleErrors(report);

        _auditLog.unshift(report);
        if (_auditLog.length > MAX_AUDIT_LOG) _auditLog = _auditLog.slice(0, MAX_AUDIT_LOG);

        const total = report.issues.length;
        const fixed = report.fixes.length;
        console.log(`🔍 Audit complete: ${total} issue(s), ${fixed} auto-fixed`);
        if (total > 0) {
            report.issues.forEach(i => console.log(`  ⚠️ ${i}`));
        }
        if (fixed > 0) {
            report.fixes.forEach(f => console.log(`  ✅ ${f}`));
        }
    } catch (e) {
        console.log('🔍 Audit error:', e.message);
    }
}

async function auditAPIs(report) {
    const endpoints = [
        { name: 'SportScore Football', url: '/api/sportscore?sport=football&limit=5' },
        { name: 'SportScore Cricket', url: '/api/sportscore?sport=cricket&limit=5' },
        { name: 'SportScore Basketball', url: '/api/sportscore?sport=basketball&limit=5' },
        { name: 'ESPN Cricket', url: '/api/google-cricket' },
        { name: 'CricketData.org', url: '/api/cricketdata' },
        { name: 'ESPN Scores', url: '/api/espn-scores?sport=football' },
    ];

    for (const ep of endpoints) {
        try {
            const res = await fetch(ep.url, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) {
                report.issues.push(`${ep.name}: HTTP ${res.status}`);
            } else {
                const text = await res.text();
                if (text.startsWith('<!')) {
                    report.issues.push(`${ep.name}: returned HTML instead of JSON`);
                } else {
                    try {
                        JSON.parse(text);
                        report.passed.push(`${ep.name}: OK`);
                    } catch {
                        report.issues.push(`${ep.name}: invalid JSON`);
                    }
                }
            }
        } catch (e) {
            report.issues.push(`${ep.name}: ${e.message}`);
        }
    }
}

function auditDOM(report) {
    const container = document.getElementById('match-list');
    if (!container) {
        report.issues.push('DOM: #match-list container missing');
        return;
    }

    const cards = container.querySelectorAll('.match-card, .ufc-card');
    if (cards.length === 0) {
        report.issues.push('DOM: no match cards rendered');
    } else {
        report.passed.push(`DOM: ${cards.length} match cards rendered`);
    }

    const leagues = container.querySelectorAll('.league-group');
    if (leagues.length === 0 && cards.length > 0) {
        report.issues.push('DOM: matches exist but no league groups');
    }

    const brokenImages = container.querySelectorAll('img[src=""], img:not([src])');
    if (brokenImages.length > 0) {
        report.issues.push(`DOM: ${brokenImages.length} broken images`);
        brokenImages.forEach(img => {
            img.style.display = 'none';
        });
        report.fixes.push(`Hidden ${brokenImages.length} broken images`);
    }

    const accordions = container.querySelectorAll('.match-detail-accordion');
    let openAccordions = 0;
    accordions.forEach(a => { if (a.style.display !== 'none') openAccordions++; });
    if (openAccordions > 3) {
        report.issues.push(`DOM: ${openAccordions} accordions open (memory concern)`);
    }
}

function auditMatchData(report) {
    if (typeof currentDate === 'undefined' || typeof DATE_CACHE === 'undefined') return;

    const today = getTodayString();
    const data = DATE_CACHE[currentDate];
    if (!data) {
        report.issues.push(`Data: no cache for ${currentDate}`);
        return;
    }

    const allMatches = getMatchesForDate(currentDate);
    if (allMatches.length === 0) {
        report.issues.push(`Data: 0 matches for ${currentDate}`);
    } else {
        report.passed.push(`Data: ${allMatches.length} matches for ${currentDate}`);
    }

    let emptyScores = 0;
    let liveMatches = 0;
    allMatches.forEach(m => {
        const status = getMatchStatus(m);
        if (status === 'live') liveMatches++;
        const s1 = String(m.score?.team1 || '').trim();
        const s2 = String(m.score?.team2 || '').trim();
        if (status === 'finished' && (s1 === '-' || s2 === '-' || !s1 || !s2)) {
            emptyScores++;
        }
    });

    if (liveMatches > 0) {
        report.passed.push(`Data: ${liveMatches} live match(es)`);
    }
    if (emptyScores > 0) {
        report.issues.push(`Data: ${emptyScores} finished match(es) without scores`);
    }

    const knownSports = ['football', 'cricket', 'basketball', 'tabletennis', 'mma', 'ufc', 'nfl'];
    knownSports.forEach(sport => {
        const sportMatches = allMatches.filter(m => m.sport === sport);
        if (sportMatches.length > 0) {
            report.passed.push(`Sport ${sport}: ${sportMatches.length} match(es)`);
        }
    });
}

function auditConsoleErrors(report) {
    const perf = performance.getEntriesByType('resource');
    const failedAPIs = perf.filter(r => r.responseStatus >= 400 && r.name.includes('/api/'));
    if (failedAPIs.length > 5) {
        report.issues.push(`API: ${failedAPIs.length} failed requests in this session`);
    }
}

function getAuditLog() {
    return _auditLog;
}

document.addEventListener('DOMContentLoaded', () => {
    startAuditAgent();
});
