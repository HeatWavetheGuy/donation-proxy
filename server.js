const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// simple cache
const cache = new Map();
const CACHE_TIME = 60000;

// helper
async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Request failed: " + res.status);
    return await res.json();
}

// get universes owned by user
async function getUniverses(userId) {
    const url = `https://games.roblox.com/v2/users/${userId}/games?accessFilter=2&limit=50&sortOrder=Asc`;
    const data = await fetchJSON(url);

    if (!data || !data.data) return [];

    return data.data.map(game => game.id);
}

// get gamepasses from a universe
async function getGamepasses(universeId) {
    let passes = [];
    let cursor = "";

    do {
        const url = `https://games.roblox.com/v1/games/${universeId}/game-passes?limit=100&cursor=${cursor}`;
        const data = await fetchJSON(url);

        if (!data || !data.data) break;

        passes = passes.concat(
            data.data
                .filter(p => p.price !== null)
                .map(p => ({
                    id: p.id,
                    name: p.name,
                    price: p.price
                }))
        );

        cursor = data.nextPageCursor;
    } while (cursor);

    return passes;
}

// root route
app.get("/", (req, res) => {
    res.send("Universe Donation Proxy Running");
});

// main route
app.get("/gamepasses/:userid", async (req, res) => {
    const userId = req.params.userid;

    if (cache.has(userId)) {
        const entry = cache.get(userId);
        if (Date.now() - entry.time < CACHE_TIME) {
            return res.json(entry.data);
        }
    }

    try {
        const universes = await getUniverses(userId);

        let allPasses = [];

        const promises = universes.map(u => getGamepasses(u));
        const results = await Promise.all(promises);

        results.forEach(list => {
            allPasses = allPasses.concat(list);
        });

        allPasses.sort((a, b) => a.price - b.price);

        const response = {
            success: true,
            passes: allPasses
        };

        cache.set(userId, { time: Date.now(), data: response });

        res.json(response);

    } catch (err) {
        console.log(err);
        res.json({ success: false, passes: [] });
    }
});

app.listen(PORT, () => {
    console.log("Proxy running on port " + PORT);
});