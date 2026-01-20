
import { fetchComToken, aplicarTema } from '../utils/utils.js';

document.addEventListener("DOMContentLoaded", function () {
    const idempresa = localStorage.getItem("idempresa");

    if (idempresa) {
        const apiUrl = `/empresas/${idempresa}`; // Verifique o caminho da sua API

        fetchComToken(apiUrl)
            .then(empresa => {
                // Usa o nome fantasia como tema
                const tema = empresa.nmfantasia;
                aplicarTema(tema);
            })
            .catch(error => {
                console.error("❌ Erro ao buscar dados da empresa para o tema:", error);
                // aplicarTema('default');
            });
    }
});

let limparFuncaoButtonListener = null;
let enviarFuncaoButtonListener = null;
let pesquisarFuncaoButtonListener = null;
let selectFuncaoChangeListener = null;
let inputDescFuncaoInputListener = null; 
let inputDescFuncaoBlurListener = null;  
let blurFuncaoCampoListener = null;

if (typeof window.FuncaoOriginal === "undefined") {
    window.FuncaoOriginal = {
        idCategoriaFuncao: "",
        idFuncao: "",
        descFuncao: "",
        vlrCustoSenior: "",
        vlrCustoPleno: "",
        vlrCustoJunior: "",
        vlrCustoBase: "",
        vlrVenda: "",
        vlrTransporte: "",
        vlrTransporteSenior: "",
        vlrAlimentacao: "",
        obsFuncao: "",
        ObsAjc:"",
        idCatFuncao: "",
        idEquipe: "",
        ativo:""
    }
};


