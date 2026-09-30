// Freelancer pago via empreiteira (fornecedorempresas.categoria = 'EMPREITEIRA').
//
// O staff continua lançado um a um em staffeventos; quem tem staffeventos.idfornecedor sai do
// bloco Staff de Vencimentos e é pago como UMA conta do fornecedor por ciclo. Aqui mora:
//   - a regra de "em qual data de pagamento este evento cai" (calcularDataCiclo);
//   - a montagem dos ciclos (fornecedor × data) a partir dos staffeventos vinculados;
//   - a baixa do ciclo (paga os liberados; quem tem solicitação pendente fica em aberto).
//
// Um evento entra no primeiro ciclo cuja data é >= o vencimento de cachê dele (fim da
// desmontagem + 2 dias, a mesma regra do bloco Staff). Decisão da usuária em 2026-09-29: a data
// do ciclo não se ajusta a feriado, porque o pagamento fica agendado no banco.

const pool = require("../db/conexaoDB");

const CATEGORIA_EMPREITEIRA = "EMPREITEIRA";
const TIPOS_PGTO = ["EVENTO", "INTERVALO", "MENSAL"];
const DIA_MS = 86400000;

// Datas trafegam como 'YYYY-MM-DD'; a conta é feita em UTC puro pra somar dias sem fuso.
const paraUTC = (iso) => {
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
};
const deUTC = (t) => new Date(t).toISOString().slice(0, 10);
const somarDias = (iso, n) => deUTC(paraUTC(iso) + n * DIA_MS);

// Dia `dia` do mês (mes 1-12); mês curto cai no último dia (dia 31 em setembro = 30/09).
const diaNoMes = (ano, mes, dia) => {
    const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    return Date.UTC(ano, mes - 1, Math.min(dia, ultimo));
};

function configValida(cfg) {
    const tipo = cfg?.tipopgto;
    if (tipo === "INTERVALO") return Number(cfg.intervalodias) > 0 && !!cfg.dtbasepgto;
    if (tipo === "MENSAL") return Number(cfg.diamespgto) >= 1 && Number(cfg.diamespgto) <= 31;
    return true; // EVENTO ou sem configuração: vence com o próprio evento
}

// Data de pagamento (ciclo) de um evento com vencimento de cachê `vencimento`.
function calcularDataCiclo(cfg, vencimento) {
    if (!vencimento) return null;
    const venc = String(vencimento).slice(0, 10);
    if (!cfg || !configValida(cfg)) return venc;

    if (cfg.tipopgto === "INTERVALO") {
        const base = paraUTC(cfg.dtbasepgto);
        const alvo = paraUTC(venc);
        if (alvo <= base) return deUTC(base);
        const passo = Number(cfg.intervalodias) * DIA_MS;
        return deUTC(base + Math.ceil((alvo - base) / passo) * passo);
    }

    if (cfg.tipopgto === "MENSAL") {
        const [y, m] = venc.split("-").map(Number);
        const dia = Number(cfg.diamespgto);
        let t = diaNoMes(y, m, dia);
        if (t < paraUTC(venc)) t = m === 12 ? diaNoMes(y + 1, 1, dia) : diaNoMes(y, m + 1, dia);
        return deUTC(t);
    }

    return venc;
}

// Primeiro dia coberto pelo ciclo que paga em `dtciclo` (só pra exibir "ciclo 22/09 a 05/10").
function inicioDoCiclo(cfg, dtciclo) {
    if (!dtciclo || !cfg || !configValida(cfg)) return null;
    if (cfg.tipopgto === "INTERVALO") return somarDias(dtciclo, -Number(cfg.intervalodias) + 1);
    if (cfg.tipopgto === "MENSAL") {
        const [y, m] = dtciclo.split("-").map(Number);
        const anterior = m === 1 ? diaNoMes(y - 1, 12, Number(cfg.diamespgto)) : diaNoMes(y, m - 1, Number(cfg.diamespgto));
        return deUTC(anterior + DIA_MS);
    }
    return null;
}

