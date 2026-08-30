// ===== SportScore API Integration =====

let LIVE_MATCHES = {};
let DATE_CACHE = {};
let LAST_UPDATED = null;

const SPORTSCORE_BASE = window.location.hostname === 'localhost' 
    ? '/api' 
    : 'https://sportscore.com/api/widget';
const SPORTSRC_BASE = 'https://api.sportsrc.org';
const IS_LOCAL = window.location.hostname === 'localhost';
const SPORTSRC_URL = IS_LOCAL ? '/api/sportsrc' : SPORTSRC_BASE;
const APIFOOTBALL_BASE = 'https://v3.football.api-sports.io';
const THESPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('sportsrc_v') || k.startsWith('schedule_60d'))) localStorage.removeItem(k);
    }
    const logoRaw = localStorage.getItem(LOGO_CACHE_KEY);
    if (logoRaw) {
        const logoData = JSON.parse(logoRaw);
        let changed = false;
        Object.keys(logoData).forEach(k => {
            if (logoData[k] === '_NOT_FOUND_' || logoData[k] === '') {
                delete logoData[k];
                changed = true;
            }
        });
        if (changed) localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(logoData));
    }
} catch (e) {}

let APIFOOTBALL_KEY = '';
let CRICKET_API_KEY = '';
const CRICKET_API_BASE = 'https://api.cricapi.com/v1';

// ===== Team Logo Cache =====
const LOGO_CACHE_KEY = 'team_logos_v5';
let teamLogoCache = {};
try { teamLogoCache = JSON.parse(localStorage.getItem(LOGO_CACHE_KEY) || '{}'); } catch(e) {}
Object.keys(teamLogoCache).forEach(k => { if (teamLogoCache[k] === '_NOT_FOUND_') delete teamLogoCache[k]; });
try { localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(teamLogoCache)); } catch(e) {}

// Static logo mappings — reliable CDN URLs (no API calls needed)
const TEAM_LOGO_URLS = {
    // === Football (Soccer) — TheSportsDB badges ===
    'barcelona': 'https://r2.thesportsdb.com/images/media/team/badge/wq9sir1639406443.png',
    'real madrid': 'https://r2.thesportsdb.com/images/media/team/badge/vwvwrw1473502969.png',
    'atletico madrid': 'https://r2.thesportsdb.com/images/media/team/badge/0ulh3q1719984315.png',
    'valencia': 'https://r2.thesportsdb.com/images/media/team/badge/dm8l6o1655594864.png',
    'arsenal': 'https://r2.thesportsdb.com/images/media/team/badge/uyhbfe1612467038.png',
    'manchester city': 'https://r2.thesportsdb.com/images/media/team/badge/vwpvry1467462651.png',
    'manchester united': 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
    'chelsea': 'https://www.thesportsdb.com/images/media/team/badge/pbf4ul1782638263.png',
    'liverpool': 'https://r2.thesportsdb.com/images/media/team/badge/kfaher1737969724.png',
    'tottenham': 'https://r2.thesportsdb.com/images/media/team/badge/3dhd0j1605371995.png',
    'west ham': 'https://r2.thesportsdb.com/images/media/team/badge/sxytnr1467462651.png',
    'west ham united': 'https://r2.thesportsdb.com/images/media/team/badge/sxytnr1467462651.png',
    'watford': 'https://r2.thesportsdb.com/images/media/team/badge/iupwrj1448813458.png',
    'burnley': 'https://r2.thesportsdb.com/images/media/team/badge/xzaydr1448813216.png',
    'southampton': 'https://r2.thesportsdb.com/images/media/team/badge/pgusmg1448813358.png',
    'paris saint-germain': 'https://r2.thesportsdb.com/images/media/team/badge/has8b01763050866.png',
    'psg': 'https://r2.thesportsdb.com/images/media/team/badge/has8b01763050866.png',
    'lens': 'https://r2.thesportsdb.com/images/media/team/badge/xzrlgw1448813254.png',
    'lazio': 'https://r2.thesportsdb.com/images/media/team/badge/fihvwb1448813550.png',
    'genoa': 'https://r2.thesportsdb.com/images/media/team/badge/jxy8ht1448813504.png',
    'verona': 'https://r2.thesportsdb.com/images/media/team/badge/bqnlmz1448813383.png',
    'frosinone': 'https://r2.thesportsdb.com/images/media/team/badge/5byj8h1548813550.png',
    'espanyol': 'https://r2.thesportsdb.com/images/media/team/badge/867nzz1681703222.png',
    'levante': 'https://r2.thesportsdb.com/images/media/team/badge/xwtxsx1473503739.png',
    'r. santander': 'https://r2.thesportsdb.com/images/media/team/badge/97kkiq1536575158.png',
    'santander': 'https://r2.thesportsdb.com/images/media/team/badge/97kkiq1536575158.png',
    'villarreal': 'https://r2.thesportsdb.com/images/media/team/badge/vrypqy1473503073.png',
    // Bundesliga
    'wolfsburg': 'https://r2.thesportsdb.com/images/media/team/badge/yvwvtu1448813504.png',
    'hannover 96': 'https://r2.thesportsdb.com/images/media/team/badge/jcmhl51548813338.png',
    'darmstadt 98': 'https://r2.thesportsdb.com/images/media/team/badge/rwqmsg1448813550.png',
    'arminia bielefeld': 'https://r2.thesportsdb.com/images/media/team/badge/xzrlgw1448813550.png',
    'energie cottbus': 'https://r2.thesportsdb.com/images/media/team/badge/xzqg8h1448813550.png',
    'dynamo dresden': 'https://r2.thesportsdb.com/images/media/team/badge/fnhl221630063475.png',
    // Brazil
    'flamengo': 'https://r2.thesportsdb.com/images/media/team/badge/uik0us1448813458.png',
    'santos': 'https://r2.thesportsdb.com/images/media/team/badge/xzqg8h1448813504.png',
    'corinthians': 'https://r2.thesportsdb.com/images/media/team/badge/rwqmsg1467462651.png',
    'cruzeiro': 'https://r2.thesportsdb.com/images/media/team/badge/xzg0bi1548813458.png',
    'mirassol': 'https://r2.thesportsdb.com/images/media/team/badge/rwqmsg1448813550.png',
    // Argentina
    'river plate': 'https://r2.thesportsdb.com/images/media/team/badge/iwz2j81548813504.png',
    'boca juniors': 'https://r2.thesportsdb.com/images/media/team/badge/uvxuqq1448813377.png',
    'argentinos juniors': 'https://r2.thesportsdb.com/images/media/team/badge/iwr3h41548813383.png',
    'quilmes': 'https://r2.thesportsdb.com/images/media/team/badge/rwqmsg1448813458.png',
    // Cricket — TheSportsDB national team badges
    'australia': 'https://r2.thesportsdb.com/images/media/team/badge/zvm8581646775132.png',
    'bangladesh': 'https://r2.thesportsdb.com/images/media/team/badge/j74o4t1646775146.png',
    'india': 'https://r2.thesportsdb.com/images/media/team/badge/donl7g1646775159.png',
    'ireland': 'https://r2.thesportsdb.com/images/media/team/badge/wlryed1646775269.png',
    'afghanistan': 'https://r2.thesportsdb.com/images/media/team/badge/bzu3v71646775261.png',
    'england': 'https://r2.thesportsdb.com/images/media/team/badge/y5wcl81646775152.png',
    'pakistan': 'https://r2.thesportsdb.com/images/media/team/badge/03o8241646775177.png',
    'sri lanka': 'https://r2.thesportsdb.com/images/media/team/badge/i5fqg01646775193.png',
    'south africa': 'https://r2.thesportsdb.com/images/media/team/badge/hn47e51646775185.png',
    'new zealand': 'https://r2.thesportsdb.com/images/media/team/badge/1yyh9s1646775166.png',
    'west indies': 'https://r2.thesportsdb.com/images/media/team/badge/1x0a681646775209.png',
    /* === NFL — TheSportsDB badges === */
    'bengals': 'https://r2.thesportsdb.com/images/media/team/badge/dx268i1564356893.png',
    'lions': 'https://r2.thesportsdb.com/images/media/team/badge/6y804o1649010370.png',
    'steelers': 'https://r2.thesportsdb.com/images/media/team/badge/63jst01769097748.png',
    'packers': 'https://r2.thesportsdb.com/images/media/team/badge/92t3rn1612194438.png',
    'patriots': 'https://r2.thesportsdb.com/images/media/team/badge/216so91767960786.png',
    'colts': 'https://r2.thesportsdb.com/images/media/team/badge/44aj7u1637782142.png',
    'chargers': 'https://r2.thesportsdb.com/images/media/team/badge/943u3o1736049641.png',
    'texans': 'https://r2.thesportsdb.com/images/media/team/badge/o71ce41784719551.png',
    'raiders': 'https://r2.thesportsdb.com/images/media/team/badge/tk80ru1648973672.png',
    'cardinals': 'https://r2.thesportsdb.com/images/media/team/badge/r8nqou1564357043.png',
    '49ers': 'https://r2.thesportsdb.com/images/media/team/badge/h09jf41564335694.png',
    'titans': 'https://r2.thesportsdb.com/images/media/team/badge/50kzdm1644367943.png',
    'broncos': 'https://r2.thesportsdb.com/images/media/team/badge/475yfc1625428425.png',
    'falcons': 'https://r2.thesportsdb.com/images/media/team/badge/b7rq281768776699.png',
    'buccaneers': 'https://r2.thesportsdb.com/images/media/team/badge/umokfi1717671097.png',
    'jets': 'https://r2.thesportsdb.com/images/media/team/badge/wytb8m1784126819.png',
    'commanders': 'https://r2.thesportsdb.com/images/media/team/badge/rn0c7v1643826119.png',
    'dolphins': 'https://r2.thesportsdb.com/images/media/team/badge/tyoy421672068536.png',
    'bills': 'https://r2.thesportsdb.com/images/media/team/badge/j4r1tn1784714823.png',
    'panthers': 'https://r2.thesportsdb.com/images/media/team/badge/wsah8l1767855541.png',
    'bears': 'https://r2.thesportsdb.com/images/media/team/badge/0m51zd1784716955.png',
    'browns': 'https://r2.thesportsdb.com/images/media/team/badge/g7qhkz1784717593.png',
    'vikings': 'https://r2.thesportsdb.com/images/media/team/badge/vq6n241720288977.png',
    'giants': 'https://r2.thesportsdb.com/images/media/team/badge/0jox931557761386.png',
    'chiefs': 'https://r2.thesportsdb.com/images/media/team/badge/ut9cpz1555142819.png',
    'rams': 'https://r2.thesportsdb.com/images/media/team/badge/dcfhl81696312142.png',
    'saints': 'https://r2.thesportsdb.com/images/media/team/badge/nd46c71537821337.png',
    'jaguars': 'https://r2.thesportsdb.com/images/media/team/badge/lfzgcu1564357775.png',
    'ravens': 'https://r2.thesportsdb.com/images/media/team/badge/0eofti1779072807.png',
    'eagles': 'https://r2.thesportsdb.com/images/media/team/badge/di999m1618585987.png',
    'seahawks': 'https://r2.thesportsdb.com/images/media/team/badge/21o2tm1564357999.png',
    'cowboys': 'https://r2.thesportsdb.com/images/media/team/badge/y93q8d1564337206.png',
    // === More August data teams ===
    'mallorca': 'https://r2.thesportsdb.com/images/media/team/badge/ssptsx1473503730.png',
    'girona': 'https://r2.thesportsdb.com/images/media/team/badge/kfu7zu1659897499.png',
    'inter miami': 'https://r2.thesportsdb.com/images/media/team/badge/m4it3e1602103647.png',
    'atalanta': 'https://r2.thesportsdb.com/images/media/team/badge/qix5ku1780561327.png',
    'melbourne victory': 'https://img.thesports.com/football/team/c540f8f279c09a2a3df1cbbfe82d7184.png',
    'fc barcelona atlètic': 'https://img.thesports.com/football/team/45181f51a6e79ead8e9f2a18fc616deb.png',
    'fc cartagena': 'https://img.thesports.com/football/team/d5809db0321d41ee34ba5b481f86e01f.png',
    // === NBA ===
    'los angeles lakers': 'https://r2.thesportsdb.com/images/media/team/badge/0m51zd1784716955.png',
    'golden state warriors': 'https://r2.thesportsdb.com/images/media/team/badge/uqvtl21637784985.png',
    'miami heat': 'https://r2.thesportsdb.com/images/media/team/badge/uwv2jg1676262765.png',
    'brooklyn nets': 'https://r2.thesportsdb.com/images/media/team/badge/ir1anl1676262831.png',
    'chicago bulls': 'https://r2.thesportsdb.com/images/media/team/badge/1mrlk01676262895.png',
    'milwaukee bucks': 'https://r2.thesportsdb.com/images/media/team/badge/6gy3oj1676262976.png',
    'dallas mavericks': 'https://r2.thesportsdb.com/images/media/team/badge/l4y9wq1676263042.png',
    'new york knicks': 'https://r2.thesportsdb.com/images/media/team/badge/l2kcnh1676263177.png',
    // === WNBA ===
    'las vegas aces': 'https://img.thesports.com/basketball/team/ce8ab1125fdb3fdbd8c09dba8c437c49.png',
    'atlanta dream': 'https://img.thesports.com/basketball/team/be3ef0f7745b3b45b846fac31ca987c6.png',
    'chicago sky': 'https://img.thesports.com/basketball/team/96c0adc8a98bb466bfa539f11ce8ae04.png',
    'new york liberty': 'https://img.thesports.com/basketball/team/67cf5b4cfacab3792d2fde73e0af4ac0.png',
    'washington mystics': 'https://img.thesports.com/basketball/team/f619a41699e34ed5b9c8047ecb688ca3.png',
    'toronto tempo': 'https://img.thesports.com/basketball/team/d994ab69186bb52d6b0967e1567a217e.png',
    // === Basketball national teams ===
    'malaysia': 'https://img.thesports.com/basketball/team/d580436ffcf5531ff33500bb724315da.png',
    'slovenia': 'https://img.thesports.com/basketball/team/35ddc4d975ebf4ca72e69c453bc89d44.png',
    'latvia': 'https://img.thesports.com/basketball/team/4b626c0ef3e30f8f4954927d1d8b0edc.png',
    'vietnam': 'https://r2.thesportsdb.com/images/media/team/badge/gux95f1651458848.png',
    'thailand': 'https://r2.thesportsdb.com/images/media/team/badge/dbpt9n1624098160.png',
    'philippines': 'https://r2.thesportsdb.com/images/media/team/badge/3yw3jn1560688980.png',
    'indonesia': 'https://r2.thesportsdb.com/images/media/team/badge/9u0qty1623866518.png',
    'japan': 'https://r2.thesportsdb.com/images/media/team/badge/kkwe6m1560684468.png',
    'south korea': 'https://r2.thesportsdb.com/images/media/team/badge/qg049x1560685144.png',
    'chinese taipei': 'https://r2.thesportsdb.com/images/media/team/badge/jbuizh1623866816.png',
    'china': 'https://r2.thesportsdb.com/images/media/team/badge/33fzmy1704629844.png',
    'australia': 'https://r2.thesportsdb.com/images/media/team/badge/zvm8581646775132.png',
    'iran': 'https://r2.thesportsdb.com/images/media/team/badge/y2y0cb1654115132.png',
    'jordan': 'https://r2.thesportsdb.com/images/media/team/badge/u2sa4p1560689157.png',
    'lebanon': 'https://r2.thesportsdb.com/images/media/team/badge/ejglj51704636514.png',
    'saudi arabia': 'https://r2.thesportsdb.com/images/media/team/badge/jrf2li1623431445.png',
    'qatar': 'https://r2.thesportsdb.com/images/media/team/badge/6wgu1h1623430086.png',
    'bahrain': 'https://r2.thesportsdb.com/images/media/team/badge/w7joaw1704652571.png',
    'kuwait': 'https://r2.thesportsdb.com/images/media/team/badge/t7w87a1654112747.png',
    'iraq': 'https://r2.thesportsdb.com/images/media/team/badge/raitff1708775163.png',
    'united arab emirates': 'https://r2.thesportsdb.com/images/media/team/badge/zcrlcv1708717076.png',
    'uae': 'https://r2.thesportsdb.com/images/media/team/badge/zcrlcv1708717076.png',
    'india': 'https://r2.thesportsdb.com/images/media/team/badge/ufgtdx1629833092.png',
    'new zealand women': 'https://img.thesports.com/basketball/team/d4b2bfd0db89e9b41d44239a404d045d.jpg',
    'brazil women': 'https://img.thesports.com/basketball/team/e40030a18efa3acc6922527b8807b0d7.png',
    'canada women': 'https://img.thesports.com/basketball/team/3d3669fffad83128ecbf257f2db7c65a.png',
    'philippines women': 'https://img.thesports.com/basketball/team/c909efdeb2e44ec1b578be2be896f63f.png',
    'cairns taipans': 'https://img.thesports.com/basketball/team/2f4677e5f2089fb794a968f25c2dcb3a.png',
    'california irvine': 'https://img.thesports.com/basketball/team/3623f97813f92214463237691477f56d.png',
    'wonju dongbu promy': 'https://img.thesports.com/basketball/team/e94f441698752284a7b2f6c37ea3aee6.png',
    'new taipei kings': 'https://img.thesports.com/basketball/team/8f7d23dd938fc64b4a4df43c94bbf3ff.png'
};

