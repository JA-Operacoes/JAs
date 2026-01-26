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

let carregandoEdicao = false; // Trava global

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

// async function carregarLancamentosParaPagto() {
//     const select = document.querySelector("#idLancamentoSelect");
//     if (!select) return;

//     try {
//         const lancamentos = await fetchComToken("/pagamentos/lancamentos");
//         select.innerHTML = '<option value="" disabled selected>Selecione o Lançamento...</option>';
        
//         lancamentos.forEach(l => {
//             const opt = document.createElement("option");
//             opt.value = l.idlancamento;
//             opt.textContent = `${l.idlancamento} - ${l.descricao}`;
//             opt.dataset.valor = l.vlrestimado;
//             opt.dataset.vctobase = l.vctobase;
//             select.appendChild(opt);
//         });
//     } catch (error) {
//         console.error("Erro ao carregar lançamentos:", error);
//     }
// }

async function carregarLancamentosParaPagto() {
    const select = document.querySelector("#idLancamentoSelect");
    if (!select) return;

    try {
        const lancamentos = await fetchComToken("/pagamentos/lancamentos");
        
        // Mantém a opção padrão (placeholder)
        select.innerHTML = '<option value="" disabled selected>Selecione o Lançamento...</option>';
        
        lancamentos.forEach(l => {
            const opt = document.createElement("option");
            opt.value = l.idlancamento;
            // Usamos String() para garantir comparação correta de tipos depois
            opt.textContent = `${l.idlancamento} - ${l.descricao}`;
            opt.dataset.valor = l.vlrestimado;
            opt.dataset.vctobase = l.vctobase;
            select.appendChild(opt);
        });

        console.log("✅ Select de lançamentos populado com sucesso.");
        return true; // Indica que terminou
    } catch (error) {
        console.error("Erro ao carregar lançamentos:", error);
        return false;
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
                ? `<button type="button" class="btn-editar-tabela" title="${eSupremo ? 'Editar parcela completa' : 'Complementar anexos'}">✏️</button>` 
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

            // const btn = tr.querySelector(".btn-editar-tabela");
            // if (btn) btn.onclick = () => preencherParaEdicao(p);

            const btn = tr.querySelector(".btn-editar-tabela");
            if (btn) {
                btn.onclick = (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    preencherParaEdicao(p);
                };
            }

            corpoTabela.appendChild(tr);
        });
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
    }
}

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

//             limparFormularioTotalmente();
//             // 1. Identificar Permissões
//             const eSupremo = typeof temPermissao === "function" ? temPermissao("Pagamentos", "supremo") : false;

//             // 2. Preenchimento dos campos básicos
//             document.querySelector("#idPagamento").value = p.idpagamento || "";
//             document.querySelector("#numParcela").value = p.numparcela;
//             document.querySelector("#vlrPago").value = parseFloat(p.vlrpago).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
//             document.querySelector("#dtvcto").value = p.dtvcto.split('T')[0];
//             document.querySelector("#dtpgto").value = p.dtpgto ? p.dtpgto.split('T')[0] : "";
//             document.querySelector("#observacaoPagto").value = p.observacao || "";
//             document.querySelector("#statusPagto").checked = (p.status.toLowerCase() === 'pago');

//             // 3. BLOQUEIO PARA NÃO SUPREMO (Trava de campos de texto/data)
//             const camposParaBloquear = ["#numParcela", "#vlrPago", "#dtvcto", "#dtpgto", "#statusPagto", "#observacaoPagto"];
//             camposParaBloquear.forEach(selector => {
//                 const el = document.querySelector(selector);
//                 if (el) el.disabled = !eSupremo; // Se não for supremo, desabilita
//             });

//             // 4. Carrega os anexos (a função carregarAnexosExistentes já cuida das lixeiras e bloqueios dos inputs file)
//             carregarAnexosExistentes(p);

//             // 5. Ajuste visual do botão principal
//             const btnEnviar = document.querySelector("#Enviar");
//             if (btnEnviar) {
//                 if (!eSupremo) {
//                     btnEnviar.textContent = "Salvar Anexos";
//                     btnEnviar.style.backgroundColor = "#27ae60"; // Verde para indicar que é apenas complemento de dados
//                 } else {
//                     btnEnviar.textContent = "Atualizar Parcela";
//                     btnEnviar.style.backgroundColor = "#f39c12"; 
//                 }
//             }

//             // Ativa labels e foca no que estiver disponível
//             document.querySelectorAll('#form input').forEach(i => i.dispatchEvent(new Event('input')));
            
