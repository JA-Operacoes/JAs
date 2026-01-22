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

//         const eSupremo = typeof temPermissao === "function" ? temPermissao("Pagamentos", "supremo") : false;
//         const podeAlterar = typeof temPermissao === "function" ? temPermissao("Pagamentos", "alterar") : false;
//         const permissaoTotalEdicao = eSupremo && podeAlterar;

//         pagamentos.forEach(p => {
//             const tr = document.createElement("tr");
//             const statusClass = p.status ? p.status.toLowerCase().trim() : 'pendente';
//             const valorFormatado = parseFloat(p.vlrpago).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            
//             // Tratamento da observação para não vir nulo
//             const obsTexto = p.observacao || "";

//             const btnEditarHTML = permissaoTotalEdicao
//                 ? `<button class="btn-editar-tabela" title="Clique para editar esta parcela">✏️</button>` 
//                 : '';

//             tr.innerHTML = `
//                 <td>${p.numparcela}º</td>
//                 <td>${formatarDataBR(p.dtvcto)}</td>
//                 <td>R$ ${valorFormatado}</td>
//                 <td>${formatarDataBR(p.dtpgto)}</td>
//                 <td><span class="status-badge ${statusClass}">${p.status.toUpperCase()}</span></td>
//                 <td class="celula-obs" title="Clique para ver mais">${obsTexto}</td>
//                 <td style="text-align: center;">${btnEditarHTML}</td>
//             `;

//             // Evento para mostrar a observação completa no Popup
//             const tdObs = tr.querySelector(".celula-obs");
//             if (obsTexto) {
//                 tdObs.onclick = () => {
//                     Swal.fire({
//                         title: `Observação - Parcela ${p.numparcela}º`,
//                         text: obsTexto,
//                         icon: 'info',
//                         confirmButtonText: 'Fechar'
//                     });
//                 };
//             } else {
//                 tdObs.style.cursor = "default";
//                 tdObs.title = "Sem observação";
//             }

//             const btn = tr.querySelector(".btn-editar-tabela");
//             if (btn) btn.onclick = () => preencherParaEdicao(p);

//             corpoTabela.appendChild(tr);
//         });
//     } catch (error) {
//         console.error("Erro ao carregar histórico:", error);
//     }
// }

// function preencherParaEdicao(p) {
//     const dataVctoFormatada = formatarDataBR(p.dtvcto);

//     Swal.fire({
//         title: 'Confirmar Edição?',
//         html: `Deseja alterar a <b>Parcela ${p.numparcela}º</b><br>Vencimento: <b>${dataVctoFormatada}</b>?`,
//         icon: 'question',
//         showCancelButton: true,
//         confirmButtonText: 'Sim, carregar dados',
//         cancelButtonText: 'Cancelar',
//         confirmButtonColor: '#f39c12'
//     }).then((result) => {
//         if (result.isConfirmed) {
//             // Preenchimento dos campos
//             document.querySelector("#idPagamento").value = p.idpagamento || "";
//             document.querySelector("#numParcela").value = p.numparcela;
//             document.querySelector("#vlrPago").value = parseFloat(p.vlrpago).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
//             document.querySelector("#dtvcto").value = p.dtvcto.split('T')[0];
//             document.querySelector("#dtpgto").value = p.dtpgto ? p.dtpgto.split('T')[0] : "";
//             document.querySelector("#observacaoPagto").value = p.observacao || "";
//             document.querySelector("#statusPagto").checked = (p.status.toLowerCase() === 'pago');

//             carregarAnexosExistentes(p);
           
//             // Ajuste visual do botão principal
//             const btnEnviar = document.querySelector("#Enviar");
//             if (btnEnviar) {
//                 btnEnviar.textContent = "Atualizar Parcela";
//                 btnEnviar.style.backgroundColor = "#f39c12"; 
//             }

