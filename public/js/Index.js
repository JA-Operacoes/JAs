document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".abrir-modal").forEach(botao => {
        botao.addEventListener("click", function () {
            let url = botao.getAttribute("data-url"); // Obtém a URL do modal
            abrirModal(url);
        });
    });
});

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

            let script = null;

            if (url.includes("CadClientes")) {
                script = document.createElement("script");
                script.src = "js/Clientes.js";
            } else if (url.includes("CadFuncao")) {
                script = document.createElement("script");
                // script.src = "js/Funcao.js";
                script.src = "js/Funcao.js"; // Corrigido para carregar o script correto
            } else if (url.includes("Orcamento")) {
                script = document.createElement("script");
                script.src = "js/Orcamento.js";
            } else if (url.includes("CadLocalMontagem")) {
                script = document.createElement("script");
                script.src = "js/LocalMontagem.js";
            } else if (url.includes("CadEventos")) {
                script = document.createElement("script");
                script.src = "js/Eventos.js";
            }

            if (script) {
                script.defer = true;
                script.onload = () => {
                    configurarEventosEspecificos(url); // só chama depois que o JS carregar
                };
                document.body.appendChild(script);
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
       // { keyword: "Equipamentos", func: configurarEventosEquipamentos },
       // { keyword: "Suprimentos", func: configurarEventosSuprimentos },
       
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
