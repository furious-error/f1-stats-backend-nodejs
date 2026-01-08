const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DATABASE;
const resultCollection = process.env.RESULT_COLLECTION;
const analysisCollection = process.env.ANALYSIS_COLLECTION;
const scheduleCollection = process.env.SCHEDULE_COLLECTION;
const driversCollection = process.env.DRIVERS_COLLECTION;
const teamsCollection = process.env.TEAMS_COLLECTION;
const circuitsCollection = process.env.CIRCUITS_COLLECTION;

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

app.get('/api/ping', (req, res) => {
    res.status(200).json({ message: "Pong" });
});

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
        const collection = db.collection(resultCollection);

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
        const collection = db.collection(resultCollection);
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


app.get('/api/analysis/:year', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: "Database not connected. Please try again later." });
    }
    try {
        const yearParam = req.params.year;
        const yearToQuery = parseInt(yearParam, 10);
        if (isNaN(yearToQuery)) {
            return res.status(400).json({ message: 'Invalid year format. Please provide a number.' });
        }
        const query = { year: yearToQuery };
        const documents = await db.collection(analysisCollection).find(query).toArray();
        if (documents.length === 0) {
            return res.status(404).json({ message: `No events found for the year ${yearToQuery}` });
        }

        res.status(200).json(documents);

    } catch (error) {
        console.error('An error occurred while fetching events:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- API Endpoint to Get Schedule for a Year ---
// GET /api/schedule/:year
// Example: /api/schedule/2026
app.get('/api/schedule/:year', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: "Database not connected. Please try again later." });
    }

    const year = parseInt(req.params.year, 10);

    if (isNaN(year)) {
        return res.status(400).json({ error: "Year parameter must be a valid number." });
    }

    try {
        const collection = db.collection(scheduleCollection);
        const schedule = await collection.find({ Year: year }).sort({ RoundNumber: 1 }).toArray();

        if (schedule.length === 0) {
            return res.status(404).json({ error: `No schedule found for year ${year}.` });
        }

        res.status(200).json({
            year: year,
            totalRounds: schedule.length,
            schedule: schedule
        });

    } catch (err) {
        console.error(`Error fetching schedule for year ${year}:`, err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- API Endpoint to Get a Specific Round from Schedule ---
// GET /api/schedule/:year/:round
// Example: /api/schedule/2026/1
app.get('/api/schedule/:year/:round', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: "Database not connected. Please try again later." });
    }

    const year = parseInt(req.params.year, 10);
    const round = parseInt(req.params.round, 10);

    if (isNaN(year)) {
        return res.status(400).json({ error: "Year parameter must be a valid number." });
    }
    if (isNaN(round)) {
        return res.status(400).json({ error: "Round parameter must be a valid number." });
    }

    try {
        const collection = db.collection(scheduleCollection);
        const event = await collection.findOne({ Year: year, RoundNumber: round });

        if (!event) {
            return res.status(404).json({ error: `Round ${round} not found for year ${year}.` });
        }

        res.status(200).json(event);

    } catch (err) {
        console.error(`Error fetching round ${round} for year ${year}:`, err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- API Endpoint to Get All Drivers ---
// GET /api/drivers
app.get('/api/drivers', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: "Database not connected. Please try again later." });
    }

    try {
        const collection = db.collection(driversCollection);
        const drivers = await collection.find({}).toArray();

        if (drivers.length === 0) {
            return res.status(404).json({ error: "No drivers found." });
        }

        res.status(200).json({
            totalDrivers: drivers.length,
            drivers: drivers
        });

    } catch (err) {
        console.error("Error fetching drivers:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- API Endpoint to Get a Specific Driver by Driver Code ---
// GET /api/drivers/:driverCode
// Example: /api/drivers/NOR
app.get('/api/drivers/:driverCode', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: "Database not connected. Please try again later." });
    }

    const driverCode = req.params.driverCode.toUpperCase();

    if (!driverCode || driverCode.length !== 3) {
        return res.status(400).json({ error: "Driver code must be a 3-letter code (e.g., NOR, VER)." });
    }

    try {
        const collection = db.collection(driversCollection);
        const driver = await collection.findOne({ driver_code: driverCode });

        if (!driver) {
            return res.status(404).json({ error: `Driver with code '${driverCode}' not found.` });
        }

        res.status(200).json(driver);

    } catch (err) {
        console.error(`Error fetching driver ${driverCode}:`, err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- API Endpoint to Get All Teams ---
// GET /api/teams
app.get('/api/teams', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: "Database not connected. Please try again later." });
    }

    try {
        const collection = db.collection(teamsCollection);
        const teams = await collection.find({}).toArray();

        if (teams.length === 0) {
            return res.status(404).json({ error: "No teams found." });
        }

        res.status(200).json({
            totalTeams: teams.length,
            teams: teams
        });

    } catch (err) {
        console.error("Error fetching teams:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- API Endpoint to Get a Specific Team by Short Name ---
// GET /api/teams/:shortName
// Example: /api/teams/McLaren
app.get('/api/teams/:shortName', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: "Database not connected. Please try again later." });
    }

    const shortName = req.params.shortName;

    if (!shortName) {
        return res.status(400).json({ error: "Team short name is required." });
    }

    try {
        const collection = db.collection(teamsCollection);
        // Case-insensitive search using regex
        const team = await collection.findOne({
            short_name: { $regex: new RegExp(`^${shortName}$`, 'i') }
        });

        if (!team) {
            return res.status(404).json({ error: `Team '${shortName}' not found.` });
        }

        res.status(200).json(team);

    } catch (err) {
        console.error(`Error fetching team ${shortName}:`, err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- API Endpoint to Get All Circuits ---
// GET /api/circuits
app.get('/api/circuits', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: "Database not connected. Please try again later." });
    }

    try {
        const collection = db.collection(circuitsCollection);
        const circuits = await collection.find({}).toArray();

        if (circuits.length === 0) {
            return res.status(404).json({ error: "No circuits found." });
        }

        res.status(200).json({
            totalCircuits: circuits.length,
            circuits: circuits
        });

    } catch (err) {
        console.error("Error fetching circuits:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- API Endpoint to Get a Specific Circuit by Circuit ID ---
// GET /api/circuits/:circuitId
// Example: /api/circuits/albert_park
app.get('/api/circuits/:circuitId', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: "Database not connected. Please try again later." });
    }

    const circuitId = req.params.circuitId;

    if (!circuitId) {
        return res.status(400).json({ error: "Circuit ID is required." });
    }

    try {
        const collection = db.collection(circuitsCollection);
        // Case-insensitive search using regex
        const circuit = await collection.findOne({
            circuitId: { $regex: new RegExp(`^${circuitId}$`, 'i') }
        });

        if (!circuit) {
            return res.status(404).json({ error: `Circuit '${circuitId}' not found.` });
        }

        res.status(200).json(circuit);

    } catch (err) {
        console.error(`Error fetching circuit ${circuitId}:`, err);
        res.status(500).json({ error: "Internal server error." });
    }
});

async function startServer() {
    await connectToMongo();
    app.listen(port, () => {
        console.log(`API server listening at http://localhost:${port}`);
    });
}

startServer();