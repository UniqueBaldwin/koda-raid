const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuración
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Simulación de DB y Auth simple
const CONFIG = { username: "admin", password: "123" };

// Rutas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === CONFIG.username && password === CONFIG.password) {
        res.redirect('/dashboard');
    } else {
        res.send("<script>alert('Error: Datos incorrectos'); window.location='/';</script>");
    }
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Lógica de Sockets (Lo que viste en tu captura)
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    socket.on('send_message', (data) => {
        const msgData = {
            text: data.text,
            timestamp: Date.now()
        };
        // Reenvía el mensaje a todos (incluyendo el dashboard)
        io.emit('new_message', msgData);
    });

    socket.on('disconnect', () => console.log('Usuario desconectado'));
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Koda Raid System corriendo en http://localhost:${PORT}`);
});