function verificaFuncao() {    

    console.log("Carregando Funcao...");
       
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const form = document.querySelector("#form");
    const botaoLimpar = document.querySelector("#Limpar");

    carregarEquipesFuncao();
    carregarCategoriasFuncao();

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário 
        console.log("Limpando Funcao...");
        const campo = document.getElementById("descFuncao");

        if (campo && campo.tagName.toLowerCase() === "select") {
            const input = document.createElement("input");
            input.type = "text";
            input.id = "descFuncao";
            input.name = "descFuncao";
            input.value = "Descrição da Função";
            input.className = "form";
            input.classList.add('uppercase');
            input.required = true;

            campo.parentNode.replaceChild(input, campo);
            adicionarEventoBlurFuncao();

            const label = document.querySelector('label[for="descFuncao"]');
            if (label) label.style.display = "block";

        }
        
        limparCamposFuncao();

    });

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário
        console.log("Enviando Funcao...");

        const idFuncao = document.querySelector("#idFuncao").value;
        const descFuncao = document.querySelector("#descFuncao").value.toUpperCase().trim();
        
        const vlrCustoBase = document.querySelector("#CustoBase").value || 0.00;
        const vlrVenda = document.querySelector("#Venda").value || 0.00;
        
        const obsProposta = document.querySelector("#obsProposta").value.trim();
        const obsFuncao = document.querySelector("#obsFuncao").value.trim();
    
        const custoBase = parseFloat(String(vlrCustoBase).replace(",", "."));
        const venda = parseFloat(String(vlrVenda).replace(",", "."));
       
        const ativo = document.getElementById('funcaoAtiva').checked;
        const idCatFuncao = document.querySelector("#idCatFuncao").value;
        const idEquipe = document.querySelector("#idEquipeFuncao").value;

       
        console.log("ID da Equipe:", idEquipe);

       // Permissões
        const temPermissaoCadastrar = temPermissao("Funcao", "cadastrar");
        const temPermissaoAlterar = temPermissao("Funcao", "alterar");

        console.log("temPermissaoCadastrar:", temPermissaoCadastrar);
        console.log("temPermissaoAlterar:", temPermissaoAlterar);

        const metodo = idFuncao ? "PUT" : "POST";

        if (!idFuncao && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novas funções.", "error");
        }

        if (idFuncao && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar funções.", "error");
        }

            // Validação mais precisa
        const camposVazios = !descFuncao || idCatFuncao === "" || idEquipe === "";
        const valoresInvalidos = isNaN(custoBase) || isNaN(venda);

        if (camposVazios || valoresInvalidos) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios!',
                text: 'Preencha todos os campos corretamente antes de enviar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
        console.log("Valores do Funcao:", idFuncao, descFuncao, venda, obsProposta, obsFuncao, idCatFuncao, idEquipe, ativo);
        console.log("Valores do Funcao Original:", window.FuncaoOriginal.idFuncao, window.FuncaoOriginal.descFuncao, window.FuncaoOriginal.vlrCusto, window.FuncaoOriginal.vlrCustoSenior,
            window.FuncaoOriginal.vlrCustoPleno, window.FuncaoOriginal.vlrCustoJunior, window.FuncaoOriginal.vlrBase, window.FuncaoOriginal.vlrVenda, window.FuncaoOriginal.vlrTransporte,
            window.FuncaoOriginal.vlrTransporteSenior, window.FuncaoOriginal.obsFuncao, window.FuncaoOriginal.vlrAlimentacao, window.FuncaoOriginal.idCatFuncao, 
            window.FuncaoOriginal.idEquipe, window.FuncaoOriginal.ativo);

        // Comparar com os valores originais
        if (
            parseInt(idFuncao) === parseInt(window.FuncaoOriginal.idFuncao) && 
            descFuncao === window.FuncaoOriginal.descFuncao &&        
            Number(venda).toFixed(2) === Number(window.FuncaoOriginal.vlrVenda).toFixed(2) &&       
            obsProposta === window.FuncaoOriginal.obsProposta &&
            obsFuncao === window.FuncaoOriginal.obsFuncao &&
            parseInt(idCatFuncao) === parseInt(window.FuncaoOriginal.idCatFuncao) &&
            parseInt(idEquipe) === parseInt(window.FuncaoOriginal.idEquipe) &&
            ativo === window.FuncaoOriginal.ativo
        ) {
            console.log("Nenhuma alteração detectada.");
            await Swal.fire({
                icon: 'info',
                title: 'Nenhuma alteração foi detectada!',
                text: 'Faça alguma alteração antes de salvar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }

const getNum = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return 0;
        const num = parseFloat(String(el.value).replace(",", "."));
        return isNaN(num) ? 0 : num;
    };
    const dados = {
        descFuncao,
        custoBase: getNum("#CustoBase"),
        venda: getNum("#Venda"),
        transporte: getNum("#transporte"),
        almoco: getNum("#almoco"),
        alimentacao: getNum("#alimentacao"),
        transpSenior: getNum("#transpSenior"),
        custoSenior: getNum("#custoSenior"),
        custoPleno: getNum("#custoPleno"),
        custoJunior: getNum("#custoJunior"),
        obsProposta: document.querySelector("#obsProposta").value.trim(),
        obsFuncao: document.querySelector("#obsFuncao").value.trim(),
        ativo: document.getElementById('funcaoAtiva').checked,
        idCatFuncao: document.querySelector("#idCatFuncao").value,
        idEquipe: document.querySelector("#idEquipeFuncao").value
    };
        const token = localStorage.getItem('token');
        const idEmpresa = localStorage.getItem('idEmpresa');

        console.log("Dados a serem enviados:", dados);
        console.log("ID da empresa:", idEmpresa);
     
        if (idFuncao) {
            const { isConfirmed } = await Swal.fire({
                title: "Deseja salvar as alterações?",
                text: "Você está prestes a atualizar os dados da função.",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Sim, salvar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            if (!isConfirmed) return; 

            try {
                
                const resultJson = await fetchComToken(`/funcao/${idFuncao}`, {
                    method: "PUT",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });

            
                Swal.fire("Sucesso!", resultJson.message || "Alterações salvas com sucesso!", "success"); 
                document.getElementById('form').reset();
                document.querySelector("#idFuncao").value = "";
                limparFuncaoOriginal();

            } catch (error) {
                console.error("Erro ao enviar dados (PUT):", error);
                
                Swal.fire("Erro", error.message || "Erro ao salvar a Função.", "error");
            }
        } else {
            // Lógica para POST (Salvar novo)
            try {
                
                const resultJson = await fetchComToken("/funcao", {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados) // Passe o objeto dados diretamente
                });
            
                Swal.fire("Sucesso!", resultJson.mensagem || "Função cadastrada!", "success"); 
                document.getElementById('form').reset(); 
                limparFuncaoOriginal();
                document.querySelector("#idFuncao").value = "";

            } catch (error) {
                console.error("Erro ao enviar dados (POST):", error);            
                Swal.fire("Erro", error.message || "Erro ao cadastrar a Função.", "error");
            }
        }           
    });
    
    console.log("botaoPesquisar:", botaoPesquisar);
    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        console.log("Pesquisando Funcao...");

        limparCamposFuncao();
        console.log("Pesquisando Funcao...");

        const temPermissaoPesquisar = temPermissao('Funcao', 'pesquisar');
        console.log("Tem permissão para pesquisar Função:", temPermissaoPesquisar);
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const input = document.querySelector("#descFuncao");
            const desc = input?.value?.trim() || "";

            const funcoes = await fetchComToken(`/funcao?descFuncao=${encodeURIComponent(desc)}`);

            if (!funcoes || funcoes.length === 0) {
                return Swal.fire({
                    icon: 'info',
                    title: 'Nenhum cliente cadastrado',
                    text: 'Não foi encontrado nenhum cliente no sistema.',
                    confirmButtonText: 'Ok'
                });
            }

            const select = criarSelectFuncao(funcoes);
            //limparCamposFuncao();
            
               
            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }
   
            const label = document.querySelector('label[for="descFuncao"]');
            if (label) {
              label.style.display = "none"; // ou guarda o texto, se quiser restaurar exatamente o mesmo
            }
    
            // Reativar o evento blur para o novo select
            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
               
                if (!desc) {
                    console.warn("Valor do select está vazio ou indefinido.");
                    return;
                }

                await carregarFuncaoDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "descFuncao";
                novoInput.name = "descFuncao";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.classList.add('uppercase');
                novoInput.value = desc;
            
                novoInput.addEventListener("input", function() {
                    this.value = this.value.toUpperCase(); // transforma o texto em maiúsculo à medida que o usuário digita
                });

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurFuncao();
               
                const label = document.querySelector('label[for="descFuncao"]');
                if (label) {
                label.style.display = "block";
                label.textContent = "Descrição da Função"; // ou algum texto que você tenha guardado
                }
              
                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarFuncaoDescricao(this.value, this);
                });
 
         });
    
        } catch (error) {
            console.error("Erro ao carregar funções:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar as funções.',
                confirmButtonText: 'Ok'
            });
        }
    });
}

