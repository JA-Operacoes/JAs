const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Caminho da pasta onde os contratos serão armazenados
const contratosUploadDir = path.join(__dirname, '../uploads/contratos');

// Cria a pasta caso não exista
if (!fs.existsSync(contratosUploadDir)) {
    fs.mkdirSync(contratosUploadDir, { recursive: true });
}

// Configuração do armazenamento
const storageContratos = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, contratosUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtro de tipo de arquivo (somente imagem ou PDF)
const fileFilterContratos = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não suportado! Apenas imagens e PDFs são permitidos.'), false);
    }
};

// Middleware final do Multer
const uploadContratosMiddleware = multer({
    storage: storageContratos,
    fileFilter: fileFilterContratos,
    limits: {
        fileSize: 50 * 1024 * 1024 // 10MB
    }
}).fields([
    { name: 'file', maxCount: 1 }
]);

module.exports = uploadContratosMiddleware;