//             // Ativa labels e foca no valor
//             document.querySelectorAll('#form input').forEach(i => i.dispatchEvent(new Event('input')));
//             document.querySelector("#vlrPago").focus();
//         }
//     });
// }

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

async function carregarHistoricoPagto(idLanc) {
    const corpoTabela = document.querySelector("#corpoHistoricoPagto");
    if (!corpoTabela) return;

    try {
        const pagamentos = await fetchComToken(`/pagamentos/historico/${idLanc}`);
        corpoTabela.innerHTML = ""; 

        // BUSCA AS PERMISSÕES
        const eSupremo = typeof temPermissao === "function" ? temPermissao("Pagamentos", "supremo") : false;
        const podeAlterar = typeof temPermissao === "function" ? temPermissao("Pagamentos", "alterar") : false;

        // NOVA LÓGICA: O botão aparece se ele puder Alterar. 
        // Se for Supremo, edita tudo. Se não for, edita só anexos (tratado na próxima função).
        const temAcessoAoBotaoEdicao = podeAlterar; 

        pagamentos.forEach(p => {
            const tr = document.createElement("tr");
            const statusClass = p.status ? p.status.toLowerCase().trim() : 'pendente';
            const valorFormatado = parseFloat(p.vlrpago).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            
            const obsTexto = p.observacao || "";

            // O botão agora aparece para quem tem permissão de 'alterar'
            const btnEditarHTML = temAcessoAoBotaoEdicao
                ? `<button class="btn-editar-tabela" title="${eSupremo ? 'Editar parcela completa' : 'Complementar anexos'}">✏️</button>` 
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
            // 1. Identificar Permissões
            const eSupremo = typeof temPermissao === "function" ? temPermissao("Pagamentos", "supremo") : false;

            // 2. Preenchimento dos campos básicos
            document.querySelector("#idPagamento").value = p.idpagamento || "";
            document.querySelector("#numParcela").value = p.numparcela;
            document.querySelector("#vlrPago").value = parseFloat(p.vlrpago).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            document.querySelector("#dtvcto").value = p.dtvcto.split('T')[0];
            document.querySelector("#dtpgto").value = p.dtpgto ? p.dtpgto.split('T')[0] : "";
            document.querySelector("#observacaoPagto").value = p.observacao || "";
            document.querySelector("#statusPagto").checked = (p.status.toLowerCase() === 'pago');

            // 3. BLOQUEIO PARA NÃO SUPREMO (Trava de campos de texto/data)
            const camposParaBloquear = ["#numParcela", "#vlrPago", "#dtvcto", "#dtpgto", "#statusPagto", "#observacaoPagto"];
            camposParaBloquear.forEach(selector => {
                const el = document.querySelector(selector);
                if (el) el.disabled = !eSupremo; // Se não for supremo, desabilita
            });

            // 4. Carrega os anexos (a função carregarAnexosExistentes já cuida das lixeiras e bloqueios dos inputs file)
            carregarAnexosExistentes(p);

            // 5. Ajuste visual do botão principal
            const btnEnviar = document.querySelector("#Enviar");
            if (btnEnviar) {
                if (!eSupremo) {
                    btnEnviar.textContent = "Salvar Anexos";
                    btnEnviar.style.backgroundColor = "#27ae60"; // Verde para indicar que é apenas complemento de dados
                } else {
                    btnEnviar.textContent = "Atualizar Parcela";
                    btnEnviar.style.backgroundColor = "#f39c12"; 
                }
            }

            // Ativa labels e foca no que estiver disponível
            document.querySelectorAll('#form input').forEach(i => i.dispatchEvent(new Event('input')));
            
            if(eSupremo) {
                document.querySelector("#vlrPago").focus();
            } else {
                Swal.fire({
                    title: 'Modo de Complemento',
                    text: 'Você não tem permissão para alterar os dados da parcela, apenas gerenciar os anexos permitidos.',
                    icon: 'info',
                    timer: 3000
                });
            }
        }
    });
}