let equipeComDetalhes = {}; 
async function carregarEquipesFuncao() {
    const selectElement = document.getElementById('idEquipeFuncao');
    // Limpa as opções anteriores, exceto a primeira (placeholder)
    equipeComDetalhes = {}; 
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }

    try {
        // Assume que a URL é a rota que busca todas as categorias sem filtro
        const url = '/funcao/equipe'; 
        
        // Use sua função de fetch
        const equipes = await fetchComToken(url); 
        console.log("Equipes", equipes); 
            
        if (equipes && equipes.length > 0) {
            equipes.forEach(equipe => {
                const option = document.createElement('option');
                option.value = equipe.idequipe;
                option.textContent = equipe.nmequipe;
                selectElement.appendChild(option);

                equipeComDetalhes[equipe.idequipe] = equipe;
            });
            selectElement.addEventListener('change', function() {

                console.log("Mudança de equipe detectada.");
                // O CÓDIGO QUE VOCÊ QUER EXECUTAR AO MUDAR A EQUIPE VAI AQUI
            
                
                const equipeSelecionadaId = this.value; // 'this' refere-se ao selectElement
                const equipeDetalhes = equipeComDetalhes[equipeSelecionadaId];
                
                console.log("Equipe selecionada (ID):", equipeSelecionadaId);
                
                if (equipeDetalhes) {
                    console.log("Nome da Equipe:", equipeDetalhes.nmequipe);
                    
                    // Exemplo de Ação: Se você precisa preencher outro campo ou fazer algo:
                    // document.getElementById('nomeCampo').value = equipeDetalhes.algumaPropriedade;
                    
                } else {
                    // Tratamento para a opção placeholder
                    console.log("Placeholder ou valor inválido selecionado.");
                }
                
                // Se a lógica for muito grande, AINDA é recomendado usar uma função externa, 
                // mas isso atende ao seu pedido de tratar 'change' aqui.
            });
            
        } else {
            console.warn("Nenhuma equipe encontrada.");
            // O SweetAlert pode ser usado aqui, mas pode ser intrusivo
            Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Nenhuma equipe cadastrada.' });
        }
        
    } catch (error) {
        console.error("Erro ao carregar equipes de função:", error);
        Swal.fire({
            icon: 'error',
            title: 'Erro de Carregamento',
            text: 'Não foi possível carregar as equipes de função.',
        });
    }
}