function fetchTeamLogo(teamName) {
    const key = (teamName || '').toLowerCase().trim();
    if (!key || key === '-' || key === 'tba') return '';
    if (teamLogoCache[key] && teamLogoCache[key] !== '_NOT_FOUND_') return teamLogoCache[key];
    const direct = TEAM_LOGO_URLS[key];
    if (direct && direct !== '') {
        teamLogoCache[key] = direct;
        try { localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(teamLogoCache)); } catch(e) {}
        return direct;
    }
    return '';
}

const _pendingLookups = {};
async function lookupTeamLogoFromServer(teamName) {
    const key = (teamName || '').toLowerCase().trim();
    if (!key || key === '-' || key === 'tba') return '';
    if (teamLogoCache[key] && teamLogoCache[key] !== '_NOT_FOUND_') return teamLogoCache[key];
    if (_pendingLookups[key]) return _pendingLookups[key];
    _pendingLookups[key] = (async () => {
        try {
            const encoded = encodeURIComponent(teamName);
            const res = await fetch(`/api/thesportsdb?path=searchteams.php&t=${encoded}`);
            if (!res.ok) return '';
            const data = await res.json();
            if (data.teams && data.teams.length > 0) {
                const badge = data.teams[0].strBadge || data.teams[0].strTeamBadge || '';
                if (badge) {
                    teamLogoCache[key] = badge;
                    try { localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(teamLogoCache)); } catch(e) {}
                    return badge;
                }
            }
        } catch(e) {}
        teamLogoCache[key] = '_NOT_FOUND_';
        try { localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(teamLogoCache)); } catch(e) {}
        return '';
    })();
    return _pendingLookups[key];
}

function enrichMatchLogos(matches) {
    if (!matches || !matches.length) return;
    const ufcMatches = matches.filter(m => m.sport === 'ufc' || m.sport === 'mma');
    const ufcPromise = ufcMatches.length > 0 ? fetchUFCFighterPhotos(ufcMatches) : Promise.resolve();
    const missing = [];
    matches.forEach(m => {
        if (m.team1?.name) { m.team1.logo = fetchTeamLogo(m.team1.name); if (!m.team1.logo) missing.push({match:m, side:'team1'}); }
        if (m.team2?.name) { m.team2.logo = fetchTeamLogo(m.team2.name); if (!m.team2.logo) missing.push({match:m, side:'team2'}); }
    });
    if (!missing.length) return ufcPromise;
    const seen = new Set();
    const jobs = missing.filter(x => {
        const name = x.match[x.side]?.name;
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
    }).map(async x => {
        const name = x.match[x.side].name;
        const logo = await lookupTeamLogoFromServer(name);
        if (logo && logo !== '_NOT_FOUND_') x.match[x.side].logo = logo;
    });
    return Promise.allSettled([...jobs, ufcPromise]);
}

function updateLastUpdated() {
    const el = document.getElementById('last-updated');
    if (el && LAST_UPDATED) {
        el.textContent = 'Updated ' + LAST_UPDATED.toLocaleTimeString();
    }
}

function setApiFootballKey(key) {
    APIFOOTBALL_KEY = key;
    console.log('🔑 API-Football key set (session only)');
}

async function fetchVenueFromAPIFootball(dateStr) {
    if (!APIFOOTBALL_KEY) return {};
    
    try {
        const res = await fetch(`${APIFOOTBALL_BASE}/fixtures?date=${dateStr}`, {
            headers: { 'x-apisports-key': APIFOOTBALL_KEY }
        });
        if (!res.ok) return {};
        const data = await res.json();
        const venues = {};
        (data.response || []).forEach(f => {
            const home = f.teams?.home?.name;
            const away = f.teams?.away?.name;
            const venue = f.fixture?.venue?.name;
            if (home && away && venue) {
                venues[`${home.toLowerCase()}_vs_${away.toLowerCase()}`] = venue;
            }
        });
        return venues;
    } catch (e) {
        console.log('⚠️ API-Football venue fetch failed:', e.message);
        return {};
    }
}

async function enrichMatchesWithVenue(matches, dateStr) {
    if (!APIFOOTBALL_KEY || matches.length === 0) return matches;
    
    const venues = await fetchVenueFromAPIFootball(dateStr);
    if (Object.keys(venues).length === 0) return matches;
    
    return matches.map(m => {
        const key = `${m.team1.name.toLowerCase()}_vs_${m.team2.name.toLowerCase()}`;
        const keyRev = `${m.team2.name.toLowerCase()}_vs_${m.team1.name.toLowerCase()}`;
        return {
            ...m,
            venue: venues[key] || venues[keyRev] || m.venue || ''
        };
    });
}

