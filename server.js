const express = require("express")
const fetch = require("node-fetch")

const app = express()
const PORT = process.env.PORT || 3000

// cache system
const cache = new Map()
const CACHE_TIME = 60 * 1000 // 1 minute

async function fetchJSON(url) {

    const res = await fetch(url)

    if (!res.ok) {
        throw new Error("Request failed: " + res.status)
    }

    return await res.json()
}

// get user games
async function getUserGames(userId) {

    let games = []
    let cursor = ""

    do {

        const url =
        `https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&limit=50&cursor=${cursor}`

        const data = await fetchJSON(url)

        games = games.concat(data.data)
        cursor = data.nextPageCursor

    } while (cursor)

    return games
}

// get gamepasses from a universe
async function getGamepasses(universeId) {

    let passes = []
    let cursor = ""

    do {

        const url =
        `https://games.roblox.com/v1/games/${universeId}/game-passes?limit=100&cursor=${cursor}`

        const data = await fetchJSON(url)

        passes = passes.concat(data.data)
        cursor = data.nextPageCursor

    } while (cursor)

    return passes
}

app.get("/gamepasses/:userid", async (req, res) => {

    const userId = req.params.userid

    // return cached result
    if (cache.has(userId)) {

        const cached = cache.get(userId)

        if (Date.now() - cached.time < CACHE_TIME) {
            return res.json(cached.data)
        }

    }

    try {

        const games = await getUserGames(userId)

        const universeIds = games.map(g => g.id)

        // fetch passes in parallel
        const requests = universeIds.map(id => getGamepasses(id))
        const results = await Promise.all(requests)

        let passes = []

        results.forEach(list => {

            list.forEach(pass => {

                if (pass.price !== null) {

                    passes.push({
                        id: pass.id,
                        name: pass.name,
                        price: pass.price
                    })

                }

            })

        })

        // sort by price
        passes.sort((a, b) => a.price - b.price)

        const response = {
            success: true,
            passes: passes
        }

        cache.set(userId, {
            time: Date.now(),
            data: response
        })

        res.json(response)

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.toString()
        })

    }

})

app.get("/", (req,res)=>{
    res.send("Donation Proxy Running")
})

app.listen(PORT, () => {
    console.log("Proxy running on port", PORT)
})