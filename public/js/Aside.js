import { fetchComToken, aplicarTema } from '../utils/utils.js';
import { animarListaEventos, animarListaClientes, animarListaOrcamentos, animarListaOrcEdicao} from './API/ScrollReveal.js'

let clienteSelecionado = null;
let nomeClienteSelecionado = '';
let nomeEventoSelecionado = '';
let eventoSelecionado = null;
let ultimoEventoIdAberto = null;
let ultimoClienteIdAberto = null;

document.addEventListener("DOMContentLoaded", async function () {
    console.log("Entrou no DOM");

    const idempresa = localStorage.getItem("idempresa");

    if (idempresa) {
        const apiUrl = `/aside/empresasTema/${idempresa}`;
        console.log("Buscando dados da empresa para tema:", apiUrl, idempresa);
        
        fetchComToken(apiUrl)
            .then(empresa => {
                console.log("Dados da empresa recebidos para tema:", empresa);
                const tema = empresa.nmfantasia; 
                aplicarTema(tema);
            })
            .catch(error => {
                console.error("❌ Erro ao buscar dados da empresa para o tema:", error);
            });
    }

    // O painel inicial agora é 'eventos'
    mostrarPainel("eventos"); 
    
    // O carregamento inicial agora é para eventos
    carregarEventos();
    
    const inputBusca = document.getElementById("search-aside");
    if (inputBusca) {
        inputBusca.addEventListener("input", function () {
            const termo = this.value.toLowerCase(); // Converte busca para minúsculo
            const listaEventos = document.querySelectorAll("#lista-dados-eventos li");

            listaEventos.forEach(li => {
                const nomeEvento = li.textContent.toLowerCase();
                // Se o nome do evento contiver o termo buscado, exibe; caso contrário, oculta
                if (nomeEvento.includes(termo)) {
                    li.style.display = "block";
                } else {
                    li.style.display = "none";
                }
            });
        });
    }

    const btn = document.getElementById("toggle-btn");
    if (btn) {
        btn.addEventListener("click", alternarMenu);
    }

    alternarMenu();
});


// --- Funções Principais de Navegação e Carregamento ---

window.navegarParaAba = function(tipo) {
    // 🔄 Limpar seleções ao voltar
    if (tipo === "eventos") { 
        clienteSelecionado = null;
        nomeClienteSelecionado = '';
        eventoSelecionado = null;
        nomeEventoSelecionado = '';
        sessionStorage.removeItem("orcamentoSelecionado");
        
        const ulClientes = document.getElementById("lista-dados-clientes");
        const ulOrcamento = document.getElementById("lista-dados-orcamento");
        if (ulClientes) ulClientes.innerHTML = "";
        if (ulOrcamento) ulOrcamento.innerHTML = "";
    }

    if (tipo === "clientes") {
        clienteSelecionado = null;
        nomeClienteSelecionado = '';
        sessionStorage.removeItem("orcamentoSelecionado");
        
        const ulOrcamento = document.getElementById("lista-dados-orcamento");
        if (ulOrcamento) ulOrcamento.innerHTML = "";
    }

    // 🔒 Bloqueia todas as abas inicialmente
    document.querySelectorAll(".aba").forEach(aba => {
        aba.classList.add("desativada");
        aba.style.pointerEvents = "none";
    });

    // ✅ Aba "Eventos" sempre ativa
    document.getElementById("aba-eventos").classList.remove("desativada");
    document.getElementById("aba-eventos").style.pointerEvents = "auto";

    // ✅ Libera "Clientes" se evento estiver selecionado
    if (eventoSelecionado) {
        document.getElementById("aba-clientes").classList.remove("desativada");
        document.getElementById("aba-clientes").style.pointerEvents = "auto";
    }

    // ✅ Libera "Orçamento" se cliente selecionado
    if (clienteSelecionado) {
        document.getElementById("aba-orcamento").classList.remove("desativada");
        document.getElementById("aba-orcamento").style.pointerEvents = "auto";
    }

    // Ativa painel e aba
    document.querySelectorAll(".painel").forEach(p => p.classList.remove("ativo"));
    document.querySelectorAll(".aba").forEach(a => a.classList.remove("ativa"));

    document.getElementById(`painel-${tipo}`)?.classList.add("ativo");
    document.getElementById(`aba-${tipo}`)?.classList.add("ativa");

    // Carregamento específico
    if (tipo === "eventos") carregarEventos(); 
    if (tipo === "clientes" && eventoSelecionado) carregarClientes(eventoSelecionado); 
    if (tipo === "orcamento" && clienteSelecionado) {
        document.getElementById("orcamento-selecionado").textContent =
            `Cliente: ${nomeClienteSelecionado} | Evento: ${nomeEventoSelecionado}`;
        carregarOrcamentos(clienteSelecionado, eventoSelecionado);
    }
};