const ehPago = (status) => String(status || "").startsWith("Pago");
// Mesma regra de /main/vencimentos: "Pago50" liquidou só metade.
const valorPago = (status, valor) => {
    if (!ehPago(status)) return 0;
    const m = String(status).match(/(\d+)/);
    return m ? valor * (Number(m[1]) / 100) : valor;
};
// Staffeventos vinculados a empreiteira na empresa, já com o vencimento de cachê do evento.
async function buscarLinhasVinculadas(db, idempresa, idfornecedor = null) {
    const { rows } = await db.query(
        `WITH fim_evento AS (
            SELECT o.idevento, MAX(o.dtfimdesmontagem)::date AS dtfim
              FROM orcamentos o
              JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
             WHERE oe.idempresa = $1
             GROUP BY o.idevento
         )
         SELECT se.idstaffevento, se.idfornecedor, se.idfuncionario, se.nmfuncionario, se.nmfuncao,
                se.idevento, se.nmevento, se.statusstaff, se.statuspgto, se.statuspgtoajdcto,
                se.comppgtocache, se.comppgtoajdcusto, se.compnotafiscal,
                GREATEST(COALESCE(se.vlrtotcache, 0), 0)::float AS vlrcache,
                GREATEST(COALESCE(se.vlrtotajdcusto, 0), 0)::float AS vlrajuda,
                jsonb_array_length(COALESCE(se.datasevento, '[]'::jsonb)) AS qtddiarias,
                to_char(dts.dtini, 'YYYY-MM-DD') AS dtini,
                to_char(dts.dtfim, 'YYYY-MM-DD') AS dtfim,
                to_char((COALESCE(fev.dtfim, dts.dtfim) + INTERVAL '2 days')::date, 'YYYY-MM-DD') AS dtvctocache,
                to_char(se.dtciclofornecedor, 'YYYY-MM-DD') AS dtciclofornecedor,
                EXISTS (
                    SELECT 1 FROM solicitacoes s
                     WHERE s.idregistroalterado = se.idstaffevento
                       AND s.status = 'Pendente'
                       AND COALESCE(s.categoria_log, '') <> 'statuscaixinha'
                ) AS temsolicitacaopendente,
                f.nmfantasia, f.razaosocial, f.cnpj, f.pix, f.tpfornecedor,
                COALESCE(fe.envianf, false) AS envianf, fe.tipopgto, fe.intervalodias,
                to_char(fe.dtbasepgto, 'YYYY-MM-DD') AS dtbasepgto, fe.diamespgto
           FROM staffeventos se
           JOIN staffempresas sem ON sem.idstaff = se.idstaff AND sem.idempresa = $1
           JOIN fornecedores f ON f.idfornecedor = se.idfornecedor
           LEFT JOIN fornecedorempresas fe ON fe.idfornecedor = se.idfornecedor AND fe.idempresa = $1
           LEFT JOIN fim_evento fev ON fev.idevento = se.idevento
           CROSS JOIN LATERAL (
                SELECT MIN(d::date) AS dtini, MAX(d::date) AS dtfim
                  FROM jsonb_array_elements_text(COALESCE(se.datasevento, '[]'::jsonb)) AS d
           ) dts
          WHERE se.idfornecedor IS NOT NULL
            AND se.statusstaff <> 'Deletado'
            AND ($2::int IS NULL OR se.idfornecedor = $2::int)`,
        [idempresa, idfornecedor]
    );
    return rows;
}

