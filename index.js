const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express(); // DEFINIDO PRIMERO PARA EVITAR ERRORES
app.use(cors());
app.use(express.json());

// CONFIGURACIÓN (Usa Variables de Entorno en Render)
const CLIENT_ID = '1336449195325882428';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// --- LÓGICA DE CORRECCIÓN ORTOGRÁFICA ---
const dictionary = { 'k': 'que', 'pq': 'porque', 'ola': 'Hola', 'tmb': 'también', 'grax': 'gracias' };
function correctText(text) {
    return text.split(' ').map(word => dictionary[word.toLowerCase()] || word).join(' ');
}

// --- RUTAS DEL SERVIDOR ---

// Login de Discord (Soluciona el error "Cannot GET /login")
app.get('/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
});

// Callback de Autenticación
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        
        res.redirect(`/?token=${tokenResponse.data.access_token}`);
    } catch (e) { res.status(500).send("Error de autenticación"); }
});

// SERVIR FRONTEND (Soluciona el error ENOENT de tu captura)
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

client.on('ready', () => {
    console.log(`Bot Listo: ${client.user.tag}`);
    client.user.setActivity('Koda Support', { type: ActivityType.Watching });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
client.login(process.env.DISCORD_TOKEN);