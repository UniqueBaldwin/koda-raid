const { Client, GatewayIntentBits, Partials, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const axios = require('axios');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIG ---
const CONFIG = {
    ownerId: '1469577414022795346', // TU ID
    clientId: '1469577414022795346', // ID DEL BOT
    clientSecret: process.env.DISCORD_CLIENT_SECRET, 
    token: process.env.DISCORD_TOKEN,
    redirectUri: 'https://koda-raid.onrender.com/auth/callback' // CAMBIA ESTO A TU URL REAL
};

// --- BASE DE DATOS LOCAL ---
const DB_PATH = './database.json';
let db = { staff: [], tickets: {}, configs: {} }; // configs guarda la personalización por servidor

if (fs.existsSync(DB_PATH)) {
    db = JSON.parse(fs.readFileSync(DB_PATH));
}
function saveDB() { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

// --- BOT DISCORD ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel]
});

// --- UTILIDAD: CORRECTOR ORTOGRÁFICO BÁSICO ---
function autoCorrect(text) {
    if (!text) return "";
    let formatted = text.trim();
    // 1. Mayúscula inicial
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    // 2. Punto final si no tiene
    if (!/[.!?]$/.test(formatted)) formatted += ".";
    // 3. Reemplazos simples (puedes añadir más)
    const fixes = { "q ": "que ", "k ": "que ", "bn": "bien", "xq": "porque" };
    for (const [key, val] of Object.entries(fixes)) {
        formatted = formatted.replace(new RegExp(`\\b${key}`, 'gi'), val);
    }
    return formatted;
}

client.on('ready', () => console.log(`🤖 Logueado como ${client.user.tag}`));

// ESCUCHAR MENSAJES EN DISCORD (DEL USUARIO)
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    // Si el mensaje es en un canal de ticket registrado
    const ticketId = message.channel.id;
    if (db.tickets[ticketId]) {
        // Enviar a la Web (Socket.io)
        io.emit('discordMessage', {
            ticketId: ticketId,
            author: message.author.username,
            avatar: message.author.displayAvatarURL(),
            content: message.content,
            timestamp: new Date().toLocaleTimeString()
        });
    }
});

// MANEJAR CREACIÓN DE TICKETS (BOTONES)
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const { customId, guild } = interaction;
        if (customId === 'create_ticket') {
            await interaction.deferReply({ ephemeral: true });
            
            // Crear canal
            const channel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });

            // Guardar en DB
            db.tickets[channel.id] = {
                owner: interaction.user.id,
                claimedBy: null, // Nadie lo ha tomado aún
                status: 'open',
                guildId: guild.id,
                messages: []
            };
            saveDB();

            const embed = new EmbedBuilder().setDescription(`Hola ${interaction.user}, espera a que un miembro del Staff te atienda.`);
            await channel.send({ embeds: [embed] });

            await interaction.editReply(`Ticket creado: ${channel}`);
            
            // AVISAR A LA WEB QUE HAY TICKET NUEVO
            io.emit('newTicketIncoming', {
                id: channel.id,
                user: interaction.user.username,
                guild: guild.name
            });
        }
    }
});

// --- RUTAS EXPRESS ---

// Login
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send("No code provided");
    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CONFIG.clientId, client_secret: CONFIG.clientSecret, code,
            grant_type: 'authorization_code', redirect_uri: CONFIG.redirectUri, scope: 'identify guilds'
        }));
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });
        const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
             headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const { username, avatar, id } = userRes.data;
        let role = (id === CONFIG.ownerId) ? 'owner' : (db.staff.includes(id) ? 'support' : 'user');
        
        // Guardar sesión simple en query (Inseguro para prod, útil para demo)
        // Pasamos los guilds codificados
        const validGuilds = guildsRes.data.filter(g => (g.permissions & 0x8) === 0x8); // Solo admins
        // En producción usaríamos sessions de verdad
        
        res.redirect(`/?user=${username}&avatar=${id}/${avatar}&role=${role}&id=${id}&token=${tokenRes.data.access_token}`);
    } catch (e) { console.error(e); res.send("Error Login"); }
});

// API: Obtener servidores mutuos (Donde el usuario es admin Y el bot está)
app.get('/api/guilds', async (req, res) => {
    const userId = req.query.userId;
    if(!userId) return res.status(400).send([]);
    
    // Filtrar servidores donde el bot está
    const botGuilds = client.guilds.cache.map(g => g.id);
    // Nota: Esto requiere que pases los guilds del usuario desde el front o guardes sesión.
    // Para simplificar, asumiremos que el frontend envía los IDs donde es admin, y validamos aquí.
    
    // Simulación: devolver todos los del bot para demo (en prod cruzar datos)
    const mutuals = client.guilds.cache.map(g => ({
        id: g.id, 
        name: g.name, 
        icon: g.iconURL(),
        memberCount: g.memberCount
    }));
    res.json(mutuals);
});

// API: Enviar Configuración de Ticket (Setup)
app.post('/api/setup/ticket', async (req, res) => {
    const { guildId, channelId, embedData } = req.body;
    
    try {
        const guild = client.guilds.cache.get(guildId);
        if(!guild) return res.status(404).send("Guild no encontrada");
        
        const channel = guild.channels.cache.get(channelId);
        if(!channel) return res.status(404).send("Canal no encontrado");

        // Construir Embed
        const embed = new EmbedBuilder()
            .setTitle(embedData.title)
            .setDescription(embedData.desc)
            .setColor(embedData.color);
        
        if(embedData.image) embed.setImage(embedData.image);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel(embedData.btnText)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(embedData.btnEmoji || '📩')
            );

        await channel.send({ embeds: [embed], components: [row] });
        
        // Guardar config
        db.configs[guildId] = embedData;
        saveDB();

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// API: Agregar Staff (Solo Owner)
app.post('/api/staff/add', (req, res) => {
    const { ownerId, newStaffId } = req.body;
    if (ownerId !== CONFIG.ownerId) return res.status(403).send("Solo Owner");
    if (!db.staff.includes(newStaffId)) {
        db.staff.push(newStaffId);
        saveDB();
    }
    res.json(db.staff);
});

// --- SOCKET.IO (CHAT EN TIEMPO REAL) ---
io.on('connection', (socket) => {
    console.log('🔌 Usuario conectado al socket');

    // Support reclama un ticket
    socket.on('claimTicket', ({ ticketId, staffUser }) => {
        if(db.tickets[ticketId]) {
            db.tickets[ticketId].claimedBy = staffUser;
            db.tickets[ticketId].status = 'claimed';
            saveDB();
            io.emit('ticketUpdate', { ticketId, status: 'claimed', staff: staffUser });
        }
    });

    // Support envía mensaje desde la Web
    socket.on('staffMessage', async ({ ticketId, content, staffName }) => {
        if (!db.tickets[ticketId]) return;

        // 1. Autocorrección
        const cleanContent = autoCorrect(content);

        // 2. Enviar a Discord usando el Bot
        try {
            const channel = await client.channels.fetch(ticketId);
            if (channel) {
                // Webhook o mensaje directo del bot con formato
                await channel.send(`**${staffName} (Support):** ${cleanContent}`);
            }
        } catch (e) { console.error("Error enviando a Discord", e); }
    });
});

server.listen(3000, () => {
    console.log('🚀 Server running on port 3000');
    client.login(CONFIG.token);
});