// Monta os ciclos (fornecedor × data de pagamento). `ano` filtra pela data do ciclo.
async function carregarCiclosFornecedor(idempresa, { ano = null, idfornecedor = null } = {}, db = pool) {
    const linhas = await buscarLinhasVinculadas(db, idempresa, idfornecedor);
    if (!linhas.length) return [];

    const ciclos = new Map();
    const linhaPorId = new Map();

    for (const l of linhas) {
        const cfg = l;
        const dtciclo = l.dtciclofornecedor || calcularDataCiclo(cfg, l.dtvctocache);
        if (!dtciclo) continue;

        const cache = l.statuspgto === "Rejeitado" ? 0 : l.vlrcache;
        const ajuda = l.statuspgtoajdcto === "Rejeitado" ? 0 : l.vlrajuda;
        const pagoLinha = valorPago(l.statuspgto, cache) + valorPago(l.statuspgtoajdcto, ajuda);
        const cacheQuitado = cache <= 0 || ehPago(l.statuspgto) && valorPago(l.statuspgto, cache) >= cache;
        const ajudaQuitada = ajuda <= 0 || ehPago(l.statuspgtoajdcto) && valorPago(l.statuspgtoajdcto, ajuda) >= ajuda;
        const quitado = cacheQuitado && ajudaQuitada;
        const pendente = l.statusstaff === "Pendente" || l.temsolicitacaopendente;
        const suspenso = l.statuspgto === "Suspenso" || l.statuspgtoajdcto === "Suspenso";

        const pessoa = {
            idstaffevento: l.idstaffevento,
            idfuncionario: l.idfuncionario,
            nome: l.nmfuncionario,
            funcao: l.nmfuncao,
            idevento: l.idevento,
            nmevento: l.nmevento,
            qtddiarias: Number(l.qtddiarias) || 0,
            dtini: l.dtini,
            dtfim: l.dtfim,
            dtvctocache: l.dtvctocache,
            cache,
            ajuda,
            total: cache + ajuda,
            pago: pagoLinha,
            aPagar: cache + ajuda - pagoLinha,
            statuspgto: l.statuspgto || "Pendente",
            statuspgtoajdcto: l.statuspgtoajdcto || "Pendente",
            quitado,
            pendente,
            suspenso,
            liberado: !quitado && !pendente && !suspenso,
        };
        const chave = `${l.idfornecedor}|${dtciclo}`;
        linhaPorId.set(l.idstaffevento, chave);

        if (!ciclos.has(chave)) {
            ciclos.set(chave, {
                idfornecedor: l.idfornecedor,
                nmfantasia: l.nmfantasia,
                razaosocial: l.razaosocial,
                cnpj: l.cnpj,
                pix: l.pix,
                tpfornecedor: l.tpfornecedor,
                envianf: l.envianf === true,
                tipopgto: l.tipopgto || "EVENTO",
                intervalodias: l.intervalodias,
                dtbasepgto: l.dtbasepgto,
                diamespgto: l.diamespgto,
                dtciclo,
                dtinicio: inicioDoCiclo(cfg, dtciclo),
                pessoas: [],
                ajustes: [],
                comprovante: null,
                notafiscal: null,
            });
        }
        const ciclo = ciclos.get(chave);
        ciclo.pessoas.push(pessoa);
        if (!ciclo.comprovante && ehPago(l.statuspgto) && l.dtciclofornecedor) ciclo.comprovante = l.comppgtocache || l.comppgtoajdcusto || null;
        if (!ciclo.notafiscal && l.compnotafiscal) ciclo.notafiscal = l.compnotafiscal;
    }

    // Crédito/Débito (staffajustefinanceiro) entra no total do empreiteiro (decisão 2026-09-25):
    // o pago fica no ciclo onde foi quitado; o pendente vai pro primeiro ciclo ainda em aberto
    // em que a pessoa aparece — uma vez só, nunca uma vez por linha dela.
    const idsFuncionarios = [...new Set(linhas.map((l) => l.idfuncionario))];
    const { rows: ajustes } = await db.query(
        `SELECT a.idajustefinanceiro, a.idfuncionario, a.tipo, a.valor::float AS valor, a.status,
                a.justificativa, a.idstaffeventopago, a.comprovante, seOrigem.nmevento AS nmevento_origem
           FROM staffajustefinanceiro a
           LEFT JOIN staffeventos seOrigem ON seOrigem.idstaffevento = a.idstaffeventoorigem
          WHERE a.idempresa = $1 AND a.idfuncionario = ANY($2) AND a.status IN ('Pendente', 'Pago')`,
        [idempresa, idsFuncionarios]
    );

    const ciclosOrdenados = [...ciclos.values()].sort((a, b) => a.dtciclo.localeCompare(b.dtciclo));
    for (const a of ajustes) {
        let destino = null;
        if (a.status === "Pago") {
            const chaveCiclo = linhaPorId.get(a.idstaffeventopago);
            if (chaveCiclo) destino = ciclos.get(chaveCiclo);
        } else {
            destino = ciclosOrdenados.find((c) => c.pessoas.some((p) => p.idfuncionario === a.idfuncionario && !p.quitado));
        }
        if (!destino) continue;
        const nomePessoa = destino.pessoas.find((p) => p.idfuncionario === a.idfuncionario)?.nome || "";
        destino.ajustes.push({ ...a, nome: nomePessoa, sinal: a.tipo === "Credito" ? 1 : -1 });
    }

    const resultado = [];
    for (const c of ciclosOrdenados) {
        if (ano && Number(c.dtciclo.slice(0, 4)) !== Number(ano)) continue;

        const somaAjustes = (filtro) => c.ajustes.filter(filtro).reduce((s, a) => s + a.sinal * a.valor, 0);
        const totalPessoas = c.pessoas.reduce((s, p) => s + p.total, 0);
        const pagoPessoas = c.pessoas.reduce((s, p) => s + p.pago, 0);
        const funcsLiberados = new Set(c.pessoas.filter((p) => p.liberado).map((p) => p.idfuncionario));

        c.total = totalPessoas + somaAjustes(() => true);
        c.pago = pagoPessoas + somaAjustes((a) => a.status === "Pago");
        c.saldo = c.total - c.pago;
        c.valorLiberado = c.pessoas.filter((p) => p.liberado).reduce((s, p) => s + p.aPagar, 0)
            + somaAjustes((a) => a.status === "Pendente" && funcsLiberados.has(a.idfuncionario));
        c.valorAguardando = c.pessoas.filter((p) => !p.quitado && (p.pendente || p.suspenso)).reduce((s, p) => s + p.aPagar, 0);
        c.qtdPessoas = new Set(c.pessoas.map((p) => p.idfuncionario)).size;
        c.qtdEventos = new Set(c.pessoas.map((p) => p.idevento)).size;
        c.temPendencia = c.pessoas.some((p) => !p.quitado && p.pendente);
        const tudoQuitado = c.pessoas.every((p) => p.quitado) && c.ajustes.every((a) => a.status === "Pago");
        c.status = tudoQuitado ? "Pago" : (c.pago > 0 ? "Parcial" : "Pendente");
        c.pessoas.sort((a, b) => (a.nmevento || "").localeCompare(b.nmevento || "") || (a.nome || "").localeCompare(b.nome || ""));
        resultado.push(c);
    }
    return resultado;
}

