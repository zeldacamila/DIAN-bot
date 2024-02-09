require('dotenv').config();

// Middleware para verificar la clave de API
function verifyAPIKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === process.env.API_KEY) {
        next();
    } else {
        res.status(401).json({ message: 'Acceso no autorizado: clave API inválida' });
    }
}


