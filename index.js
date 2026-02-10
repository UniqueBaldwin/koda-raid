const express = require('express');
const path = require('path');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// CONFIGURACIÓN (Usa tus datos de image_95aa3b.png)
const CLIENT_ID = '1469577414022795346'; 
const CLIENT_SECRET = 'TU_CLIENT_SECRET_AQUI'; // <--- ¡PON EL TUYO!
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

app.use(express.static(path.join(__dirname, 'public')));

// RUTA LOGIN
app.get('/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
});

// RUTA CALLBACK (Procesa los datos del usuario)
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/');

    try {
        const response = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            scope: 'identify',
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${response.data.access_token}` }
        });

        const { username, avatar, id } = userRes.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;
        
        // Regresa al inicio con los datos
        res.redirect(`/?user=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatarUrl)}`);
    } catch (e) {
        res.send("Error al conectar con Discord");
    }
});

app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));