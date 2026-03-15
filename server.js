const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Request failed: " + res.status);
    return res.json();
}

// get user's places
async function getUserPlaces(userId) {
    const url = `https://games.roblox.com/v2/users/${userId}/games?accessFilter=2&limit=50`;
    const data = await fetchJSON(url);

    if (!data.data) return [];

    return data.data.map(game => game.rootPlace.id);
}

// convert place -> universe
async function getUniverse(placeId) {
    const url = `https://apis.roblox.com/universes/v1/places/${placeId}/universe`;
    const data = await fetchJSON(url);
    return data.universeId;
}

// get passes from universe
async function getPasses(universeId) {
    const url = `https://games.roblox.com/v1/games/${universeId}/game-passes?limit=100`;
    const data = await fetchJSON(url);

    if (!data.data) return [];

    return data.data
        .filter(p => p.price !== null)
        .map(p => ({
            id: p.id,
            name: p.name,
            price: p.price
        }));
}

app.get("/", (req,res)=>{
    res.send("Donation proxy running");
});

app.get("/gamepasses/:userid", async (req,res)=>{
    try{
        const userId = req.params.userid;

        const places = await getUserPlaces(userId);

        let allPasses = [];

        for (const placeId of places) {
            const universeId = await getUniverse(placeId);
            const passes = await getPasses(universeId);
            allPasses = allPasses.concat(passes);
        }

        allPasses.sort((a,b)=>a.price-b.price);

        res.json({
            success:true,
            passes:allPasses
        });

    } catch(err) {
        res.json({
            success:false,
            error:err.toString()
        });
    }
});

app.listen(PORT, ()=>{
    console.log("Proxy running on port "+PORT);
});