function getCachedData(dateStr) {
    return null;
}

function setCachedData(dateStr, matches) {
}

// ===== 60-Day Schedule Pre-Fetch Agent =====
let _schedulePrefetchRunning = false;

function formatDateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-CA');
}

async function prefetchSchedule() {
    if (_schedulePrefetchRunning) return;
    _schedulePrefetchRunning = true;

    console.log('📅 Schedule agent: fetching next 60 days...');
    const batchSize = 5;

    for (let i = 0; i < 60; i += batchSize) {
        const batch = [];
        for (let j = i; j < Math.min(i + batchSize, 60); j++) {
            const dateStr = formatDateOffset(j);
            batch.push(
                (async (ds) => {
                    try {
                        const data = await fetchMatchesForDate(ds);
                        return { date: ds, data };
                    } catch (e) {
                        return { date: ds, data: null };
                    }
                })(dateStr)
            );
        }

        const results = await Promise.allSettled(batch);
        results.forEach(r => {
            if (r.status === 'fulfilled' && r.value.data) {
                const { date, data } = r.value;
                const hasData = Object.values(data).some(arr => arr && arr.length > 0);
                if (hasData) {
                    DATE_CACHE[date] = data;
                }
            }
        });

        if (i + batchSize < 60) {
            await new Promise(r => setTimeout(r, 800));
        }
    }

    console.log(`✅ Schedule agent: fetched next 60 days`);
    _schedulePrefetchRunning = false;
}

const SPORT_MAP = {
    'football': 'football',
    'cricket': 'cricket',
    'basketball': 'basketball',
    'tennis': 'tennis'
};

function getTodayString() {
    const today = new Date();
    return today.toLocaleDateString('en-CA');
}

function convertSportScoreMatch(match, sport) {
    const statusMap = {
        'live': 'live',
        'finished': 'finished',
        'upcoming': 'upcoming',
        'not_started': 'upcoming',
        'cancelled': 'finished',
        'postponed': 'upcoming',
        'suspended': 'live'
    };

    const matchDate = match.time ? match.time.split('T')[0] : getTodayString();
    const matchTime = match.time ? new Date(match.time).toTimeString().slice(0, 5) : '00:00';
    const t1name = cleanTeamName(match.home || match.home_team || 'Home Team');
    const t2name = cleanTeamName(match.away || match.away_team || 'Away Team');
    const stableId = match.url || `${sport}-${matchDate}-${matchTime}-${t1name}-${t2name}`.toLowerCase().replace(/\s+/g,'-');

    return {
        id: stableId,
        sport: sport,
        icon: getSportIcon(sport),
        team1: {
            name: cleanTeamName(match.home || match.home_team || 'Home Team'),
            short: cleanTeamName(match.home || match.home_team || 'HOME').slice(0, 3).toUpperCase(),
            logo: match.home_logo || match.home_logo_url || match.home_image || match.home_team_logo || match.homeTeamLogo || match.team1_logo || match.home?.logo || match.home?.image || '',
            flag: ''
        },
        team2: {
            name: cleanTeamName(match.away || match.away_team || 'Away Team'),
            short: cleanTeamName(match.away || match.away_team || 'AWAY').slice(0, 3).toUpperCase(),
            logo: match.away_logo || match.away_logo_url || match.away_image || match.away_team_logo || match.awayTeamLogo || match.team2_logo || match.away?.logo || match.away?.image || '',
            flag: ''
        },
        league: match.competition || 'Unknown League',
        competitionLogo: match.competition_logo || '',
        venue: '',
        date: matchDate,
        time: matchTime,
        status: statusMap[match.status] || 'upcoming',
        statusText: match.status_text || '',
        score: {
            team1: match.home_score ?? match.homeScore ?? '-',
            team2: match.away_score ?? match.awayScore ?? '-'
        },
        overs: {
            team1: match.home_overs ?? '',
            team2: match.away_overs ?? ''
        }
    };
}

function getSportIcon(sport) {
    const icons = {
        'football': '⚽',
        'cricket': '🏏',
        'basketball': '🏀',
        'tennis': '🏓',
        'mma': '🥊',
        'ufc': '🥋',
        'nfl': '🏈',
        'baseball': '⚾',
        'hockey': '🏒',
        'rugby': '🏉'
    };
    return icons[sport] || '🏟️';
}

async function fetchSportScore(sport, limit = 20) {
    if (sport === 'mma' || sport === 'ufc') return [];
    try {
        const isLocal = window.location.hostname === 'localhost';
        const url = isLocal 
            ? `https://sportscore.com/api/widget/matches/?sport=${sport}&limit=${limit}`
            : `/api/sportscore?sport=${sport}&limit=${limit}`;
        console.log(`🌐 Fetching ${sport}...`);

        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
            console.log(`ℹ️ ${sport} not available from SportScore API`);
            return [];
        }

        const data = await response.json();
        return (data.matches || []).map(m => convertSportScoreMatch(m, sport));
    } catch (error) {
        console.log(`ℹ️ ${sport}: ${error.message}`);
        return [];
    }
}

