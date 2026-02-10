const express = require('express');
const path = require('path');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// CONFIGURACIÓN (Usa tus IDs reales)
const CLIENT_ID = '1469577414022795346'; 
// Esta línea ahora lee la variable que configuraste en Render
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET; 
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

app.use(express.static(path.join(__dirname, 'public')));

app.get('/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/');

    // Validación de seguridad para Baldwin
    if (!CLIENT_SECRET) {
        return res.status(500).send("Error: No configuraste la variable DISCORD_CLIENT_SECRET en Render.");
    }

    try {
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
        });

        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const { username, avatar, id } = userRes.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;
        
        res.redirect(`/?user=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatarUrl)}`);
    } catch (error) {
        console.error('ERROR:', error.response?.data || error.message);
        res.status(500).send("Error al conectar con Discord. Revisa que el Client Secret en Render sea el correcto.");
    }
});

app.listen(PORT, () => console.log(`🚀 Koda en puerto ${PORT}`));