//             if(eSupremo) {
//                 document.querySelector("#vlrPago").focus();
//             } else {
//                 Swal.fire({
//                     title: 'Modo de Complemento',
//                     text: 'Você não tem permissão para alterar os dados da parcela, apenas gerenciar os anexos permitidos.',
//                     icon: 'info',
//                     timer: 3000
//                 });
//             }
//         }
//     });
// }



// async function preencherParaEdicao(p) {

//     const dataVctoFormatada = formatarDataBR(p.dtvcto);

//     const result = await Swal.fire({
//         title: 'Confirmar Edição?',
//         html: `Deseja alterar a <b>Parcela ${p.numparcela}º</b><br>Vencimento: <b>${dataVctoFormatada}</b>?`,
//         icon: 'question',
//         showCancelButton: true,
//         confirmButtonText: 'Sim, carregar dados',
//         cancelButtonText: 'Cancelar',
//         confirmButtonColor: '#f39c12'
//     });

//     if (result.isConfirmed) {
//         // 1. Limpa o formulário antes de tudo
//         limparFormularioTotalmente(); 

//         // 2. Preenche o ID de pagamento (essencial para o PUT funcionar)
//         document.querySelector("#idPagamento").value = p.idpagamento || "";

//         // 3. BUSCAR DADOS COMPLEMENTARES (Valor Previsto e Descrição)
//         // Usamos o idlancamento que já existe no objeto 'p' vindo do histórico
       
//         try {
//             carregandoEdicao = true;

//             const selectLanc = document.querySelector("#idLancamentoSelect");
//             const originalOnChange = selectLanc ? selectLanc.onchange : null;
//             if (selectLanc) selectLanc.onchange = null;

//             const dadosLanc = await fetchComToken(`/pagamentos/lancamentos/detalhe/${p.idlancamento}`);
//             console.log("Dados do lançamento para edição:", dadosLanc, p.idlancamento);
//             if (dadosLanc) {
//                 // 1. Preencher o SELECT principal
//                  if (selectLanc) selectLanc.value = p.idlancamento;
//                 // 2. Preencher os campos de exibição (Texto e Valor)
//                 const elDesc = document.querySelector("#descLancamento"); 
//                 const elVlrPrev = document.querySelector("#vlrPrevisto");

//                 if (elDesc) elDesc.value = dadosLanc.descricao || "";
//                 if (elVlrPrev) {
//                     elVlrPrev.value = parseFloat(dadosLanc.vlrestimado || 0)
//                         .toLocaleString('pt-BR', { minimumFractionDigits: 2 });
//                 }
                
//                 // 3. Importante: Disparar evento de mudança se houver lógica atrelada ao select
//                 // selectLanc.dispatchEvent(new Event('change')); 
//             }
//         } catch (error) {
//             console.error("Erro ao buscar detalhes:", error);
//         }finally {
//             carregandoEdicao = false; // LIBERA A TRAVA
//         }

//         // 4. Preenchimento dos campos da parcela
//         document.querySelector("#numParcela").value = p.numparcela;
//         document.querySelector("#vlrPago").value = parseFloat(p.vlrpago).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
//         document.querySelector("#dtvcto").value = p.dtvcto.split('T')[0];
//         document.querySelector("#dtpgto").value = p.dtpgto ? p.dtpgto.split('T')[0] : "";
//         document.querySelector("#observacaoPagto").value = p.observacao || "";
//         document.querySelector("#statusPagto").checked = (p.status.toLowerCase() === 'pago');

//         // 5. Bloqueios de permissão (Supremo vs Comum)
//         const eSupremo = typeof temPermissao === "function" ? temPermissao("Pagamentos", "supremo") : false;
//         const camposParaBloquear = ["#numParcela", "#vlrPago", "#dtvcto", "#dtpgto", "#statusPagto", "#observacaoPagto"];
//         camposParaBloquear.forEach(selector => {
//             const el = document.querySelector(selector);
//             if (el) el.disabled = !eSupremo;
//         });

//         // 6. Carrega anexos e atualiza interface
//         carregarAnexosExistentes(p);
        
//         // Atualiza labels (materialize/custom)
//         document.querySelectorAll('#form input').forEach(i => i.dispatchEvent(new Event('input')));
//     }
// }

