const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// --- INICIALIZACIÓN ---
const app = express();
app.use(cors());
app.use(express.json());

// Forzar la ruta absoluta para evitar errores ENOENT en Render
const publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) {
    console.error("¡ERROR CRÍTICO! La carpeta 'public' no existe. Créala y mete index.html ahí.");
    // Fallback de emergencia por si olvidas la carpeta
    app.get('/', (req, res) => res.send('ERROR: Crea la carpeta "public" y pon index.html dentro.'));
} else {
    app.use(express.static(publicPath));
}

// --- CONFIGURACIÓN ---
// ¡OJO! En Render agrega estas variables en "Environment"
const CLIENT_ID = '1336449195325882428'; 
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET; 
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';
const OWNER_ID = '967660960682762251'; // Tu ID

// Base de datos en memoria (RAM)
let DB = {
    users: {},
    tickets: [
        { id: 'T-101', user: 'Baldwin', status: 'active', msg: 'Necesito ayuda con el servidor.' },
        { id: 'T-102', user: 'Guest_99', status: 'pending', msg: 'Reportando un bug visual.' }
    ],
    logs: []
};

// --- MOTOR DE GRAMÁTICA ---
function kodaCorrect(text) {
    if(!text) return "";
    const dict = {
        'k': 'que', 'q': 'que', 'pq': 'porque', 'xp': 'porque', 'tmb': 'también', 
        'ola': 'Hola', 'm': 'me', 'sta': 'está', 'grax': 'gracias', 'ntp': 'no te preocupes'
    };
    let words = text.split(/\s+/);
    let fixed = words.map(w => {
        let clean = w.toLowerCase().replace(/[^a-zñ]/g, '');
        return dict[clean] ? w.toLowerCase().replace(clean, dict[clean]) : w;
    });
    let final = fixed.join(' ');
    return final.charAt(0).toUpperCase() + final.slice(1);
}

// --- RUTAS API ---

app.get('/login', (req, res) => {
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`);
});

app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/');
    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const user = userRes.data;
        // Guardar sesión
        DB.users[tokenRes.data.access_token] = user;
        
        res.redirect(`/?token=${tokenRes.data.access_token}`);
    } catch (e) {
        console.error("Auth Error:", e.message);
        res.redirect('/');
    }
});

// Endpoint de Datos
app.get('/api/data', (req, res) => {
    const token = req.headers.authorization;
    const user = DB.users[token];
    if (!user) return res.status(401).json({ error: "No autorizado" });

    res.json({
        user: {
            username: user.username,
            avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
            isOwner: user.id === OWNER_ID
        },
        stats: {
            tickets: DB.tickets.length,
            online: 1,
            logs: DB.logs.length
        },
        tickets: DB.tickets
    });
});

// Endpoint Chat con IA (Simulada/Gramática)
app.post('/api/chat', (req, res) => {
    const { msg } = req.body;
    const corrected = kodaCorrect(msg);
    // Aquí conectarías con Discord real
    res.json({ original: msg, corrected: corrected, response: "Mensaje procesado y enviado al staff." });
});

// Servir la APP (Fallback final)
app.get('*', (req, res) => {
    if (fs.existsSync(path.join(publicPath, 'index.html'))) {
        res.sendFile(path.join(publicPath, 'index.html'));
    } else {
        res.send('ERROR 404: No encuentro index.html en la carpeta public.');
    }
});

// --- CLIENTE DISCORD ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', () => {
    console.log(`🤖 Koda Bot activo como ${client.user.tag}`);
    client.user.setActivity('Koda Dashboard', { type: ActivityType.Watching });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));

if(process.env.DISCORD_TOKEN) client.login(process.env.DISCORD_TOKEN);