let categoriasComDetalhes = {}; 
async function carregarCategoriasFuncao() {
    const selectElement = document.getElementById('idCatFuncao');
    // Limpa as opções anteriores, exceto a primeira (placeholder)
    categoriasComDetalhes = {}; 
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }

    try {
        // Assume que a URL é a rota que busca todas as categorias sem filtro
        const url = '/funcao/categoriafuncao'; 
        
        // Use sua função de fetch
        const categorias = await fetchComToken(url); 
        console.log("CATEGORIAS", categorias);
        
        //if (response.ok) {
            //const categorias = await response.json();
            
            if (categorias && categorias.length > 0) {
                categorias.forEach(categoria => {
                    const option = document.createElement('option');                    
                    option.value = categoria.idcategoriafuncao;                   
                    option.textContent = categoria.nmcategoriafuncao; 
                    selectElement.appendChild(option);

                    categoriasComDetalhes[categoria.idcategoriafuncao] = categoria;
                });
                selectElement.addEventListener('change', preencherCustosPorCategoria);
            } else {               
                console.warn("Nenhuma categoria função encontrada.");
                // O SweetAlert pode ser usado aqui, mas pode ser intrusivo
                Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Nenhuma categoria função cadastrada.' });
            }
        
    } catch (error) {
        console.error("Erro ao carregar categorias de função:", error);
        Swal.fire({
            icon: 'error',
            title: 'Erro de Carregamento',
            text: 'Não foi possível carregar as categorias de função.',
        });
    }
}
function preencherCustosPorCategoria() {
    const selectElement = document.getElementById('idCatFuncao');
    const idSelecionado = selectElement.value;

    console.log("Categoria selecionada (ID):", idSelecionado);
    
    // Verifica se um ID válido foi selecionado (não a opção placeholder)
    if (!idSelecionado) {
        // Opcional: Limpar os campos se for deselecionado ou se for o placeholder
        limparCamposDeCusto(); 
        return;
    }
    
    // Busca os detalhes da categoria no objeto armazenado
    const categoria = categoriasComDetalhes[idSelecionado];

    if (categoria) {
        // Preenche os campos com os valores da categoria selecionada
        document.querySelector("#CustoSenior").value = categoria.ctofuncaosenior || 0.00;
        document.querySelector("#CustoPleno").value = categoria.ctofuncaopleno || 0.00;
        document.querySelector("#CustoJunior").value = categoria.ctofuncaojunior || 0.00;
        document.querySelector("#CustoBase").value = categoria.ctofuncaobase || 0.00;       
        document.querySelector("#transporte").value = categoria.transporte || 0.00;
        document.querySelector("#TranspSenior").value = categoria.transpsenior || 0.00;      
        document.querySelector("#alimentacao").value = categoria.alimentacao || 0.00;
        
        console.log(`Custos preenchidos com base na Categoria ID: ${idSelecionado}`);
    } else {
        console.warn(`Detalhes não encontrados para a Categoria ID: ${idSelecionado}`);
        limparCamposDeCusto();
    }
}



