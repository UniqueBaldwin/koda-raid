const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Datos de tu aplicación (Extraídos de tus capturas)
const CLIENT_ID = '1469577414022795346'; 
const CLIENT_SECRET = 'TU_CLIENT_SECRET_AQUI'; // Búscalo en Discord Dev Portal > OAuth2
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para iniciar el login
app.get('/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(url);
});

// Ruta de retorno de Discord
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/?error=no_code');

    try {
        // 1. Cambiamos el código por un token de acceso
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            scope: 'identify',
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        // 2. Usamos el token para obtener los datos del usuario
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        const { username, avatar, id } = userResponse.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;

        // 3. Enviamos los datos de vuelta al dashboard vía URL
        res.redirect(`/?user=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatarUrl)}`);

    } catch (error) {
        console.error('Error en Auth:', error.response?.data || error.message);
        res.redirect('/?error=auth_failed');
    }
});

app.listen(PORT, () => console.log(`🚀 Koda Online en puerto ${PORT}`));