function mostrarPainel(tipo) {
    const paineis = document.querySelectorAll('.painel');
    const abas = document.querySelectorAll('.aba');

    paineis.forEach(p => p.classList.remove('ativo'));
    abas.forEach(a => a.classList.remove('ativa'));

    document.getElementById(`painel-${tipo}`)?.classList.add('ativo');
    document.getElementById(`aba-${tipo}`)?.classList.add('ativa');

    if (tipo === 'clientes') {
        if (eventoSelecionado) {
            document.getElementById('evento-selecionado').textContent = `Clientes do Evento: ${nomeEventoSelecionado}`;
            carregarClientes(eventoSelecionado); 
        } else {
            Swal.fire("Atenção", "Selecione um evento primeiro.", "warning");
            return;
        }
    }

    if (tipo === 'orcamento') {
        if (clienteSelecionado && eventoSelecionado) {
            document.getElementById('orcamento-selecionado').textContent =
                `Cliente: ${nomeClienteSelecionado} | Evento: ${nomeEventoSelecionado}`;
            carregarOrcamentos(clienteSelecionado, eventoSelecionado);
        } else {
            Swal.fire("Atenção", "Selecione um cliente primeiro.", "warning");
            return;
        }
    }
}

// --- Funções de Carregamento de Dados ---

async function carregarEventos() {
    try {
        const eventos = await fetchComToken(`/aside/eventos`);

        const ul = document.getElementById('lista-dados-eventos');
        ul.innerHTML = '';

        if (!Array.isArray(eventos) || eventos.length === 0) {
            ul.innerHTML = '<li>Nenhum evento encontrado.</li>';
            return;
        }

        eventos.forEach(evento => {
            const li = document.createElement('li');
            li.textContent = evento.nmevento;
            li.setAttribute('data-evento-id', evento.idevento);

            li.onclick = () => {
                eventoSelecionado = evento.idevento;
                nomeEventoSelecionado = evento.nmevento;
                
                ul.querySelectorAll("li").forEach(item => item.classList.remove("selecionado"));
                li.classList.add("selecionado");

                document.getElementById('evento-selecionado').textContent = `Clientes do Evento: ${nomeEventoSelecionado}`;
                navegarParaAba('clientes');
            };

            ul.appendChild(li);
        });

      animarListaEventos();

    } catch (erro) {
        console.error("Erro ao carregar eventos:", erro);
        Swal.fire("Erro", "Não foi possível carregar os eventos.", "error");
    }
}