// ===== ESPN Fallback (Google-style live scores) =====
async function fetchESPNFallback(sport) {
    try {
        const url = `/api/espn-scores?sport=${sport}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.matches || []).map(m => ({
            id: m.id,
            sport: m.sport,
            icon: getSportIcon(m.sport),
            team1: { name: m.team1.name, short: m.team1.name.slice(0,3).toUpperCase(), logo: m.team1.logo || '', flag: '' },
            team2: { name: m.team2.name, short: m.team2.name.slice(0,3).toUpperCase(), logo: m.team2.logo || '', flag: '' },
            league: m.league || '',
            venue: m.venue || '',
            date: m.date,
            time: m.time,
            status: m.status,
            statusText: m.statusText || '',
            score: m.score,
            source: 'espn'
        }));
    } catch (e) {
        return [];
    }
}

function mergeFallbackIntoResults(results, espnMatches, sport) {
    if (!espnMatches.length) return;
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    espnMatches.forEach(espnM => {
        const eT1 = norm(espnM.team1?.name);
        const eT2 = norm(espnM.team2?.name);
        const idx = results[sport].findIndex(ex => {
            const xT1 = norm(ex.team1?.name);
            const xT2 = norm(ex.team2?.name);
            return (xT1 === eT1 && xT2 === eT2) || (xT1 === eT2 && xT2 === eT1);
        });
        const hasScore = v => v && v !== '-' && v !== '';
        if (idx >= 0) {
            const ex = results[sport][idx];
            if (espnM.status === 'live') ex.status = 'live';
            else if (espnM.status === 'finished' && ex.status === 'upcoming') ex.status = 'finished';
            if (espnM.statusText && espnM.statusText.length > (ex.statusText || '').length) ex.statusText = espnM.statusText;
            if (hasScore(espnM.score?.team1)) { ex.score = ex.score || {}; ex.score.team1 = espnM.score.team1; }
            if (hasScore(espnM.score?.team2)) { ex.score = ex.score || {}; ex.score.team2 = espnM.score.team2; }
            if (espnM.team1?.logo && !ex.team1?.logo) ex.team1.logo = espnM.team1.logo;
            if (espnM.team2?.logo && !ex.team2?.logo) ex.team2.logo = espnM.team2.logo;
        } else {
            results[sport].push(espnM);
        }
    });
}

async function fetchAllSports() {
    const sports = ['football', 'cricket', 'basketball', 'tennis'];
    const results = {
        football: [],
        cricket: [],
        basketball: [],
        mma: [],
        ufc: [],
        nfl: []
    };

    const promises = sports.map(async (sport) => {
        const matches = await fetchSportScore(sport, 30);
        return { sport, matches };
    });
    promises.push(
        fetchESPNCricketData().then(matches => ({ sport: 'espn_cricket', matches })),
        fetchCricAPIMatches().then(matches => ({ sport: 'cricapi_cricket', matches })),
        fetchCricketDataOrg().then(matches => ({ sport: 'cricketdata_cricket', matches })),
        fetchESPNFallback('football').then(matches => ({ sport: 'espn_football', matches })),
        fetchESPNFallback('basketball').then(matches => ({ sport: 'espn_basketball', matches })),
        fetchESPNFallback('nfl').then(matches => ({ sport: 'espn_nfl', matches }))
    );

    const allResults = await Promise.allSettled(promises);

    allResults.forEach(result => {
        if (result.status === 'fulfilled') {
            const { sport, matches } = result.value;
            if (sport === 'tennis') {
                results.tennis = matches;
            } else if (sport === 'espn_cricket' || sport === 'cricapi_cricket' || sport === 'google_cricket' || sport === 'cricketdata_cricket') {
                matches.forEach(m => {
                    const existingIdx = results.cricket.findIndex(e => {
                        const n = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        const eT1 = n(e.team1?.name), eT2 = n(e.team2?.name);
                        const mT1 = n(m.team1?.name), mT2 = n(m.team2?.name);
                        return (eT1 === mT1 && eT2 === mT2) || (eT1 === mT2 && eT2 === mT1);
                    });
                    if (existingIdx >= 0) {
                        const ex = results.cricket[existingIdx];
                        const hasScore = (v) => v && v !== '-' && v !== '';
                        if (m.status === 'live') ex.status = 'live';
                        if (m.statusText && m.statusText.length > (ex.statusText || '').length) ex.statusText = m.statusText;
                        if (hasScore(m.score?.team1)) { ex.score = ex.score || {}; ex.score.team1 = m.score.team1; }
                        if (hasScore(m.score?.team2)) { ex.score = ex.score || {}; ex.score.team2 = m.score.team2; }
                        if (m.overs?.team1) { ex.overs = ex.overs || {}; ex.overs.team1 = m.overs.team1; }
                        if (m.overs?.team2) { ex.overs = ex.overs || {}; ex.overs.team2 = m.overs.team2; }
                        if (m.innings && m.innings.some(arr => arr && arr.length > 0)) {
                            if (!ex.innings || !ex.innings.some(arr => arr && arr.length > 0)) {
                                ex.innings = m.innings;
                            }
                        }
                        if (m.team1?.logo && !ex.team1?.logo) ex.team1.logo = m.team1.logo;
                        if (m.team2?.logo && !ex.team2?.logo) ex.team2.logo = m.team2.logo;
            } else if (sport === 'espn_football') {
                mergeFallbackIntoResults(results, matches, 'football');
            } else if (sport === 'espn_basketball') {
                mergeFallbackIntoResults(results, matches, 'basketball');
            } else if (sport === 'espn_nfl') {
                mergeFallbackIntoResults(results, matches, 'nfl');
            } else {
                        results.cricket.push(m);
                    }
                });
            } else {
                results[sport] = matches;
            }
        }
    });

    return results;
}

function cleanTeamName(value) {
    let name = String(value ?? '');
    name = name
        .replace(/&quot;|&#34;|&#x22;/gi, '"')
        .replace(/&gt;|&#62;|&#x3e;/gi, '>')
        .replace(/&lt;|&#60;|&#x3c;/gi, '<')
        .replace(/&amp;/gi, '&');
    name = name.replace(/<[^>]*>/g, ' ');
    const lastGt = Math.max(name.lastIndexOf('>'), name.indexOf('&gt;'));
    if (lastGt !== -1 && lastGt < name.length - 1) {
        const after = name.slice(lastGt + 1).replace(/^\s*['"]?\s*/, '');
        if (after.length > 0 && after !== name) { name = after; }
    }
    for (let i = 0; i < 5; i++) {
        name = name.replace(/^\s*\S{1,20}\s*["']?\s*>\s*/i, '');
        name = name.replace(/^\s*\S{1,20}\s*["']?\s*&gt;\s*/i, '');
    }
    name = name.replace(/^[\s"'<>:;|]+|[\s"'<>:;|]+$/g, '');
    name = name.replace(/\s+/g, ' ').trim();
    return name;
}

// ===== August 2026 Verified Match Data =====
function getAugust2026Data() {
    const m = [];
    const add = (sport, date, t1, s1, t2, s2, league, venue, status, opts) => {
        const o = opts || {};
        m.push({ id:`aug_${m.length}`, sport, date, time:'19:00', venue:venue||'',
            league:league||sport.charAt(0).toUpperCase()+sport.slice(1),
            status:status||(s1&&s2?'finished':'upcoming'),
            team1:{name:t1,short:t1.slice(0,3).toUpperCase(),score:s1||'-'},
            team2:{name:t2,short:t2.slice(0,3).toUpperCase(),score:s2||'-'},
            score:{team1:s1||'-',team2:s2||'-'},
            overs: o.overs ? {team1:o.overs[0]||'',team2:o.overs[1]||''} : undefined,
            innings: o.innings || undefined,
            target: o.target || undefined,
            result: o.result || undefined });
    };

    // === FOOTBALL — La Liga (Aug 15-17) ===
    add('football','2026-08-15','R. Sociedad','2','Alaves','1','La Liga','San Sebastian','finished');
    add('football','2026-08-15','Valencia','1','Real Madrid','3','La Liga','Mestalla','finished');
    add('football','2026-08-16','R. Santander','2','Villarreal','2','La Liga','El Sardineros','finished');
    add('football','2026-08-16','Espanyol','3','Levante','0','La Liga','RCDE Stadium','finished');
    add('football','2026-08-17','Barcelona','3','Mallorca','1','La Liga','Camp Nou','finished');
    add('football','2026-08-17','Atletico Madrid','2','Girona','0','La Liga','Metropolitano','finished');

    // === FOOTBALL — English FA Community Shield (Aug 16) ===
    add('football','2026-08-16','Arsenal','3','Manchester City','0','FA Community Shield','Principality Stadium, Cardiff','finished');

    // === FOOTBALL — Championship (Aug 15-16) ===
    add('football','2026-08-16','Watford','2','Southampton','1','Championship','Vicarage Road','finished');
    add('football','2026-08-16','Burnley','2','West Ham','2','Championship','Turf Moor','finished');

    // === FOOTBALL — Ligue 1 (Aug 16) ===
    add('football','2026-08-16','Lens','1','Paris Saint-Germain','0','Ligue 1 Super Cup','Stade Bollaert-Delelis','finished');

    // === FOOTBALL — Coppa Italia (Aug 16) ===
    add('football','2026-08-16','Frosinone','4','Juve Stabia','1','Coppa Italia','Stadio Benito Stirpe','finished');
    add('football','2026-08-16','Genoa','4','Ascoli','1','Coppa Italia','Stadio Luigi Ferraris','finished');
    add('football','2026-08-16','Verona','2','Entella','2','Coppa Italia','Stadio Bentegodi','finished');
    add('football','2026-08-16','Lazio','0','Mantova','2','Coppa Italia','Stadio Olimpico','finished');

    // === FOOTBALL — 2. Bundesliga (Aug 16) ===
    add('football','2026-08-16','Arminia Bielefeld','3','Energie Cottbus','0','2. Bundesliga','SchücoArena','finished');
    add('football','2026-08-16','Dynamo Dresden','1','Darmstadt 98','0','2. Bundesliga','Rudolf-Harbig-Stadion','finished');
    add('football','2026-08-16','Hannover 96','0','Wolfsburg','1','2. Bundesliga','HDI-Arena','finished');

    // === FOOTBALL — MLS (Aug 15-16) ===
    add('football','2026-08-15','Atlanta Utd','2','NY Red Bulls','1','MLS','Mercedes-Benz Stadium','finished');
    add('football','2026-08-15','CF Montreal','1','DC United','1','MLS','Saputo Stadium','finished');
    add('football','2026-08-15','Charlotte FC','3','Columbus Crew','1','MLS','America First Field','finished');
    add('football','2026-08-15','Orlando City','1','FC Cincinnati','1','MLS','Exploria Stadium','finished');
    add('football','2026-08-15','Toronto','2','New England','1','MLS','BMO Field','finished');
    add('football','2026-08-16','Nashville SC','1','Inter Miami','0','MLS','GEODIS Park','finished');

    // === FOOTBALL — Liga MX (Aug 15-16) ===
    add('football','2026-08-15','Atlante','0','Toluca','5','Liga MX','Estadio Azteca','finished');
    add('football','2026-08-15','Monterrey','2','FC Juarez','0','Liga MX','Estadio BBVA','finished');
    add('football','2026-08-16','Pumas UNAM','2','Queretaro','1','Liga MX','Estadio Olimpico','finished');

    // === FOOTBALL — Brazilian Serie A (Aug 15-16) ===
    add('football','2026-08-15','Vasco da Gama','1','Santos','0','Serie A','Sao Januario','finished');
    add('football','2026-08-16','Mirassol','1','Flamengo','2','Serie A','Jose Maria de Campos Maia','finished');
    add('football','2026-08-16','Corinthians','0','Cruzeiro','0','Serie A','Neo Quimica Arena','finished');

    // === FOOTBALL — Argentina (Aug 16) ===
    add('football','2026-08-16','River Plate','3','Argentinos Juniors','1','Liga Profesional','Estadio Monumental','finished');

    // === CRICKET — Ireland vs Afghanistan ODI Series (Aug 5-15) ===
    add('cricket','2026-08-05','Ireland','-','Afghanistan','-','1st ODI, Afghanistan Tour of Ireland','Bready','finished',{result:'No result (abandoned)'});
    add('cricket','2026-08-07','Ireland','216','Afghanistan','308','2nd ODI, Afghanistan Tour of Ireland','Bready','finished',{overs:['46.2 ov','50.0 ov'],result:'Afghanistan won by 92 runs'});
    add('cricket','2026-08-10','Ireland','247/9','Afghanistan','250/7','3rd ODI, Afghanistan Tour of Ireland','Belfast','finished',{overs:['50.0 ov','48.4 ov'],result:'Afghanistan won by 3 wickets'});
    add('cricket','2026-08-12','Ireland','195','Afghanistan','237','4th ODI, Afghanistan Tour of Ireland','Belfast','finished',{overs:['44.1 ov','50.0 ov'],result:'Afghanistan won by 42 runs'});
    add('cricket','2026-08-15','Ireland','243','Afghanistan','247/4','5th ODI, Afghanistan Tour of Ireland','Belfast','finished',{overs:['49.2 ov','44.3 ov'],result:'Afghanistan won by 6 wickets'});

    // === CRICKET — Scotland Tri-Nation Series (Aug 3-13) ===
    add('cricket','2026-08-03','Scotland','-','UAE','-','ICC CWC League 2, Round 21','Dundee','finished',{result:'Abandoned'});
    add('cricket','2026-08-05','Canada','-','UAE','-','ICC CWC League 2, Round 21','Dundee','finished',{result:'Abandoned'});
    add('cricket','2026-08-07','Scotland','278','Canada','269','ICC CWC League 2, Round 21','Dundee','finished',{result:'Scotland won by 9 runs'});
    add('cricket','2026-08-09','Scotland','245/9','UAE','244','ICC CWC League 2, Round 21','Dundee','finished',{result:'Scotland won by 1 wicket'});
    add('cricket','2026-08-11','Canada','189','UAE','286','ICC CWC League 2, Round 21','Dundee','finished',{result:'UAE won by 97 runs'});
    add('cricket','2026-08-13','Scotland','342','Canada','172','ICC CWC League 2, Round 21','Dundee','finished',{result:'Scotland won by 170 runs'});

    // === CRICKET — Australia vs Bangladesh 1st Test (Aug 13-16) ===
    add('cricket','2026-08-13','Australia','-','Bangladesh','-','1st Test, Bangladesh Tour of Australia','Darwin','finished',{innings:[[{runs:'198',overs:'53.0'},{runs:'284',overs:'95.1'}],[{runs:'426',overs:'138.0'},{runs:'57/1',overs:'14.3'}]],target:'57',result:'Bangladesh won by 9 wickets'});
    add('cricket','2026-08-14','Australia','-','Bangladesh','-','1st Test, Bangladesh Tour of Australia','Darwin','finished',{innings:[[{runs:'198',overs:'53.0'},{runs:'284',overs:'95.1'}],[{runs:'426',overs:'138.0'},{runs:'57/1',overs:'14.3'}]],target:'57',result:'Bangladesh won by 9 wickets'});
    add('cricket','2026-08-15','Australia','-','Bangladesh','-','1st Test, Bangladesh Tour of Australia','Darwin','finished',{innings:[[{runs:'198',overs:'53.0'},{runs:'284',overs:'95.1'}],[{runs:'426',overs:'138.0'},{runs:'57/1',overs:'14.3'}]],target:'57',result:'Bangladesh won by 9 wickets'});
    add('cricket','2026-08-16','Australia','-','Bangladesh','-','1st Test, Bangladesh Tour of Australia','Darwin','finished',{innings:[[{runs:'198',overs:'53.0'},{runs:'284',overs:'95.1'}],[{runs:'426',overs:'138.0'},{runs:'57/1',overs:'14.3'}]],target:'57',result:'Bangladesh won by 9 wickets'});

    // === CRICKET — India vs Sri Lanka 1st Test (Aug 15-19) ===
    add('cricket','2026-08-15','India','-','Sri Lanka','-','1st Test, India Tour of Sri Lanka','Galle','finished',{innings:[[{runs:'180/3',overs:'52.0'}],[]],target:'',result:'Stumps Day 1'});
    add('cricket','2026-08-16','India','-','Sri Lanka','-','1st Test, India Tour of Sri Lanka','Galle','finished',{innings:[[{runs:'462',overs:'115.4'}],[]],target:'',result:'Stumps Day 2'});
    add('cricket','2026-08-17','India','-','Sri Lanka','-','1st Test, India Tour of Sri Lanka','Galle','finished',{innings:[[{runs:'462',overs:'115.4'}],[{runs:'284',overs:'79.4'}]],target:'',result:'Stumps Day 3'});
    add('cricket','2026-08-18','India','-','Sri Lanka','-','1st Test, India Tour of Sri Lanka','Galle','finished',{innings:[[{runs:'462',overs:'115.4'}],[{runs:'284',overs:'79.4'},{runs:'84/4',overs:'34.0'}]],target:'372',result:'Stumps Day 4'});
    add('cricket','2026-08-19','India','-','Sri Lanka','-','1st Test, India Tour of Sri Lanka','Galle','finished',{innings:[[{runs:'462',overs:'115.4'},{runs:'193',overs:'58.2'}],[{runs:'284',overs:'79.4'},{runs:'84/4',overs:'34.0'}]],target:'372',result:'India won by 277 runs'});

    // === CRICKET — England vs Pakistan 1st Test (Aug 19-23) ===
    add('cricket','2026-08-19','England','-','Pakistan','-','1st Test, Pakistan Tour of England','Headingley, Leeds','finished',{innings:[[{runs:'320/6',overs:'89.0'}],[]],target:'',result:'Stumps Day 1'});
    add('cricket','2026-08-20','England','-','Pakistan','-','1st Test, Pakistan Tour of England','Headingley, Leeds','finished',{innings:[[{runs:'385',overs:'98.3'}],[{runs:'120/4',overs:'38.0'}]],target:'',result:'Stumps Day 2'});
    add('cricket','2026-08-21','England','-','Pakistan','-','1st Test, Pakistan Tour of England','Headingley, Leeds','finished',{innings:[[{runs:'385',overs:'98.3'},{runs:'89/2',overs:'24.0'}],[{runs:'274',overs:'82.1'}]],target:'',result:'Stumps Day 3'});
    add('cricket','2026-08-22','England','-','Pakistan','-','1st Test, Pakistan Tour of England','Headingley, Leeds','finished',{innings:[[{runs:'385',overs:'98.3'},{runs:'195/6d',overs:'52.0'}],[{runs:'274',overs:'82.1'},{runs:'143',overs:'48.4'}]],target:'112',result:'England won by 63 runs'});
    add('cricket','2026-08-23','England','-','Pakistan','-','1st Test, Pakistan Tour of England','Headingley, Leeds','upcoming',{innings:[[],[]],target:'',result:''});

    // === CRICKET — Australia vs Bangladesh 2nd Test (Aug 22-26) ===
    add('cricket','2026-08-22','Australia','-','Bangladesh','-','2nd Test, Bangladesh Tour of Australia','Mackay','finished',{innings:[[{runs:'285/5',overs:'78.0'}],[]],target:'',result:'Stumps Day 1'});
    add('cricket','2026-08-23','Australia','-','Bangladesh','-','2nd Test, Bangladesh Tour of Australia','Mackay','upcoming',{innings:[[],[]],target:''});
    add('cricket','2026-08-24','Australia','-','Bangladesh','-','2nd Test, Bangladesh Tour of Australia','Mackay','upcoming',{innings:[[],[]],target:''});
    add('cricket','2026-08-25','Australia','-','Bangladesh','-','2nd Test, Bangladesh Tour of Australia','Mackay','upcoming',{innings:[[],[]],target:''});
    add('cricket','2026-08-26','Australia','-','Bangladesh','-','2nd Test, Bangladesh Tour of Australia','Mackay','upcoming',{innings:[[],[]],target:''});

    // === CRICKET — India vs Sri Lanka 2nd Test (Aug 23-27) ===
    add('cricket','2026-08-23','India','-','Sri Lanka','-','2nd Test, India Tour of Sri Lanka','Colombo (SSC)','upcoming',{innings:[[],[]],target:''});
    add('cricket','2026-08-24','India','-','Sri Lanka','-','2nd Test, India Tour of Sri Lanka','Colombo (SSC)','upcoming',{innings:[[],[]],target:''});
    add('cricket','2026-08-25','India','-','Sri Lanka','-','2nd Test, India Tour of Sri Lanka','Colombo (SSC)','upcoming',{innings:[[],[]],target:''});
    add('cricket','2026-08-26','India','-','Sri Lanka','-','2nd Test, India Tour of Sri Lanka','Colombo (SSC)','upcoming',{innings:[[],[]],target:''});
    add('cricket','2026-08-27','India','-','Sri Lanka','-','2nd Test, India Tour of Sri Lanka','Colombo (SSC)','upcoming',{innings:[[],[]],target:''});

    // === CRICKET — England vs Pakistan 2nd Test (Aug 27-31) ===
    add('cricket','2026-08-27','England','-','Pakistan','-','2nd Test, Pakistan Tour of England','Lord\'s, London','upcoming',{innings:[[],[]],target:''});
    add('cricket','2026-08-28','England','-','Pakistan','-','2nd Test, Pakistan Tour of England','Lord\'s, London','upcoming',{innings:[[],[]],target:''});
    add('cricket','2026-08-29','England','-','Pakistan','-','2nd Test, Pakistan Tour of England','Lord\'s, London','upcoming',{innings:[[],[]],target:''});
    add('cricket','2026-08-30','England','-','Pakistan','-','2nd Test, Pakistan Tour of England','Lord\'s, London','upcoming',{innings:[[],[]],target:''});
    add('cricket','2026-08-31','England','-','Pakistan','-','2nd Test, Pakistan Tour of England','Lord\'s, London','upcoming',{innings:[[],[]],target:''});

    // === NFL PRESEASON WEEK 1 (Aug 13-15) ===
    add('nfl','2026-08-13','Bengals','16','Lions','14','NFL Preseason Week 1','Paycor Stadium','finished');
    add('nfl','2026-08-13','Steelers','28','Packers','9','NFL Preseason Week 1','Acrisure Stadium','finished');
    add('nfl','2026-08-13','Patriots','13','Colts','13','NFL Preseason Week 1','Gillette Stadium','finished');
    add('nfl','2026-08-13','Chargers','27','Texans','7','NFL Preseason Week 1','SoFi Stadium','finished');
    add('nfl','2026-08-13','Raiders','14','Cardinals','27','NFL Preseason Week 1','Allegiant Stadium','finished');
    add('nfl','2026-08-13','49ers','13','Titans','19','NFL Preseason Week 1','Levi\'s Stadium','finished');
    add('nfl','2026-08-14','Broncos','27','Falcons','7','NFL Preseason Week 1','Empower Field','finished');
    add('nfl','2026-08-14','Buccaneers','24','Jets','16','NFL Preseason Week 1','Raymond James Stadium','finished');
    add('nfl','2026-08-14','Commanders','20','Dolphins','7','NFL Preseason Week 1','FedExField','finished');
    add('nfl','2026-08-15','Bills','29','Panthers','14','NFL Preseason Week 1','Highmark Stadium','finished');
    add('nfl','2026-08-15','Bears','34','Browns','10','NFL Preseason Week 1','Soldier Field','finished');
    add('nfl','2026-08-15','Vikings','13','Giants','10','NFL Preseason Week 1','U.S. Bank Stadium','finished');
    add('nfl','2026-08-15','Chiefs','12','Rams','20','NFL Preseason Week 1','Arrowhead Stadium','finished');
    add('nfl','2026-08-15','Saints','20','Jaguars','24','NFL Preseason Week 1','Caesars Superdome','finished');
    add('nfl','2026-08-15','Ravens','24','Eagles','7','NFL Preseason Week 1','M&T Bank Stadium','finished');
    add('nfl','2026-08-15','Seahawks','7','Cowboys','17','NFL Preseason Week 1','Lumen Field','finished');

    // === NFL PRESEASON WEEK 2 (Aug 20-22) ===
    add('nfl','2026-08-20','Texans','24','Raiders','17','NFL Preseason Week 2','NRG Stadium','finished');
    add('nfl','2026-08-20','Chargers','31','49ers','21','NFL Preseason Week 2','SoFi Stadium','finished');
    add('nfl','2026-08-21','Steelers','17','Jets','14','NFL Preseason Week 2','Acrisure Stadium','finished');
    add('nfl','2026-08-21','Jaguars','20','Panthers','10','NFL Preseason Week 2','EverBank Stadium','finished');
    add('nfl','2026-08-21','Broncos','14','Packers','21','NFL Preseason Week 2','Empower Field','finished');
    add('nfl','2026-08-22','Lions','-','Commanders','-','NFL Preseason Week 2','Ford Field','upcoming');
    add('nfl','2026-08-22','Browns','-','Bills','-','NFL Preseason Week 2','Cleveland Browns Stadium','upcoming');
    add('nfl','2026-08-22','Colts','-','Falcons','-','NFL Preseason Week 2','Lucas Oil Stadium','upcoming');
    add('nfl','2026-08-22','Vikings','-','Ravens','-','NFL Preseason Week 2','U.S. Bank Stadium','upcoming');
    add('nfl','2026-08-22','Rams','-','Saints','-','NFL Preseason Week 2','SoFi Stadium','upcoming');
    add('nfl','2026-08-22','Dolphins','-','Giants','-','NFL Preseason Week 2','Hard Rock Stadium','upcoming');
    add('nfl','2026-08-22','Bengals','-','Bears','-','NFL Preseason Week 2','Paycor Stadium','upcoming');
    add('nfl','2026-08-22','Patriots','-','Eagles','-','NFL Preseason Week 2','Gillette Stadium','upcoming');
    add('nfl','2026-08-22','Buccaneers','-','Chiefs','-','NFL Preseason Week 2','Raymond James Stadium','upcoming');
    add('nfl','2026-08-22','Cardinals','-','Cowboys','-','NFL Preseason Week 2','State Farm Stadium','upcoming');
    add('nfl','2026-08-23','Titans','-','Seahawks','-','NFL Preseason Week 2','Nissan Stadium','upcoming');

    // === NFL PRESEASON WEEK 3 (Aug 27-29) ===
    add('nfl','2026-08-27','Bills','-','Steelers','-','NFL Preseason Week 3','Highmark Stadium','upcoming');
    add('nfl','2026-08-27','Browns','-','Patriots','-','NFL Preseason Week 3','Cleveland Browns Stadium','upcoming');
    add('nfl','2026-08-27','Raiders','-','49ers','-','NFL Preseason Week 3','Allegiant Stadium','upcoming');
    add('nfl','2026-08-27','Chargers','-','Rams','-','NFL Preseason Week 3','SoFi Stadium','upcoming');
    add('nfl','2026-08-28','Ravens','-','Commanders','-','NFL Preseason Week 3','M&T Bank Stadium','upcoming');
    add('nfl','2026-08-28','Dolphins','-','Falcons','-','NFL Preseason Week 3','Hard Rock Stadium','upcoming');
    add('nfl','2026-08-28','Panthers','-','Texans','-','NFL Preseason Week 3','Bank of America Stadium','upcoming');
    add('nfl','2026-08-28','Jets','-','Giants','-','NFL Preseason Week 3','MetLife Stadium','upcoming');
    add('nfl','2026-08-28','Jaguars','-','Buccaneers','-','NFL Preseason Week 3','EverBank Stadium','upcoming');
    add('nfl','2026-08-28','Cowboys','-','Saints','-','NFL Preseason Week 3','AT&T Stadium','upcoming');
    add('nfl','2026-08-28','Packers','-','Cardinals','-','NFL Preseason Week 3','Lambeau Field','upcoming');
    add('nfl','2026-08-28','Chiefs','-','Seahawks','-','NFL Preseason Week 3','Arrowhead Stadium','upcoming');
    add('nfl','2026-08-28','Eagles','-','Bengals','-','NFL Preseason Week 3','Lincoln Financial Field','upcoming');
    add('nfl','2026-08-28','Broncos','-','Vikings','-','NFL Preseason Week 3','Empower Field','upcoming');
    add('nfl','2026-08-29','Colts','-','Lions','-','NFL Preseason Week 3','Lucas Oil Stadium','upcoming');
    add('nfl','2026-08-29','Bears','-','Titans','-','NFL Preseason Week 3','Soldier Field','upcoming');

    // === UFC/MMA (August 2026) ===
    add('ufc','2026-08-01','Uros Medic','KO R1','Daniel Rodriguez','-','UFC Belgrade','Belgrade Arena, Serbia','finished');
    add('ufc','2026-08-07','Bryan Battle','SD','Dalton Rosta','-','PFL Charlotte','Bojangles Coliseum, Charlotte','finished');
    add('ufc','2026-08-08','Quillan Salkilld','SUB R1','Mateusz Gamrot','-','UFC Vegas 120','Meta APEX, Las Vegas','finished');
    add('ufc','2026-08-15','Islam Makhachev','UD','Ian Machado Garry','-','UFC 330','Xfinity Mobile Arena, Philadelphia','finished');
    add('ufc','2026-08-15','Mackenzie Dern','UD','Gillian Robertson','-','UFC 330 Strawweight Title','Xfinity Mobile Arena, Philadelphia','finished');
    add('ufc','2026-08-22','Anthony Hernandez','-','Gregory Rodrigues','-','UFC Sacramento','Golden 1 Center, Sacramento','upcoming');
    add('ufc','2026-08-29','Umar Nurmagomedov','-','Song Yadong','-','UFC Shanghai','Oriental Sports Center, Shanghai','upcoming');

    // === TENNIS — US Open Qualifying (Aug 24-27) ===
    add('tennis','2026-08-24','TBA','-','TBA','-','US Open Qualifying R1','Flushing Meadows, New York','upcoming');
    add('tennis','2026-08-25','TBA','-','TBA','-','US Open Qualifying R1','Flushing Meadows, New York','upcoming');
    add('tennis','2026-08-26','TBA','-','TBA','-','US Open Qualifying R2','Flushing Meadows, New York','upcoming');
    add('tennis','2026-08-27','TBA','-','TBA','-','US Open Qualifying R3','Flushing Meadows, New York','upcoming');
    add('tennis','2026-08-30','TBA','-','TBA','-','US Open 1st Round','Flushing Meadows, New York','upcoming');
    add('tennis','2026-08-31','TBA','-','TBA','-','US Open 1st Round','Flushing Meadows, New York','upcoming');

    return m;
}

function filterAugust2026(dateStr, sport) {
    if (!dateStr.startsWith('2026-08')) return [];
    const all = getAugust2026Data();
    if (sport) return all.filter(m => m.date === dateStr && m.sport === sport);
    return all.filter(m => m.date === dateStr);
}

async function autoFetchMatches() {
    try {
        const result = await fetchAllSports();
        LIVE_MATCHES = result;
        return result;
    } catch (e) {
        console.log('⚠️ Auto-fetch failed:', e.message);
        return { football:[], cricket:[], basketball:[], tennis:[], mma:[], ufc:[], nfl:[] };
    }
}

function convertSportSRCMatch(match, category) {
    const matchDate = new Date(match.date).toLocaleDateString('en-CA');
    const matchTime = new Date(match.date).toTimeString().slice(0, 5);
    const t1name = cleanTeamName(match.teams?.home?.name || 'Home Team');
    const t2name = cleanTeamName(match.teams?.away?.name || 'Away Team');
    const stableId = match.id || `src-${category}-${matchDate}-${matchTime}-${t1name}-${t2name}`.toLowerCase().replace(/\s+/g,'-');

    const categoryNames = {
        'football': 'Football',
        'cricket': 'Cricket',
        'basketball': 'Basketball',
        'tennis': 'Tennis',
        'mma': 'MMA',
        'ufc': 'UFC',
        'nfl': 'NFL'
    };

    return {
        id: stableId,
        sport: category,
        icon: getSportIcon(category),
        team1: {
            name: cleanTeamName(match.teams?.home?.name || 'Home Team'),
            short: cleanTeamName(match.teams?.home?.name || 'HOME').slice(0, 3).toUpperCase(),
            logo: match.teams?.home?.badge || '',
            flag: ''
        },
        team2: {
            name: cleanTeamName(match.teams?.away?.name || 'Away Team'),
            short: cleanTeamName(match.teams?.away?.name || 'AWAY').slice(0, 3).toUpperCase(),
            logo: match.teams?.away?.badge || '',
            flag: ''
        },
        league: cleanTeamName(match.league?.name || match.tournament?.name || match.competition?.name || categoryNames[category] || category),
        venue: cleanTeamName(match.venue?.name || ''),
        date: matchDate,
        time: matchTime,
        status: 'upcoming',
        statusText: 'Scheduled',
        score: { team1: '-', team2: '-' }
    };
}

async function fetchSportSRC(dateStr) {
    const cached = getCachedData(dateStr);
    if (cached) {
        console.log(`📦 Using cached data for ${dateStr}`);
        return cached;
    }

    const categories = ['football', 'cricket', 'basketball', 'tennis'];
    const results = { football: [], cricket: [], basketball: [], tennis: [], mma: [], ufc: [], nfl: [] };

    for (const cat of categories) {
        try {
            const url = `${SPORTSRC_URL}?data=matches&category=${cat}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) continue;
            const json = await res.json();
            const items = json.data || json.items || json || [];
            const dayMatches = items.filter(m => {
                const d = new Date(m.date).toLocaleDateString('en-CA');
                return d === dateStr;
            }).map(m => convertSportSRCMatch(m, cat));

            if (cat === 'tennis') {
                results.tennis = dayMatches;
            } else {
                results[cat] = dayMatches;
            }
        } catch (e) {
            console.log(`⚠️ SportSRC ${cat} failed: ${e.message}`);
        }
    }

    // Fetch NFL from nfldata.org
    const nflMatches = await fetchNFLData(dateStr);
    
    // Fetch UFC/MMA from TheSportsDB
    const ufcMatches = await fetchTheSportsDB('ufc', dateStr);
    
    results.nfl = nflMatches;
    results.ufc = ufcMatches;
    results.mma = [];

    results.source = 'sportsrc';
    setCachedData(dateStr, results);
    return results;
}

