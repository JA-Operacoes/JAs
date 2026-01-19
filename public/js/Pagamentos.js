import { fetchComToken, aplicarTema } from '../utils/utils.js';

document.addEventListener("DOMContentLoaded", function () {
    const idempresa = localStorage.getItem("idempresa");
    if (idempresa) {
        const apiUrl = `/empresas/${idempresa}`;
        fetchComToken(apiUrl)
            .then(empresa => {
                aplicarTema(empresa.nmfantasia);
            })
            .catch(error => console.error("❌ Erro ao buscar tema:", error));
    }
});

// --- FUNÇÕES AUXILIARES ---

function formatarDataBR(dataStr) {
    if (!dataStr) return '-';
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function prepararNumeroParaEnvio(valor) {
    if (!valor) return 0;
    let sValor = valor.toString();
    if (sValor.includes('.') && sValor.includes(',')) sValor = sValor.replace(/\./g, '');
    return parseFloat(sValor.replace(',', '.'));
}

// --- FUNÇÕES DE LÓGICA ---

async function carregarLancamentosParaPagto() {
    const select = document.querySelector("#idLancamentoSelect");
    if (!select) return;

    try {
        const lancamentos = await fetchComToken("/pagamentos/lancamentos");
        select.innerHTML = '<option value="" disabled selected>Selecione o Lançamento...</option>';
        
        lancamentos.forEach(l => {
            const opt = document.createElement("option");
            opt.value = l.idlancamento;
            opt.textContent = `${l.idlancamento} - ${l.descricao}`;
            opt.dataset.valor = l.vlrestimado;
            opt.dataset.vctobase = l.vctobase;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error("Erro ao carregar lançamentos:", error);
    }
}

async function buscarDadosParcela(idLanc, vctoBaseOriginal) {
    try {
        const ultimoPagto = await fetchComToken(`/pagamentos/ultimo/${idLanc}`);
        const campoParcela = document.querySelector("#numParcela");
        const campoVcto = document.querySelector("#dtvcto");

        if (ultimoPagto && ultimoPagto.numparcela > 0) {
            const proximaParcela = parseInt(ultimoPagto.numparcela) + 1;
            campoParcela.value = proximaParcela;

            const dataUltimoVcto = new Date(ultimoPagto.dtvcto);
            dataUltimoVcto.setMonth(dataUltimoVcto.getMonth() + 1);
            campoVcto.value = dataUltimoVcto.toISOString().split('T')[0];
        } else {
            campoParcela.value = 1;
            campoVcto.value = vctoBaseOriginal ? vctoBaseOriginal.split('T')[0] : "";
        }
    } catch (error) {
        console.warn("Erro ao calcular próxima parcela.");
        document.querySelector("#numParcela").value = 1;
    }
}

// async function carregarHistoricoPagto(idLanc) {
//     const corpoTabela = document.querySelector("#corpoHistoricoPagto");
//     if (!corpoTabela) return;

//     try {
//         const pagamentos = await fetchComToken(`/pagamentos/historico/${idLanc}`);
//         corpoTabela.innerHTML = ""; 

//         console.log("Pagamentos carregados:", pagamentos);

//         const eSupremo = typeof temPermissao === "function" ? temPermissao("Pagamentos", "supremo") : false;
//         const podeAlterar = typeof temPermissao === "function" ? temPermissao("Pagamentos", "alterar") : false;

//         // Apenas permite editar se AMBAS as condições forem verdadeiras
//         const permissaoTotalEdicao = eSupremo && podeAlterar;
        

//         pagamentos.forEach(p => {
//             const tr = document.createElement("tr");
//             const statusClass = p.status ? p.status.toLowerCase().trim() : 'pendente';
//             const valorFormatado = parseFloat(p.vlrpago).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

//             const btnEditarHTML = permissaoTotalEdicao
//                 ? `<button class="btn-editar-tabela" title="Clique para editar esta parcela">✏️</button>` 
//                 : '';

//             tr.innerHTML = `
//                 <td>${p.numparcela}º</td>
//                 <td>${formatarDataBR(p.dtvcto)}</td>
//                 <td>R$ ${valorFormatado}</td>
//                 <td>${formatarDataBR(p.dtpgto)}</td>
//                 <td><span class="status-badge ${statusClass}">${p.status.toUpperCase()}</span></td>
//                 <td style="text-align: center;">${btnEditarHTML}</td>
//             `;

//             const btn = tr.querySelector(".btn-editar-tabela");
//             if (btn) btn.onclick = () => preencherParaEdicao(p);

//             corpoTabela.appendChild(tr);
//         });
//     } catch (error) {
//         console.error("Erro ao carregar histórico:", error);
//     }
// }

async function carregarHistoricoPagto(idLanc) {
    const corpoTabela = document.querySelector("#corpoHistoricoPagto");
    if (!corpoTabela) return;

    try {
        const pagamentos = await fetchComToken(`/pagamentos/historico/${idLanc}`);
        corpoTabela.innerHTML = ""; 

        const eSupremo = typeof temPermissao === "function" ? temPermissao("Pagamentos", "supremo") : false;
        const podeAlterar = typeof temPermissao === "function" ? temPermissao("Pagamentos", "alterar") : false;
        const permissaoTotalEdicao = eSupremo && podeAlterar;

        pagamentos.forEach(p => {
            const tr = document.createElement("tr");
            const statusClass = p.status ? p.status.toLowerCase().trim() : 'pendente';
            const valorFormatado = parseFloat(p.vlrpago).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            
            // Tratamento da observação para não vir nulo
            const obsTexto = p.observacao || "";

            const btnEditarHTML = permissaoTotalEdicao
                ? `<button class="btn-editar-tabela" title="Clique para editar esta parcela">✏️</button>` 
                : '';

            tr.innerHTML = `
                <td>${p.numparcela}º</td>
                <td>${formatarDataBR(p.dtvcto)}</td>
                <td>R$ ${valorFormatado}</td>
                <td>${formatarDataBR(p.dtpgto)}</td>
                <td><span class="status-badge ${statusClass}">${p.status.toUpperCase()}</span></td>
                <td class="celula-obs" title="Clique para ver mais">${obsTexto}</td>
                <td style="text-align: center;">${btnEditarHTML}</td>
            `;

            // Evento para mostrar a observação completa no Popup
            const tdObs = tr.querySelector(".celula-obs");
            if (obsTexto) {
                tdObs.onclick = () => {
                    Swal.fire({
                        title: `Observação - Parcela ${p.numparcela}º`,
                        text: obsTexto,
                        icon: 'info',
                        confirmButtonText: 'Fechar'
                    });
                };
            } else {
                tdObs.style.cursor = "default";
                tdObs.title = "Sem observação";
            }

            const btn = tr.querySelector(".btn-editar-tabela");
            if (btn) btn.onclick = () => preencherParaEdicao(p);

            corpoTabela.appendChild(tr);
        });
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
    }
}

function preencherParaEdicao(p) {
    const dataVctoFormatada = formatarDataBR(p.dtvcto);

    Swal.fire({
        title: 'Confirmar Edição?',
        html: `Deseja alterar a <b>Parcela ${p.numparcela}º</b><br>Vencimento: <b>${dataVctoFormatada}</b>?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, carregar dados',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f39c12'
    }).then((result) => {
        if (result.isConfirmed) {
            // Preenchimento dos campos
            document.querySelector("#idPagamento").value = p.idpagamento || "";
            document.querySelector("#numParcela").value = p.numparcela;
            document.querySelector("#vlrPago").value = parseFloat(p.vlrpago).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            document.querySelector("#dtvcto").value = p.dtvcto.split('T')[0];
            document.querySelector("#dtpgto").value = p.dtpgto ? p.dtpgto.split('T')[0] : "";
            document.querySelector("#observacaoPagto").value = p.observacao || "";
            document.querySelector("#statusPagto").checked = (p.status.toLowerCase() === 'pago');

            // Ajuste visual do botão principal
            const btnEnviar = document.querySelector("#Enviar");
            if (btnEnviar) {
                btnEnviar.textContent = "Atualizar Parcela";
                btnEnviar.style.backgroundColor = "#f39c12"; 
            }

            // Ativa labels e foca no valor
            document.querySelectorAll('#form input').forEach(i => i.dispatchEvent(new Event('input')));
            document.querySelector("#vlrPago").focus();
        }
    });
}

//ESSE SALVAR REFAZ O CÁLCULO DA MÉDIA APÓS SALVAR O PAGAMENTO
// async function salvarPagamento() {
//     const idLancamento = document.querySelector("#idLancamentoSelect").value;
//     const idPagamento = document.querySelector("#idPagamento").value;

//     // Verificação de Permissões
//     const temPermissaoCadastrar = typeof temPermissao === "function" ? temPermissao("pagamentos", "cadastrar") : true;
//     const temPermissaoAlterar = typeof temPermissao === "function" ? temPermissao("pagamentos", "alterar") : true;

//     if (!idPagamento && !temPermissaoCadastrar) {
//         return Swal.fire("Acesso negado", "Sem permissão para cadastrar.", "error");
//     }
//     if (idPagamento && !temPermissaoAlterar) {
//         return Swal.fire("Acesso negado", "Sem permissão para alterar.", "error");
//     }

//     if (!idLancamento) {
//         return Swal.fire("Atenção", "Selecione um lançamento!", "warning");
//     }

//     const dados = {
//         idpagamento: idPagamento || null,
//         idlancamento: idLancamento,
//         numparcela: parseInt(document.querySelector("#numParcela").value),
//         vlrprevisto: prepararNumeroParaEnvio(document.querySelector("#vlrPrevisto").value),
//         vlrpago: prepararNumeroParaEnvio(document.querySelector("#vlrPago").value),
//         dtvcto: document.querySelector("#dtvcto").value,
//         dtpgto: document.querySelector("#dtpgto").value,
//         observacao: document.querySelector("#observacaoPagto").value,
//         status: document.querySelector("#statusPagto").checked ? 'pago' : 'pendente'
//     };

//     try {
//         const metodo = idPagamento ? "PUT" : "POST";
//         const url = idPagamento ? `/pagamentos/${idPagamento}` : "/pagamentos";

//         const response = await fetchComToken(url, {
//             method: metodo,
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify(dados)
//         });

//         if (response) {
//             let msgExtra = "";
//             try {
//                 const resMedia = await fetchComToken(`/pagamentos/recalcular-media/${dados.idlancamento}`);
//                 if (resMedia?.novaMedia) {
//                     const mediaBRL = parseFloat(resMedia.novaMedia).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
//                     msgExtra = `<br>Média atualizada: <b>${mediaBRL}</b>`;
//                 }
//             } catch (e) { console.error(e); }

//             await Swal.fire("Sucesso!", `${idPagamento ? 'Alterado' : 'Registrado'} com sucesso.${msgExtra}`, "success");
            
//             limparFormularioTotalmente();
//             await carregarHistoricoPagto(idLancamento);
//         }
//     } catch (error) {
//         console.error(error);
//         Swal.fire("Erro", "Erro ao processar operação.", "error");
//     }
// }


async function salvarPagamento() {
    const idLancamento = document.querySelector("#idLancamentoSelect").value;
    const idPagamento = document.querySelector("#idPagamento").value;

    // Verificação de Permissões
    const temPermissaoCadastrar = typeof temPermissao === "function" ? temPermissao("pagamentos", "cadastrar") : true;
    const temPermissaoAlterar = typeof temPermissao === "function" ? temPermissao("pagamentos", "alterar") : true;

    if (!idPagamento && !temPermissaoCadastrar) {
        return Swal.fire("Acesso negado", "Sem permissão para cadastrar.", "error");
    }
    if (idPagamento && !temPermissaoAlterar) {
        return Swal.fire("Acesso negado", "Sem permissão para alterar.", "error");
    }

    if (!idLancamento) {
        return Swal.fire("Atenção", "Selecione um lançamento!", "warning");
    }

    const dados = {
        idpagamento: idPagamento || null,
        idlancamento: idLancamento,
        numparcela: parseInt(document.querySelector("#numParcela").value),
        vlrprevisto: prepararNumeroParaEnvio(document.querySelector("#vlrPrevisto").value),
        vlrpago: prepararNumeroParaEnvio(document.querySelector("#vlrPago").value),
        dtvcto: document.querySelector("#dtvcto").value,
        dtpgto: document.querySelector("#dtpgto").value,
        observacao: document.querySelector("#observacaoPagto").value,
        status: document.querySelector("#statusPagto").checked ? 'pago' : 'pendente'
    };

    try {
        const metodo = idPagamento ? "PUT" : "POST";
        const url = idPagamento ? `/pagamentos/${idPagamento}` : "/pagamentos";

        const response = await fetchComToken(url, {
            method: metodo,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dados)
        });

        if (response) {
            // O bloco de recálculo da média foi removido daqui para manter o valor fixo
            
            await Swal.fire(
                "Sucesso!", 
                `${idPagamento ? 'Alterado' : 'Registrado'} com sucesso.`, 
                "success"
            );
            
            limparFormularioTotalmente();
            await carregarHistoricoPagto(idLancamento);
        }
    } catch (error) {
        console.error(error);
        Swal.fire("Erro", "Erro ao processar operação.", "error");
    }
}

function limparFormularioTotalmente() {
    const form = document.querySelector("#form");
    if (form) form.reset();
    
    document.querySelector("#idPagamento").value = "";
    
    const btnEnviar = document.querySelector("#Enviar");
    if (btnEnviar) {
        btnEnviar.textContent = "Confirmar Pagamento";
        btnEnviar.style.backgroundColor = ""; 
    }
    
    document.querySelectorAll('#form input').forEach(i => i.dispatchEvent(new Event('input')));
}

// --- CONFIGURAÇÃO DOS EVENTOS ---

function configurarEventosPagamentos() {
    carregarLancamentosParaPagto();

    const enviarBtn = document.querySelector("#Enviar");
    const limparBtn = document.querySelector("#Limpar");
    const selectLanc = document.querySelector("#idLancamentoSelect");

    if (enviarBtn) enviarBtn.onclick = salvarPagamento;
    if (limparBtn) limparBtn.onclick = () => {
        limparFormularioTotalmente();
        document.querySelector("#corpoHistoricoPagto").innerHTML = "";
    };

    if (selectLanc) {
        selectLanc.onchange = async (e) => {
            const idLanc = e.target.value;
            if (!idLanc) return;

            await carregarHistoricoPagto(idLanc);
            const dadosOpcao = e.target.selectedOptions[0].dataset;
            document.querySelector("#vlrPrevisto").value = dadosOpcao.valor || "";
            document.querySelector("#dtvcto").value = dadosOpcao.vctobase?.split('T')[0] || "";
            await buscarDadosParcela(idLanc, dadosOpcao.vctobase);
            document.querySelectorAll('#form input').forEach(i => i.dispatchEvent(new Event('input')));
        };
    }
}

window.configurarEventosEspecificos = function(modulo) {
    if (modulo.trim().toLowerCase() === 'pagamentos') {
        configurarEventosPagamentos();
        if (typeof aplicarPermissoes === "function" && window.permissoes) {
            aplicarPermissoes(window.permissoes);
        }
    }
};

window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['pagamentos'] = {
    configurar: configurarEventosPagamentos,
    desinicializar: () => { 
        const idPagto = document.querySelector("#idPagamento");
        if(idPagto) idPagto.value = "";
    }
};