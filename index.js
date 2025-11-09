const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Set your desired Author/Developer Name here
const AUTHOR_NAME = "Gemini Proxy Developer"; // <== CHANGE THIS TO YOUR NAME

// The base URL for the original external API
const EXTERNAL_API_BASE = 'https://tele-social.vercel.app';

app.use(express.json());

// --- Endpoint 1: Proxy for Available Services (/api/services) ---
app.get('/api/services', async (req, res) => {
    try {
        const externalUrl = `${EXTERNAL_API_BASE}/services`;
        const response = await axios.get(externalUrl);

        // **Modification:** Add author name to the external JSON data
        const finalResponse = {
            author: AUTHOR_NAME, // <== ADDED
            ...response.data
        };

        res.json(finalResponse);

    } catch (error) {
        console.error('Error fetching services:', error.message);
        res.status(500).json({ status: false, message: 'Failed to fetch services from external API.' });
    }
});

// --- Endpoint 2: Proxy for Video Download (/api/download) ---
app.get('/api/download', async (req, res) => {
    const videoUrl = req.query.url; 

    if (!videoUrl) {
        return res.status(400).json({ status: false, message: 'Missing video URL parameter.' });
    }

    try {
        const externalUrl = `${EXTERNAL_API_BASE}/down?url=${encodeURIComponent(videoUrl)}`;
        
        // 1. Fetch the metadata (JSON) from the external API first
        const metadataResponse = await axios.get(externalUrl);
        const data = metadataResponse.data;

        if (!data.status || data.data.type !== 'video') {
             // **Modification:** Return author name even on error/404
             return res.status(404).json({ 
                 status: false, 
                 author: AUTHOR_NAME, // <== ADDED
                 message: 'Video data not found or unsupported format.' 
             });
        }
        
        // 2. Stream the video file (code remains the same for streaming)
        const mediaUrl = data.data.media.download; 
        const videoResponse = await axios.get(mediaUrl, {
            responseType: 'stream', 
        });

        // Set headers for the client response
        const filename = data.data.media.filename || 'download.mp4';
        res.setHeader('Content-Type', videoResponse.headers['content-type'] || 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Pipe the stream and return
        videoResponse.data.pipe(res);

    } catch (error) {
        console.error('Error downloading video:', error.message);
        // **Modification:** Return author name on internal error
        res.status(500).json({ 
            status: false, 
            author: AUTHOR_NAME, // <== ADDED
            message: 'Failed to process video download.' 
        });
    }
});

app.listen(port, () => {
    console.log(`Proxy server listening at http://localhost:${port}`);
});
