const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CLIENT_ID = '1469577414022795346'; 
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET; // Asegúrate que se llame así en Render
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

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

        // Cambia esto a tu URL real de Vercel
        res.redirect(`https://koda-raid.vercel.app/?token=${response.data.access_token}`);
    } catch (err) {
        console.error("Error detallado:", err.response?.data || err.message);
        res.status(500).send("Error en login: " + (err.response?.data?.error_description || "Fallo en el servidor"));
    }
});

// Ruta para obtener servidores
app.get('/api/servers', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send("No hay token");
    try {
        const userGuilds = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: authHeader }
        });
        const botGuildIds = client.guilds.cache.map(g => g.id);
        const mutual = userGuilds.data.filter(g => (parseInt(g.permissions) & 0x8) === 0x8 && botGuildIds.includes(g.id));
        res.json(mutual);
    } catch (e) { res.status(500).send("Error al cargar servers"); }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000, () => console.log('Koda Engine Online'));