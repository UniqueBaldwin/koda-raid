const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// --- BASE DE DATOS EN MEMORIA (Elaborada) ---
const OWNER_ID = 'TU_CLIENT_ID_AQUI';
const db = {
    config: { title: "Soporte Koda", color: "#5865F2", welcome: "Hola, ¿en qué ayudamos?" },
    supports: new Set(['ID_DE_UN_AMIGO']), // Lista de IDs autorizados
    queue: [], // Tickets esperando [{userId, channelId, firstMsg, time}]
    activeTickets: {}, // { supportId: {userId, channelId, messages: []} }
    allMessages: [] // Historial global para el Owner
};

// --- MOTOR DE GRAMÁTICA PRO (Sin IA) ---
function masterGrammar(text) {
    let t = text.trim();
    if (!t) return "";
    
    // Diccionario de corrección rápida
    const rules = [
        { reg: /\b(k|q|que)\b/gi, rep: "que" },
        { reg: /\b(porke|pq|porque)\b/gi, rep: "porque" },
        { reg: /\b(v|verda)\b/gi, rep: "verdad" },
        { reg: /\b(tmb|tmbn)\b/gi, rep: "también" },
        { reg: /\b(ola)\b/gi, rep: "Hola" },
        { reg: /\bhacer\s+v\b/gi, rep: "hacer ver" }
    ];
    
    rules.forEach(r => t = t.replace(r.reg, r.rep));
    
    // Capitalización inteligente
    t = t.charAt(0).toUpperCase() + t.slice(1);
    if (!/[.!?]$/.test(t)) t += ".";
    
    return t;
}

// --- LÓGICA DE DISCORD ---
client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    // Lógica para abrir ticket (ejemplo: mensaje privado al bot)
    if (!msg.guild) {
        const existing = db.queue.find(q => q.userId === msg.author.id);
        if (!existing) {
            const ticket = { 
                userId: msg.author.id, 
                username: msg.author.username,
                firstMsg: masterGrammar(msg.content),
                time: new Date().toLocaleTimeString()
            };
            db.queue.push(ticket);
            io.emit('new_request', ticket); // Notificar a todos los supports en la web
            msg.reply("⏳ Tu solicitud ha sido enviada a nuestro equipo de soporte. Espera un momento...");
        }
    } else {
        // Si el mensaje es en un canal de ticket ya activo
        // Buscar quién tiene este canal asignado
        for (const [supId, session] of Object.entries(db.activeTickets)) {
            if (session.userId === msg.author.id) {
                const cleanMsg = {
                    role: 'client',
                    user: msg.author.username,
                    text: masterGrammar(msg.content),
                    time: new Date().toLocaleTimeString()
                };
                session.messages.push(cleanMsg);
                db.allMessages.push(cleanMsg);
                io.to(supId).emit('receive_msg', cleanMsg); // Solo al support asignado
                io.to('admins').emit('monitor_msg', cleanMsg); // Al dueño
            }
        }
    }
});

// --- COMUNICACIÓN WEB (SOCKETS) ---
io.on('connection', (socket) => {
    socket.on('auth', (userId) => {
        socket.userId = userId;
        if (userId === OWNER_ID) socket.join('admins');
        console.log(`Usuario conectado: ${userId}`);
    });

    // Acción tipo DIDI: Aceptar Ticket
    socket.on('accept_ticket', (userId) => {
        const index = db.queue.findIndex(q => q.userId === userId);
        if (index !== -1) {
            const ticket = db.queue.splice(index, 1)[0];
            db.activeTickets[socket.userId] = { ...ticket, messages: [] };
            socket.emit('ticket_assigned', db.activeTickets[socket.userId]);
            io.emit('update_queue', db.queue); // Quitar de la lista de otros supports
        }
    });

    // Enviar mensaje del Support al Cliente
    socket.on('send_to_client', async ({ text, userId }) => {
        const user = await client.users.fetch(userId);
        const cleanText = masterGrammar(text);
        await user.send(`**[Soporte]:** ${cleanText}`);
        
        const msgObj = { role: 'support', text: cleanText, time: new Date().toLocaleTimeString() };
        db.activeTickets[socket.userId].messages.push(msgObj);
        socket.emit('receive_msg', msgObj);
    });
});

server.listen(3000, () => console.log('🚀 Koda Pro Backend en puerto 3000'));
client.login('TU_TOKEN');