// Paga os liberados de um ciclo. Quem tem solicitação pendente (ou está suspenso) fica em
// aberto no mesmo ciclo e é pago depois, num novo clique (decisão da usuária em 2026-09-29).
// `clienteExterno`: roda dentro de uma transação já aberta por quem chamou (usado em teste).
async function pagarCicloFornecedor(idempresa, idfornecedor, dtciclo, { comprovante = null, notafiscal = null } = {}, clienteExterno = null) {
    const client = clienteExterno || await pool.connect();
    try {
        if (!clienteExterno) await client.query("BEGIN");
        const ciclos = await carregarCiclosFornecedor(idempresa, { idfornecedor }, client);
        const ciclo = ciclos.find((c) => c.dtciclo === dtciclo);
        if (!ciclo) throw Object.assign(new Error("Ciclo não encontrado para este fornecedor."), { status: 404 });

        const liberados = ciclo.pessoas.filter((p) => p.liberado);
        if (!liberados.length) {
            throw Object.assign(new Error("Nenhum lançamento liberado para pagar neste ciclo."), { status: 409 });
        }
        if (ciclo.envianf && !notafiscal && !ciclo.notafiscal) {
            throw Object.assign(new Error("Este fornecedor emite NF: anexe a nota fiscal do ciclo antes de pagar."), { status: 400 });
        }

        const ids = liberados.map((p) => p.idstaffevento);
        // FOR UPDATE: duas pessoas clicando Pagar no mesmo ciclo não podem gravar por cima
        // uma da outra (mesmo cuidado da aprovação de solicitações de staffeventos).
        await client.query(`SELECT 1 FROM staffeventos WHERE idstaffevento = ANY($1) FOR UPDATE`, [ids]);
        await client.query(
            `UPDATE staffeventos
                SET statuspgto = CASE WHEN statuspgto IN ('Pago', 'Rejeitado') THEN statuspgto ELSE 'Pago' END,
                    statuspgtoajdcto = CASE WHEN statuspgtoajdcto IN ('Pago', 'Rejeitado') THEN statuspgtoajdcto ELSE 'Pago' END,
                    dtciclofornecedor = $2::date,
                    comppgtocache = COALESCE($3, comppgtocache),
                    comppgtoajdcusto = COALESCE($3, comppgtoajdcusto),
                    compnotafiscal = COALESCE($4, compnotafiscal)
              WHERE idstaffevento = ANY($1)
                AND idfornecedor = $5`,
            [ids, dtciclo, comprovante, notafiscal, idfornecedor]
        );

        // Crédito/Débito pendente de quem foi pago agora: quita junto, apontando pro staffevento
        // do ciclo (idstaffeventopago), igual ao pagamento feito pelo bloco Staff.
        const primeiroIdPorFunc = new Map();
        liberados.forEach((p) => { if (!primeiroIdPorFunc.has(p.idfuncionario)) primeiroIdPorFunc.set(p.idfuncionario, p.idstaffevento); });
        const ajustesPagos = [];
        for (const a of ciclo.ajustes) {
            if (a.status !== "Pendente" || !primeiroIdPorFunc.has(a.idfuncionario)) continue;
            await client.query(
                `UPDATE staffajustefinanceiro
                    SET status = 'Pago', dtpagamento = now(), idstaffeventopago = $1,
                        comprovante = COALESCE($2, comprovante)
                  WHERE idajustefinanceiro = $3 AND idempresa = $4 AND status = 'Pendente'`,
                [primeiroIdPorFunc.get(a.idfuncionario), comprovante, a.idajustefinanceiro, idempresa]
            );
            ajustesPagos.push(a.idajustefinanceiro);
        }

        if (!clienteExterno) await client.query("COMMIT");
        return { idsPagos: ids, ajustesPagos, valorPago: ciclo.valorLiberado, valorAguardando: ciclo.valorAguardando };
    } catch (err) {
        if (!clienteExterno) await client.query("ROLLBACK");
        throw err;
    } finally {
        if (!clienteExterno) client.release();
    }
}