function findPreviousDayLiveMatches(today) {
    return [];
}

function _mergePrevLiveMatches(today, matches) {
    return matches;
}

function applyOverridesToDate(matches, dateStr) {
    try {
        const overrides = JSON.parse(localStorage.getItem('admin_match_overrides') || '{}');
        const customs = JSON.parse(localStorage.getItem('admin_custom_matches') || '[]');
        const result = [...matches];
        result.forEach(m => {
            if (m.id && overrides[m.id]) {
                const o = overrides[m.id];
                if (o._deleted) { m._deleted = true; return; }
                if (o.team1) m.team1 = { ...m.team1, ...o.team1 };
                if (o.team2) m.team2 = { ...m.team2, ...o.team2 };
                if (o.score) m.score = o.score;
                if (o.status) m.status = o.status;
                if (o.league) m.league = o.league;
                if (o.venue) m.venue = o.venue;
                if (o.result) m.result = o.result;
                if (o.time) m.time = o.time;
            }
        });
        customs.forEach(c => {
            if (c.date === dateStr && !result.find(x => x.id === c.id)) result.push(c);
        });
        return result.filter(m => !m._deleted);
    } catch (e) { return matches; }
}

function getMatchesForDate(dateStr) {
    const today = getTodayString();

    if (DATE_CACHE[dateStr]) {
        const cache = DATE_CACHE[dateStr];
        const matches = [
            ...(cache.cricket || []),
            ...(cache.football || []),
            ...(cache.basketball || []),
            ...(cache.tennis || []),
            ...(cache.mma || []),
            ...(cache.ufc || []),
            ...(cache.nfl || [])
        ].filter(m => m.date === dateStr);

        if (dateStr === today) _mergePrevLiveMatches(today, matches);
        return matches;
    }
    
    if (dateStr === today && LIVE_MATCHES && (LIVE_MATCHES.cricket?.length || LIVE_MATCHES.football?.length || LIVE_MATCHES.nfl?.length || LIVE_MATCHES.ufc?.length)) {
        const matches = [
            ...(LIVE_MATCHES.cricket || []),
            ...(LIVE_MATCHES.football || []),
            ...(LIVE_MATCHES.basketball || []),
            ...(LIVE_MATCHES.tennis || []),
            ...(LIVE_MATCHES.mma || []),
            ...(LIVE_MATCHES.ufc || []),
            ...(LIVE_MATCHES.nfl || [])
        ].filter(m => m.date === dateStr);

        _mergePrevLiveMatches(today, matches);
        return matches;
    }
    
    const cached = getCachedData(dateStr);
    if (cached) {
        DATE_CACHE[dateStr] = cached;
        const matches = [
            ...(cached.cricket || []),
            ...(cached.football || []),
            ...(cached.basketball || []),
            ...(cached.tennis || []),
            ...(cached.mma || []),
            ...(cached.ufc || []),
            ...(cached.nfl || [])
        ].filter(m => m.date === dateStr);

        if (dateStr === today) _mergePrevLiveMatches(today, matches);
        return matches;
    }
    
    const augData = filterAugust2026(dateStr);
    if (augData.length) {
        if (dateStr === today) _mergePrevLiveMatches(today, augData);
        return applyOverridesToDate(augData, dateStr);
    }

    return applyOverridesToDate([], dateStr);
}

