require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const { Server } = require("socket.io");
const http = require('http');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- CONFIGURACIÓN ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// DATOS CRÍTICOS (Asegúrate de tener esto en tu .env o variables de Render)
const CONFIG = {
    clientId: process.env.DISCORD_CLIENT_ID || 'TU_CLIENT_ID', 
    clientSecret: process.env.DISCORD_CLIENT_SECRET || 'TU_CLIENT_SECRET',
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'https://tu-app.onrender.com/auth/discord/callback',
    ownerId: '1469577414022795346', // TU ID REAL
    token: process.env.DISCORD_TOKEN || 'TU_TOKEN_BOT'
};

// --- BASE DE DATOS JSON (Persistencia) ---
const DB_FILE = './data.json';
let db = { staff: [], tickets: {}, configs: {} };
if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE));

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'koda-secret-key-super-segura',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 horas (poner secure: true si tienes HTTPS configurado con proxy)
}));

// Middleware de Protección de Rutas
function checkAuth(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login.html');
}

// --- BOT DISCORD ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel]
});

// Función de autocorrección simple
const autoCorrect = (text) => {
    let t = text.trim();
    t = t.charAt(0).toUpperCase() + t.slice(1);
    t = t.replace(/\bq\b/gi, 'que').replace(/\bxq\b/gi, 'porque').replace(/\bbn\b/gi, 'bien');
    if (!/[.!?]$/.test(t)) t += '.';
    return t;
};

// Eventos del Bot
client.on('interactionCreate', async interaction => {
    if (interaction.isButton() && interaction.customId === 'create_ticket') {
        // Crear Ticket
        const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9]/g, '');
        const guild = interaction.guild;
        
        // Verificar si ya tiene ticket (opcional, por ahora permitimos múltiples)
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        // Guardar en DB
        const ticketData = {
            id: channel.id,
            userId: interaction.user.id,
            username: interaction.user.username,
            guildId: guild.id,
            guildName: guild.name,
            status: 'open', // open, claimed, closed
            claimedBy: null,
            history: []
        };
        db.tickets[channel.id] = ticketData;
        saveDB();

        // Embed de bienvenida
        const embed = new EmbedBuilder()
            .setColor('#6366f1')
            .setDescription(`Hola <@${interaction.user.id}>, soporte conectará contigo pronto.`);
        await channel.send({ embeds: [embed] });

        await interaction.reply({ content: `Ticket creado: <#${channel.id}>`, ephemeral: true });
        
        // Notificar al socket
        io.emit('ticket_created', ticketData);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const ticket = db.tickets[message.channel.id];
    if (ticket) {
        // Es un mensaje en un ticket, guardar y enviar al dashboard
        const msgData = {
            author: message.author.username,
            avatar: message.author.displayAvatarURL(),
            content: message.content,
            role: 'user', // El usuario de discord siempre es 'user' en este contexto
            timestamp: Date.now()
        };
        ticket.history.push(msgData);
        saveDB();
        io.to(message.channel.id).emit('new_message', msgData); // Emitir a la sala del socket
    }
});

// --- RUTAS DE AUTENTICACIÓN ---
app.get('/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.clientId}&redirect_uri=${encodeURIComponent(CONFIG.redirectUri)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/login.html');

    try {
        // 1. Canjear código por token
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CONFIG.clientId,
            client_secret: CONFIG.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: CONFIG.redirectUri,
        }));

        const accessToken = tokenRes.data.access_token;

        // 2. Obtener datos del usuario
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const userData = userRes.data;
        
        // 3. Determinar Rol
        let role = 'user';
        if (userData.id === CONFIG.ownerId) role = 'owner';
        else if (db.staff.includes(userData.id)) role = 'support';

        // 4. Crear Sesión
        req.session.user = {
            id: userData.id,
            username: userData.username,
            avatar: `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`,
            role: role,
            accessToken: accessToken
        };

        res.redirect('/'); // Redirigir al dashboard principal
    } catch (e) {
        console.error(e);
        res.redirect('/login.html?error=auth_failed');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

// --- API ---
app.get('/api/me', checkAuth, (req, res) => {
    res.json(req.session.user);
});

app.get('/api/tickets', checkAuth, (req, res) => {
    // Owner y Support ven todos los tickets
    if (['owner', 'support'].includes(req.session.user.role)) {
        res.json(Object.values(db.tickets).filter(t => t.status !== 'closed'));
    } else {
        res.status(403).json([]);
    }
});

app.get('/api/guilds', checkAuth, async (req, res) => {
    // Obtener guilds del usuario desde Discord API
    try {
        const response = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${req.session.user.accessToken}` }
        });
        
        // Filtrar donde es Admin (Permissions & 0x8)
        const adminGuilds = response.data.filter(g => (g.permissions & 0x8) === 0x8);
        
        // Cruzar con los guilds donde está el bot
        const botGuildIds = client.guilds.cache.map(g => g.id);
        const mutualGuilds = adminGuilds.filter(g => botGuildIds.includes(g.id));
        
        res.json(mutualGuilds);
    } catch (e) {
        res.json([]);
    }
});

app.post('/api/setup', checkAuth, async (req, res) => {
    // Configurar Embed en un canal
    const { guildId, channelId, embedConfig } = req.body;
    
    // Validar seguridad basica (el usuario debe ser admin de ese guild, validación pendiente por brevedad)
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).send("Bot no está en el servidor");
    
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return res.status(404).send("Canal no encontrado");

    try {
        const embed = new EmbedBuilder()
            .setTitle(embedConfig.title)
            .setDescription(embedConfig.desc)
            .setColor(embedConfig.color);
            
        if(embedConfig.image) embed.setImage(embedConfig.image);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel(embedConfig.btnText)
                .setStyle(ButtonStyle.Success)
                .setEmoji(embedConfig.emoji || '📩')
        );

        await channel.send({ embeds: [embed], components: [row] });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Solo Owner
app.post('/api/staff', checkAuth, (req, res) => {
    if (req.session.user.role !== 'owner') return res.status(403).send("Unauthorized");
    const { id, action } = req.body; // action: add / remove
    
    if (action === 'add' && !db.staff.includes(id)) db.staff.push(id);
    if (action === 'remove') db.staff = db.staff.filter(s => s !== id);
    
    saveDB();
    res.json(db.staff);
});

app.get('/api/staff', checkAuth, (req, res) => {
    if (req.session.user.role !== 'owner') return res.status(403).json([]);
    res.json(db.staff);
});

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    socket.on('join_ticket', (ticketId) => {
        socket.join(ticketId); // Unirse a la sala del ticket
    });

    socket.on('send_message', async (data) => {
        // data: { ticketId, content, staffName }
        const ticket = db.tickets[data.ticketId];
        if (!ticket) return;

        // Autocorregir
        const cleanContent = autoCorrect(data.content);

        // Enviar a Discord
        try {
            const channel = await client.channels.fetch(data.ticketId);
            await channel.send(`**${data.staffName} (Support):** ${cleanContent}`);
            
            // Guardar y devolver al frontend (para que se vea bonito)
            const msgData = {
                author: data.staffName,
                content: cleanContent, // Enviamos el corregido
                role: 'support',
                timestamp: Date.now()
            };
            ticket.history.push(msgData);
            saveDB();
            
            io.to(data.ticketId).emit('new_message', msgData);

        } catch (e) { console.error(e); }
    });
});

// Servir la app solo si autenticado (el static 'public' sirve login.html si no hay ruta)
app.get('/', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

server.listen(PORT, () => {
    console.log(`🚀 Koda Raid System running on port ${PORT}`);
    client.login(CONFIG.token);
});