// async function salvarPagamento() {
//     const idLancamento = document.querySelector("#idLancamentoSelect").value;
//     const idPagamento = document.querySelector("#idPagamento").value;

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

//     const formData = new FormData();
//     formData.append("idpagamento", idPagamento || null);
//     formData.append("idlancamento", idLancamento);
//     formData.append("numparcela", parseInt(document.querySelector("#numParcela").value));
//     formData.append("vlrprevisto", prepararNumeroParaEnvio(document.querySelector("#vlrPrevisto").value));
//     formData.append("vlrpago", prepararNumeroParaEnvio(document.querySelector("#vlrPago").value));
//     formData.append("dtvcto", document.querySelector("#dtvcto").value);
//     formData.append("dtpgto", document.querySelector("#dtpgto").value);
//     formData.append("observacao", document.querySelector("#observacaoPagto").value);
//     formData.append("status", document.querySelector("#statusPagto").checked ? 'pago' : 'pendente');

//     const arquivoConta = document.querySelector("#arquivoConta").files[0];
//     const comprovantePagto = document.querySelector("#comprovantePagto").files[0];

//     if (arquivoConta) {
//         formData.append("imagemConta", arquivoConta);
//     }
//     if (comprovantePagto) {
//         formData.append("comprovantePagamento", comprovantePagto);
//     }

//     formData.append("limparComprovanteImagem", document.getElementById('limparComprovanteImagem').value);
//     formData.append("limparComprovantePagto", document.getElementById('limparComprovantePagto').value);

//     try {
//         const metodo = idPagamento ? "PUT" : "POST";
//         const url = idPagamento ? `/pagamentos/${idPagamento}` : "/pagamentos";

//         const response = await fetchComToken(url, {
//             method: metodo,
//             body: formData
//         });

//         if (response) {
//             await Swal.fire("Sucesso!", `${idPagamento ? 'Alterado' : 'Registrado'} com sucesso.`, "success");
//             limparFormularioTotalmente();
//             await carregarHistoricoPagto(idLancamento);
//         }
//     } catch (error) {
//         console.error(error);
//         Swal.fire("Erro", "Erro ao processar operação.", "error");
//     }
// }

// Adicione isso à sua função de inicialização do modal de pagamentos