// Função auxiliar para limpar os campos, se necessário
function limparCamposDeCusto() {
    document.querySelector("#CustoSenior").value = "";
    document.querySelector("#CustoPleno").value = "";
    document.querySelector("#CustoJunior").value = "";
    document.querySelector("#CustoBase").value = "";
    document.querySelector("#Venda").value = "";
    document.querySelector("#transporte").value = "";
    document.querySelector("#TranspSenior").value = "";
    document.querySelector("#alimentacao").value = "";
}

function criarSelectFuncao(funcoes) {
   
    const select = document.createElement("select");
    select.id = "descFuncao";
    select.name = "descFuncao";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione uma função...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO FUNCAO:", funcoes);

    funcoes.forEach(funcaoachada => {
        const option = document.createElement("option");
        option.value = funcaoachada.descfuncao;
        option.text = funcaoachada.descfuncao;
        select.appendChild(option);
    });
 
    return select;
}


// Variável global para armazenar o último elemento clicado
if (!window.ultimoClique) {
    window.ultimoClique = null;
  
}
// Captura o último elemento clicado no documento (uma única vez)
document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurFuncao() {
    const input = document.querySelector("#descFuncao");
    if (!input) return;

    input.addEventListener("blur", async function () {
        console.log("Blur no campo descFuncao:", this.value);

        const botoesIgnorados = ["Limpar", "Pesquisar", "Close"];
        const ehBotaoIgnorado =
            (ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id)) ||
            (ultimoClique?.classList && ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }

        const desc = this.value.trim();
        console.log("Campo descFuncao procurado:", desc);

        if (!desc) return;

        try {
            console.log("Buscando Função com descrição:", desc);
            await carregarFuncaoDescricao(desc, this);
            console.log("Função selecionada depois de carregarFuncaoDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Função:", error);
        }
    });
}


