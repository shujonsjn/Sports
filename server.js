const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Data cache
const cache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// SportScore API
const SPORTSCORE_BASE = 'https://sportscore.com/api/widget';

// Serve static files
app.use(express.static(path.join(__dirname)));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// API endpoint for matches
app.get('/api/matches', async (req, res) => {
    const sport = req.query.sport || 'football';
    const limit = req.query.limit || 30;
    const cacheKey = `${sport}_${limit}`;

    // Check cache
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION) {
        console.log(`📦 Cache hit: ${sport}`);
        return res.json(cache[cacheKey].data);
    }

    try {
        console.log(`🌐 Fetching ${sport} from SportScore...`);
        const response = await fetch(`${SPORTSCORE_BASE}/matches/?sport=${sport}&limit=${limit}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        // Cache the data
        cache[cacheKey] = {
            data: data,
            timestamp: Date.now()
        };

        console.log(`✅ Cached ${sport}: ${(data.matches || []).length} matches`);
        res.json(data);
    } catch (error) {
        console.log(`❌ Error fetching ${sport}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', cache: Object.keys(cache).length });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api/matches?sport=football`);
});
