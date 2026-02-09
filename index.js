const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// --- CONSTANTES DE PODER ---
const OWNER_ID = '967660960682762251';
const CLIENT_ID = '1469577414022795346';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

// --- BASE DE DATOS EN MEMORIA (Persistence Mock) ---
let storage = {
    config: { title: "Koda Support", color: "#6366f1", desc: "Bienvenido al sistema de soporte de Koda. ¿En qué podemos ayudarte?", footer: "Koda Systems 2024" },
    supports: [], // IDs de ayudantes autorizados
    activeTickets: [], // { id, userId, userName, avatar, channelId, agentId, status: 'pending'|'active', messages: [] }
    logs: [],
    sessions: {} 
};

// --- MOTOR DE GRAMÁTICA (Corregido y Extendido) ---
function kodaGrammar(text) {
    if (!text) return "";
    const rules = {
        'k': 'que', 'ke': 'que', 'pq': 'porque', 'tmb': 'también', 'ola': 'Hola',
        'haiga': 'haya', 'aser': 'hacer', 'valla': 'vaya', 'iba': 'iba', 'hiva': 'iba',
        'estubimos': 'estuvimos', 'grax': 'gracias', 'nomas': 'no más', 'pa': 'para',
        'aki': 'aquí', 'tengo k': 'tengo que', 'estoy k': 'estoy que'
    };
    let words = text.split(/\s+/);
    let corrected = words.map(w => {
        let clean = w.toLowerCase().replace(/[.,!¡?¿]/g, '');
        return rules[clean] ? w.toLowerCase().replace(clean, rules[clean]) : w;
    });
    // Forzar Mayúscula inicial
    let final = corrected.join(' ');
    return final.charAt(0).toUpperCase() + final.slice(1);
}

// --- LÓGICA DE DISCORD ---
client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    // Detectar si el mensaje es en un canal de ticket
    const ticket = storage.activeTickets.find(t => t.channelId === msg.channel.id);
    if (ticket) {
        const msgData = {
            author: msg.author.username,
            avatar: msg.author.displayAvatarURL(),
            content: msg.content,
            role: 'client',
            timestamp: new Date().toISOString()
        };
        ticket.messages.push(msgData);
        console.log(`[Ticket ${ticket.id}] Mensaje de cliente: ${msg.content}`);
    }
});

// --- API ROUTES ---

// Middleware de Auth
const auth = (req, res, next) => {
    const token = req.headers.authorization;
    if (!storage.sessions[token]) return res.status(401).json({ error: "Sesión expirada" });
    req.user = storage.sessions[token];
    next();
};

// Login OAuth2
app.get('/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI
        }));
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const user = userRes.data;
        let role = 'USER';
        if (user.id === OWNER_ID) role = 'OWNER';
        else if (storage.supports.includes(user.id)) role = 'SUPPORT';

        const token = tokenRes.data.access_token;
        storage.sessions[token] = { ...user, role, loginTime: Date.now() };
        
        res.redirect(`https://koda-support.vercel.app/?token=${token}`);
    } catch (e) { res.status(500).send("Error en la autenticación"); }
});

// Obtener Estado Global (Dashboard)
app.get('/api/dashboard', auth, (req, res) => {
    res.json({
        user: req.user,
        config: storage.config,
        tickets: storage.activeTickets,
        supports: storage.supports,
        isOwner: req.user.id === OWNER_ID
    });
});

// Gestionar Personal (Solo OWNER)
app.post('/api/admin/supports', auth, (req, res) => {
    if (req.user.id !== OWNER_ID) return res.status(403).json({ error: "No eres el Owner" });
    const { targetId, action } = req.body;

    if (action === 'add') {
        if (!storage.supports.includes(targetId)) storage.supports.push(targetId);
    } else {
        storage.supports = storage.supports.filter(id => id !== targetId);
    }
    res.json({ success: true, list: storage.supports });
});

// Responder Ticket (Didi Mode)
app.post('/api/tickets/reply', auth, async (req, res) => {
    const { ticketId, content } = req.body;
    const ticket = storage.activeTickets.find(t => t.id === ticketId);
    
    if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });
    if (ticket.status === 'pending') return res.status(400).json({ error: "Debes aceptar el ticket primero" });

    const corrected = kodaGrammar(content);
    
    try {
        const channel = await client.channels.fetch(ticket.channelId);
        await channel.send(`**[Soporte - ${req.user.username}]:** ${corrected}`);
        
        ticket.messages.push({
            author: req.user.username,
            role: 'support',
            content: corrected,
            timestamp: new Date().toISOString()
        });
        res.json({ success: true, corrected });
    } catch (e) { res.status(500).json({ error: "Error enviando mensaje a Discord" }); }
});

// Aceptar Ticket (El reclamo tipo Didi)
app.post('/api/tickets/claim', auth, (req, res) => {
    const { ticketId } = req.body;
    const ticket = storage.activeTickets.find(t => t.id === ticketId);
    
    if (ticket && ticket.status === 'pending') {
        ticket.status = 'active';
        ticket.agentId = req.user.id;
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "Ticket ya tomado o inexistente" });
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000);