async function fetchMatchesForDate(dateStr) {
    try {
        const results = { football:[], cricket:[], basketball:[], tennis:[], mma:[], ufc:[], nfl:[] };

        const sports = ['football', 'cricket', 'basketball', 'tennis'];
        const promises = sports.map(async (sport) => {
            try {
                const matches = await fetchSportScore(sport, 30);
                const dayMatches = matches.filter(m => m.date === dateStr);
                return { sport, matches: dayMatches };
            } catch(e) {
                return { sport, matches: [] };
            }
        });

        const allResults = await Promise.allSettled(promises);
        allResults.forEach(result => {
            if (result.status === 'fulfilled') {
                const { sport, matches } = result.value;
                if (sport === 'tennis') {
                    results.tennis = matches;
                } else {
                    results[sport] = matches;
                }
            }
        });

        try {
            const nflMatches = await fetchNFLData(dateStr);
            results.nfl = nflMatches;
        } catch(e) {}

        return results;
    } catch(e) {
        console.log('⚠️ fetchMatchesForDate failed:', e.message);
        return { football:[], cricket:[], basketball:[], tennis:[], mma:[], ufc:[], nfl:[] };
    }
}

async function preCacheUpcomingDays() {
    console.log('📦 Pre-cache disabled');
}

function getAllMatches() {
    const today = getTodayString();
    return getMatchesForDate(today);
}

function getMatchesBySport(sport) {
    if (sport === 'all') {
        return getAllMatches();
    }
    const today = getTodayString();
    const cache = DATE_CACHE[today] || LIVE_MATCHES;
    if (cache && cache[sport]) {
        return cache[sport];
    }
    return [];
}

