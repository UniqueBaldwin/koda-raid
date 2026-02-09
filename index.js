const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// CONFIGURACIÓN MAESTRA
const OWNER_ID = '967660960682762251'; 
let supports = []; // IDs de Discord de tus ayudantes
let tickets = []; // Base de datos viva de conversaciones
let ticketConfig = { title: "Soporte Koda", color: "#6366f1", desc: "Haz clic abajo para abrir un ticket" };

// CORRECCIÓN SIN IA (Diccionario Pro)
function correctGrammar(text) {
    const rules = {
        'ke': 'que', 'k': 'que', 'pq': 'porque', 'tmb': 'también', 'ola': 'Hola',
        'aser': 'hacer', 'valla': 'vaya', 'haiga': 'haya', 'iba': 'iba', 'hiva': 'iba',
        'estubimos': 'estuvimos', 'grax': 'gracias', 'nomas': 'no más'
    };
    return text.split(' ').map(w => rules[w.toLowerCase()] || w).join(' ');
}

// EVENTO: EL BOT RECIBE MENSAJES EN DISCORD
client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    
    // Buscar si el mensaje pertenece a un ticket activo
    const ticket = tickets.find(t => t.channelId === msg.channel.id);
    if (ticket) {
        ticket.messages.push({
            role: 'client',
            author: msg.author.username,
            content: msg.content,
            time: new Date().toLocaleTimeString()
        });
    }
});

// --- API PARA EL PANEL WEB ---

// Verificar quién es quién
app.get('/api/auth/:id', (req, res) => {
    const id = req.params.id;
    let role = 'USER';
    if (id === OWNER_ID) role = 'OWNER';
    else if (supports.includes(id)) role = 'SUPPORT';
    res.json({ role });
});

// Agregar/Eliminar Supports (Solo para TI)
app.post('/api/admin/supports', (req, res) => {
    const { adminId, targetId, action } = req.body;
    if (adminId !== OWNER_ID) return res.status(403).send("No autorizado");
    
    if (action === 'add') { if(!supports.includes(targetId)) supports.push(targetId); }
    else supports = supports.filter(i => i !== targetId);
    res.json({ success: true, supports });
});

// Enviar respuesta corregida desde la Web a Discord
app.post('/api/reply', async (req, res) => {
    const { ticketId, agentId, agentName, content } = req.body;
    const ticket = tickets.find(t => t.id === ticketId);
    
    if (ticket && (agentId === OWNER_ID || supports.includes(agentId))) {
        const corrected = correctGrammar(content);
        const channel = await client.channels.fetch(ticket.channelId);
        
        await channel.send(`**[${agentName}]:** ${corrected}`);
        ticket.messages.push({ role: 'support', author: agentName, content: corrected, time: new Date().toLocaleTimeString() });
        res.json({ success: true, corrected });
    }
});

// Guardar Configuración del Setup
app.post('/api/setup', (req, res) => {
    if (req.body.adminId !== OWNER_ID) return res.status(403).send("No");
    ticketConfig = { ...req.body.config };
    res.json({ success: true });
});

client.login(process.env.DISCORD_TOKEN);
app.listen(3000, () => console.log("Koda Support Engine Ready"));