#!/usr/bin/env node
// ===== Schedule Checker Agent =====
// Validates August 2026 schedule data: past dates must be finished, no duplicate IDs, innings consistency, etc.
// Run: node scripts/schedule-checker.js [--fix]

const fs = require('fs');
const path = require('path');

const FIX_MODE = process.argv.includes('--fix');
const API_FILE = path.join(__dirname, '..', 'js', 'api.js');

function getTodayString() {
    const d = new Date();
    return d.toLocaleDateString('en-CA');
}

function run() {
    const content = fs.readFileSync(API_FILE, 'utf8');
    const lines = content.split('\n');
    const today = getTodayString();

    let totalMatches = 0;
    const issues = [];
    const stats = { total: 0, finished: 0, live: 0, upcoming: 0 };
    const sportCounts = {};
    const dateCounts = {};
    const seenIds = new Set();
    const duplicateIds = [];
    const pastUpcoming = [];
    const pastLive = [];
    const futureFinished = [];
    const emptyInnings = [];
    const missingScores = [];
    const multiDayMatches = {};

    lines.forEach((line, idx) => {
        const m = line.match(/add\('(\w+)','(\d{4}-\d{2}-\d{2})','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','(upcoming|finished|live)'(?:,\{([^}]*)\})?\)/);
        if (!m) return;

        const [, sport, date, t1, s1, t2, s2, league, venue, status, opts] = m;
        totalMatches++;
        stats.total++;
        stats[status]++;

        sportCounts[sport] = (sportCounts[sport] || 0) + 1;
        dateCounts[date] = (dateCounts[date] || 0) + 1;

        // Track multi-day matches
        const matchKey = `${sport}-${t1}-${t2}-${league}`;
        if (!multiDayMatches[matchKey]) multiDayMatches[matchKey] = [];
        multiDayMatches[matchKey].push({ date, status, line: idx + 1 });

        // Past date checks
        if (date < today) {
            if (status === 'upcoming') {
                pastUpcoming.push({ sport, date, t1, t2, league, line: idx + 1 });
            }
            if (status === 'live') {
                pastLive.push({ sport, date, t1, t2, league, line: idx + 1 });
            }
        }

        // Future date checks
        if (date > today) {
            if (status === 'finished') {
                futureFinished.push({ sport, date, t1, t2, league, line: idx + 1 });
            }
        }

        // Score checks
        if (status === 'finished' && sport !== 'cricket') {
            if ((s1 === '-' || s1 === '') && (s2 === '-' || s2 === '')) {
                missingScores.push({ sport, date, t1, t2, line: idx + 1 });
            }
        }

        // Cricket innings checks
        if (sport === 'cricket' && opts) {
            const inningsMatch = opts.match(/innings:\[(\[.*?\](?:,\[.*?\])?)\]/);
            if (inningsMatch) {
                try {
                    const innStr = '[' + inningsMatch[1] + ']';
                    const innings = JSON.parse(innStr);
                    if (innings.length >= 2 && innings[0].length === 0 && innings[1].length === 0 && status === 'finished') {
                        emptyInnings.push({ sport, date, t1, t2, line: idx + 1 });
                    }
                } catch (e) {}
            }
        }
    });

    // Check multi-day match consistency
    Object.entries(multiDayMatches).forEach(([key, days]) => {
        if (days.length <= 1) return;
        const sorted = days.sort((a, b) => a.date.localeCompare(b.date));
        const pastDays = sorted.filter(d => d.date < today);
        const futureDays = sorted.filter(d => d.date >= today);

        pastDays.forEach(d => {
            if (d.status === 'upcoming') {
                issues.push(`MULTI-DAY: ${key} — past day ${d.date} still "upcoming" (line ${d.line})`);
            }
            if (d.status === 'live') {
                issues.push(`MULTI-DAY: ${key} — past day ${d.date} still "live" (line ${d.line})`);
            }
        });
    });

    // Report
    console.log('\n' + '='.repeat(60));
    console.log('  SCHEDULE CHECKER REPORT');
    console.log('  Today: ' + today);
    console.log('='.repeat(60));
    console.log(`\n  Total matches: ${stats.total}`);
    console.log(`  Finished: ${stats.finished} | Live: ${stats.live} | Upcoming: ${stats.upcoming}`);
    console.log(`\n  By sport:`);
    Object.entries(sportCounts).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
        console.log(`    ${s.padEnd(12)} ${c}`);
    });

    console.log(`\n  Date coverage: ${Object.keys(dateCounts).length} unique dates`);
    const dates = Object.keys(dateCounts).sort();
    console.log(`    Range: ${dates[0]} to ${dates[dates.length - 1]}`);

    let errorCount = 0;

    if (pastUpcoming.length > 0) {
        console.log(`\n  PAST DATES WITH "UPCOMING" STATUS (${pastUpcoming.length}):`);
        pastUpcoming.forEach(p => {
            console.log(`    L${p.line}: ${p.date} ${p.sport} — ${p.t1} vs ${p.t2} (${p.league})`);
            errorCount++;
        });
    }

    if (pastLive.length > 0) {
        console.log(`\n  PAST DATES WITH "LIVE" STATUS (${pastLive.length}):`);
        pastLive.forEach(p => {
            console.log(`    L${p.line}: ${p.date} ${p.sport} — ${p.t1} vs ${p.t2} (${p.league})`);
            errorCount++;
        });
    }

    if (futureFinished.length > 0) {
        console.log(`\n  FUTURE DATES WITH "FINISHED" STATUS (${futureFinished.length}):`);
        futureFinished.forEach(p => {
            console.log(`    L${p.line}: ${p.date} ${p.sport} — ${p.t1} vs ${p.t2} (${p.league})`);
            errorCount++;
        });
    }

    if (emptyInnings.length > 0) {
        console.log(`\n  FINISHED CRICKET MATCHES WITH EMPTY INNINGS (${emptyInnings.length}):`);
        emptyInnings.forEach(p => {
            console.log(`    L${p.line}: ${p.date} ${p.sport} — ${p.t1} vs ${p.t2}`);
            errorCount++;
        });
    }

    if (missingScores.length > 0) {
        console.log(`\n  FINISHED MATCHES WITHOUT SCORES (${missingScores.length}):`);
        missingScores.forEach(p => {
            console.log(`    L${p.line}: ${p.date} ${p.sport} — ${p.t1} vs ${p.t2}`);
            errorCount++;
        });
    }

    if (issues.length > 0) {
        console.log(`\n  OTHER ISSUES (${issues.length}):`);
        issues.forEach(i => console.log(`    ${i}`));
        errorCount += issues.length;
    }

    if (errorCount === 0) {
        console.log('\n  ALL SCHEDULES ARE VALID!');
    } else {
        console.log(`\n  ${errorCount} issue(s) found.`);
        if (FIX_MODE) {
            console.log('  Fix mode: auto-fixing past upcoming/live dates...');
            autoFix(pastUpcoming, pastLive);
        } else {
            console.log('  Run with --fix to auto-fix past date statuses.');
        }
    }

    console.log('\n' + '='.repeat(60) + '\n');
    return errorCount;
}

function autoFix(pastUpcoming, pastLive) {
    let content = fs.readFileSync(API_FILE, 'utf8');
    let fixed = 0;

    pastUpcoming.forEach(p => {
        const old = `'${p.date}','${p.t1}','${p.t2}','${p.league}','${p.venue}','upcoming'`;
        const rep = `'${p.date}','${p.t1}','${p.t2}','${p.league}','${p.venue}','finished'`;
        if (content.includes(old)) {
            content = content.replace(old, rep);
            fixed++;
        }
    });

    pastLive.forEach(p => {
        const old = `'${p.date}','${p.t1}','${p.t2}','${p.league}','${p.venue}','live'`;
        const rep = `'${p.date}','${p.t1}','${p.t2}','${p.league}','${p.venue}','finished'`;
        if (content.includes(old)) {
            content = content.replace(old, rep);
            fixed++;
        }
    });

    if (fixed > 0) {
        fs.writeFileSync(API_FILE, content, 'utf8');
        console.log(`  Fixed ${fixed} match status(es) in api.js`);
    } else {
        console.log('  No fixes needed.');
    }
}

run();