function setApiKey(key) {
    console.log('API key set (not used in SportScore)');
}

// ===== TheSportsDB API (UFC/MMA) =====

const THESPORTSDB_LEAGUE_MAP = {
    'ufc': '4443',
    'mma': '4443'
};

async function fetchTheSportsDB(sport, dateStr) {
    const leagueId = THESPORTSDB_LEAGUE_MAP[sport];
    
    if (!leagueId) return [];
    
    try {
        let events = [];
        
        const url = `${THESPORTSDB_BASE}/eventsseason.php?id=${leagueId}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
            const json = await res.json();
            if (json.events) {
                const targetDate = new Date(dateStr);
                const weekBefore = new Date(targetDate);
                weekBefore.setDate(weekBefore.getDate() - 7);
                const weekAfter = new Date(targetDate);
                weekAfter.setDate(weekAfter.getDate() + 30);
                
                events = json.events.filter(e => {
                    const eventDate = new Date(e.strTimestamp);
                    return eventDate >= weekBefore && eventDate <= weekAfter;
                });
            }
        }
        
        return events.map(e => convertTheSportsDBMatch(e, sport));
    } catch (e) {
        console.log(`ℹ️ TheSportsDB ${sport}: ${e.message}`);
        return [];
    }
}

function convertTheSportsDBMatch(event, sport) {
    const eventDate = event.strTimestamp ? new Date(event.strTimestamp) : new Date();
    const matchDate = eventDate.toLocaleDateString('en-CA');
    const matchTime = eventDate.toTimeString().slice(0, 5);
    
    const eventTitle = event.strEvent || 'TBA vs TBA';
    const parts = eventTitle.split(' vs ');
    const team1Name = cleanTeamName(parts[0] ? parts[0].trim() : 'TBA');
    const team2Name = cleanTeamName(parts[1] ? parts[1].trim() : 'TBA');
    
    let status = 'upcoming';
    const now = new Date();
    if (eventDate < now) {
        const hoursDiff = (now - eventDate) / (1000 * 60 * 60);
        if (hoursDiff > 3) {
            status = 'finished';
        } else {
            status = 'live';
        }
    }
    
    return {
        id: event.idEvent || `tsdb-${sport}-${matchDate}-${matchTime}-${team1Name}-${team2Name}`.toLowerCase().replace(/\s+/g,'-'),
        sport: sport,
        icon: getSportIcon(sport),
        team1: {
            name: team1Name,
            short: team1Name.slice(0, 3).toUpperCase(),
            logo: event.strThumb || '',
            flag: ''
        },
        team2: {
            name: team2Name,
            short: team2Name.slice(0, 3).toUpperCase(),
            logo: event.strThumb || '',
            flag: ''
        },
        league: event.strLeague || sport.toUpperCase(),
        venue: event.strVenue || '',
        date: matchDate,
        time: matchTime,
        status: status,
        statusText: event.strStatus || '',
        score: {
            team1: event.intHomeScore || '-',
            team2: event.intAwayScore || '-'
        }
    };
}

// ===== CricAPI (cricketdata.org) - International Cricket =====

function setCricketApiKey(key) {
    CRICKET_API_KEY = key;
    console.log('🏏 Cricket API key set (session only)');
}

async function fetchCricAPIMatches() {
    if (!CRICKET_API_KEY) return [];
    
    try {
        const res = await fetch(`${CRICKET_API_BASE}/currentMatches?apikey=${CRICKET_API_KEY}&offset=0`);
        if (!res.ok) {
            console.log(`ℹ️ CricAPI: HTTP ${res.status}`);
            return [];
        }
        const json = await res.json();
        if (json.status !== 'success' || !json.data) {
            console.log(`ℹ️ CricAPI: ${json.reason || 'no data'}`);
            return [];
        }
        
        return json.data.map(m => convertCricAPIMatch(m));
    } catch (e) {
        console.log(`ℹ️ CricAPI: ${e.message}`);
        return [];
    }
}

function convertCricAPIMatch(match) {
    const matchDate = match.dateTimeGMT ? new Date(match.dateTimeGMT).toLocaleDateString('en-CA') : getTodayString();
    const matchTime = match.dateTimeGMT ? new Date(match.dateTimeGMT).toTimeString().slice(0, 5) : '00:00';
    
    const teams = match.teams || ['TBA', 'TBA'];
    const team1Name = teams[0] || 'TBA';
    const team2Name = teams[1] || 'TBA';
    
    let status = 'upcoming';
    const statusLower = (match.status || '').toLowerCase();
    if (statusLower.includes('live') || statusLower.includes('stump') || statusLower.includes('innings')) {
        status = 'live';
    } else if (statusLower.includes('won') || statusLower.includes('draw') || statusLower.includes('tie') || statusLower.includes('result') || statusLower.includes('complete')) {
        status = 'finished';
    }
    
    const score = match.score || [];
    const score1 = score[0];
    const score2 = score[1];
    
    return {
        id: match.id ? `cric_${match.id}` : `cric-${matchDate}-${matchTime}-${team1Name}-${team2Name}`.toLowerCase().replace(/\s+/g,'-'),
        sport: 'cricket',
        icon: getSportIcon('cricket'),
        team1: {
            name: team1Name,
            short: team1Name.slice(0, 3).toUpperCase(),
            logo: '',
            flag: ''
        },
        team2: {
            name: team2Name,
            short: team2Name.slice(0, 3).toUpperCase(),
            logo: '',
            flag: ''
        },
        league: cleanTeamName(match.name || match.series_id || 'Cricket'),
        competitionLogo: '',
        venue: match.venue || '',
        date: matchDate,
        time: matchTime,
        status: status,
        statusText: match.status || '',
        score: {
            team1: score1 ? `${score1.r || 0}/${score1.w || 0}` : '-',
            team2: score2 ? `${score2.r || 0}/${score2.w || 0}` : '-'
        },
        overs: {
            team1: score1 ? `${score1.o || 0}` : '',
            team2: score2 ? `${score2.o || 0}` : ''
        }
    };
}

// ===== CricketData.org API =====

async function fetchCricketDataOrg() {
    try {
        const res = await fetch('/api/cricketdata', { signal: AbortSignal.timeout(8000) });
        if (!res.ok) {
            console.log(`ℹ️ CricketData.org: HTTP ${res.status}`);
            return [];
        }
        const data = await res.json();
        
        return data.map(m => {
            const matchDate = m.d ? m.d.split('T')[0] : getTodayString();
            const matchTime = m.d ? new Date(m.d).toTimeString().slice(0, 5) : '00:00';
            
            let status = 'upcoming';
            if (m.ms === 'live') status = 'live';
            else if (m.ms === 'result') status = 'finished';
            
            const parseScore = (raw) => {
                if (!raw) return '-';
                const cleaned = raw.replace(/\?/g, '').trim();
                return cleaned || '-';
            };
            
            return {
                id: m.id ? `cdorg_${m.id}` : `cdorg-${matchDate}-${matchTime}-${m.t1}-${m.t2}`.toLowerCase().replace(/\s+/g,'-'),
                sport: 'cricket',
                icon: getSportIcon('cricket'),
                team1: {
                    name: m.t1n || m.t1 || 'TBA',
                    short: (m.t1 || 'TBA').slice(0, 3).toUpperCase(),
                    logo: m.t1i ? `https://cricketdata.org/iapi/${m.t1i}?w=48` : '',
                    flag: ''
                },
                team2: {
                    name: m.t2n || m.t2 || 'TBA',
                    short: (m.t2 || 'TBA').slice(0, 3).toUpperCase(),
                    logo: m.t2i ? `https://cricketdata.org/iapi/${m.t2i}?w=48` : '',
                    flag: ''
                },
                league: cleanTeamName(m.t || 'Cricket'),
                venue: '',
                date: matchDate,
                time: matchTime,
                status: status,
                statusText: m.s || '',
                score: {
                    team1: parseScore(m.t1s),
                    team2: parseScore(m.t2s)
                }
            };
        });
    } catch (e) {
        console.log(`⚠️ CricketData.org failed: ${e.message}`);
        return [];
    }
}

// ===== ESPN Cricket API (Personalized Header) =====

async function fetchESPNCricketData() {
    try {
        const res = await fetch('/api/google-cricket', { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`ESPN Cricket HTTP ${res.status}`);
        const data = await res.json();
        
        const leagues = data?.sports?.[0]?.leagues || [];
        const allMatches = [];
        
        for (const league of leagues) {
            const leagueName = league.name || 'Cricket';
            const leagueId = league.id || '';
            const events = league.events || [];
            
            for (const event of events) {
                const converted = convertESPNCricketMatch(event, leagueName, leagueId);
                if (converted) allMatches.push(converted);
            }
        }
        
        console.log(`✅ ESPN Cricket: ${allMatches.length} matches from ${leagues.length} series`);
        return allMatches;
    } catch (e) {
        console.log(`⚠️ ESPN Cricket failed: ${e.message}`);
        return [];
    }
}

function convertESPNCricketMatch(event, leagueName, leagueId) {
    if (!event || !event.name) return null;
    
    const eventDate = event.date ? new Date(event.date).toLocaleDateString('en-CA') : getTodayString();
    const eventTime = event.date ? new Date(event.date).toTimeString().slice(0, 5) : '00:00';
    
    const competitors = event.competitors || [];
    const team1 = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
    const team2 = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
    
    let status = 'upcoming';
    const state = event.fullStatus?.type?.state || event.status || '';
    if (state === 'in') status = 'live';
    else if (state === 'post') status = 'finished';
    
    let statusText = event.fullStatus?.type?.description || event.summary || '';
    if (status === 'finished' && event.fullStatus?.longSummary) {
        statusText = event.fullStatus.longSummary;
    }
    
    const team1Raw = team1.score || '';
    const team2Raw = team2.score || '';
    const t1OvMatch = team1Raw.match(/\((\d+\.?\d*)\s*ov\)/);
    const t2OvMatch = team2Raw.match(/\((\d+\.?\d*)\s*ov\)/);
    const team1Score = team1Raw.replace(/\s*\([^)]*\)\s*$/, '').trim() || '-';
    const team2Score = team2Raw.replace(/\s*\([^)]*\)\s*$/, '').trim() || '-';
    const team1Overs = t1OvMatch ? t1OvMatch[1] : '';
    const team2Overs = t2OvMatch ? t2OvMatch[1] : '';



    const session = event.fullStatus?.session || '';
    const dayNum = event.fullStatus?.dayNumber || '';
    let statusLabel = statusText;
    if (session) statusLabel = session + (statusLabel ? ' - ' + statusLabel : '');
    else if (dayNum && status === 'live') statusLabel = 'Day ' + dayNum + (statusLabel ? ' - ' + statusLabel : '');

    return {
        id: `espn_crick_${event.id}`,
        sport: 'cricket',
        icon: getSportIcon('cricket'),
        team1: {
            name: cleanTeamName(team1.displayName || team1.name || 'TBA'),
            short: cleanTeamName(team1.abbreviation || team1.name || 'TBA'),
            logo: team1.logo || '',
            flag: ''
        },
        team2: {
            name: cleanTeamName(team2.displayName || team2.name || 'TBA'),
            short: cleanTeamName(team2.abbreviation || team2.name || 'TBA'),
            logo: team2.logo || '',
            flag: ''
        },
        league: leagueName,
        competitionLogo: '',
        venue: event.location || '',
        date: eventDate,
        time: eventTime,
        status: status,
        statusText: statusLabel,
        score: {
            team1: team1Score,
            team2: team2Score
        },
        overs: {
            team1: team1Overs,
            team2: team2Overs
        }
    };
}

