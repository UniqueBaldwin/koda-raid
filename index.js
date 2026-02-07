const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Esto es para que la página de Vercel pueda avisarle al bot
app.get('/encender', (req, res) => {
  client.channels.cache.first().send('¡Koda encendido desde la web! 🚀');
  res.send('Acción ejecutada');
});

// Mantener el bot vivo
client.login('DISCORD_TOKEN'); 
app.listen(3000, () => console.log('Servidor listo'));