// Anexa comprovante ou NF do ciclo. NF vale pro ciclo inteiro (inclusive quem ainda não foi
// pago, pra liberar o botão Pagar); comprovante só nos staffeventos já pagos nesse ciclo.
async function anexarArquivoCiclo(idempresa, idfornecedor, dtciclo, campo, caminho) {
    const ciclos = await carregarCiclosFornecedor(idempresa, { idfornecedor });
    const ciclo = ciclos.find((c) => c.dtciclo === dtciclo);
    if (!ciclo) throw Object.assign(new Error("Ciclo não encontrado para este fornecedor."), { status: 404 });

    if (campo === "notafiscal") {
        const ids = ciclo.pessoas.map((p) => p.idstaffevento);
        await pool.query(`UPDATE staffeventos SET compnotafiscal = $1 WHERE idstaffevento = ANY($2) AND idfornecedor = $3`, [caminho, ids, idfornecedor]);
        return { ids };
    }

    const idsPagos = ciclo.pessoas.filter((p) => p.pago > 0).map((p) => p.idstaffevento);
    if (!idsPagos.length) throw Object.assign(new Error("Pague o ciclo antes de anexar o comprovante."), { status: 409 });
    await pool.query(
        `UPDATE staffeventos SET comppgtocache = $1, comppgtoajdcusto = $1 WHERE idstaffevento = ANY($2) AND idfornecedor = $3`,
        [caminho, idsPagos, idfornecedor]
    );
    const idsAjustes = ciclo.ajustes.filter((a) => a.status === "Pago").map((a) => a.idajustefinanceiro);
    if (idsAjustes.length) {
        await pool.query(
            `UPDATE staffajustefinanceiro SET comprovante = $1 WHERE idajustefinanceiro = ANY($2) AND idempresa = $3`,
            [caminho, idsAjustes, idempresa]
        );
    }
    return { ids: idsPagos };
}

