const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// --- CONFIGURATION ---
const AUTHOR_NAME = "@TheVextro"; 
const EXTERNAL_API_BASE = 'https://tele-social.vercel.app';
// !! CHANGE THIS TO YOUR SECURE KEY !!
const LOG_ACCESS_KEY = "m2h"; 

// --- LOGGING SETUP ---
const requestLog = [];

/**
 * Middleware to log every incoming request
 */
app.use((req, res, next) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl,
        // Get the client IP address (Render usually forwards this in headers)
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
    };
    
    // Only keep the last 1000 logs to prevent memory overflow
    if (requestLog.length >= 1000) {
        requestLog.shift(); 
    }
    
    requestLog.push(logEntry);
    
    // Log to console as well
    console.log(`[${logEntry.timestamp}] ${logEntry.method} ${logEntry.path} from ${logEntry.ip}`);
    
    next();
});

app.use(express.json());

// --- NEW ENDPOINT: LOGS ACCESS ---
// Endpoint: /api/logs
app.get('/api/logs', (req, res) => {
    const key = req.query.key;
    
    if (key !== LOG_ACCESS_KEY) {
        // Return 401 Unauthorized if the key is missing or incorrect
        return res.status(401).json({ 
            status: false, 
            message: 'Access denied: Invalid or missing API key.',
            author: AUTHOR_NAME
        });
    }

    // Key is correct, return the logs
    res.json({
        status: true,
        author: AUTHOR_NAME,
        logCount: requestLog.length,
        logs: requestLog.reverse() // Reverse to show newest logs first
    });
});
// --- END NEW ENDPOINT ---

// --- Existing Endpoint 1: Proxy for Available Services (/api/services) ---
app.get('/api/services', async (req, res) => {
    try {
        const externalUrl = `${EXTERNAL_API_BASE}/services`;
        const response = await axios.get(externalUrl);

        const finalResponse = {
            author: AUTHOR_NAME, 
            ...response.data
        };

        res.json(finalResponse);

    } catch (error) {
        console.error('Error fetching services:', error.message);
        res.status(500).json({ status: false, message: 'Failed to fetch services from external API.', author: AUTHOR_NAME });
    }
});

// --- Existing Endpoint 2: Proxy for Video Download (/api/download) ---
// Note: This endpoint still streams the video and does not return JSON on success.
app.get('/api/download', async (req, res) => {
    const videoUrl = req.query.url; 

    if (!videoUrl) {
        return res.status(400).json({ status: false, message: 'Missing video URL parameter.', author: AUTHOR_NAME });
    }

    try {
        const externalUrl = `${EXTERNAL_API_BASE}/down?url=${encodeURIComponent(videoUrl)}`;
        
        const metadataResponse = await axios.get(externalUrl);
        const data = metadataResponse.data;

        if (!data.status || data.data.type !== 'video') {
             return res.status(404).json({ 
                 status: false, 
                 author: AUTHOR_NAME, 
                 message: 'Video data not found or unsupported format.' 
             });
        }
        
        const mediaUrl = data.data.media.download; 
        const videoResponse = await axios.get(mediaUrl, {
            responseType: 'stream', 
        });

        const filename = data.data.media.filename || 'download.mp4';
        res.setHeader('Content-Type', videoResponse.headers['content-type'] || 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        videoResponse.data.pipe(res);

    } catch (error) {
        console.error('Error downloading video:', error.message);
        res.status(500).json({ 
            status: false, 
            author: AUTHOR_NAME, 
            message: 'Failed to process video download.' 
        });
    }
});

app.listen(port, () => {
    console.log(`Proxy server listening at http://localhost:${port}`);
});
