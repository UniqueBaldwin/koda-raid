const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express(); // DEFINIDO DESDE EL INICIO
app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN DE IDENTIDAD ---
const OWNER_ID = '967660960682762251';
const CLIENT_ID = '1469577414022795346';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET; // DEBES PONERLO EN RENDER
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

// BASE DE DATOS EN MEMORIA (Estado del Sistema)
let KodaDB = {
    sessions: {},
    supports: [],
    activeTickets: [],
    config: {
        title: "Koda Support",
        color: "#6366f1",
        description: "Bienvenido al centro de soporte de Koda. ¿En qué podemos ayudarte?",
        footer: "Sistema de Soporte Koda v2.0"
    },
    logs: [{ time: new Date().toLocaleTimeString(), msg: "Sistema iniciado correctamente." }]
};

// --- MOTOR DE GRAMÁTICA AVANZADO ---
function smartCorrect(text) {
    if (!text) return "";
    const dictionary = {
        'k': 'que', 'ke': 'que', 'pq': 'porque', 'tmb': 'también', 'ola': 'Hola',
        'haiga': 'haya', 'aser': 'hacer', 'valla': 'vaya', 'iba': 'iba', 'hiba': 'iba',
        'estubimos': 'estuvimos', 'grax': 'gracias', 'nomas': 'no más', 'pa': 'para'
    };
    
    let words = text.split(/\s+/);
    let corrected = words.map(w => {
        let clean = w.toLowerCase().replace(/[.,!¡?¿]/g, '');
        return dictionary[clean] ? w.toLowerCase().replace(clean, dictionary[clean]) : w;
    });

    let final = corrected.join(' ');
    return final.charAt(0).toUpperCase() + final.slice(1);
}

// --- LOGICA DE DISCORD ---
client.on('ready', () => {
    console.log(`Bot listo: ${client.user.tag}`);
    client.user.setActivity('Koda Support Dashboard', { type: ActivityType.Watching });
});

// --- API ROUTES ---

// Login Redirect
app.get('/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
});

// Callback de Discord OAuth2
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No se proporcionó código de autorización.");

    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const user = userRes.data;
        let role = 'USER';
        if (user.id === OWNER_ID) role = 'OWNER';
        else if (KodaDB.supports.includes(user.id)) role = 'SUPPORT';

        const token = tokenRes.data.access_token;
        KodaDB.sessions[token] = { ...user, role, loginAt: new Date() };
        KodaDB.logs.push({ time: new Date().toLocaleTimeString(), msg: `Usuario ${user.username} (${role}) inició sesión.` });

        res.redirect(`https://koda-raid.onrender.com/?token=${token}`);
    } catch (e) {
        console.error(e);
        res.status(500).send("Error en la autenticación.");
    }
});

// Middleware de Seguridad
const protect = (req, res, next) => {
    const token = req.headers.authorization;
    if (!KodaDB.sessions[token]) return res.status(401).send("Sesión inválida");
    req.user = KodaDB.sessions[token];
    next();
};

// Endpoints de Datos
app.get('/api/me', protect, (req, res) => {
    res.json({ user: req.user, config: KodaDB.config, stats: { 
        tickets: KodaDB.activeTickets.length, 
        logs: KodaDB.logs.length,
        agents: KodaDB.supports.length + 1
    }});
});

app.get('/api/tickets', protect, (req, res) => {
    if (req.user.role === 'USER') return res.status(403).send();
    res.json(KodaDB.activeTickets);
});

app.post('/api/admin/config', protect, (req, res) => {
    if (req.user.role !== 'OWNER') return res.status(403).send();
    KodaDB.config = { ...KodaDB.config, ...req.body };
    KodaDB.logs.push({ time: new Date().toLocaleTimeString(), msg: "Configuración global actualizada por el Owner." });
    res.json({ success: true });
});

app.post('/api/reply', protect, async (req, res) => {
    const { ticketId, content } = req.body;
    const ticket = KodaDB.activeTickets.find(t => t.id === ticketId);
    if (!ticket) return res.status(404).send();

    const corrected = smartCorrect(content);
    // Aquí enviarías el mensaje a Discord realmente
    ticket.messages.push({ author: req.user.username, role: 'support', text: corrected, time: new Date() });
    res.json({ corrected });
});

// Servir Frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server en puerto ${PORT}`));
client.login(process.env.DISCORD_TOKEN);