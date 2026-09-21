// ===== Foto do modelo de equipamento =====
// Mesmo padrão da foto do item do almoxarifado (routes/rotaAlmoxarifado.js): o
// arquivo vai pro disco em uploads/ com nome fixo (um novo upload sobrescreve o
// anterior em vez de acumular) e o banco guarda só o caminho relativo, servido
// estaticamente em /uploads (ver server.js).
//
// A diferença é onde o caminho é gravado: modelo de equipamento não é tabela, é
// um objeto dentro do JSONB `equipamentos.modelos` ({ id, marca, modelo, ... }).
// Por isso não existe migration — a foto entra como mais uma chave `foto` no
// próprio objeto do modelo, atualizada com jsonb_agg no elemento certo.
//
// O handler é compartilhado porque o upload acontece em dois lugares com
// permissões diferentes: no cadastro (/equipamentos, permissão Equipamentos) e
// no TI Mode (/ti, flag ti/supremo).
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pool = require("../db/conexaoDB");

const dirFotosModelos = path.join(__dirname, "..", "uploads", "equipamentos");
if (!fs.existsSync(dirFotosModelos)) fs.mkdirSync(dirFotosModelos, { recursive: true });

// O idmodelo vem do front (UUID gerado em Equipamentos.js) e vira nome de
// arquivo — sanitiza pra não deixar path traversal entrar pelo :idmodelo.
function idModeloSeguro(idmodelo) {
  return String(idmodelo || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

const storageFotoModelo = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dirFotosModelos),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `modelo_${idModeloSeguro(req.params.idmodelo)}${ext}`);
  },
});

const uploadFotoModelo = multer({
  storage: storageFotoModelo,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Envie um arquivo de imagem (PNG, JPG, etc.)."));
  },
});

// POST /:idequip/modelos/:idmodelo/foto — recebe o arquivo em FormData("foto").
function salvarFotoModeloEquipamento(req, res) {
  uploadFotoModelo.single("foto")(req, res, async (err) => {
    if (err) {
      console.error("Erro no upload da foto do modelo:", err);
      return res.status(400).json({ message: "Erro ao enviar a foto." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Envie um arquivo de imagem." });
    }

    const { idequip, idmodelo } = req.params;
    const idempresa = req.idempresa;
    const caminhoRelativo = `uploads/equipamentos/${req.file.filename}`;

    try {
      // Grava a chave `foto` só no elemento cujo id bate, preservando o resto do
      // array (marca/modelo/qtdeminima dos outros modelos).
      const result = await pool.query(
        `UPDATE equipamentos e
            SET modelos = (
              SELECT COALESCE(jsonb_agg(
                       CASE WHEN elem->>'id' = $1
                            THEN elem || jsonb_build_object('foto', $2::text)
                            ELSE elem END
                     ), '[]'::jsonb)
                FROM jsonb_array_elements(e.modelos) elem
            )
           FROM equipamentoempresas ee
          WHERE e.idequip = $3
            AND ee.idequip = e.idequip
            AND ee.idempresa = $4
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(e.modelos) x WHERE x->>'id' = $1
            )
          RETURNING e.idequip`,
        [idmodelo, caminhoRelativo, idequip, idempresa]
      );

      if (!result.rowCount) {
        return res.status(404).json({ message: "Modelo não encontrado neste equipamento." });
      }

      res.json({ message: "Foto salva com sucesso.", foto: caminhoRelativo });
    } catch (error) {
      console.error("Erro ao salvar foto do modelo de equipamento:", error);
      res.status(500).json({ message: "Erro ao salvar a foto." });
    }
  });
}

module.exports = { salvarFotoModeloEquipamento };
