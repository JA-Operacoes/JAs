const express = require('express');
const router = express.Router();
const pool = require("../db/conexaoDB");
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

router.get("/:nrOrcamento/contrato", verificarPermissao("Orcamentos", "pesquisar"), async (req, res) => {
    const client = await pool.connect();
    try {
        const { nrOrcamento } = req.params;
        const idempresa = req.idempresa;

        // Buscar dados do orçamento
        const query = `
            SELECT 
                o.idorcamento, o.nrorcamento, o.vlrcliente, 
                o.dtinirealizacao, o.dtfimrealizacao,
                c.nmfantasia AS cliente_nome, c.cnpj AS cliente_cnpj, c.endereco AS cliente_endereco,
                e.nmevento AS evento_nome, lm.descmontagem AS local_montagem
            FROM orcamentos o
            JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
            LEFT JOIN clientes c ON o.idcliente = c.idcliente
            LEFT JOIN eventos e ON o.idevento = e.idevento
            LEFT JOIN localmontagem lm ON o.idmontagem = lm.idmontagem
            WHERE o.nrorcamento = $1 AND oe.idempresa = $2
            LIMIT 1
        `;
        const result = await client.query(query, [nrOrcamento, idempresa]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Orçamento não encontrado" });
        }

        const dados = result.rows[0];
        dados.data_assinatura = new Date().toLocaleDateString("pt-BR");
        dados.nr_orcamento = nrOrcamento;
        dados.valor_total = dados.vlrcliente;

        // Chama Python
        const pythonScript = path.join(__dirname, "../scripts/gerar_contrato.py");
        const python = spawn("python3", [pythonScript]);
        python.stdin.write(JSON.stringify(dados));
        python.stdin.end();

        let output = "";
        python.stdout.on("data", (data) => { output += data.toString(); });
        python.stderr.on("data", (data) => { console.error("Python stderr:", data.toString()); });

        python.on("close", (code) => {
            if (code !== 0) {
                console.error("Python finalizou com erro. Código:", code, "Output:", output);
                return res.status(500).json({ error: "Erro ao gerar contrato (Python)" });
            }

            const filePath = path.join(__dirname, "../public/contratos", output.trim());

            if (!fs.existsSync(filePath)) {
                return res.status(500).json({ error: "Arquivo não encontrado após gerar contrato" });
            }

            // Forçar download
            res.download(filePath, output.trim(), (err) => {
                if (err) console.error("Erro ao enviar arquivo:", err);
            });
        });

    } catch (error) {
        console.error("Erro ao gerar contrato:", error);
        res.status(500).json({ error: "Erro ao gerar contrato", detail: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;