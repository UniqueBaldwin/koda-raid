const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000; // Render usa el 10000 por defecto

// Configuración de Discord (Basado en tus capturas)
const CLIENT_ID = '1469577414022795346'; 
const REDIRECT_URI = 'https://koda-raid.onrender.com/auth/callback';

app.use(cors());
app.use(express.json());

// Servir la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// --- RUTAS ---

// Arregla el error "Cannot GET /login"
app.get('/login', (req, res) => {
    const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordUrl);
});

// Ruta para cuando el usuario acepta en Discord
app.get('/auth/callback', (req, res) => {
    // Redirige al inicio con un mensaje de éxito simulado
    res.redirect('/?auth=success');
});

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Koda corriendo en el puerto ${PORT}`);
});