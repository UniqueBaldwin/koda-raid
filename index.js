const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

// --- INICIALIZACIÓN CRÍTICA ---
const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURACIÓN (Usa Variables de Entorno en Render para el Secret)
const OWNER_ID = '967660960682762251';
const CLIENT_ID = '1336449195325882428'; 
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET; // ¡Agrégalo en Render!
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ] 
});

// BASE DE DATOS VOLÁTIL (Se recomienda MongoDB para persistencia real)
let serverState = {
    config: {
        title: "Koda Support Center",
        color: "#6366f1",
        description: "Bienvenido. Nuestro equipo de soporte humano te atenderá en breve.",
        footer: "Powered by Koda Systems",
        status: "Online"
    },
    supports: [], // IDs de ayudantes
    tickets: [], // { id, userId, userName, channelId, status, messages: [], agentId }
    sessions: {},
    logs: []
};

// --- MOTOR DE CORRECCIÓN GRAMATICAL (DICCIONARIO DINÁMICO) ---
const grammarDictionary = {
    'k': 'que', 'ke': 'que', 'pq': 'porque', 'tmb': 'también', 'ola': 'Hola',
    'haiga': 'haya', 'aser': 'hacer', 'valla': 'vaya', 'iba': 'iba', 'hiva': 'iba',
    'grax': 'gracias', 'nomas': 'no más', 'pa': 'para', 'aki': 'aquí', 'esta': 'está'
};

function processText(text) {
    if (!text) return "";
    let words = text.split(/\s+/);
    let corrected = words.map(word => {
        let cleanWord = word.toLowerCase().replace(/[.,!¡?¿]/g, '');
        let replacement = grammarDictionary[cleanWord];
        if (replacement) {
            return word.toLowerCase().replace(cleanWord, replacement);
        }
        return word;
    });
    let result = corrected.join(' ');
    return result.charAt(0).toUpperCase() + result.slice(1);
}

// --- DISCORD EVENTS ---
client.on('ready', () => {
    console.log(`[BOT] Conectado como ${client.user.tag}`);
    client.user.setActivity('Koda Support Dashboard', { type: ActivityType.Watching });
});

client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    // Lógica de tickets: Detectar mensajes en canales de soporte
    const ticket = serverState.tickets.find(t => t.channelId === msg.channel.id);
    if (ticket) {
        const msgObject = {
            author: msg.author.username,
            avatar: msg.author.displayAvatarURL(),
            content: msg.content,
            timestamp: new Date().toISOString(),
            type: 'client'
        };
        ticket.messages.push(msgObject);
        // Aquí podríamos disparar un WebSocket para actualizar la web en tiempo real
    }
});

// --- API ROUTES ---

// Ruta de Login (Fix: "Cannot GET /login")
app.get('/login', (req, res) => {
    const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordUrl);
});

// Callback de Auth
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        const userData = userResponse.data;
        let userRole = 'USER';
        if (userData.id === OWNER_ID) userRole = 'OWNER';
        else if (serverState.supports.includes(userData.id)) userRole = 'SUPPORT';

        const sessionToken = tokenResponse.data.access_token;
        serverState.sessions[sessionToken] = { ...userData, role: userRole };

        // Redirigir al frontend (ajusta la URL a tu dominio de Vercel o GitHub Pages)
        res.redirect(`https://koda-raid.onrender.com/?token=${sessionToken}`);
    } catch (error) {
        console.error("Auth Error:", error.response?.data || error.message);
        res.status(500).send("Error en la autenticación con Discord");
    }
});

// Obtener datos del Dashboard
app.get('/api/status', (req, res) => {
    const token = req.headers.authorization;
    const session = serverState.sessions[token];
    if (!session) return res.status(401).json({ error: "No autorizado" });

    res.json({
        user: session,
        config: serverState.config,
        tickets: serverState.tickets.filter(t => 
            session.role === 'OWNER' || t.agentId === session.id || t.status === 'pending'
        ),
        stats: {
            active: serverState.tickets.filter(t => t.status === 'active').length,
            pending: serverState.tickets.filter(t => t.status === 'pending').length,
            agents: serverState.supports.length + 1
        }
    });
});

// Responder Ticket
app.post('/api/reply', async (req, res) => {
    const token = req.headers.authorization;
    const session = serverState.sessions[token];
    if (!session || session.role === 'USER') return res.status(403).json({ error: "Prohibido" });

    const { ticketId, message } = req.body;
    const ticket = serverState.tickets.find(t => t.id === ticketId);

    if (ticket) {
        const correctedMessage = processText(message);
        try {
            const channel = await client.channels.fetch(ticket.channelId);
            await channel.send(`**[Soporte - ${session.username}]:** ${correctedMessage}`);
            
            ticket.messages.push({
                author: session.username,
                content: correctedMessage,
                timestamp: new Date().toISOString(),
                type: 'support'
            });
            res.json({ success: true, message: correctedMessage });
        } catch (e) {
            res.status(500).json({ error: "Error enviando a Discord" });
        }
    }
});

// Servir el frontend si está en el mismo server
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[SERVER] Running on port ${PORT}`));
client.login(process.env.DISCORD_TOKEN);