async function carregarClientes(eventoId) {
    try {
        console.log("ID evento:", eventoId);
        const clientes = await fetchComToken(`/aside/clientes?eventoId=${eventoId}`); 

        if (!clientes || clientes.erro === "sessao_expirada") {
            Swal.fire("Sessão expirada", "Por favor, faça login novamente.", "warning");
            return;
        }

        const ul = document.getElementById("lista-dados-clientes");
        ul.innerHTML = "";

        if (!Array.isArray(clientes) || clientes.length === 0) {
            ul.innerHTML = "<li>Nenhum cliente associado a este evento.</li>";
            return clientes;
        }

        clientes.forEach(cliente => {
            const li = document.createElement("li");
            li.textContent = cliente.nmfantasia;
            li.setAttribute('data-cliente-id', cliente.idcliente);

            li.addEventListener("click", () => {
                clienteSelecionado = cliente.idcliente;
                nomeClienteSelecionado = cliente.nmfantasia;

                ul.querySelectorAll("li").forEach(item => item.classList.remove("selecionado"));
                li.classList.add("selecionado");
                
                // Ativa a aba de orçamentos e depois a exibe.
                const abaOrcamento = document.getElementById('aba-orcamento');
                abaOrcamento.classList.remove('desativada');
                abaOrcamento.style.pointerEvents = 'auto';

                mostrarPainel('orcamento');
            });

            ul.appendChild(li);
        });

        animarListaClientes();

    } catch (erro) {
        console.error("Erro ao carregar clientes:", erro);
    }
}

