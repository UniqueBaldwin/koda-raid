const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// 1. Middlewares Esenciales
app.use(cors());
app.use(express.json());

// 2. Servir Archivos Estáticos (Logo, CSS, JS)
// Esto permite que 'logo.png' se vea si entras a /logo.png
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
} else {
    console.error("⚠️ ERROR: No existe la carpeta 'public'.");
}

// 3. Variables (Pon estas en Render -> Environment)
const CLIENT_ID = '1336449195325882428'; 
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback'; // ¡Asegúrate que esta URL coincida en Discord Dev Portal!

// --- RUTAS DEL SERVIDOR (Aquí arreglamos el Cannot GET) ---

// Ruta de Login
app.get('/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
});

// Ruta de Callback (Cuando Discord te devuelve al sitio)
app.get('/auth/callback', (req, res) => {
    // Aquí simulamos que todo salió bien para mostrarte el dashboard
    res.redirect('/?token=access_granted_123');
});

// API del Corrector
app.post('/api/correct', (req, res) => {
    const { text } = req.body;
    if(!text) return res.json({ corrected: "" });

    const dict = { 'k': 'que', 'q': 'que', 'pq': 'porque', 'ola': 'Hola', 'grax': 'gracias' };
    let words = text.split(' ').map(w => dict[w.toLowerCase()] || w);
    let fixed = words.join(' ');
    
    res.json({ corrected: fixed.charAt(0).toUpperCase() + fixed.slice(1) });
});

// 4. Ruta Catch-All (IMPORTANTE: Esta va AL FINAL)
// Si entra a cualquier otra cosa, le mostramos la app
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// --- BOT DISCORD ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`🤖 Koda Bot conectado: ${client.user.tag}`);
    client.user.setActivity('Dashboard Koda', { type: ActivityType.Watching });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Web lista en puerto ${PORT}`));

if(process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch(e => console.log("Falta Token"));
}