async function salvarPagamento() {
    const idLancamento = document.querySelector("#idLancamentoSelect").value;
    const idPagamento = document.querySelector("#idPagamento").value;

    // ... (Suas verificações de permissão permanecem iguais) ...

    if (!idLancamento) {
        return Swal.fire("Atenção", "Selecione um lançamento!", "warning");
    }

    // Captura dos dados para exibição e envio
    const numParcela = document.querySelector("#numParcela").value;
    const vlrPagoStr = document.querySelector("#vlrPago").value;
    const dtVcto = document.querySelector("#dtvcto").value;
    const dtPgto = document.querySelector("#dtpgto").value;

    // --- BLOCO DE CONFIRMAÇÃO PARA NOVO REGISTRO ---
    if (!idPagamento) {
        const confirmacao = await Swal.fire({
            title: 'Confirmar Pagamento?',
            html: `
                <div style="text-align: left; background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
                    <p><b>Parcela:</b> ${numParcela}º</p>
                    <p><b>Valor Pago:</b> R$ ${vlrPagoStr}</p>
                    <p><b>Vencimento:</b> ${formatarDataBR(dtVcto)}</p>
                    <p><b>Data Pagto:</b> ${formatarDataBR(dtPgto)}</p>
                </div>
                <br>Os dados estão corretos?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, Confirmar',
            cancelButtonText: 'Revisar',
            confirmButtonColor: '#27ae60',
            cancelButtonColor: '#d33'
        });

        if (!confirmacao.isConfirmed) return; // Cancela a execução se o usuário não confirmar
    }

    // --- SEGUIR COM A MONTAGEM DO FORMDATA ---
    const formData = new FormData();
    formData.append("idpagamento", idPagamento || "");
    formData.append("idlancamento", idLancamento);
    formData.append("numparcela", parseInt(numParcela));
    formData.append("vlrprevisto", prepararNumeroParaEnvio(document.querySelector("#vlrPrevisto").value));
    formData.append("vlrpago", prepararNumeroParaEnvio(vlrPagoStr));
    formData.append("dtvcto", dtVcto);
    formData.append("dtpgto", dtPgto);
    formData.append("observacao", document.querySelector("#observacaoPagto").value);
    formData.append("status", document.querySelector("#statusPagto").checked ? 'pago' : 'pendente');

    // Flags de limpeza e arquivos
    formData.append("limparComprovanteImagem", document.getElementById('limparComprovanteImagem').value);
    formData.append("limparComprovantePagto", document.getElementById('limparComprovantePagto').value);

    const arquivoConta = document.querySelector("#arquivoConta").files[0];
    const comprovantePagto = document.querySelector("#comprovantePagto").files[0];

    if (arquivoConta) formData.append("imagemConta", arquivoConta);
    if (comprovantePagto) formData.append("comprovantePagamento", comprovantePagto);

    try {
        const metodo = idPagamento ? "PUT" : "POST";
        const url = idPagamento ? `/pagamentos/${idPagamento}` : "/pagamentos";

        const response = await fetchComToken(url, {
            method: metodo,
            body: formData
        });

        if (response) {
            await Swal.fire("Sucesso!", `${idPagamento ? 'Alterado' : 'Registrado'} com sucesso.`, "success");
            limparFormularioTotalmente();
            await carregarHistoricoPagto(idLancamento);
        }
    } catch (error) {
        console.error(error);
        Swal.fire("Erro", "Erro ao processar operação.", "error");
    }
}



function inicializarEventosUpload() {
    const config = [
        { input: "#arquivoConta", label: "#fileNameConta" },
        { input: "#comprovantePagto", label: "#fileNameComprovante" }
    ];

    config.forEach(item => {
        const input = document.querySelector(item.input);
        const label = document.querySelector(item.label);

        if (input && label) {
            input.addEventListener("change", (e) => {
                const fileName = e.target.files[0]?.name || "Nenhum arquivo selecionado";
                label.textContent = fileName;
                // Opcional: mudar a cor para destacar que há um arquivo
                label.style.color = e.target.files[0] ? "var(--primary-color)" : "";
            });
        }
    });
}


function carregarAnexosExistentes(p) {
    const containerComp = document.getElementById('linkContainerComprovante');
    const containerConta = document.getElementById('linkContainerConta');
    const inputComp = document.getElementById('comprovantePagto');
    const inputConta = document.getElementById('arquivoConta');

    // REGRA: Se tem permissão de "apagar", pode remover qualquer um dos dois.
    const podeApagarAnexo = typeof temPermissao === "function" ? temPermissao("Pagamentos", "apagar") : false;

    // Reset de flags de controle
    document.getElementById('limparComprovantePagto').value = "false";
    document.getElementById('limparComprovanteImagem').value = "false";

    // --- 1. Lógica para Imagem da Conta (Boleto) ---
    if (p.imagemconta) {
        document.getElementById('imagemContaDisplay').style.display = "block";
        if (inputConta) inputConta.disabled = true;

        // Liberado se 'podeApagarAnexo' for true, independente de ser Supremo
        const btnLixeiraConta = podeApagarAnexo 
            ? `<button type="button" onclick="marcarParaLimpar('imagemConta')" class="btn-limpar-anexo" title="Remover boleto">🗑️</button>` 
            : `<span title="Sem permissão para apagar" style="opacity: 0.5; cursor: not-allowed;">🔒</span>`;

        containerConta.innerHTML = `
            <div style="display: flex; gap: 5px; align-items: center;">
                <a href="/uploads/contas/imagemboleto/${p.imagemconta}" target="_blank" class="btn-view-file">👁️ Ver Conta</a>
                ${btnLixeiraConta}
            </div>`;
    }

    // --- 2. Lógica para Comprovante de Pagamento ---
    if (p.comprovantepgto) {
        document.getElementById('comprovantePagtoDisplay').style.display = "block";
        if (inputComp) inputComp.disabled = true;

        // Liberado se 'podeApagarAnexo' for true
        const btnLixeiraComp = podeApagarAnexo 
            ? `<button type="button" onclick="marcarParaLimpar('comprovante')" class="btn-limpar-anexo" title="Remover comprovante">🗑️</button>` 
            : `<span title="Sem permissão para apagar" style="opacity: 0.5; cursor: not-allowed;">🔒</span>`;

        containerComp.innerHTML = `
            <div style="display: flex; gap: 5px; align-items: center;">
                <a href="/uploads/contas/comprovantespgto/${p.comprovantepgto}" target="_blank" class="btn-view-file">👁️ Ver Comprovante</a>
                ${btnLixeiraComp}
            </div>`;
    }
}

// Função para configurar o comportamento de escolha de arquivo (Upload novo)
function configurarUploads() {
    const inputs = [
        { id: 'comprovantePagto', label: 'fileNameComprovante', display: 'comprovantePagtoDisplay', container: 'linkContainerComprovante' },
        { id: 'arquivoConta', label: 'fileNameConta', display: 'imagemContaDisplay', container: 'linkContainerConta' }
    ];

    inputs.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            el.addEventListener('change', function(e) {
                const file = e.target.files[0];
                const label = document.getElementById(item.label);
                const display = document.getElementById(item.display);
                const container = document.getElementById(item.container);

                if (file) {
                    label.textContent = file.name;
                    label.style.color = "#27ae60"; // Verde para indicar seleção nova
                    
                    const url = URL.createObjectURL(file);
                    display.style.display = "block";
                    container.innerHTML = `
                        <a href="${url}" target="_blank" class="btn-view-file">
                            🔍 Pré-visualizar Selecionado
                        </a>`;
                }
            });
        }
    });
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

    document.getElementById('imagemContaDisplay').style.display = "none";
    document.getElementById('comprovantePagtoDisplay').style.display = "none";
    document.getElementById('fileNameConta').textContent = "Nenhum arquivo selecionado";
    document.getElementById('fileNameComprovante').textContent = "Nenhum arquivo selecionado";
    document.getElementById('fileNameConta').style.color = "";
    document.getElementById('fileNameComprovante').style.color = "";
}

// Esta função deve estar no nível superior do seu arquivo JS

function marcarParaLimpar(tipo) {
    Swal.fire({
        title: 'Remover anexo?',
        text: "Para trocar o arquivo, você deve remover o atual primeiro.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, remover',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            if (tipo === 'comprovante') {
                document.getElementById('limparComprovantePagto').value = "true";
                document.getElementById('comprovantePagtoDisplay').style.display = "none";
                const input = document.getElementById('comprovantePagto');
                input.disabled = false;
                input.parentElement.onclick = null; // REMOVE O ALERTA
                document.getElementById('fileNameComprovante').textContent = "Selecione novo arquivo...";
            } 
            
            if (tipo === 'imagemConta') {
                document.getElementById('limparComprovanteImagem').value = "true";
                document.getElementById('imagemContaDisplay').style.display = "none";
                const input = document.getElementById('arquivoConta');
                input.disabled = false;
                input.parentElement.onclick = null; // REMOVE O ALERTA
                document.getElementById('fileNameConta').textContent = "Selecione nova imagem...";
            }
        }
    });
}
window.marcarParaLimpar = marcarParaLimpar;


// --- CONFIGURAÇÃO DOS EVENTOS ---

function configurarEventosPagamentos() {
    configurarUploads();
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