async function carregarFuncaoDescricao(desc, elementoAtual) {
    console.log("Carregando Função com descrição:", desc, elementoAtual);
    try {
      
       const funcao = await fetchComToken(`/funcao?descFuncao=${encodeURIComponent(desc)}`);
      
       console.log("Resposta da busca de Função:", funcao);

       if (!funcao || !funcao.idfuncao) throw new Error("Função não encontrada");

    //    if (!funcao || funcao.length === 0 || !funcao.idfuncao) {
    //         // Lançamos o erro para forçar a entrada no bloco 'catch'
    //         throw new Error("Função não encontrada ou resposta inválida.");
    //     }

        document.querySelector("#idEquipeFuncao").value = funcao.idequipe;
        document.querySelector("#idCatFuncao").value = funcao.idcategoriafuncao;
        document.querySelector("#idFuncao").value = funcao.idfuncao;
        document.querySelector("#CustoSenior").value = funcao.ctofuncaosenior || 0.00;
        document.querySelector("#CustoPleno").value = funcao.ctofuncaopleno || 0.00;
        document.querySelector("#CustoJunior").value = funcao.ctofuncaojunior || 0.00;
        document.querySelector("#CustoBase").value = funcao.ctofuncaobase || 0.00;
        document.querySelector("#Venda").value = funcao.vdafuncao || 0.00;
        document.querySelector("#transporte").value = funcao.transporte || 0.00;
        document.querySelector("#TranspSenior").value = funcao.transpsenior || 0.00;      
        document.querySelector("#alimentacao").value = funcao.alimentacao || 0.00;
        document.querySelector("#obsProposta").value = funcao.obsproposta || "";
        document.querySelector("#obsFuncao").value = funcao.obsfuncao || "";
        document.querySelector("#funcaoAtiva").checked =
         funcao.ativo === true || funcao.ativo === "true" || funcao.ativo === 1;       

        console.log("Valores da Função carregada:", funcao.ctofuncaosenior, funcao.ctofuncaopleno, funcao.ctofuncaojunior, funcao.ctofuncaobase, funcao.vdafuncao, funcao.transporte, funcao.alimentacao, funcao.idequipe);
        
        window.FuncaoOriginal = {
            idFuncao: funcao.idfuncao,
            descFuncao: funcao.descfuncao,
            idCategoriaFuncao: funcao.idcategoriafuncao,
            idEquipe: funcao.idequipe,
            vlrVenda: funcao.vdafuncao,
            vlrCustoSenior: funcao.ctofuncaosenior,
            vlrCustoPleno: funcao.ctofuncaopleno,
            vlrCustoJunior: funcao.ctofuncaojunior,
            vlrCustoBase: funcao.ctofuncaobase,
            vlrTransporte: funcao.transporte,
            vlrTransporteSenior: funcao.transpsenior,
            vlrAlimentacao: funcao.alimentacao,            
            obsProposta: funcao.obsproposta,
            obsFuncao: funcao.obsfuncao,
            ativo: funcao.ativo
        };  
       

    } catch (error) {
        
        const inputIdFuncao = document.querySelector("#idFuncao");
        const podeCadastrarFuncao = temPermissao("Funcao", "cadastrar");

        if (!inputIdFuncao.value && podeCadastrarFuncao) {
    
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como nova Função?`,
                text: `Função "${desc.toUpperCase()}" não encontrado`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            console.log("Resultado do Swal:", resultado);
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro da Função.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
        
        }else if (!podeCadastrarFuncao) {
            Swal.fire({
                icon: "info",
                title: "Função não cadastrada",
                text: "Você não tem permissão para cadastrar função.",
                confirmButtonText: "OK"
            });
        }
        
    }
}

function limparFuncaoOriginal() {
    window.FuncaoOriginal = {
        idCategoriaFuncao: "",
        idFuncao: "",
        descFuncao: "",
        vlrCustoBase: "",
        vlrCustoPleno: "",
        vlrCustoJunior: "",
        vlrCustoSenior: "",
        vlrVenda: "",
        vlrTransporte: "",
        vlrTransporteSenior: "",
        vlrAlimentacao: "",
        obsFuncao:"",
        ObsAjc:"",
        ativo:""
    };
}

function limparCamposFuncao() {
    const campos = ["idFuncao", "descFuncao","CustoSenior", "CustoPleno", "CustoJunior", "CustoBase", "Venda", 
        "transporte", "transporteSenior",  "alimentacao", "idCatFuncao","idEquipe","ObsAjc"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            if (campo.type === "checkbox") {
                campo.checked = false;
            } else {
                campo.value = "";
            }
        }
    });

    // Garante que o campo "ativo" (checkbox) seja desmarcado
    const campoAtivo = document.getElementById("funcaoAtiva");
    if (campoAtivo && campoAtivo.type === "checkbox") {
        campoAtivo.checked = false;
    }
    
    const selectCatFuncao = document.getElementById("idCatFuncao");
    if (selectCatFuncao) {
        // Reseta o valor do select para a primeira opção (placeholder, que geralmente tem value="" ou é a primeira)
        selectCatFuncao.value = ""; 
    }

    const selectEquipe = document.getElementById("idEquipeFuncao");
    if (selectEquipe) {
        // Reseta o valor do select para a primeira opção (placeholder, que geralmente tem value="" ou é a primeira)
        selectEquipe.value = ""; 
    }
}

function configurarEventosFuncao() {
    console.log("Configurando eventos Funcao...");
    verificaFuncao(); // Carrega os Funcao ao abrir o modal
    adicionarEventoBlurFuncao();
    console.log("Entrou configurar Funcao no FUNCAO.js.");
} 
window.configurarEventosFuncao = configurarEventosFuncao;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  
  if (modulo.trim().toLowerCase() === 'funcao') {
    
    configurarEventosFuncao();

    if (typeof aplicarPermissoes === "function" && window.permissoes) {// 01/06/2025
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis.");
    }
  
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;


function desinicializarFuncaoModal() { // Renomeado para seguir o padrão 'desinicializarBancosModal'
    console.log("🧹 Desinicializando módulo Funcao.js...");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const descFuncaoElement = document.getElementById("descFuncao"); // Pode ser input ou select

    // 1. Remover listeners de eventos dos botões fixos (usando as variáveis `let`)
    if (botaoLimpar && limparFuncaoButtonListener) {
        botaoLimpar.removeEventListener("click", limparFuncaoButtonListener);
        limparFuncaoButtonListener = null; // Zera a referência
        console.log("Listener de click do Limpar (Funcao) removido.");
    }
    if (botaoEnviar && enviarFuncaoButtonListener) {
        botaoEnviar.removeEventListener("click", enviarFuncaoButtonListener);
        enviarFuncaoButtonListener = null; // Zera a referência
        console.log("Listener de click do Enviar (Funcao) removido.");
    }
    if (botaoPesquisar && pesquisarFuncaoButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarFuncaoButtonListener);
        pesquisarFuncaoButtonListener = null; // Zera a referência
        console.log("Listener de click do Pesquisar (Funcao) removido.");
    }

    // 2. Remover listeners de elementos dinâmicos (#descFuncao)
    if (descFuncaoElement) {
        if (descFuncaoElement.tagName.toLowerCase() === "select" && selectFuncaoChangeListener) {
            descFuncaoElement.removeEventListener("change", selectFuncaoChangeListener);
            selectFuncaoChangeListener = null;
            console.log("Listener de change do select descFuncao removido.");
        }
        if (descFuncaoElement.tagName.toLowerCase() === "input") {
            if (inputDescFuncaoInputListener) {
                descFuncaoElement.removeEventListener("input", inputDescFuncaoInputListener);
                inputDescFuncaoInputListener = null;
                console.log("Listener de input do descFuncao (input) removido.");
            }
            if (inputDescFuncaoBlurListener) {
                descFuncaoElement.removeEventListener("blur", inputDescFuncaoBlurListener);
                inputDescFuncaoBlurListener = null;
                console.log("Listener de blur do descFuncao (input) removido.");
            }
            // Se 'adicionarEventoBlurFuncao' adiciona um listener com uma referência que está em 'blurFuncaoCampoListener'
            if (blurFuncaoCampoListener) {
                 descFuncaoElement.removeEventListener("blur", blurFuncaoCampoListener);
                 blurFuncaoCampoListener = null;
                 console.log("Listener adicional de blur do descFuncao (input) removido.");
            }
        }
    }
    
    // 3. Limpar o estado global FuncaoOriginal
    // Assumindo que window.FuncaoOriginal existe, ou defina-o como um objeto vazio
    window.FuncaoOriginal = { idFuncao: "", descFuncao: "", vlrCustoSenior: 0.00, vlrCustoPleno: 0.00, vlrCustoJunior: 0.00, vlrCustoBase: 0.00, vlrVenda: 0.00, vlrTransporte: 0.00, 
        vlrTransporteSenior: 0.00, obsFuncao: "", vlrAliemntacao: 0.00, idCatFuncao: "", idEquipe: "", ativo: false };
    limparCamposFuncao(); // Chame a função que limpa os campos do formulário para garantir um estado limpo
    document.getElementById('form').reset(); // Garante que o formulário seja resetado
    document.querySelector("#idFuncao").value = ""; // Garante que o ID oculto seja limpo

    console.log("✅ Módulo Funcao.js desinicializado.");
}
// Torna a função de desinicialização global para ser chamada pelo sistema de módulos


window.moduloHandlers = window.moduloHandlers || {}; // Garante que o objeto existe

// Registra as funções de configuração e desinicialização para o módulo 'Funcao'
window.moduloHandlers['Funcao'] = { // Use 'Funcao' (com F maiúsculo) para corresponder ao seu mapaModulos no Index.js
    configurar: configurarEventosFuncao, // Usa a nova função de inicialização
    desinicializar: desinicializarFuncaoModal // Usa a nova função de desinicialização
};