document.addEventListener("DOMContentLoaded", function () {
  // Apenas configura seus modais
  document.querySelectorAll(".abrir-modal").forEach(botao => {
    botao.addEventListener("click", function () {
      let url = botao.getAttribute("data-url");
      abrirModal(url);
    });
  });
})

function abrirModal(url) {
    console.log("ABRIR  MODAL  Carregando modal de:", url);

    if (!url) {
        console.error("URL do modal não fornecida.");
        return;
    }else {
        console.log("URL do modal fornecida:", url);
        if (url.includes("Orcamento")) {
            console.log("URL do modal é de orçamento");
           
        }
    }

    fetch(url)
        .then(response => response.text())
        .then(html => {
            let modalContainer = document.getElementById("modal-container");
            modalContainer.innerHTML = html;

            // let script = null;

            // if (url.includes("CadClientes")) {
            //     script = document.createElement("script");
            //     script.src = "js/Clientes.js";
            //     window.moduloAtual = "Clientes";
            //     console.log("MODULO ATUAL", window.moduloAtual);

            // } else if (url.includes("CadFuncao")) {
            //     script = document.createElement("script");
            //     script.src = "js/Funcao.js"; 

            // } else if (url.includes("Orcamento")) {
            //     script = document.createElement("script");
            //     script.src = "js/Orcamento.js";

            // } else if (url.includes("CadLocalMontagem")) {
            //     script = document.createElement("script");
            //     script.src = "js/LocalMontagem.js";

            // } else if (url.includes("CadEventos")) {
            //     script = document.createElement("script");
            //     script.src = "js/Eventos.js";

            // }else if (url.includes("CadEquipamentos")) {
            //     script = document.createElement("script");
            //     script.src = "js/Equipamentos.js";

            // }else if (url.includes("CadSuprimentos")) {
            //     script = document.createElement("script");
            //     script.src = "js/Suprimentos.js";
            // }

            // if (script) {
            //     script.defer = true;
            //     script.onload = () => {
            //         configurarEventosEspecificos(url); // só chama depois que o JS carregar
            //         // e depois reaplica as permissões, agora incluindo elementos do modal
            //         if (window.initPermissoes) {
            //             setTimeout(() => {
            //                 console.log("Reexecutando initPermissoes após carregar modal");
            //                 initPermissoes();
            //             }, 100); // dá tempo do conteúdo ser renderizado
            //         }
            //     };
            //    // document.body.appendChild(script);
               
            // }

            let scriptSrc = null;

            if (url.includes("CadClientes")) {
                scriptSrc = "js/Clientes.js";
                window.moduloAtual = "Clientes";
            } else if (url.includes("CadFuncao")) {
                scriptSrc = "js/Funcao.js";
                window.moduloAtual = "Funções";
            } else if (url.includes("Orcamento")) {
                scriptSrc = "js/Orcamento.js";
                window.moduloAtual = "Orcamento";
            } else if (url.includes("CadLocalMontagem")) {
                scriptSrc = "js/LocalMontagem.js";
                window.moduloAtual = "Locais";
            } else if (url.includes("CadEventos")) {
                scriptSrc = "js/Eventos.js";
                window.moduloAtual = "Eventos";
            } else if (url.includes("CadEquipamentos")) {
                scriptSrc = "js/Equipamentos.js";
                window.moduloAtual = "Equipamentos";
            } else if (url.includes("CadSuprimentos")) {
                scriptSrc = "js/Suprimentos.js";
                window.moduloAtual = "Suprimentos";
            }


            console.log("MODULO ATUAL:", window.moduloAtual);

            // Verifica se o script já está carregado
            const scriptsExistentes = Array.from(document.scripts);
            const jaCarregado = scriptsExistentes.some(s => s.src.includes(scriptSrc));

            if (scriptSrc && !jaCarregado) {
                let script = document.createElement("script");
                script.src = scriptSrc;
                script.defer = true;
                script.onload = () => {
                    // Só configurar eventos e permissões depois do script carregar
                    configurarEventosEspecificos(url);

                    if (window.initPermissoes) {
                        setTimeout(() => {
                            console.log("Reexecutando initPermissoes após carregar modal");
                            initPermissoes();
                        }, 100); // para garantir que DOM está pronto
                    }
                };
                document.body.appendChild(script);
            } else {
                // Script já carregado, só configurar eventos e permissões
                configurarEventosEspecificos(url);

                if (window.initPermissoes) {
                    setTimeout(() => {
                        console.log("Reexecutando initPermissoes após carregar modal (sem recarregar script)");
                        initPermissoes();
                    }, 100);
                }
            }


            let modal = modalContainer.querySelector(".modal");
            let overlay = document.getElementById("modal-overlay");

            if (modal) {
                modal.style.display = "block";
                overlay.style.display = "block";
                document.body.classList.add("modal-open");

                let closeButton = modal.querySelector('.close');
                if (closeButton) closeButton.addEventListener('click', fecharModal);          
                
            }
        })
        .catch(error => console.error("Erro ao carregar modal:", error));
}

function fecharModal() {
    console.log("FECHANDO  MODAL PELO MODAL.JS " );
    let modalContainer = document.getElementById("modal-container");
    let overlay = document.getElementById("modal-overlay");

    if (modalContainer) {
        modalContainer.innerHTML = "";
        // modalContainer.style.display = "none";
    }
    
    if (overlay) {
        // overlay.style.display = "none";
    }

    document.body.classList.remove("modal-open");
}

function configurarEventosEspecificos(url) {
    console.log("Modal.js - Configurando eventos para:", url);

    const rotas = [
        { keyword: "Orcamento", func: configurarEventosOrcamento },
        { keyword: "CadFuncao", func: configurarEventosFuncao },
        { keyword: "CadLocalMontagem", func: configurarEventosMontagem },
        { keyword: "CadEventos", func: configurarEventosCadEvento},
        { keyword: "CadEquipamentos", func: configurarEventosEquipamento },
        { keyword: "CadSuprimentos", func: configurarEventosSuprimento },
        { keyword: "CadClientes", func: configurarEventosClientes },
    ];

    rotas.forEach(({ keyword, func }) => {
        if (url.includes(keyword)) {
            setTimeout(() => {
                if (typeof func === "function") {
                    console.log(`Chamando ${func.name}()`);
                    func();
                } else {
                    console.error(`Função ${func.name} não encontrada!`);
                }
            }, 500);
        }
    });

}