// Remove a NF/listagem ou o comprovante do ciclo. O arquivo continua no servidor e o caminho
// antigo fica no log (logMiddleware da rota) — só deixa de estar ligado ao ciclo. Comprovante:
// limpa só onde está o MESMO arquivo do ciclo, pra não apagar um comprovante que alguém tenha
// posto numa pessoa específica pelo Staff.
async function removerAnexoCiclo(idempresa, idfornecedor, dtciclo, campo) {
    const ciclos = await carregarCiclosFornecedor(idempresa, { idfornecedor });
    const ciclo = ciclos.find((c) => c.dtciclo === dtciclo);
    if (!ciclo) throw Object.assign(new Error("Ciclo não encontrado para este fornecedor."), { status: 404 });
    const ids = ciclo.pessoas.map((p) => p.idstaffevento);

    if (campo === "notafiscal") {
        if (!ciclo.notafiscal) throw Object.assign(new Error("Este ciclo não tem anexo para remover."), { status: 409 });
        await pool.query(
            `UPDATE staffeventos SET compnotafiscal = NULL WHERE idstaffevento = ANY($1) AND idfornecedor = $2 AND compnotafiscal = $3`,
            [ids, idfornecedor, ciclo.notafiscal]
        );
        return { removido: ciclo.notafiscal };
    }

    if (!ciclo.comprovante) throw Object.assign(new Error("Este ciclo não tem comprovante para remover."), { status: 409 });
    await pool.query(
        `UPDATE staffeventos
            SET comppgtocache = CASE WHEN comppgtocache = $3 THEN NULL ELSE comppgtocache END,
                comppgtoajdcusto = CASE WHEN comppgtoajdcusto = $3 THEN NULL ELSE comppgtoajdcusto END
          WHERE idstaffevento = ANY($1) AND idfornecedor = $2`,
        [ids, idfornecedor, ciclo.comprovante]
    );
    await pool.query(
        `UPDATE staffajustefinanceiro SET comprovante = NULL WHERE idempresa = $1 AND comprovante = $2 AND idstaffeventopago = ANY($3)`,
        [idempresa, ciclo.comprovante, ids]
    );
    return { removido: ciclo.comprovante };
}

// Estorna o ciclo INTEIRO (decisão da usuária em 2026-09-29): tudo que foi pago por este ciclo
// (staffeventos com dtciclofornecedor = dtciclo) volta pra Pendente, junto com o crédito/débito
// quitado nele. Quem já tinha cachê/ajuda pago ANTES de entrar na empreiteira (sem
// dtciclofornecedor) não é tocado. O motivo vai pro obspospgto de cada pessoa, com a data.
async function estornarCicloFornecedor(idempresa, idfornecedor, dtciclo, motivo) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { rows } = await client.query(
            `SELECT se.idstaffevento, se.statuspgto, se.statuspgtoajdcto, se.comppgtocache
               FROM staffeventos se
               JOIN staffempresas sem ON sem.idstaff = se.idstaff AND sem.idempresa = $1
              WHERE se.idfornecedor = $2 AND se.dtciclofornecedor = $3::date
              FOR UPDATE OF se`,
            [idempresa, idfornecedor, dtciclo]
        );
        if (!rows.length) throw Object.assign(new Error("Nada foi pago neste ciclo para estornar."), { status: 409 });
        const ids = rows.map((r) => r.idstaffevento);

        const [ano, mes, dia] = dtciclo.split("-");
        const hoje = new Date().toLocaleDateString("pt-BR");
        const nota = `[${hoje}] Estorno do ciclo da empreiteira de ${dia}/${mes}/${ano}: ${motivo}`;
        await client.query(
            `UPDATE staffeventos
                SET statuspgto = CASE WHEN statuspgto LIKE 'Pago%' THEN 'Pendente' ELSE statuspgto END,
                    statuspgtoajdcto = CASE WHEN statuspgtoajdcto LIKE 'Pago%' THEN 'Pendente' ELSE statuspgtoajdcto END,
                    comppgtocache = NULL,
                    comppgtoajdcusto = NULL,
                    dtciclofornecedor = NULL,
                    obspospgto = TRIM(BOTH E'\\n' FROM COALESCE(obspospgto, '') || E'\\n' || $2)
              WHERE idstaffevento = ANY($1)`,
            [ids, nota]
        );
        const { rowCount: ajustesEstornados } = await client.query(
            `UPDATE staffajustefinanceiro
                SET status = 'Pendente', dtpagamento = NULL, idstaffeventopago = NULL, comprovante = NULL
              WHERE idempresa = $1 AND status = 'Pago' AND idstaffeventopago = ANY($2)`,
            [idempresa, ids]
        );
        await client.query("COMMIT");
        return { idsEstornados: ids, ajustesEstornados, anteriores: rows };
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    removerAnexoCiclo,
    estornarCicloFornecedor,
    CATEGORIA_EMPREITEIRA,
    TIPOS_PGTO,
    calcularDataCiclo,
    inicioDoCiclo,
    carregarCiclosFornecedor,
    pagarCicloFornecedor,
    anexarArquivoCiclo,
};
