const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DATABASE;
const collectionName = process.env.RESULT_COLLECTION;

app.use(cors());

let db;

async function connectToMongo() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        console.log("Successfully connected to MongoDB.");
        db = client.db(dbName);
    } catch (err) {
        console.error("Failed to connect to MongoDB", err);
        process.exit(1);
    }
}

app.use(express.json());

// --- API Endpoint to Get All Sessions for a Specific Event by Name and Year ---
// GET /api/events/:eventName/:year/sessions
// Example: /api/events/Monaco%20Grand%20Prix/2025/sessions
app.get('/api/events/:eventName/:year/sessions', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: "Database not connected. Please try again later." });
    }

    const { eventName } = req.params;
    const year = parseInt(req.params.year, 10);

    if (!eventName) {
        return res.status(400).json({ error: "EventName parameter is required." });
    }
    if (isNaN(year)) {
        return res.status(400).json({ error: "Year parameter must be a valid number." });
    }

    try {
        const collection = db.collection(collectionName);

        const eventDocument = await collection.findOne(
            { EventName: eventName, Year: year },
            { projection: { Sessions: 1, _id: 0 } }
        );

        if (!eventDocument) {
            return res.status(404).json({ error: `Event '${eventName}' for year ${year} not found.` });
        }

        if (eventDocument.Sessions) {
            res.status(200).json({
                eventName: eventName,
                year: year,
                sessions: eventDocument.Sessions
            });
        } else {
            res.status(404).json({ error: `Sessions data not found for event '${eventName}' in ${year}.` });
        }

    } catch (err) {
        console.error("Error fetching event sessions by name/year:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- API Endpoint to Get a Specific Session for an Event by Name, Year, and Session Name ---
// GET /api/events/:eventName/:year/sessions/:sessionName
// Example: /api/events/Monaco%20Grand%20Prix/2025/sessions/Practice%201
app.get('/api/events/:eventName/:year/sessions/:sessionName', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: "Database not connected. Please try again later." });
    }

    const { eventName, sessionName } = req.params;
    const year = parseInt(req.params.year, 10);

    if (!eventName) {
        return res.status(400).json({ error: "EventName parameter is required." });
    }
    if (isNaN(year)) {
        return res.status(400).json({ error: "Year parameter must be a valid number." });
    }
    if (!sessionName) {
        return res.status(400).json({ error: "SessionName parameter is required." });
    }

    try {
        const collection = db.collection(collectionName);
        const sessionFieldPath = `Sessions.${sessionName}`;

        const eventDocument = await collection.findOne(
            { EventName: eventName, Year: year },
            { projection: { [sessionFieldPath]: 1, _id: 0 } }
        );

        if (!eventDocument) {
            return res.status(404).json({ error: `Event '${eventName}' for year ${year} not found.` });
        }

        if (eventDocument.Sessions && eventDocument.Sessions[sessionName]) {
            res.status(200).json({
                eventName: eventName,
                year: year,
                sessionName: sessionName,
                sessionData: eventDocument.Sessions[sessionName]
            });
        } else {
            res.status(404).json({ error: `Session '${sessionName}' not found for event '${eventName}' in ${year}.` });
        }

    } catch (err) {
        console.error(`Error fetching specific session '${sessionName}' for '${eventName}' (${year}):`, err);
        res.status(500).json({ error: "Internal server error." });
    }
});


async function startServer() {
    await connectToMongo();
    app.listen(port, () => {
        console.log(`API server listening at http://localhost:${port}`);
        console.log("Example usage:");
        console.log(`  All sessions: http://localhost:${port}/api/events/Monaco%20Grand%20Prix/2025/sessions`);
        console.log(`  Specific session: http://localhost:${port}/api/events/Monaco%20Grand%20Prix/2025/sessions/Practice%201`);
    });
}

startServer();