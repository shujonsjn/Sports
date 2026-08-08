const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Data cache
const cache = {};
const CACHE_DURATION = 5 * 60 * 1000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// API endpoint
app.get('/api/matches', async (req, res) => {
    const sport = req.query.sport || 'football';
    const limit = req.query.limit || 30;
    const cacheKey = `${sport}_${limit}`;

    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION) {
        return res.json(cache[cacheKey].data);
    }

    try {
        const response = await fetch(`https://sportscore.com/api/widget/matches/?sport=${sport}&limit=${limit}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        cache[cacheKey] = { data, timestamp: Date.now() };
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