async function carregarOrcamentos(clienteId, eventoId) {
    ultimoClienteIdAberto = clienteId;
    ultimoEventoIdAberto = eventoId;
    try {
        const orcamentos = await fetchComToken(`aside/orcamento?clienteId=${clienteId}&eventoId=${eventoId}`);

        const ul = document.getElementById('lista-dados-orcamento');
        ul.innerHTML = '';

        if (!Array.isArray(orcamentos) || orcamentos.length === 0) {
            ul.innerHTML = '<li>Nenhum orçamento encontrado</li>';
            return;
        }

        // 1. Agrupar os orçamentos pela coluna 'edicao'
        const pastas = orcamentos.reduce((acc, orc) => {
            const edicao = orc.edicao || "Sem Edição";
            if (!acc[edicao]) acc[edicao] = [];
            acc[edicao].push(orc);
            return acc;
        }, {});

        // 2. Criar as pastas (Edições)
        Object.keys(pastas).sort((a, b) => b - a).forEach(edicao => {
            
            const liPasta = document.createElement('li');
            liPasta.classList.add('pasta-Edicao');
            liPasta.innerHTML = `<strong>📁${edicao}</strong>`;
            liPasta.style.cursor = 'pointer';
            liPasta.style.padding = '5px';
            liPasta.style.backgroundColor = '#ececec';
            liPasta.style.marginBottom = '2px';

            const ulSublista = document.createElement('ul');
            ulSublista.style.display = 'none'; // Começa fechada
            ulSublista.style.listStyle = 'none';
            ulSublista.style.paddingLeft = '15px';

            // Alternar abrir/fechar pasta
            liPasta.onclick = () => {
                const estaAberto = ulSublista.style.display === 'block';
                ulSublista.style.display = estaAberto ? 'none' : 'block';
                liPasta.innerHTML = estaAberto ? `<strong>📁 Edição ${edicao}</strong>` : `<strong>📂 Edição ${edicao}</strong>`;
            };

            // 3. Inserir os orçamentos com a SUA lógica original
            pastas[edicao].forEach(orc => {
                const li = document.createElement('li');
                li.innerHTML = `
                    Orçamento nº ${orc.nrorcamento}<br>
                    Status: ${orc.status}<br>
                    Nome: ${orc.nomenclatura}
                `;

                animarListaOrcEdicao();

                // --- INÍCIO DA SUA LÓGICA ORIGINAL ---
                li.onclick = (e) => {
                    e.stopPropagation(); // IMPORTANTE: impede que o clique no orçamento feche a pasta
                    
                    sessionStorage.setItem("origemAbertura", "aside"); 
    
                    console.log("🟢 Clique no orçamento:", orc.nrorcamento);
                    sessionStorage.setItem("orcamentoSelecionado", JSON.stringify(orc));

                    const linkModal = document.querySelector('.abrir-modal[data-modulo="Orcamentos"]');
                    if (linkModal) {
                        // Se o modal já foi aberto antes nesta sessão, window.preencherFormularioComOrcamento
                        // ainda aponta para a instância ANTERIOR do módulo Orcamentos.js (com Flatpickr
                        // ligados ao <tr>/modal antigo, já removido do DOM). Sem limpar isso aqui, o
                        // polling abaixo via "typeof window.preencherFormularioComOrcamento === function"
                        // passava na hora — usando a função velha — e é exatamente por isso que 1 em cada
                        // poucas tentativas falhava mesmo com o polling: a condição já estava satisfeita
                        // por um estado obsoleto antes do novo <script> terminar de (re)inicializar.
                        delete window.preencherFormularioComOrcamento;
                        delete window.limparFormularioOrcamento;

                        console.log("🟡 Abrindo modal de orçamento...");
                        linkModal.click();

                        // Espera o #nrOrcamento existir, window.preencherFormularioComOrcamento estar
                        // disponível de novo (prova que o novo módulo terminou o setup síncrono) E o
                        // Flatpickr do período de Marcação já estar de fato anexado ao elemento atual do
                        // DOM (flatpickr grava a instância em element._flatpickr) — essa terceira checagem
                        // é o sinal mais confiável, pois é uma propriedade do próprio nó vivo, não de uma
                        // referência de módulo que pode ficar obsoleta entre aberturas.
                        const aguardarModalPronto = () => new Promise((resolve) => {
                            const tentativa = setInterval(() => {
                                const input = document.getElementById("nrOrcamento");
                                const campoMarcacao = document.getElementById("periodoMarcacao");
                                if (
                                    input &&
                                    typeof window.preencherFormularioComOrcamento === "function" &&
                                    campoMarcacao && campoMarcacao._flatpickr
                                ) {
                                    clearInterval(tentativa);
                                    resolve(input);
                                }
                            }, 50);
                            setTimeout(() => {
                                clearInterval(tentativa);
                                resolve(document.getElementById("nrOrcamento") || null);
                            }, 5000);
                        });

                        aguardarModalPronto().then(async (input) => {
                            console.log("🔵 Modal pronto: tentando preencher");
                            if (input && typeof window.preencherFormularioComOrcamento === "function") {
                                console.log("🟣 Campo nrOrcamento encontrado. Preenchendo com:", orc.nrorcamento);
                                input.value = orc.nrorcamento;

                                try {
                                    console.log("🟤 Buscando orçamento detalhado via API...");
                                    const orcamento = await fetchComToken(`orcamentos?nrOrcamento=${orc.nrorcamento}`);
                                    console.log("✅ Dados recebidos, preenchendo formulário. ");
                                    window.preencherFormularioComOrcamento(orcamento);
                                } catch (error) {
                                    console.error("❌ Erro ao buscar orçamento:", error);
                                    window.limparFormularioOrcamento?.();
                                    Swal.fire("Erro", `Não foi possível buscar o orçamento ${orc.nrorcamento}.`, "error");
                                }
                            } else {
                                console.warn("⚠️ Modal não ficou pronto a tempo (campo ou função de preenchimento ausentes).");
                                Swal.fire("Erro", "O modal do orçamento demorou demais para carregar. Tente novamente.", "error");
                            }
                        });
                    } else {
                        console.error("❌ Botão para abrir o modal não encontrado.");
                        Swal.fire("Erro", "Botão para abrir o modal não encontrado.", "error");
                    }
                };
                // --- FIM DA SUA LÓGICA ORIGINAL ---

                ulSublista.appendChild(li);
            });

            ul.appendChild(liPasta);
            ul.appendChild(ulSublista);
        });

        animarListaOrcamentos();
        animarListaOrcEdicao();

    } catch (erro) {
        console.error("❌ Erro ao carregar orçamentos:", erro);
        Swal.fire("Erro", "Não foi possível carregar os orçamentos.", "error");
    }
}

window.recarregarListaOrcamentosAside = () => {
    if (ultimoClienteIdAberto && ultimoEventoIdAberto) {
        carregarOrcamentos(ultimoClienteIdAberto, ultimoEventoIdAberto);
    }
};

function alternarMenu() {
    const wrapper = document.getElementById("wrapper");
    const btn = document.getElementById("toggle-btn");

    const estaFechado = wrapper.classList.toggle("menu-fechado");
    btn.innerHTML = estaFechado ? "»" : "«";
}