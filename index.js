const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const cors = require('cors'); // Para que la web tenga permiso de hablar con el bot
const app = express();

app.use(cors());

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// --- ESTE ES EL PUNTO 1 ---
app.get('/encender', (req, res) => {
  const canalId = '1434315111660650566'; // Pega aquí el ID que copiaste
  const canal = client.channels.cache.get(canalId);
  
  if (canal) {
    const texto = req.query.mensaje || '¡Koda reportándose! 🫡';
    canal.send(texto);
    return res.send('Mensaje enviado al canal');
  } 
  
  res.status(404).send('No encontré el canal. ¿Koda tiene permiso de verlo?');
});
// --------------------------

client.login(process.env.DISCORD_TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor listo')); 