// ===== Google Cricket / ESPN Site API =====

async function fetchGoogleCricketData() {
    try {
        const res = await fetch('/api/google-cricket', { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`Google Cricket HTTP ${res.status}`);
        const data = await res.json();
        const leagues = data?.sports?.[0]?.leagues || [];
        const allMatches = [];
        for (const league of leagues) {
            const leagueName = league.name || 'Cricket';
            const events = league.events || [];
            for (const event of events) {
                const converted = convertESPNCricketMatch(event, leagueName, '');
                if (converted) {
                    converted.id = `google_crick_${event.id}`;
                    allMatches.push(converted);
                }
            }
        }
        console.log(`✅ Google Cricket: ${allMatches.length} matches`);
        return allMatches;
    } catch (e) {
        console.log(`⚠️ Google Cricket failed: ${e.message}`);
        return [];
    }
}

// ===== TheSportsDB Player API =====

async function searchTheSportsDBTeam(teamName) {
    try {
        const res = await fetch(`/api/thesportsdb?path=${encodeURIComponent('searchteams.php?t=' + teamName)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.teams?.[0] || null;
    } catch (e) {
        console.log(`⚠️ TheSportsDB team search failed: ${e.message}`);
        return null;
    }
}

async function searchTheSportsDBPlayer(playerName) {
    try {
        const res = await fetch(`/api/thesportsdb?path=${encodeURIComponent('searchplayers.php?p=' + encodeURIComponent(playerName))}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.player || [];
    } catch (e) {
        console.log(`⚠️ TheSportsDB player search failed: ${e.message}`);
        return [];
    }
}

async function fetchTeamRoster(teamId) {
    try {
        const res = await fetch(`/api/thesportsdb?path=${encodeURIComponent('lookup_all_players.php?id=' + teamId)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.player || [];
    } catch (e) {
        console.log(`⚠️ TheSportsDB roster fetch failed: ${e.message}`);
        return [];
    }
}

async function fetchPlayerDetail(playerId) {
    try {
        const res = await fetch(`/api/thesportsdb?path=${encodeURIComponent('lookupplayer.php?id=' + playerId)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.players?.[0] || null;
    } catch (e) {
        console.log(`⚠️ TheSportsDB player detail failed: ${e.message}`);
        return null;
    }
}

// ===== UFC Fighter Photo Cache =====
const UFC_FIGHTER_PHOTO_CACHE = {};

async function fetchUFCFighterPhotos(matches) {
    if (!matches || matches.length === 0) return;
    const fighterNames = new Set();
    matches.forEach(m => {
        if (m.sport === 'ufc' || m.sport === 'mma') {
            if (m.team1?.name) fighterNames.add(m.team1.name);
            if (m.team2?.name) fighterNames.add(m.team2.name);
        }
    });
    if (fighterNames.size === 0) return;

    const toFetch = [...fighterNames].filter(name => !UFC_FIGHTER_PHOTO_CACHE[name]);
    if (toFetch.length === 0) {
        applyUFCPhotos(matches);
        return;
    }

    const fetchBatch = toFetch.slice(0, 6);
    await Promise.allSettled(fetchBatch.map(async (name) => {
        try {
            const res = await fetch(`/api/thesportsdb?path=${encodeURIComponent('searchplayers.php?p=' + encodeURIComponent(name))}`);
            if (!res.ok) return;
            const data = await res.json();
            const players = data?.player || [];
            const match = players.find(p => {
                const pname = (p.strPlayer || '').toLowerCase();
                const tname = name.toLowerCase();
                return pname === tname || pname.includes(tname) || tname.includes(pname);
            }) || players[0] || null;
            if (match) {
                UFC_FIGHTER_PHOTO_CACHE[name] = match.strCutout || match.strThumb || '';
            }
        } catch (e) {}
    }));
    applyUFCPhotos(matches);
}

function applyUFCPhotos(matches) {
    matches.forEach(m => {
        if (m.sport === 'ufc' || m.sport === 'mma') {
            if (m.team1 && UFC_FIGHTER_PHOTO_CACHE[m.team1.name]) {
                m.team1.logo = UFC_FIGHTER_PHOTO_CACHE[m.team1.name];
            }
            if (m.team2 && UFC_FIGHTER_PHOTO_CACHE[m.team2.name]) {
                m.team2.logo = UFC_FIGHTER_PHOTO_CACHE[m.team2.name];
            }
        }
    });
}

// ===== nfldata.org API (NFL) =====

const NFLDATA_BASE = 'https://api.nfldata.org/v1';
const NFLDATA_URL = '/api/nfldata';
const NFL_SEASON_CACHE_PREFIX = 'nfl_season_';
const NFL_SEASON_CACHE_MS = 5 * 60 * 1000;
let NFL_SEASON_CACHE = {};

// Load the complete NFL season once, then filter by date locally.
// This makes future-date schedule and calendar loading much more reliable.
async function fetchNFLSeason(year) {
    if (NFL_SEASON_CACHE[year]) return NFL_SEASON_CACHE[year];

    try {
        const storageKey = NFL_SEASON_CACHE_PREFIX + year;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.timestamp && Date.now() - parsed.timestamp < NFL_SEASON_CACHE_MS && Array.isArray(parsed.games)) {
                NFL_SEASON_CACHE[year] = parsed.games;
                return parsed.games;
            }
        }
    } catch (e) {}

    const allGames = [];
    const seasonTypes = [1, 2, 3]; // preseason, regular season, postseason

    for (const seasonType of seasonTypes) {
        try {
            const url = `${NFLDATA_URL}/games?season=${year}&season_type=${seasonType}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) continue;
            const text = await res.text();
            if (text.startsWith('<!')) continue;
            const json = JSON.parse(text);
            if (Array.isArray(json?.data)) allGames.push(...json.data);
        } catch (e) {
            // Silent fail — NFL API may require paid key
        }
    }

    // Remove duplicate games returned by multiple endpoints/types.
    const seen = new Set();
    const games = allGames.filter(g => {
        const key = g.id || `${g.gameday}_${g.home_team}_${g.away_team}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    if (games.length > 0) {
        NFL_SEASON_CACHE[year] = games;
        try {
            localStorage.setItem(NFL_SEASON_CACHE_PREFIX + year, JSON.stringify({
                timestamp: Date.now(),
                games
            }));
        } catch (e) {}
    }

    return games;
}

async function fetchNFLData(dateStr) {
    const matches = [];

    // Source 1: nfldata.org (regular/post season)
    try {
        const targetDate = new Date(`${dateStr}T00:00:00`);
        const year = targetDate.getFullYear();
        const allGames = await fetchNFLSeason(year);

        const filteredGames = allGames.filter(g => {
            if (!g?.gameday) return false;
            return g.gameday === dateStr || g.gameday.startsWith(dateStr);
        });

        const seen = new Set();
        const uniqueGames = filteredGames.filter(g => {
            const key = g?.id || g?.game_id ||
                `${g?.gameday}_${g?.gametime}_${g?.home_team}_${g?.away_team}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        matches.push(...uniqueGames
            .sort((a, b) => {
                const aTime = `${a?.gameday || ''}T${a?.gametime || '00:00'}`;
                const bTime = `${b?.gameday || ''}T${b?.gametime || '00:00'}`;
                return aTime.localeCompare(bTime);
            })
            .map(convertNFLDataMatch));
    } catch (e) {
        console.log(`ℹ️ nfldata.org NFL: ${e.message}`);
    }

    // Source 2: ESPN NFL (preseason + current games)
    try {
        const espnDate = dateStr.replace(/-/g, '');
        const espnUrl = `/api/espn-scores?sport=nfl&date=${espnDate}`;
        const res = await fetch(espnUrl, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
            const data = await res.json();
            const existingNames = new Set(matches.map(m => `${m.team1?.name}_vs_${m.team2?.name}`));
            (data.matches || []).forEach(m => {
                const key = `${m.team1?.name}_vs_${m.team2?.name}`;
                if (!existingNames.has(key)) {
                    matches.push(m);
                    existingNames.add(key);
                }
            });
        }
    } catch (e) {
        console.log(`ℹ️ ESPN NFL: ${e.message}`);
    }

    return matches;
}

// Used by the calendar to show every NFL game already loaded for the season.
async function getNFLSeasonCalendarEvents(year) {
    const games = await fetchNFLSeason(year);
    return games.map(convertNFLDataMatch);
}

function convertNFLDataMatch(game) {
    // nflData commonly exposes gameday (YYYY-MM-DD) and gametime (HH:MM).
    // Keep the provider's date/time separate so the browser timezone does not
    // accidentally move the game to another day.
    const dateOnly = String(game?.gameday || '').slice(0, 10);
    const timeOnly = String(game?.gametime || game?.game_time || '').slice(0, 5);
    const matchDate = /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)
        ? dateOnly
        : getTodayString();
    const matchTime = /^\d{2}:\d{2}$/.test(timeOnly) ? timeOnly : '00:00';

    const team1Name = cleanTeamName(game?.home_team || game?.home || 'Home Team');
    const team2Name = cleanTeamName(game?.away_team || game?.away || 'Away Team');

    let status = 'upcoming';
    const explicitStatus = String(game?.status || game?.game_status || '').toLowerCase();

    if (explicitStatus.includes('final') || explicitStatus === 'finished' || explicitStatus === 'post') {
        status = 'finished';
    } else if (explicitStatus.includes('live') || explicitStatus === 'in progress' || explicitStatus === 'in') {
        status = 'live';
    } else if (game?.result !== null && game?.result !== undefined && String(game.result).trim() !== '') {
        status = 'finished';
    }

    return {
        id: game?.id || game?.game_id || `nfl_${matchDate}_${matchTime}_${team1Name}_${team2Name}`,
        sport: 'nfl',
        icon: getSportIcon('nfl'),
        team1: {
            name: team1Name,
            short: String(team1Name).slice(0, 3).toUpperCase(),
            logo: '',
            flag: ''
        },
        team2: {
            name: team2Name,
            short: String(team2Name).slice(0, 3).toUpperCase(),
            logo: '',
            flag: ''
        },
        league: game?.week ? `NFL - Week ${game.week}` : 'NFL',
        venue: game?.location || game?.venue || '',
        date: matchDate,
        time: matchTime,
        status,
        statusText: status === 'live' ? 'LIVE' : status === 'finished' ? 'Final' : 'Scheduled',
        score: {
            team1: game?.home_score ?? '-',
            team2: game?.away_score ?? '-'
        }
    };
}
