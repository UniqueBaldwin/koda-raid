const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const cors = require('cors');
const app = express();

// Esto permite que tu página de Vercel hable con el bot en Render
app.use(cors());

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

app.get('/encender', async (req, res) => {
    const canalId = '1434315111660650566'; // Tu ID de canal
    const texto = req.query.mensaje || '¡Koda reportándose desde el panel! 🫡';

    try {
        const canal = await client.channels.fetch(canalId);
        if (canal) {
            await canal.send(texto);
            return res.send('Mensaje enviado');
        }
        res.status(404).send('No encontré el canal especificado');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error interno al enviar mensaje');
    }
});

// El token se saca de las Variables de Entorno de Render
client.login(process.env.DISCORD_TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor listo'));