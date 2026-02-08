const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const cors = require('cors'); // Para que la web tenga permiso de hablar con el bot
const app = express();

app.use(cors());

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// --- ESTE ES EL PUNTO 1 ---
app.get('/encender', (req, res) => {
  // Busca el primer canal de texto donde el bot pueda escribir
  const canal = client.channels.cache.find(c => c.type === 0); 
  
  if (canal) {
    canal.send('¡Koda activado desde la web! 🚀');
    res.send('Acción ejecutada con éxito');
  } else {
    res.status(404).send('No encontré un canal para escribir');
  }
});
// --------------------------

client.login(process.env.DISCORD_TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor listo'));