async function preencherParaEdicao(p) {
    const dataVctoFormatada = formatarDataBR(p.dtvcto);

    const result = await Swal.fire({
        title: 'Confirmar Edição?',
        html: `Deseja alterar a <b>Parcela ${p.numparcela}º</b><br>Vencimento: <b>${dataVctoFormatada}</b>?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, carregar dados',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f39c12'
    });

    if (result.isConfirmed) {
        try {
            // A flag deve ser ativada ANTES da limpeza para evitar que o 
            // 'change' disparado pelo reset ative outras lógicas.
            carregandoEdicao = true; 

            limparFormularioTotalmente(false);

            const selectLanc = document.querySelector("#idLancamentoSelect");

            // SEGURANÇA: Se por algum erro o select estiver vazio, recarrega as opções
            if (selectLanc && selectLanc.options.length <= 1) {
                await carregarLancamentosParaPagto();
            }

            // 1. Buscar Detalhes do Lançamento via API
            const dadosLanc = await fetchComToken(`/pagamentos/lancamentos/detalhe/${p.idlancamento}`);
            
            if (dadosLanc) {
                // Preenche IDs e o Select Principal
                document.querySelector("#idPagamento").value = p.idpagamento || "";
                if (selectLanc) selectLanc.value = p.idlancamento;

                // Preenche campos de exibição de valores estimados
                const elDesc = document.querySelector("#descLancamento"); 
                const elVlrPrev = document.querySelector("#vlrPrevisto");
                if (elDesc) elDesc.value = dadosLanc.descricao || "";
                if (elVlrPrev) {
                    elVlrPrev.value = parseFloat(dadosLanc.vlrestimado || 0)
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                }
            }

            // 2. Preenchimento dos campos da parcela vindo do objeto 'p'
            document.querySelector("#numParcela").value = p.numparcela;
            document.querySelector("#vlrPago").value = parseFloat(p.vlrpago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            document.querySelector("#dtvcto").value = p.dtvcto ? p.dtvcto.split('T')[0] : "";
            document.querySelector("#dtpgto").value = p.dtpgto ? p.dtpgto.split('T')[0] : "";
            document.querySelector("#observacaoPagto").value = p.observacao || "";
            document.querySelector("#statusPagto").checked = (p.status && p.status.toLowerCase() === 'pago');

            // 3. Controle de Permissões e Bloqueios
            const eSupremo = typeof temPermissao === "function" ? temPermissao("Pagamentos", "supremo") : false;
            const camposParaBloquear = [
                "#idLancamentoSelect", "#numParcela", "#vlrPago", 
                "#dtvcto", "#dtpgto", "#statusPagto", "#observacaoPagto"
            ];
            
            camposParaBloquear.forEach(selector => {
                const el = document.querySelector(selector);
                if (el) el.disabled = !eSupremo;
            });

            // 4. Carrega Anexos e atualiza Botão Principal
            carregarAnexosExistentes(p);
            
            const btnEnviar = document.querySelector("#Enviar");
            if (btnEnviar) {
                btnEnviar.textContent = eSupremo ? "Atualizar Parcela" : "Salvar Anexos";
                btnEnviar.style.backgroundColor = eSupremo ? "#f39c12" : "#27ae60";
            }

            // 5. Sincronização final da UI
            document.querySelectorAll('#form input, #form select').forEach(i => {
                i.dispatchEvent(new Event('input', { bubbles: true }));
                i.dispatchEvent(new Event('change', { bubbles: true }));
            });

        } catch (error) {
            console.error("Erro crítico na carga de edição:", error);
            Swal.fire('Erro', 'Falha ao carregar dados para edição.', 'error');
        } finally {
            // O delay garante que todos os eventos disparados acima foram processados
            setTimeout(() => { 
                carregandoEdicao = false; 
                console.log("🔓 Modo de edição liberado.");
            }, 200);
        }
    }
}



async function salvarPagamento(event) {
   
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const idLancamento = document.querySelector("#idLancamentoSelect").value;
    const idPagamento = document.querySelector("#idPagamento").value;
    const temPermissaoSupremo = temPermissao("Pagamentos", "supremo");

    if (!idLancamento) {
        return Swal.fire("Atenção", "Selecione um lançamento!", "warning");
    }

    // Captura dos dados
    const numParcela = document.querySelector("#numParcela").value;
    const vlrPagoStr = document.querySelector("#vlrPago").value;
    const dtVcto = document.querySelector("#dtvcto").value;
    const dtPgto = document.querySelector("#dtpgto").value;
    const isPago = document.querySelector("#statusPagto").checked;

    // --- BLOCO DE CONFIRMAÇÃO DINÂMICO ---
    if (!idPagamento) {
        let tituloSwal, textoBotao;

        if (temPermissaoSupremo) {
            tituloSwal = 'Confirmar Pagamento?';
            textoBotao = 'Sim, Confirmar Pagamento';
        } else {
            tituloSwal = 'Enviar Dados de Pagamento?';
            textoBotao = 'Sim, Enviar';
        }

        const confirmacao = await Swal.fire({
            title: tituloSwal,
            html: `
                <div style="text-align: left; background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
                    <p><b>Parcela:</b> ${numParcela}º</p>
                    <p><b>Valor Pago:</b> R$ ${vlrPagoStr}</p>
                    <p><b>Vencimento:</b> ${formatarDataBR(dtVcto)}</p>
                    <p><b>Data Pagto:</b> ${formatarDataBR(dtPgto)}</p>
                    <p><b>Status:</b> ${isPago ? '<span style="color:green">PAGO</span>' : '<span style="color:orange">PENDENTE</span>'}</p>
                </div>
                <br>Deseja prosseguir com o envio?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: textoBotao,
            cancelButtonText: 'Revisar',
            confirmButtonColor: '#27ae60',
            cancelButtonColor: '#d33'
        });

        if (!confirmacao.isConfirmed) return;
    }

    // --- MONTAGEM DO FORMDATA ---
    const formData = new FormData();
    formData.append("idpagamento", idPagamento || "");
    formData.append("idlancamento", idLancamento);
    formData.append("numparcela", parseInt(numParcela));
    formData.append("vlrprevisto", prepararNumeroParaEnvio(document.querySelector("#vlrPrevisto").value));
    formData.append("vlrpago", prepararNumeroParaEnvio(vlrPagoStr));
    formData.append("dtvcto", dtVcto);
    formData.append("dtpgto", dtPgto);
    formData.append("observacao", document.querySelector("#observacaoPagto").value);
    
    // Regra: se não for supremo, o status será sempre 'pendente' no envio para segurança, 
    // ou manterá o valor do campo que já deve estar bloqueado no DOM.
    
    formData.append("status", (temPermissaoSupremo && isPago) ? 'pago' : 'pendente');

    // Flags e arquivos permanecem iguais...
    formData.append("limparComprovanteImagem", document.getElementById('limparComprovanteImagem').value);
    formData.append("limparComprovantePagto", document.getElementById('limparComprovantePagto').value);

    const arquivoConta = document.querySelector("#arquivoConta").files[0];
    const comprovantePagto = document.querySelector("#comprovantePagto").files[0];
    if (arquivoConta) formData.append("imagemConta", arquivoConta);
    if (comprovantePagto) formData.append("comprovantePagamento", comprovantePagto);

    try {
        const metodo = idPagamento ? "PUT" : "POST";
        const url = idPagamento ? `/pagamentos/${idPagamento}` : "/pagamentos";

        console.log(`🚀 Enviando requisição ${metodo} para: ${url}`);

        const response = await fetchComToken(url, {
            method: metodo,
            body: formData
        });

        if (response) {
            await Swal.fire("Sucesso!", `${idPagamento ? 'Alterado' : 'Registrado'} com sucesso.`, "success");
           // const idParaRecarregar = idLancamento;
            limparFormularioTotalmente(true);
           // if (idParaRecarregar) {
           //     document.querySelector("#idLancamentoSelect").value = idParaRecarregar;
            //    await carregarHistoricoPagto(idParaRecarregar);
           // }
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



function limparFormularioTotalmente(limparTabela = true) {
    const form = document.querySelector("#form");
    if (form) form.reset(); 

    // 1. Reset de IDs e Flags
    document.querySelector("#idPagamento").value = "";
    if(document.getElementById('limparComprovanteImagem')) document.getElementById('limparComprovanteImagem').value = "false";
    if(document.getElementById('limparComprovantePagto')) document.getElementById('limparComprovantePagto').value = "false";

    // 2. FORÇAR LIMPEZA DA DATA E CHECKBOX (Mesmo após o reset)
    const campoDtPgto = document.querySelector("#dtpgto");
    const pagoCheckbox = document.querySelector("#statusPagto");
    
    if (campoDtPgto) {
        campoDtPgto.value = ""; // Garante que a data suma
    }
    if (pagoCheckbox) {
        pagoCheckbox.checked = false; // Garante que o checkbox desmarque
    }

    // 3. Reset do Select e Histórico
    const selectLancamento = document.querySelector("#idLancamentoSelect");
    if (selectLancamento) {
        if (limparTabela) {
            selectLancamento.value = ""; 
            const corpoTabela = document.querySelector("#corpoHistoricoPagto");
            if (corpoTabela) corpoTabela.innerHTML = ""; // Limpa o histórico
        }
        selectLancamento.disabled = false;
    }

    // 4. Reset de Campos de Texto Complementares
    const elDesc = document.querySelector("#descLancamento"); 
    const elVlrPrev = document.querySelector("#vlrPrevisto");
    if (elDesc) elDesc.value = "";
    if (elVlrPrev) elVlrPrev.value = "";

    // 5. Reset Visual de Anexos
    const imgDisplay = document.getElementById('imagemContaDisplay');
    const compDisplay = document.getElementById('comprovantePagtoDisplay');
    if (imgDisplay) imgDisplay.style.display = "none";
    if (compDisplay) compDisplay.style.display = "none";
    
    if (document.getElementById('fileNameConta')) document.getElementById('fileNameConta').textContent = "Nenhum arquivo selecionado";
    if (document.getElementById('fileNameComprovante')) document.getElementById('fileNameComprovante').textContent = "Nenhum arquivo selecionado";

    // 6. Sincronizar UI (Forçar atualização visual dos campos)
    document.querySelectorAll('#form input, #form select').forEach(i => {
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.dispatchEvent(new Event('change', { bubbles: true }));
    });
}


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

    const pagoCheckbox = document.querySelector("#statusPagto");
    const temPermissaoSupremo = temPermissao("Pagamentos", "supremo");    
    
    // if (pagoCheckbox) {
    //     pagoCheckbox.checked = false; // Inicia inativo
        
    //     // Desbloqueia apenas se for Supremo
    //     pagoCheckbox.disabled = !temPermissaoSupremo;

    //     // NOVA LÓGICA DE DATA AUTOMÁTICA
    //     pagoCheckbox.addEventListener('change', () => {
    //         const campoDtPgto = document.querySelector("#dtpgto");
    //         if (!campoDtPgto) return;

    //         if (pagoCheckbox.checked) {
    //             // Se marcou como pago e o campo está vazio, preenche com a data atual (Brasília/Local)
    //             if (!campoDtPgto.value) {
    //                 const hoje = new Date();
    //                 const offset = hoje.getTimezoneOffset();
    //                 const dataLocal = new Date(hoje.getTime() - (offset * 60 * 1000));
    //                 campoDtPgto.value = dataLocal.toISOString().split('T')[0];
                    
    //                 // Dispara o evento 'input' para que a interface (labels) reconheça o valor
    //                 campoDtPgto.dispatchEvent(new Event('input', { bubbles: true }));
    //             }
    //         } else {
    //             // Opcional: Limpa a data se desmarcar o status 'Pago'
    //             campoDtPgto.value = "";
    //             campoDtPgto.dispatchEvent(new Event('input', { bubbles: true }));
    //         }
    //     });
    // }


    if (pagoCheckbox) {
        pagoCheckbox.checked = false; 
        pagoCheckbox.disabled = !temPermissaoSupremo;

        // EVENTO DE CLIQUE COM CONFIRMAÇÃO
        pagoCheckbox.addEventListener('click', async (e) => {
            const campoDtPgto = document.querySelector("#dtpgto");
            
            // SE ESTIVER DESMARCANDO (Status saindo de PAGO para PENDENTE)
            if (!pagoCheckbox.checked) {
                // Cancela momentaneamente a desmarcação
                e.preventDefault(); 

                const confirmacao = await Swal.fire({
                    title: 'Remover Pagamento?',
                    text: "Isso removerá a data preenchida e voltará o status para PENDENTE. Confirmar?",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sim, remover',
                    cancelButtonText: 'Manter como Pago',
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6'
                });

                if (confirmacao.isConfirmed) {
                    // Se confirmou, desmarca de fato e limpa a data
                    pagoCheckbox.checked = false;
                    if (campoDtPgto) {
                        campoDtPgto.value = "";
                        campoDtPgto.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } else {
                    // Se cancelou, mantém o checkbox marcado
                    pagoCheckbox.checked = true;
                }
            } 
            // SE ESTIVER MARCANDO (Status PAGO)
            else {
                if (campoDtPgto && !campoDtPgto.value) {
                    const hoje = new Date();
                    const offset = hoje.getTimezoneOffset();
                    const dataLocal = new Date(hoje.getTime() - (offset * 60 * 1000));
                    campoDtPgto.value = dataLocal.toISOString().split('T')[0];
                    campoDtPgto.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        });
    }

    if (enviarBtn) enviarBtn.onclick = (e) => salvarPagamento(e);
    if (limparBtn) limparBtn.onclick = () => {
        limparFormularioTotalmente(true);
        document.querySelector("#corpoHistoricoPagto").innerHTML = "";
    };

    if (selectLanc) {
        selectLanc.onchange = async (e) => {

        if (carregandoEdicao) return;
        
        const idPagamentoAtual = document.querySelector("#idPagamento").value;
        if (idPagamentoAtual) {
            console.warn("Mudança de lançamento ignorada pois estamos em modo de edição.");
            return; 
        }
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