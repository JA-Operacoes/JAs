// const express = require("express");
// const multer = require("multer");
// const router = express.Router();
// const path = require("path");
// const fs = require("fs");

// // Criação da pasta 'uploads' se não existir
// const uploadDir = path.join(__dirname, "..", "uploads");
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir);
//   console.log("📂 Pasta 'uploads/' criada.");
// }

// // Middleware multer configurado com uso de 'req.body'
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadDir);
//   },
//   filename: (req, file, cb) => {
//   const cliente = req.body.cliente || "sem_cliente";
//   const evento = req.body.evento || "sem_evento";

//   // Sanitize para evitar caracteres inválidos no nome do arquivo
//   const safeCliente = cliente.replace(/[^a-z0-9]/gi, "_").toLowerCase();
//   const safeEvento = evento.replace(/[^a-z0-9]/gi, "_").toLowerCase();

//   // Formatar data atual dd-mm-yyyy
//   const dataAtual = new Date();
//   const dataFormatada = `${String(dataAtual.getDate()).padStart(2, "0")}-${String(dataAtual.getMonth() + 1).padStart(2, "0")}-${dataAtual.getFullYear()}`;

//   const nomeFinal = `orcamento_${safeCliente}_${safeEvento}_${dataFormatada}${path.extname(file.originalname)}`;
//   console.log("📄 Nome final do arquivo:", nomeFinal);

//   cb(null, nomeFinal);
//   }
// });

// const upload = multer({ storage });

// // Rota para upload
// router.post("/", upload.single("arquivo"), (req, res) => {
//   if (!req.file) {
//     console.warn("⚠️ Nenhum arquivo recebido.");
//     return res.status(400).json({ erro: "Arquivo não recebido" });
//   }

//   console.log("✅ Arquivo recebido e salvo com sucesso:");
//   console.log("🗂 Caminho:", req.file.path);
//   console.log("📏 Tamanho:", req.file.size, "bytes");
//   console.log("📎 Tipo:", req.file.mimetype);

//   res.json({ mensagem: "PDF recebido e salvo com sucesso!", arquivo: req.file.filename });
// });

// module.exports = router;