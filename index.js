const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURACIÓN ---
const OWNER_ID = '1469577414022795346'; 
const CLIENT_ID = '1469577414022795346';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const TOKEN = process.env.DISCORD_TOKEN;
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

// "Base de datos" simple en un archivo
let db = { staff: [] };
const dbPath = path.join(__dirname, 'database.json');
if (fs.existsSync(dbPath)) db = JSON.parse(fs.readFileSync(dbPath));

const saveDB = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

// --- LÓGICA DE DISCORD (BOT) ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    new SlashCommandBuilder().setName('setup').setDescription('Instrucciones para configurar el dashboard'),
    new SlashCommandBuilder().setName('invite').setDescription('Enlace de invitación del bot'),
    new SlashCommandBuilder().setName('help').setDescription('Información sobre Koda y sus funciones'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Comandos Slash registrados');
    } catch (e) { console.error(e); }
})();

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'setup') {
        await interaction.reply('🛠️ **Configuración:** Ve a https://koda-raid.onrender.com, logueate y sigue los pasos en la pestaña "Setup".');
    }
    if (interaction.commandName === 'invite') {
        await interaction.reply(`🔗 **Invítame:** https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`);
    }
    if (interaction.commandName === 'help') {
        await interaction.reply('🤖 **Koda Bot:** Soy un sistema de gestión avanzada. Comandos: `/setup`, `/invite`, `/help`.');
    }
});

// --- RUTAS DEL DASHBOARD ---

app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code,
            grant_type: 'authorization_code', redirect_uri: REDIRECT_URI,
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const { username, avatar, id } = userRes.data;
        let role = (id === OWNER_ID) ? 'owner' : (db.staff.includes(id) ? 'staff' : 'user');
        const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;

        res.redirect(`/?user=${username}&avatar=${avatarUrl}&role=${role}&id=${id}`);
    } catch (e) { res.status(500).send("Error en Auth"); }
});

// API para que el Owner gestione el Staff
app.post('/api/staff/add', (req, res) => {
    const { ownerId, newStaffId } = req.body;
    if (ownerId !== OWNER_ID) return res.status(403).send("No eres el dueño");
    if (!db.staff.includes(newStaffId)) {
        db.staff.push(newStaffId);
        saveDB();
    }
    res.json(db.staff);
});

app.post('/api/staff/remove', (req, res) => {
    const { ownerId, targetId } = req.body;
    if (ownerId !== OWNER_ID) return res.status(403).send("No eres el dueño");
    db.staff = db.staff.filter(id => id !== targetId);
    saveDB();
    res.json(db.staff);
});

app.listen(10000, () => {
    console.log('🚀 Servidor y Bot listos');
    client.login(TOKEN);
});