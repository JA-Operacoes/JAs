import { fetchComToken, aplicarTema  } from '../utils/utils.js';

let nomeEmpresaAtual = '';

document.addEventListener("DOMContentLoaded", function () {
    const idempresa = localStorage.getItem("idempresa");

    if (idempresa) {
        const apiUrl = `/empresas/${idempresa}`; // Verifique o caminho da sua API

        fetchComToken(apiUrl)
            .then(empresa => {
                // Usa o nome fantasia como tema
                const tema = empresa.nmfantasia;
                nomeEmpresaAtual = empresa.nmfantasia || '';
                aplicarTema(tema);
            })
            .catch(error => {
                console.error("❌ Erro ao buscar dados da empresa para o tema:", error);
                // aplicarTema('default');
            });
    }
});

let codBancoBlurListener = null;
let selectLinguasChangeListener = null;
let limparFuncionariosButtonListener = null;
let enviarFuncionariosButtonListener = null;
let pesquisarFuncionariosButtonListener = null;
let selectNomeFuncionarioChangeListener = null; 
let selectApelidoFuncionarioChangeListener = null; 
let inputNomeFuncionarioBlurListener = null; 
let inputApelidoFuncionarioBlurListener = null; 
let inputNomeFuncionarioInputListener = null;
let inputApelidoFuncionarioInputListener = null;
let cpfBlurListener = null;

if (typeof window.funcionarioriginal === "undefined") {
    window.funcionarioOriginal = {
        idfuncionario: "",
        perfil: "",
        nome: "",
        cpf: "",
        rg: "",
        nivelFluenciaLinguas: "", 
        idiomasAdicionais: "[]", 
        celularPessoal: "", 
        celularFamiliar: "", 
        email: "",
        site: "",
        codigoBanco: "", 
        pix: "",
        numeroConta: "", 
        digitoConta: "", 
        agencia: "",
        digitoAgencia: "", 
        tipoConta: "", 
        cep: "",
        rua: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        pais: "",
        dataNascimento:"",
        nomeFamiliar:"",
        apelido:"",
        pcd: false,
        ativo: true,
        bonificado: false,
        mei: false,
        adesaoPlanoSaude: false,
        tipoPlanoSaude: "",
        funcao: "",
        cbo: "",
        admissao: "",
        salario: "",
        dependentes: "",
        dependentesdados: [],
        admissao: "",
        valealim: "",
        valetrnsp: ""
    };
}

// Gera dinamicamente os campos (nome + data de nascimento) de cada dependente,
// conforme a quantidade informada no input #dependentes. Preserva os valores já
// digitados quando a quantidade aumenta/diminui. `oninput` chama esta função.
// `dadosIniciais` (opcional) pré-preenche os campos ao carregar um funcionário:
// array de { nome, nascimento }.
window.gerarCamposDependentes = function gerarCamposDependentes(quantidade, dadosIniciais) {
    const container = document.getElementById("dependentesContainer");
    if (!container) return;

    let qtd = parseInt(quantidade, 10);
    if (isNaN(qtd) || qtd < 0) qtd = 0;
    const MAX_DEPENDENTES = 20;
    if (qtd > MAX_DEPENDENTES) qtd = MAX_DEPENDENTES;

    // Se veio uma lista pronta (carregamento), usa ela; senão preserva o que já
    // estava digitado antes de recriar os campos.
    let valores;
    if (Array.isArray(dadosIniciais)) {
        valores = dadosIniciais.map(d => ({
            nome: d?.nome || "",
            nasc: (d?.nascimento || "").split("T")[0]
        }));
    } else {
        valores = [];
        container.querySelectorAll(".dependente-item").forEach((item, i) => {
            valores[i] = {
                nome: item.querySelector(`[name="depNome[]"]`)?.value || "",
                nasc: item.querySelector(`[name="depNasc[]"]`)?.value || ""
            };
        });
    }

    container.innerHTML = "";

    for (let i = 0; i < qtd; i++) {
        const nome = valores[i]?.nome || "";
        const nasc = valores[i]?.nasc || "";

        const item = document.createElement("div");
        item.className = "form-2colunas dependente-item";
        item.innerHTML = `
            <div class="form2">
                <input type="text" class="uppercase" name="depNome[]" id="depNome_${i}" value="${nome}" spellcheck="false" style="width:535.5px;">
                <label for="depNome_${i}">Nome do ${i + 1}º dependente</label>
            </div>
            <div class="form2">
                <input type="date" name="depNasc[]" id="depNasc_${i}" value="${nasc}">
                <label for="depNasc_${i}">Dt Nasc.</label>
            </div>
        `;
        container.appendChild(item);
    }
};

// Coleta os dependentes preenchidos no formulário e devolve um array
// [{ nome, nascimento }] pronto pra virar JSON e ir ao backend.
window.coletarDependentes = function coletarDependentes() {
    const container = document.getElementById("dependentesContainer");
    if (!container) return [];
    return Array.from(container.querySelectorAll(".dependente-item")).map(item => ({
        nome: (item.querySelector(`[name="depNome[]"]`)?.value || "").toUpperCase().trim(),
        nascimento: item.querySelector(`[name="depNasc[]"]`)?.value || ""
    }));
};

function usuarioTemPermissaoFinanceiro() {
  if (!window.permissoes || !Array.isArray(window.permissoes)) return false;
  console.log("Usuário tem permissão Financeiro no staff");
  const permissaoStaff = window.permissoes.find(p => p.modulo?.toLowerCase() === "funcionarios");
  if (!permissaoStaff) return false;

  // A flag que você usa para determinar o acesso ao financeiro
  return !!permissaoStaff.pode_financeiro;
}

// Mostra o fieldset Financeiro só quando o perfil é Interno/Externo E o usuário tem
// permissão financeira no Staff. Caso contrário, esconde e desliga o `required` dos
// campos internos (senão um campo obrigatório escondido bloqueia o submit nativo).
function atualizarFieldsetFinanceiro() {
  const fieldset = document.querySelector("fieldset.financeiro");
  if (!fieldset) return;

  const perfil = document.querySelector('input[name="perfil"]:checked')?.value || "";
  const perfilElegivel = perfil === "Interno" || perfil === "ExternoH";
  const mostrar = perfilElegivel && usuarioTemPermissaoFinanceiro();

  fieldset.style.display = mostrar ? "" : "none";
  // Ativa/desativa o `required` dos campos conforme a visibilidade.
  fieldset.querySelectorAll("input[required], [data-required]").forEach((inp) => {
    if (mostrar) {
      if (inp.dataset.required) { inp.required = true; delete inp.dataset.required; }
    } else if (inp.required) {
      inp.dataset.required = "1"; inp.required = false;
    }
  });
}

// Plano de saúde: 1º escolhe o PLANO (nomeplano), 2º escolhe o TIPO daquele plano.
// Os dois selects só ficam habilitados quando 'Adesão Plano de Saúde' está marcado.
// Salvamos o idtipoplanosaude (value do select de tipo).
function atualizarTipoPlanoSaude() {
  const checkbox = document.getElementById("adesaoPlanoSaude");
  const selectPlano = document.getElementById("nomePlanoSaude");
  const selectTipo = document.getElementById("tipoPlanoSaude");
  if (!checkbox || !selectPlano || !selectTipo) return;

  const habilitado = checkbox.checked === true;
  // As caixas dos selects só aparecem quando há adesão. A do tipo aparece
  // apenas depois de escolher um plano.
  const boxPlano = selectPlano.closest(".select-plano-saude-box");
  const boxTipo = selectTipo.closest(".select-plano-saude-box");
  if (boxPlano) boxPlano.style.display = habilitado ? "" : "none";
  if (boxTipo) boxTipo.style.display = (habilitado && selectPlano.value) ? "" : "none";

  selectPlano.disabled = !habilitado;
  selectTipo.disabled = !habilitado || !selectPlano.value;
  if (!habilitado) {
    selectPlano.value = "";
    selectTipo.value = "";
  }
}

// Preenche o select de planos (nomeplano) a partir do backend.
async function carregarPlanosSaude() {
  const selectPlano = document.getElementById("nomePlanoSaude");
  if (!selectPlano) return;
  try {
    const planos = await fetchComToken("/funcionarios/planos-saude");
    selectPlano.querySelectorAll("option:not([value=''])").forEach((o) => o.remove());
    (planos || []).forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.nome;
      opt.textContent = p.nome;
      selectPlano.appendChild(opt);
    });
  } catch (err) {
    console.error("Erro ao carregar planos de saúde:", err);
  }
}

// Preenche o select de tipos do plano escolhido; opcionalmente pré-seleciona um id.
async function carregarTiposPlanoSaude(nomePlano, idSelecionar = null) {
  const selectTipo = document.getElementById("tipoPlanoSaude");
  if (!selectTipo) return;
  selectTipo.querySelectorAll("option:not([value=''])").forEach((o) => o.remove());
  selectTipo.value = "";
  if (!nomePlano) { atualizarTipoPlanoSaude(); return; }
  try {
    const tipos = await fetchComToken(`/funcionarios/planos-saude/${encodeURIComponent(nomePlano)}/tipos`);
    (tipos || []).forEach((t) => {
      const opt = document.createElement("option");
      opt.value = String(t.idtipoplanosaude);
      opt.textContent = t.nometipo;
      selectTipo.appendChild(opt);
    });
    if (idSelecionar != null) selectTipo.value = String(idSelecionar);
  } catch (err) {
    console.error("Erro ao carregar tipos do plano:", err);
  }
  atualizarTipoPlanoSaude();
}

// ===== Autocomplete de CBO por Função (e vice-versa) =====
// Digitar na Função OU no CBO busca na base local de CBO (rota /funcionarios/cbo, que
// casa tanto por código quanto por nome/sinônimo) e mostra uma lista; ao escolher,
// preenche o título oficial na Função e o código no campo CBO. Isso garante que o par
// Função/CBO salvo sempre corresponda a um código real da tabela oficial (MTE/CBO2002)
// — o backend também valida isso no POST/PUT como última barreira.
// Cria (ou reusa) uma lista de sugestões ancorada ao campo informado.
function criarListaSugestoesCBO(inputAncora, listaId) {
    const wrapper = inputAncora.parentNode;
    wrapper.style.position = "relative";
    let lista = document.getElementById(listaId);
    if (!lista) {
        lista = document.createElement("ul");
        lista.id = listaId;
        lista.style.cssText = "position:absolute; left:0; right:0; top:100%; z-index:60;" +
            "background:#fff; border:1px solid #ccc; border-radius:6px; max-height:240px;" +
            "overflow-y:auto; margin:2px 0 0; padding:4px; list-style:none;" +
            "box-shadow:0 4px 12px rgba(0,0,0,.15); display:none;";
        wrapper.appendChild(lista);
    }
    return lista;
}

// Liga a busca de CBO a um campo de origem (Função ou CBO): digitar nele consulta
// /funcionarios/cbo e, ao escolher uma sugestão, preenche os dois campos.
function ligarAutocompleteCBO(inputOrigem, inputFuncao, inputCBO, listaId) {
    const lista = criarListaSugestoesCBO(inputOrigem, listaId);
    const fechar = () => { lista.style.display = "none"; };
    let timer = null;

    inputOrigem.addEventListener("input", function () {
        const termo = this.value.trim();
        clearTimeout(timer);
        if (termo.length < 2) { fechar(); return; }
        timer = setTimeout(async () => {
            try {
                const sugestoes = await fetchComToken(`/funcionarios/cbo?q=${encodeURIComponent(termo)}`);
                lista.innerHTML = "";
                if (!Array.isArray(sugestoes) || sugestoes.length === 0) {
                    lista.innerHTML = '<li style="padding:6px 10px; color:#999;">Nenhum CBO encontrado</li>';
                    lista.style.display = "block";
                    return;
                }
                sugestoes.forEach((s) => {
                    const li = document.createElement("li");
                    li.textContent = `${s.codigo} — ${s.titulo}`;
                    li.style.cssText = "padding:6px 10px; cursor:pointer; border-radius:4px;";
                    li.addEventListener("mouseover", () => { li.style.background = "#f0f2f5"; });
                    li.addEventListener("mouseout", () => { li.style.background = ""; });
                    li.addEventListener("mousedown", (e) => {
                        e.preventDefault();
                        inputFuncao.value = s.titulo.toUpperCase();
                        inputCBO.value = s.codigo;
                        fechar();
                    });
                    lista.appendChild(li);
                });
                lista.style.display = "block";
            } catch (err) {
                console.error("Erro ao buscar CBO:", err);
            }
        }, 350);
    });

    inputOrigem.addEventListener("focus", () => { if (lista.children.length) lista.style.display = "block"; });
    document.addEventListener("mousedown", (e) => {
        if (e.target !== inputOrigem && !lista.contains(e.target)) fechar();
    });
}

function configurarBuscaCBO() {
    const inputFuncao = document.getElementById("funcao");
    const inputCBO = document.getElementById("cbo");
    if (!inputFuncao || !inputCBO) return; // modal ainda não montado

    // Mudou a Função digitando => invalida o CBO até escolher uma sugestão de novo.
    inputFuncao.addEventListener("input", () => { inputCBO.value = ""; });

    ligarAutocompleteCBO(inputFuncao, inputFuncao, inputCBO, "cbo-sugestoes-funcao");
    ligarAutocompleteCBO(inputCBO, inputFuncao, inputCBO, "cbo-sugestoes-cbo");
}

// Confere no backend se o código digitado no campo CBO é um código real da tabela
// oficial. Usada antes de salvar, para barrar o envio de um CBO inválido cedo (o
// backend também valida no POST/PUT, mas aqui dá o aviso sem round-trip de gravação).
async function cboEhValido(codigo) {
    const termo = String(codigo || "").trim();
    if (!termo) return true; // campo vazio: quem decide se é obrigatório é a validação de campos
    try {
        const sugestoes = await fetchComToken(`/funcionarios/cbo?q=${encodeURIComponent(termo)}`);
        return Array.isArray(sugestoes) && sugestoes.some((s) => s.codigo === termo);
    } catch (err) {
        console.error("Erro ao validar CBO:", err);
        return true; // falha na checagem não deve travar o usuário; o backend valida de qualquer forma
    }
}

// ===== Verificação de CPF já cadastrado (em qualquer empresa) =====
// Ao sair do campo CPF, verifica se já existe um funcionário com esse CPF.
// - Se já pertence à empresa atual: carrega os dados para edição (como no fluxo por nome).
// - Se pertence a outra empresa: oferece importar os dados pessoais para a empresa atual,
//   economizando a digitação. Os campos específicos do vínculo empregatício (Função, CBO,
//   Salário, Admissão, Ativo, Bonificado, VA/VT, Plano de Saúde, Dependentes) NÃO são
//   importados — cada empresa pode ter condições diferentes para a mesma pessoa.
function configurarVerificacaoCpf() {
    const inputCpf = document.getElementById("cpf");
    if (!inputCpf) return;

    if (cpfBlurListener) {
        inputCpf.removeEventListener("blur", cpfBlurListener);
    }

    cpfBlurListener = async function () {
        const cpf = this.value.trim();
        if (!cpf || cpf.length < 14) return; // CPF incompleto (formato 000.000.000-00)

        const idAtual = document.getElementById("idFuncionario")?.value;
        if (idAtual) return; // já está editando um funcionário carregado

        try {
            const resposta = await fetchComToken(`/funcionarios/verificar-cpf/${encodeURIComponent(cpf)}`);

            // fetchComToken devolve [] quando a rota responde 404 (CPF novo, ninguém encontrado)
            if (!resposta || Array.isArray(resposta) || !resposta.idfuncionario) {
                return;
            }

            if (resposta.existeNaEmpresaAtual) {
                await Swal.fire({
                    icon: 'info',
                    title: 'Funcionário já cadastrado nesta empresa',
                    text: 'Os dados deste funcionário foram carregados para edição.',
                    confirmButtonText: 'OK'
                });
                await carregarFuncionarioDescricao(resposta.dados.nome);
                return;
            }

            const { isConfirmed } = await Swal.fire({
                icon: 'question',
                title: 'Funcionário já cadastrado em outra empresa do grupo empresarial',
                text: `Deseja importar os dados para a empresa "${nomeEmpresaAtual || 'atual'}"?`,
                showCancelButton: true,
                confirmButtonText: 'Sim, importar',
                cancelButtonText: 'Não',
                reverseButtons: true
            });

            if (isConfirmed) {
                preencherDadosImportadosFuncionario(resposta.dados);
                await Swal.fire({
                    icon: 'info',
                    title: 'Dados importados',
                    text: 'Os dados de vínculo (perfil, função, salário, admissão, dependentes, etc.) vieram como sugestão de outra empresa do grupo — confira e ajuste o que for diferente nesta empresa antes de salvar.',
                    confirmButtonText: 'OK, entendi'
                });
            }
        } catch (error) {
            console.error("Erro ao verificar CPF do funcionário:", error);
        }
    };

    inputCpf.addEventListener("blur", cpfBlurListener);
}

// Preenche os dados PESSOAIS de um funcionário já existente (achado por CPF em outra
// empresa). Propositalmente NÃO preenche `idFuncionario` — o formulário continua em modo
// de novo cadastro (POST), que no backend detecta o CPF já existente e apenas vincula o
// funcionário à empresa atual, em vez de duplicar o registro.
function preencherDadosImportadosFuncionario(funcionario) {
    // Foto é dado pessoal (mora em `funcionarios`, não em `funcionarioempresas`) — já
    // está associada ao mesmo idfuncionario que será vinculado à empresa atual, só
    // faltava mostrar a pré-visualização aqui (o dado em si já estava correto).
    const previewFoto = document.getElementById('previewFoto');
    const fileNameSpan = document.getElementById('fileName');
    const uploadHeader = document.getElementById('uploadHeader');
    if (previewFoto && fileNameSpan && uploadHeader) {
        if (funcionario.foto) {
            previewFoto.src = `/${funcionario.foto}`;
            previewFoto.style.display = 'block';
            uploadHeader.style.display = 'none';
            fileNameSpan.textContent = funcionario.foto.split('/').pop() || 'Foto carregada';
        } else {
            previewFoto.src = '#';
            previewFoto.style.display = 'none';
            uploadHeader.style.display = 'block';
            fileNameSpan.textContent = 'Nenhum arquivo selecionado';
        }
    }

    document.getElementById("nome").value = funcionario.nome || '';
    document.getElementById("apelido").value = funcionario.apelido || '';
    document.getElementById("rg").value = funcionario.rg || '';
    document.getElementById("dataNasc").value = funcionario.datanascimento?.split('T')[0] || '';

    const checkboxPcd = document.getElementById("pcd");
    if (checkboxPcd) checkboxPcd.checked = funcionario.pcd === true;

    // Perfil/Ativo/Bonificado/MEI: sugestão editável vinda de um vínculo já existente
    // (não são "verdade" pra empresa nova — o backend manda o mais recente encontrado
    // como ponto de partida). O usuário revisa e ajusta se for diferente nesta empresa.
    if (funcionario.perfil) {
        document.querySelectorAll('input[name="perfil"]').forEach((radio) => {
            radio.checked = radio.value === funcionario.perfil;
        });
        if (typeof atualizarFieldsetFinanceiro === 'function') atualizarFieldsetFinanceiro();
    }

    const checkboxAtivo = document.getElementById("ativo");
    if (checkboxAtivo) checkboxAtivo.checked = funcionario.ativo === true;

    const checkboxBonificado = document.getElementById("bonificado");
    if (checkboxBonificado) checkboxBonificado.checked = funcionario.bonificado === true;

    const checkboxMei = document.getElementById("mei");
    if (checkboxMei) checkboxMei.checked = funcionario.mei === true;

    const selectLinguas = document.getElementById('Linguas');
    if (selectLinguas) {
        selectLinguas.value = funcionario.fluencia || '';
        atualizarCamposLinguas();
        if (funcionario.idiomasadicionais) {
            try {
                const idiomasSalvos = JSON.parse(funcionario.idiomasadicionais);
                const inputsIdioma = document.querySelectorAll('#idiomasContainer .idiomaInput');
                inputsIdioma.forEach((input, index) => {
                    if (idiomasSalvos[index]) input.value = idiomasSalvos[index];
                });
            } catch (e) { /* ignora idiomas inválidos */ }
        }
    }

    document.getElementById("celularPessoal").value = funcionario.celularpessoal || '';
    document.getElementById("celularFamiliar").value = funcionario.celularfamiliar || '';
    document.getElementById("email").value = funcionario.email || '';
    document.getElementById("site").value = funcionario.site || '';
    document.getElementById("nomeFamiliar").value = funcionario.nomefamiliar || '';

    document.getElementById("codBanco").value = funcionario.codigobanco || '';
    if (funcionario.codigobanco) preencherDadosBancoPeloCodigo(funcionario.codigobanco);
    document.getElementById("pix").value = funcionario.pix || '';
    document.getElementById("agencia").value = funcionario.agencia || '';
    document.getElementById("digitoAgencia").value = funcionario.digitoagencia || '';
    document.getElementById("nConta").value = funcionario.numeroconta || '';
    document.getElementById("digitoConta").value = funcionario.digitoconta || '';
    const selectTipoConta = document.getElementById('tpConta');
    if (selectTipoConta) selectTipoConta.value = funcionario.tipoconta || '';

    document.getElementById("cep").value = funcionario.cep || '';
    document.getElementById("rua").value = funcionario.rua || '';
    document.getElementById("numero").value = funcionario.numero || '';
    document.getElementById("complemento").value = funcionario.complemento || '';
    document.getElementById("bairro").value = funcionario.bairro || '';
    document.getElementById("cidade").value = funcionario.cidade || '';
    document.getElementById("estado").value = funcionario.estado || '';
    document.getElementById("pais").value = funcionario.pais || '';

    // Dados de RH (função, cbo, admissão, salário, dependentes, VA/VT, plano de saúde):
    // mesma lógica de sugestão editável — vêm do vínculo mais recente já existente.
    const inputFuncao = document.getElementById("funcao");
    if (inputFuncao) inputFuncao.value = funcionario.funcao || '';
    const inputCbo = document.getElementById("cbo");
    if (inputCbo) inputCbo.value = funcionario.cbo || '';
    const inputAdmissao = document.getElementById("admissao");
    if (inputAdmissao) inputAdmissao.value = funcionario.admissao?.split('T')[0] || '';

    const inputSalario = document.getElementById("salario");
    if (inputSalario) {
        let valorSalario = parseFloat(funcionario.salario) || 0;
        if (valorSalario > 100000) valorSalario = valorSalario / 100;
        inputSalario.value = valorSalario.toFixed(2);
        if (typeof formatReais === 'function') formatReais(inputSalario);
    }
    const inputVA = document.getElementById("valealim");
    if (inputVA) {
        inputVA.value = (parseFloat(funcionario.valealim) || 0).toFixed(2);
        if (typeof formatReais === 'function') formatReais(inputVA);
    }
    const inputVT = document.getElementById("valetrnsp");
    if (inputVT) {
        inputVT.value = (parseFloat(funcionario.valetrnsp) || 0).toFixed(2);
        if (typeof formatReais === 'function') formatReais(inputVT);
    }

    const inputDependentes = document.getElementById("dependentes");
    if (inputDependentes) {
        inputDependentes.value = funcionario.dependentes || '0';
        let dependentesDadosSugeridos = funcionario.dependentesdados;
        if (typeof dependentesDadosSugeridos === 'string') {
            try { dependentesDadosSugeridos = JSON.parse(dependentesDadosSugeridos || '[]'); }
            catch (e) { dependentesDadosSugeridos = []; }
        }
        if (!Array.isArray(dependentesDadosSugeridos)) dependentesDadosSugeridos = [];
        gerarCamposDependentes(funcionario.dependentes || 0, dependentesDadosSugeridos);
    }

    const checkboxAdesaoPlanoSaude = document.getElementById("adesaoPlanoSaude");
    if (checkboxAdesaoPlanoSaude) {
        checkboxAdesaoPlanoSaude.checked = funcionario.adesaoplanosaude === true;
        if (typeof atualizarTipoPlanoSaude === 'function') atualizarTipoPlanoSaude();
    }
    const selectTipoPlanoSaude = document.getElementById("tipoPlanoSaude");
    if (selectTipoPlanoSaude) selectTipoPlanoSaude.value = funcionario.tipoplanosaude || '';
}


async function verificaFuncionarios() {
    console.log("Configurando eventos do modal Funcionários...");
    
    configurarPreviewFoto();

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    
    const form = document.querySelector("#form-funcionario");

    const codBancoInput = document.getElementById("codBanco");

    if (!botaoEnviar|| !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    codBancoInput.addEventListener("blur", async function () {
        const codBanco = this.value.trim();
        if (!codBanco) {
            console.warn("Código do banco vazio, não fazendo busca.");
            return;
        }
        preencherDadosBancoPeloCodigo(codBanco);
    });

    const selectLinguas = document.getElementById('Linguas');
    if (selectLinguas) {
        selectLinguas.addEventListener('change', async function () {
            atualizarCamposLinguas();
        });
    }

    const checkboxAdesaoPlanoSaude = document.getElementById("adesaoPlanoSaude");
    if (checkboxAdesaoPlanoSaude) {
        checkboxAdesaoPlanoSaude.addEventListener("change", atualizarTipoPlanoSaude);
    }
    const selectNomePlanoSaude = document.getElementById("nomePlanoSaude");
    if (selectNomePlanoSaude) {
        selectNomePlanoSaude.addEventListener("change", () => carregarTiposPlanoSaude(selectNomePlanoSaude.value));
    }
    carregarPlanosSaude();      // popula o select de planos
    atualizarTipoPlanoSaude();  // estado inicial (habilita/desabilita)

    botaoLimpar.addEventListener("click", (e) => {
        e.preventDefault();
        limparCamposFuncionarios();
    });

    // Mostra/esconde o fieldset Financeiro conforme o perfil escolhido + permissão.
    document.querySelectorAll('input[name="perfil"]').forEach((radio) => {
        radio.addEventListener("change", atualizarFieldsetFinanceiro);
    });
    atualizarFieldsetFinanceiro(); // estado inicial

    configurarBuscaCBO(); // autocomplete de CBO pela Função
    configurarVerificacaoCpf(); // detecta CPF já cadastrado (nesta ou em outra empresa)

    botaoEnviar.addEventListener("click", async (event) => {
        event.preventDefault();

        const idFuncionario = document.querySelector("#idFuncionario").value.trim();
        const perfil = document.querySelector('input[name="perfil"]:checked')?.value || '';
        const nome = document.querySelector("#nome")?.value.toUpperCase().trim();
        const cpf = document.getElementById("cpf")?.value.trim() || '';
        const rg = document.getElementById("rg")?.value.trim() || '';
        const nivelFluenciaLinguas = document.getElementById("Linguas")?.value.trim() || '';
        const idiomasContainer = document.getElementById('idiomasContainer');
        const inputsIdioma = idiomasContainer.querySelectorAll('.idiomaInput');
        const dataNascimento = document.getElementById("dataNasc").value;
        const nomeFamiliar = document.getElementById("nomeFamiliar")?.value.toUpperCase().trim();
        const apelido = document.getElementById("apelido")?.value.toUpperCase().trim();

        const idiomasAdicionaisArray = [];
        inputsIdioma.forEach(input => {
            const valor = input.value.trim();
            if (valor) idiomasAdicionaisArray.push(valor);
        });
        const idiomasAdicionais = JSON.stringify(idiomasAdicionaisArray);

        const celularPessoal = document.getElementById("celularPessoal")?.value.trim() || '';
        const celularFamiliar = document.getElementById("celularFamiliar")?.value.trim() || '';
        const email = document.getElementById("email")?.value.trim() || '';
        const site = document.getElementById("site")?.value.trim() || '';
        const codigoBanco = document.getElementById("codBanco")?.value.trim() || '';
        const pix = document.getElementById("pix")?.value.trim() || '';
        const numeroConta = document.getElementById("nConta")?.value.trim() || '';
        const digitoConta = document.getElementById("digitoConta")?.value.trim() || '';
        const agencia = document.getElementById("agencia")?.value.trim() || '';
        const digitoAgencia = document.getElementById("digitoAgencia")?.value.trim() || '';
        const tipoConta = document.getElementById("tpConta")?.value.trim() || '';
        const cep = document.getElementById("cep")?.value.trim() || '';
        const rua = document.getElementById("rua")?.value.trim() || '';
        const numero = document.getElementById("numero")?.value.trim() || '';
        const complemento = document.getElementById("complemento")?.value.trim() || '';
        const bairro = document.getElementById("bairro")?.value.toUpperCase().trim() || '';
        const cidade = document.getElementById("cidade")?.value.toUpperCase().trim() || '';
        const estado = document.getElementById("estado")?.value.toUpperCase().trim() || '';
        const pais = document.getElementById("pais")?.value.toUpperCase().trim() || '';

        // 🎯 CAPTURA DO CAMPO 'ativo'
        const campoPcd = document.getElementById("pcd");
        const pcd = campoPcd?.checked === true;
        
        const campoAtivo = document.getElementById("ativo"); // 🎯 ID é 'ativo'
        const ativo = campoAtivo?.checked === true; // true se marcado (ativo), false se desmarcado (inativo)

        const campoBonificado = document.getElementById("bonificado");
        const bonificado = campoBonificado?.checked === true;

        const campoMei = document.getElementById("mei");
        const mei = campoMei?.checked === true;

        const campoAdesaoPlanoSaude = document.getElementById("adesaoPlanoSaude");
        const adesaoPlanoSaude = campoAdesaoPlanoSaude?.checked === true;
        // O select de tipo guarda o idtipoplanosaude (FK). O texto antigo (tipoPlanoSaude)
        // nao e mais usado; enviamos vazio para a coluna legada ficar null.
        const idTipoPlanoSaude = adesaoPlanoSaude
            ? (document.getElementById("tipoPlanoSaude")?.value.trim() || '')
            : '';
        const tipoPlanoSaude = '';
        const salario = desformatarReais(document.getElementById("salario")?.value) || '';
        const valealim = desformatarReais(document.getElementById("valealim")?.value) || '';
        const valetrnsp = desformatarReais(document.getElementById("valetrnsp")?.value) || '';
        const funcao = document.getElementById("funcao")?.value.toUpperCase().trim() || '';
        const cbo = document.getElementById("cbo")?.value.trim() || '';
        const dependentes = document.getElementById("dependentes")?.value.trim() || '0';
        const dependentesDados = JSON.stringify(coletarDependentes());
        const admissao = document.getElementById("admissao").value;
        

            // Validação de campos obrigatórios
            if (!nome || !cpf || !rg || !celularPessoal || !perfil || !dataNascimento) {
            console.log("VALIDACAO", "nome", nome, "cpf", cpf, "rg", rg, "celularPessoal", celularPessoal, "cep", cep,  "rua", rua,  "numero", numero, "bairro", bairro, "cidade", cidade, "estado", estado, "pais", pais, "perfil", perfil, "celularFamiliar", celularFamiliar, "nomeFamiliar", nomeFamiliar, "apelido", apelido )
                return Swal.fire("Campos obrigatórios!", "Preencha todos os campos obrigatórios: Perfil, Nome, Data de Nascimento, CPF, RG, Celular Pessoal, Celular Contato, Nome do Contato, E-mail, CEP, Rua, Número, Bairro, Cidade, Estado e País.", "warning");
            }

            // Validação do CBO: só se aplica a Interno/Externo com holerite (mesmo critério
            // que mostra o fieldset Financeiro — ver atualizarFieldsetFinanceiro). Para os
            // demais perfis o campo fica oculto e não tem CBO; se ainda assim ele carregar um
            // valor "preso" (ex.: sugestão importada de outra empresa via CPF), não bloqueia.
            const perfilTemRH = perfil === "Interno" || perfil === "ExternoH";
            if (perfilTemRH && cbo && !(await cboEhValido(cbo))) {
                document.getElementById("cbo")?.focus();
                return Swal.fire("CBO inválido!", `O código "${cbo}" não existe na tabela oficial de CBO. Digite a Função ou o CBO e escolha uma opção da lista de sugestões.`, "warning");
            }
            // Permissões
            const temPermissaoCadastrar = temPermissao("Funcionarios", "cadastrar");
            const temPermissaoAlterar = temPermissao("Funcionarios", "alterar");

            const metodo = idFuncionario ? "PUT" : "POST";
            const url = idFuncionario ? `/funcionarios/${idFuncionario}` : "/funcionarios";

            if (!idFuncionario && !temPermissaoCadastrar) {
                return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos funcionários.", "error");
            }

            if (idFuncionario && !temPermissaoAlterar) {
                return Swal.fire("Acesso negado", "Você não tem permissão para alterar funcionários.", "error");
            }

            console.log("Preparando dados para envio:", {
                perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
                celularPessoal, celularFamiliar, email, site, codigoBanco, pix,
                numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, 
                numero, complemento, bairro, cidade, estado, pais, dataNascimento, nomeFamiliar, apelido, pcd, ativo // 🎯 CAMPO ATIVO
            });
        // --- CRIANDO O FORMDATA ---
        const formData = new FormData();
        formData.append("perfil", perfil);
        formData.append("nome", nome);
        formData.append("cpf", cpf);
        formData.append("rg", rg);
        formData.append("nivelFluenciaLinguas", nivelFluenciaLinguas);
        formData.append("idiomasAdicionais", idiomasAdicionais);
        formData.append("celularPessoal", celularPessoal);
        formData.append("celularFamiliar", celularFamiliar);
        formData.append("email", email);
        formData.append("site", site);
        formData.append("codigoBanco", codigoBanco);
        formData.append("pix", pix);
        formData.append("numeroConta", numeroConta);
        formData.append("digitoConta", digitoConta);
        formData.append("agencia", agencia);
        formData.append("digitoAgencia", digitoAgencia);
        formData.append("tipoConta", tipoConta);
        formData.append("cep", cep);
        formData.append("rua", rua);
        formData.append("numero", numero);
        formData.append("complemento", complemento);
        formData.append("bairro", bairro);
        formData.append("cidade", cidade);
        formData.append("estado", estado);
        formData.append("pais", pais);
        formData.append("dataNascimento", dataNascimento);
        formData.append("nomeFamiliar", nomeFamiliar);
        formData.append("apelido", apelido);
        formData.append("pcd", pcd); // <- envia como string "true" ou "false"
        formData.append("ativo", ativo); // 🎯 CAMPO ATIVO: Adicionado ao FormData
        formData.append("bonificado", bonificado);
        formData.append("mei", mei);
        formData.append("adesaoPlanoSaude", adesaoPlanoSaude);
        formData.append("tipoPlanoSaude", tipoPlanoSaude);
        formData.append("idTipoPlanoSaude", idTipoPlanoSaude);
        formData.append("salario", salario);
        formData.append("funcao", funcao);
        formData.append("cbo", cbo);
        formData.append("dependentes", dependentes);
        formData.append("dependentesDados", dependentesDados);
        formData.append("admissao", admissao);
        formData.append("valealim", valealim);
        formData.append("valetrnsp", valetrnsp);

            console.log("valor de pcd:", pcd);
            console.log("valor de ativo:", ativo); // 🎯 CAMPO ATIVO
            console.log("valor de bonificado:", bonificado); // 🎯 CAMPO BONIFICADO
            console.log("valor de mei:", mei); // 🎯 CAMPO MEI
            console.log("valor de adesaoPlanoSaude:", adesaoPlanoSaude, "tipoPlanoSaude:", tipoPlanoSaude);

            // Adiciona o arquivo da foto APENAS SE UM NOVO ARQUIVO FOI SELECIONADO
            const inputFileElement = document.getElementById('file');
            const fotoArquivo = inputFileElement.files[0];
            if (fotoArquivo) {
                formData.append('foto', fotoArquivo); // 'foto' é o nome do campo esperado pelo Multer
            }

            console.log("Preparando envio de FormData. Método:", metodo, "URL:", url);
            console.log("Dados do FormData:", {
                perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
                celularPessoal, celularFamiliar, email, site, codigoBanco, pix,
                numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero, complemento, bairro,
                cidade, estado, pais, dataNascimento, nomeFamiliar, apelido, pcd, ativo, bonificado, mei, adesaoPlanoSaude, tipoPlanoSaude, salario, funcao, cbo, dependentes, admissao, valealim, valetrnsp
            });
            if (metodo === "PUT" && window.funcionarioOriginal) {
                let houveAlteracao = false;

                // 1. Verificar alteração na foto
                if (fotoArquivo) { 
                    houveAlteracao = true;
                } else {
                    // Lógica de comparação de foto mantida
                }

                // 1.5. Comparar os dados dos dependentes (JSONB)
                if (!houveAlteracao) {
                    let depOriginal = window.funcionarioOriginal.dependentesdados;
                    if (typeof depOriginal === 'string') {
                        try { depOriginal = JSON.parse(depOriginal || '[]'); } catch (e) { depOriginal = []; }
                    }
                    if (!Array.isArray(depOriginal)) depOriginal = [];
                    if (JSON.stringify(depOriginal) !== dependentesDados) {
                        houveAlteracao = true;
                    }
                }

                // 2. Comparar os outros campos de texto/booleano
                if (!houveAlteracao) {
                    const camposTextoParaComparar = {
                        perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
                        celularPessoal, celularFamiliar, email, site, codigoBanco, pix,
                        numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero, complemento, bairro,
                        cidade, estado, pais, dataNascimento, nomeFamiliar, apelido, pcd,
                        ativo, bonificado, mei, adesaoPlanoSaude, tipoPlanoSaude, salario, funcao, cbo, dependentes, admissao, valealim, valetrnsp
                    };

                    for (const key in camposTextoParaComparar) {
                        // Trata PCD e ATIVO como booleanos
                        if (key === 'pcd' || key === 'ativo' || key === 'bonificado' || key === 'mei' || key === 'adesaoPlanoSaude') {
                            const originalBool = window.funcionarioOriginal[key] === true;
                            const atualBool = camposTextoParaComparar[key] === true;
                            if (originalBool !== atualBool) {
                                houveAlteracao = true;
                                break;
                            }
                            continue; // Pula a comparação de string para estes campos
                        }


                        const valorOriginal = String(window.funcionarioOriginal[key] || '').toUpperCase().trim();
                        const valorAtual = String(camposTextoParaComparar[key] || '').toUpperCase().trim();

                        if (key === 'idiomasAdicionais') {
                            try {
                                const oldParsed = JSON.parse(String(window.funcionarioOriginal.idiomasAdicionais || '[]'));
                                const newParsed = JSON.parse(String(idiomasAdicionais || '[]'));
                                // Ordena os arrays para comparação consistente
                                if (JSON.stringify(oldParsed.sort()) !== JSON.stringify(newParsed.sort())) {
                                    houveAlteracao = true;
                                    break;
                                }
                            } catch (e) {
                                // Fallback para comparação de string simples se o parse falhar
                                if (valorOriginal !== valorAtual) {
                                    houveAlteracao = true;
                                    break;
                                }
                            }
                        } else if (valorOriginal !== valorAtual) {
                            houveAlteracao = true;
                            break;
                        }
                    }
                }

                if (!houveAlteracao) {
                    return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
                }
            }

            try {
                // Confirmação para alteração (PUT)
                if (metodo === "PUT") {
                    const { isConfirmed } = await Swal.fire({
                        title: "Deseja salvar as alterações?",
                        text: "Você está prestes a atualizar os dados do funcionário.",
                        icon: "question",
                        showCancelButton: true,
                        confirmButtonText: "Sim, salvar",
                        cancelButtonText: "Cancelar",
                        reverseButtons: true,
                        focusCancel: true
                    });
                    if (!isConfirmed) return;
                }

                // --- CHAMADA FETCH COM FORMDATA ---
                const respostaApi = await fetchComToken(url, {
                    method: metodo,
                    body: formData, 
                });

                await Swal.fire("Sucesso!", respostaApi.message || "Funcionário salvo com sucesso.", "success");
                limparCamposFuncionarios();
                
                // 🎯 ATUALIZA O ESTADO ORIGINAL APÓS SUCESSO
                window.funcionarioOriginal = { 
                    idfuncionario: idFuncionario, // ou o ID retornado se for POST
                    perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
                    celularPessoal, celularFamiliar, email, site, codigoBanco, pix,
                    numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, 
                    numero, complemento, bairro, cidade, estado, pais, dataNascimento, nomeFamiliar, apelido,
                    pcd: pcd, ativo: ativo, bonificado: bonificado, mei: mei,
                    adesaoPlanoSaude: adesaoPlanoSaude, tipoPlanoSaude: tipoPlanoSaude, salario, funcao, cbo, dependentes, admissao, valealim, valetrnsp
                };

            } catch (error) {
                console.error("Erro ao enviar dados do funcionário:", error);
                Swal.fire("Erro", error.message || "Erro ao salvar funcionário.", "error");
            }
        
    });

    botaoPesquisar.addEventListener("click", async function (event) {
      event.preventDefault();
      limparCamposFuncionarios(); // Limpa os campos antes de pesquisar

      console.log("Pesquisando Funcionários...");

      const temPermissaoPesquisar = temPermissao('Funcionarios', 'pesquisar');
      if (!temPermissaoPesquisar) {
          return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar funcionários.", "warning");
      }

      try {
          const funcionarios = await fetchComToken("/funcionarios"); // Busca todos os funcionários

          if (!funcionarios || funcionarios.length === 0) {
              return Swal.fire({
                  icon: 'info',
                  title: 'Nenhum funcionário cadastrado',
                  text: 'Não foi encontrado nenhum funcionário no sistema.',
                  confirmButtonText: 'Ok'
              });
          }

          // Busca estilo aside: filtro ao vivo por nome/apelido nos próprios campos.
          ativarModoBuscaFuncionarios(funcionarios);

      } catch (error) {
          console.error("Erro ao carregar lista de funcionários:", error);
          Swal.fire({
              icon: 'error',
              title: 'Erro',
              text: 'Não foi possível carregar a lista de funcionários.',
              confirmButtonText: 'Ok'
          });
      }
    });

}

function ativarModoBuscaFuncionarios(funcionarios) {
    const campoNome = document.getElementById("nome");
    if (!campoNome) return;

    // Cria (ou reusa) a lista suspensa ancorada no campo Nome.
    const wrapper = campoNome.parentNode;
    wrapper.style.position = "relative";
    let lista = document.getElementById("func-busca-lista");
    if (!lista) {
        lista = document.createElement("ul");
        lista.id = "func-busca-lista";
        lista.className = "func-busca-lista";
        lista.style.cssText = "position:absolute; left:0; right:0; top:100%; z-index:50;" +
            "background:#fff; border:1px solid #ccc; border-radius:6px; max-height:220px;" +
            "overflow-y:auto; margin:0; padding:4px; list-style:none;" +
            "box-shadow:0 4px 12px rgba(0,0,0,.15);";
        wrapper.appendChild(lista);
    }

    // Renderiza todos os funcionários como itens (nome — apelido).
    lista.innerHTML = "";
    funcionarios.forEach((f) => {
        const li = document.createElement("li");
        li.dataset.nome = f.nome || "";
        li.dataset.apelido = f.apelido || "";
        li.dataset.id = f.idfuncionario;
        li.textContent = f.apelido ? `${f.nome} — ${f.apelido}` : (f.nome || "");
        li.style.cssText = "padding:6px 10px; cursor:pointer; border-radius:4px;";
        li.addEventListener("mouseover", () => { li.style.background = "#f0f2f5"; });
        li.addEventListener("mouseout", () => { li.style.background = ""; });
        // mousedown dispara antes do blur do campo, evitando que a lista suma antes do clique.
        li.addEventListener("mousedown", async (e) => {
            e.preventDefault();
            document.getElementById("idFuncionario").value = li.dataset.id;
            await carregarFuncionarioDescricao(li.dataset.nome);
            sairModoBuscaFuncionarios();
        });
        lista.appendChild(li);
    });

    // Liga o filtro ao vivo nos dois campos.
    ["nome", "apelido"].forEach((id) => {
        const campo = document.getElementById(id);
        if (!campo) return;
        campo.addEventListener("input", filtrarBuscaFuncionarios);
        campo.addEventListener("focus", mostrarBuscaFuncionarios);
    });

    filtrarBuscaFuncionarios();
    campoNome.focus();

    // Esconde a lista ao clicar fora dos campos/lista.
    document.addEventListener("mousedown", fecharBuscaSeForaFuncionarios);
}

function mostrarBuscaFuncionarios() {
    const lista = document.getElementById("func-busca-lista");
    if (lista) lista.style.display = "block";
}

// Remove acentos pra comparação (ex.: "Márcia" e "Marcia" batem na busca), mas
// nunca é usado pra exibir nada — o texto mostrado no <li> continua com o
// acento salvo de verdade (li.textContent vem direto de f.nome/f.apelido).
function removerAcentosBusca(str) {
    return String(str || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function filtrarBuscaFuncionarios() {
    const lista = document.getElementById("func-busca-lista");
    if (!lista) return;
    const termoNome = removerAcentosBusca((document.getElementById("nome")?.value || "").toUpperCase().trim());
    const termoApelido = removerAcentosBusca((document.getElementById("apelido")?.value || "").toUpperCase().trim());
    lista.querySelectorAll("li").forEach((li) => {
        const nome = removerAcentosBusca((li.dataset.nome || "").toUpperCase());
        const apelido = removerAcentosBusca((li.dataset.apelido || "").toUpperCase());
        const okNome = !termoNome || nome.includes(termoNome);
        const okApelido = !termoApelido || apelido.includes(termoApelido);
        li.style.display = (okNome && okApelido) ? "block" : "none";
    });
    lista.style.display = "block";
}

function fecharBuscaSeForaFuncionarios(e) {
    const lista = document.getElementById("func-busca-lista");
    if (!lista) return;
    const campoNome = document.getElementById("nome");
    const campoApelido = document.getElementById("apelido");
    if (e.target === campoNome || e.target === campoApelido || lista.contains(e.target)) return;
    lista.style.display = "none";
}

function sairModoBuscaFuncionarios() {
    const lista = document.getElementById("func-busca-lista");
    if (lista) lista.remove();
    document.removeEventListener("mousedown", fecharBuscaSeForaFuncionarios);
    ["nome", "apelido"].forEach((id) => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.removeEventListener("input", filtrarBuscaFuncionarios);
            campo.removeEventListener("focus", mostrarBuscaFuncionarios);
        }
    });
}

function adicionarListenersAoInputNomeFuncionario(inputElement) {
    // Remove listeners anteriores para evitar duplicidade
    if (inputNomeFuncionarioInputListener) {
        inputElement.removeEventListener("input", inputNomeFuncionarioInputListener);
    }
    if (inputNomeFuncionarioBlurListener) {
        inputElement.removeEventListener("blur", inputNomeFuncionarioBlurListener);
    }

    inputNomeFuncionarioInputListener = function() {
        this.value = this.value.toUpperCase();
    };
    inputElement.addEventListener("input", inputNomeFuncionarioInputListener);

    inputNomeFuncionarioBlurListener = async function() {
        if (!this.value.trim()) return;
        await carregarFuncionarioDescricao(this.value); // Carrega pelo nome
    };
    inputElement.addEventListener("blur", inputNomeFuncionarioBlurListener);
}

function adicionarListenersAoInputApelidoFuncionario(inputElement) {
    // Remove listeners anteriores para evitar duplicidade
    if (inputApelidoFuncionarioInputListener) {
        inputElement.removeEventListener("input", inputApelidoFuncionarioInputListener);
    }
    if (inputApelidoFuncionarioBlurListener) {
        inputElement.removeEventListener("blur", inputApelidoFuncionarioBlurListener);
    }

    inputApelidoFuncionarioInputListener = function() {
        this.value = this.value.toUpperCase();
    };
    inputElement.addEventListener("input", inputApelidoFuncionarioInputListener);

    inputApelidoFuncionarioBlurListener = async function() {
        if (!this.value.trim()) return;
        // Se o blur do apelido deve carregar o funcionário, chame a função com o apelido
        // Pode ser necessário ajustar `carregarFuncionarioDescricao` para lidar com a busca por apelido
        await carregarFuncionarioDescricao(null, this.value); // Exemplo: Carrega pelo apelido
    };
    inputElement.addEventListener("blur", inputApelidoFuncionarioBlurListener);
}


function resetarCamposNomeApelidoParaInput() {
    const nomeCampo = document.getElementById("nome");
    if (nomeCampo && nomeCampo.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "nome";
        input.name = "nome";
        input.value = "";
        input.placeholder = "Nome do Funcionário";
        input.className = "form-2colunas";
        input.classList.add('uppercase');
        input.required = true;
        nomeCampo.parentNode.replaceChild(input, nomeCampo);
        adicionarListenersAoInputNomeFuncionario(input);
        const label = document.querySelector('label[for="nome"]');
        if (label) label.style.display = "block";
    }

    const apelidoCampo = document.getElementById("apelido");
    if (apelidoCampo && apelidoCampo.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "apelido";
        input.name = "apelido";
        input.value = "";
        input.placeholder = "Apelido";
        input.className = "form-2colunas";
        input.classList.add('uppercase');
        input.required = true;
        apelidoCampo.parentNode.replaceChild(input, apelidoCampo);
        adicionarListenersAoInputApelidoFuncionario(input);
        const label = document.querySelector('label[for="apelido"]');
        if (label) label.style.display = "block";
    }
}


// =============================================================================
// Função de Desinicialização do Módulo Funcionarios
// =============================================================================
function desinicializarFuncionariosModal() {
    console.log("🧹 Desinicializando módulo Funcionarios.js...");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const codBancoInput = document.getElementById("codBanco");
    const selectLinguas = document.getElementById('Linguas');
    const inputNomeFuncionario = document.getElementById("nome"); // Pode ser input ou select
    const inputApelido = document.getElementById("apelido"); // Pode ser input ou select


    // 1. Remover listeners de eventos dos elementos fixos
    if (codBancoInput && codBancoBlurListener) {
        codBancoInput.removeEventListener("blur", codBancoBlurListener);
        codBancoBlurListener = null;
        console.log("Listener de blur do codBanco removido.");
    }
    const inputCpf = document.getElementById("cpf");
    if (inputCpf && cpfBlurListener) {
        inputCpf.removeEventListener("blur", cpfBlurListener);
        cpfBlurListener = null;
        console.log("Listener de blur do CPF removido.");
    }
    if (selectLinguas && selectLinguasChangeListener) {
        selectLinguas.removeEventListener("change", selectLinguasChangeListener);
        selectLinguasChangeListener = null;
        console.log("Listener de change do selectLinguas removido.");
    }
    if (botaoLimpar && limparFuncionariosButtonListener) {
        botaoLimpar.removeEventListener("click", limparFuncionariosButtonListener);
        limparFuncionariosButtonListener = null;
        console.log("Listener de click do Limpar (Funcionarios) removido.");
    }
    if (botaoEnviar && enviarFuncionariosButtonListener) {
        botaoEnviar.removeEventListener("click", enviarFuncionariosButtonListener);
        enviarFuncionariosButtonListener = null;
        console.log("Listener de click do Enviar (Funcionarios) removido.");
    }
    if (botaoPesquisar && pesquisarFuncionariosButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarFuncionariosButtonListener);
        pesquisarFuncionariosButtonListener = null;
        console.log("Listener de click do Pesquisar (Funcionarios) removido.");
    }

    // 2. Remover listeners de elementos dinâmicos (#nome e #apelido)
    if (inputNomeFuncionario) {
        if (inputNomeFuncionario.tagName.toLowerCase() === "select" && selectNomeFuncionarioChangeListener) {
            inputNomeFuncionario.removeEventListener("change", selectNomeFuncionarioChangeListener);
            selectNomeFuncionarioChangeListener = null;
            console.log("Listener de change do select de nome de Funcionário removido.");
        }
        if (inputNomeFuncionario.tagName.toLowerCase() === "input") {
            if (inputNomeFuncionarioInputListener) {
                inputNomeFuncionario.removeEventListener("input", inputNomeFuncionarioInputListener);
                inputNomeFuncionarioInputListener = null;
                console.log("Listener de input do nome de Funcionário (input) removido.");
            }
            if (inputNomeFuncionarioBlurListener) {
                inputNomeFuncionario.removeEventListener("blur", inputNomeFuncionarioBlurListener);
                inputNomeFuncionarioBlurListener = null;
                console.log("Listener de blur do nome de Funcionário (input) removido.");
            }
        }
    }

    if (inputApelido) {
        if (inputApelido.tagName.toLowerCase() === "select" && selectApelidoFuncionarioChangeListener) {
            inputApelido.removeEventListener("change", selectApelidoFuncionarioChangeListener);
            selectApelidoFuncionarioChangeListener = null;
            console.log("Listener de change do select de apelido de Funcionário removido.");
        }
        if (inputApelido.tagName.toLowerCase() === "input") {
            if (inputApelidoFuncionarioInputListener) {
                inputApelido.removeEventListener("input", inputApelidoFuncionarioInputListener);
                inputApelidoFuncionarioInputListener = null;
                console.log("Listener de input do apelido de Funcionário (input) removido.");
            }
            if (inputApelidoFuncionarioBlurListener) {
                inputApelido.removeEventListener("blur", inputApelidoFuncionarioBlurListener);
                inputApelidoFuncionarioBlurListener = null;
                console.log("Listener de blur do apelido de Funcionário (input) removido.");
            }
        }
    }

    // Lógica para desinicializar 'configurarPreviewFoto()' se ela adicionar listeners
    // Isso depende de como 'configurarPreviewFoto()' é implementada.
    // Se ela adicionar um listener ao 'file' input, você precisaria de uma variável 'let' para isso.
    // Ex: if (inputFileElement && previewFotoChangeListener) { inputFileElement.removeEventListener('change', previewFotoChangeListener); }


    // 3. Limpar o estado global e campos do formulário
    window.funcionarioOriginal = null; // Zera o objeto de funcionário original
    limparCamposFuncionarios(); // Limpa todos os campos visíveis do formulário
   // document.querySelector("#form-funcionario").reset(); // Garante que o formulário seja completamente resetado
    document.querySelector("#idFuncionario").value = ""; // Limpa o ID oculto
    resetarCamposNomeApelidoParaInput(); // Garante que nome e apelido voltem a ser inputs padrão

    console.log("✅ Módulo Funcionarios.js desinicializado.");
}


if (!window.ultimoClique) {
    window.ultimoClique = null;
  
}
// Captura o último elemento clicado no documento (uma única vez)
document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurFuncionario() {
    const input = document.querySelector("#nome");
    if (!input) return;

    input.addEventListener("blur", async function () {
        
        const botoesIgnorados = ["Limpar", "Pesquisar", "Enviar"];
        const ehBotaoIgnorado =
            ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id) ||
             (ultimoClique?.classList && ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
            return;
        }

        const desc = this.value.trim();
        if (!desc) return;

        const idAtual = document.querySelector("#idFuncionario")?.value;
        if (idAtual) return;


        try {
            await carregarFuncionarioDescricao(desc, this);
        } catch (error) {
            console.error("Erro ao buscar Funcionario:", error);
        }
    });
}


async function salvarFuncionario(dados) {
  const idFuncionario = document.querySelector("#idFuncionario").value;

  if (idFuncionario) {
    Swal.fire({
      title: "Deseja salvar as alterações?",
      text: "Você está prestes a atualizar os dados do funcionário.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sim, salvar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      focusCancel: true
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetchComToken(`/funcionarios/${idFuncionario}`, {
                    method: "PUT",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });

          const resultJson = await response.json();

          if (response.ok) {
            document.getElementById('form').reset();
            Swal.fire("Sucesso!", resultJson.mensagem || "Alterações salvas com sucesso!", "success");
            document.querySelector("#idFuncionario").value = "";
            limparFuncionariosOriginal();  
          } else {
            Swal.fire("Erro", resultJson.erro || "Erro ao salvar o funcionário.", "error");
          }
        } catch (error) {
          console.error("Erro ao enviar dados:", error);
          Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
        }
      }
    });
  } else {
    // Se for novo, salva direto
    try {
        const response = await fetchComToken("/funcionarios", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

      const resultJson = await response.json();

      if (response.ok) {
        Swal.fire("Sucesso!", resultJson.mensagem || "Funcionário cadastrado com sucesso!", "success");
        document.getElementById('form').reset();
        limparFuncionariosOriginal();
        document.querySelector("#idFuncionario").value = "";
      } else {
        Swal.fire("Erro", resultJson.erro || "Erro ao cadastrar o funcionário.", "error");
      }
    } catch (error) {
      console.error("Erro ao enviar dados:", error);
      Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
    }
  }
}

function verificarPerfil() {
  const internoSelecionado = document.getElementById("interno").checked;
  const container = document.getElementById("campoFuncaoContainer");

  // Limpa o campo, caso já exista
  container.innerHTML = "";

  if (internoSelecionado) {
    const div = document.createElement("div");
    div.classList.add("form2");

    const input = document.createElement("input");
    input.type = "text";
    input.name = "funcao";
    input.id = "funcao";
    input.required = true;
    input.spellcheck = false;

    const label = document.createElement("label");
    label.setAttribute("for", "funcao");
    label.innerText = "Função";
    

    div.appendChild(input);
    div.appendChild(label);
    container.appendChild(div);
  }
}


console.log("Ainda não Entrou no Preview");

function configurarPreviewFoto() {
  const inputFile = document.getElementById('file');
  const preview = document.getElementById('previewFoto');
  const fileName = document.getElementById('fileName');
  //const hiddenInput = document.getElementById('linkFotoFuncionarios');
  const header = document.getElementById('uploadHeader');

  if (!inputFile || !preview || !fileName || !header) {
    console.warn("Elementos do preview não encontrados.");
    return;
  }

  inputFile.addEventListener('change', function () {
    const file = inputFile.files[0];

    if (!file) {
      // Nenhum arquivo selecionado
      previewFoto.src = '#';
      preview.style.display = 'none';
      header.style.display = 'block';
      fileName.textContent = 'Nenhum arquivo selecionado';
      //hiddenInput.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      Swal.fire('Arquivo inválido', 'Selecione uma imagem válida.', 'warning');
      inputFile.value = '';
      preview.src = '#';
      preview.style.display = 'none';
      header.style.display = 'block';
      fileName.textContent = 'Nenhum arquivo selecionado';
    //  hiddenInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
      header.style.display = 'none';
      fileName.textContent = file.name;
      //hiddenInput.value = e.target.result;
    };
    reader.readAsDataURL(file);
    console.log("pegou a imagem do ", fileNameImg)
  });
}

async function carregarFuncionarioDescricao(nome, elementoInputOuSelect) {
    try {
        console.log("nome:", nome);
        const funcionario = await fetchComToken(`/funcionarios?nome=${encodeURIComponent(nome)}`);

        if (funcionario && funcionario.ambiguous) {
            // Mais de um funcionário bateu ignorando acento (ex.: "Marcia" e "Márcia" são
            // pessoas diferentes) — não adivinha qual é, pede pra usar o Pesquisar.
            const lista = funcionario.opcoes
                .map(o => `• ${o.nome}${o.apelido ? ' — ' + o.apelido : ''}`)
                .join('\n');
            await Swal.fire({
                icon: 'warning',
                title: 'Mais de um funcionário encontrado',
                text: `Encontrei mais de um funcionário parecido com "${nome}" (ignorando acento). Use o botão "Pesquisar" pra escolher o certo:\n${lista}`,
                confirmButtonText: 'OK'
            });
            return;
        }

        if (!funcionario || !funcionario.idfuncionario) throw new Error("Evento não encontrado");
        //if (funcionario) {

            //window.funcionarioOriginal = { ...funcionario }; // Salva o estado original
            document.getElementById("idFuncionario").value = funcionario.idfuncionario || '';
            document.getElementById("nome").value = funcionario.nome || '';
            document.getElementById("apelido").value = funcionario.apelido || '';
            console.log("Apelido:", apelido);

            const checkboxPcd = document.getElementById("pcd");
            checkboxPcd.checked = funcionario.pcd === true;
            
            // 🎯 CARREGA O CAMPO ATIVO: Se for true no DB, marca o checkbox.
            const checkboxAtivo = document.getElementById("ativo");
            if (checkboxAtivo) {
                checkboxAtivo.checked = funcionario.ativo === true;
            }

            const checkboxBonificado = document.getElementById("bonificado");
            if (checkboxBonificado) {
                checkboxBonificado.checked = funcionario.bonificado === true;
            }

            const checkboxMei = document.getElementById("mei");
            if (checkboxMei) {
                checkboxMei.checked = funcionario.mei === true;
            }

            const checkboxAdesaoPlanoSaude = document.getElementById("adesaoPlanoSaude");
            if (checkboxAdesaoPlanoSaude) {
                checkboxAdesaoPlanoSaude.checked = funcionario.adesaoplanosaude === true;
            }
            // Pré-seleciona o plano salvo e carrega seus tipos, marcando o idtipoplanosaude.
            const selectNomePlanoSaude = document.getElementById("nomePlanoSaude");
            if (selectNomePlanoSaude) {
                selectNomePlanoSaude.value = funcionario.nomeplanosaude || '';
            }
            await carregarTiposPlanoSaude(funcionario.nomeplanosaude || '', funcionario.idtipoplanosaude || null);
            atualizarTipoPlanoSaude();

            const radiosPerfil = document.querySelectorAll('input[name="perfil"]'); // Ou input[name="radio"] se você não mudou o name
            radiosPerfil.forEach(radio => {
                if (radio.value === funcionario.perfil) {
                    radio.checked = true;
                } else {
                    radio.checked = false; // Desmarcar outros, caso haja
                }
            });
            atualizarFieldsetFinanceiro(); // reflete o perfil carregado

            const previewFoto = document.getElementById('previewFoto'); // ID da sua tag <img>
            const fileNameSpan = document.getElementById('fileName');       // ID do span/p que mostra o nome do arquivo
            const uploadHeader = document.getElementById('uploadHeader');

            if (funcionario.foto) {
                
                previewFoto.src = `/${funcionario.foto}`;
                previewFoto.style.display = 'block'; 
                uploadHeader.style.display = 'none';              
                fileNameSpan.textContent = funcionario.foto.split('/').pop() || 'Foto carregada';
            } else {
               
                previewFoto.src = '#'; 
                previewFoto.style.display = 'none'; 
                uploadHeader.style.display = 'block'; 
                fileNameSpan.textContent = 'Nenhum arquivo selecionado'; 
            }

           
            document.getElementById("cpf").value = funcionario.cpf || '';
            document.getElementById("rg").value = funcionario.rg || '';
            document.getElementById("Linguas").value = funcionario.fluencia || '';
            console.log("Linguas recebidas:", funcionario.fluencia);
            atualizarCamposLinguas();
            console.log("Linguas atualizadas");
           // document.getElementById("idiomasContainer").value = funcionario.idiomasadicionais ? JSON.stringify(funcionario.idiomasadicionais) : '';

            if (funcionario.idiomasadicionais) {
                try {
                    const idiomasSalvos = JSON.parse(funcionario.idiomasadicionais);
                    const inputsIdioma = document.querySelectorAll('#idiomasContainer .idiomaInput'); // Pega os inputs recém-gerados

                    // Percorre os inputs e preenche com os idiomas salvos
                    inputsIdioma.forEach((input, index) => {
                        if (idiomasSalvos[index]) {
                            input.value = idiomasSalvos[index];
                        }
                    });
                } catch (e) {
                    console.error("Erro ao fazer parse dos idiomas salvos:", e);
                }
            }

            console.log("Dados recebidos no Back:", funcionario);

            document.getElementById("dataNasc").value = funcionario.datanascimento?.split('T')[0] || '';
            console.log("dataNascimento recebida:", funcionario.datanascimento);

            document.getElementById("celularPessoal").value = funcionario.celularpessoal || '';
            document.getElementById("celularFamiliar").value = funcionario.celularfamiliar || '';
            document.getElementById("email").value = funcionario.email || '';
            document.getElementById("site").value = funcionario.site || '';

            document.getElementById("codBanco").value = funcionario.codigobanco || '';
            const inputCodBanco = document.getElementById("codBanco");
            if (inputCodBanco) {
                
                preencherDadosBancoPeloCodigo(funcionario.codigobanco);
            } else {
                console.warn("[Funcionarios.js] Elemento 'codigobanco' não encontrado no DOM.");
            }

            document.getElementById("pix").value = funcionario.pix || '';
            document.getElementById("agencia").value = funcionario.agencia || '';
            document.getElementById("digitoAgencia").value = funcionario.digitoagencia || '';
            document.getElementById("nConta").value = funcionario.numeroconta || '';
            document.getElementById("digitoConta").value = funcionario.digitoconta || '';

            const selectTipoConta = document.getElementById('tpConta');
            if (selectTipoConta) {
                selectTipoConta.value = funcionario.tipoconta || 'selecionado';
            }

            document.getElementById("cep").value = funcionario.cep || '';
            document.getElementById("rua").value = funcionario.rua || '';
            document.getElementById("numero").value = funcionario.numero || '';
            document.getElementById("complemento").value = funcionario.complemento || '';
            document.getElementById("bairro").value = funcionario.bairro || '';
            document.getElementById("cidade").value = funcionario.cidade || '';
            document.getElementById("estado").value = funcionario.estado || '';
            document.getElementById("pais").value = funcionario.pais || '';
            document.getElementById("funcao").value = funcionario.funcao  || "";
            document.getElementById("cbo").value = funcionario.cbo  || "";

            const inputSalario = document.getElementById("salario");
                if (inputSalario) {
                    let valorSalario = parseFloat(funcionario.salario) || 0;
                    
                    // Se o valor parece estar em centavos (ex: 300000.00 ao invés de 3000.00)
                    if (valorSalario > 100000) {
                        valorSalario = valorSalario / 100;
                    }
                    
                    inputSalario.value = valorSalario.toFixed(2);
                    // formatReais é função GLOBAL (window.formatReais), não método do input.
                    if (typeof formatReais === 'function') formatReais(inputSalario);
                }

            // VA e VT: define o valor cru e reformata em R$ chamando formatReais(elemento).
            const inputVA = document.getElementById("valealim");
            if (inputVA) {
                inputVA.value = (parseFloat(funcionario.valealim) || 0).toFixed(2);
                if (typeof formatReais === 'function') formatReais(inputVA);
            }
            const inputVT = document.getElementById("valetrnsp");
            if (inputVT) {
                inputVT.value = (parseFloat(funcionario.valetrnsp) || 0).toFixed(2);
                if (typeof formatReais === 'function') formatReais(inputVT);
            }

            document.getElementById("dependentes").value = funcionario.dependentes  || "0";
            // dependentesdados vem do banco como JSONB (array) ou string JSON.
            let dependentesDadosCarregados = funcionario.dependentesdados;
            if (typeof dependentesDadosCarregados === 'string') {
                try { dependentesDadosCarregados = JSON.parse(dependentesDadosCarregados || '[]'); }
                catch (e) { dependentesDadosCarregados = []; }
            }
            if (!Array.isArray(dependentesDadosCarregados)) dependentesDadosCarregados = [];
            gerarCamposDependentes(funcionario.dependentes || 0, dependentesDadosCarregados);
            document.getElementById("admissao").value = funcionario.admissao?.split('T')[0] || '';

            document.getElementById("nomeFamiliar").value = funcionario.nomefamiliar || '';
            document.getElementById("apelido").value = funcionario.apelido || '';
            console.log("nomeFamiliar recebido:", funcionario.nomefamiliar);

            // Armazena o estado original, se necessário
            window.funcionarioOriginal = { 
                ...funcionario, 
                pcd: funcionario.pcd === true, // Garante que é booleano
                ativo: funcionario.ativo === true, // 🎯 NOVO: Garante que é booleano (true = ativo)
                bonificado: funcionario.bonificado === true, // 🎯 NOVO: Garante que é booleano (true = bonificado)
                mei: funcionario.mei === true, // Garante que é booleano (true = mei)
                adesaoPlanoSaude: funcionario.adesaoplanosaude === true,
                tipoPlanoSaude: funcionario.tipoplanosaude || ''
            };
           
            const selectLinguas = document.getElementById('Linguas'); 
            if (selectLinguas) {
                selectLinguas.value = funcionario.fluencia || '';
            }            
           
            const formInputs = document.querySelectorAll('#formFuncionarios input, #formFuncionarios select, #formFuncionarios textarea');
            formInputs.forEach(input => input.removeAttribute('disabled'));            
        //} 
    } catch (error) {
     
        const inputIdFuncionario = document.querySelector("#idFuncionario");
        const podeCadastrarFuncionario = temPermissao("Funcionarios", "cadastrar");

        if (inputIdFuncionario?.value) return;
      
        if (!inputIdFuncionario.value && podeCadastrarFuncionario) {
             const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${nome.toUpperCase()}" como novo Funcionário?`,
                text: `Funcionário "${nome.toUpperCase()}" não encontrado.`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro do Funcionário.");
                elementoInputOuSelect.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoInputOuSelect.focus();
                }, 0);
                return;
            }
            elementoInputOuSelect.value = nome.toUpperCase();
        } else if (!podeCadastrarFuncionario) {
            Swal.fire({
                icon: "info",
                title: "Funcionário não cadastrado",
                text: "Você não tem permissão para cadastrar funcionários.",
                confirmButtonText: "OK"
            });
        }       
    }
}

async function preencherDadosBancoPeloCodigo() {
 
    const codBancoInput = document.getElementById('codBanco');
  
    if (!codBancoInput) {
        console.warn("Elemento 'inputBanco' (nome do banco) não encontrado no DOM do modal de Funcionários.");
        return;
    }

    if (!codBancoInput.value) {       
        codBancoInput.value = '';
        return;
    }    

    try {
        const codBanco = document.getElementById("codBanco").value;
        const url = `/funcionarios/bancos?codBanco=${encodeURIComponent(codBanco)}`;
        const nomeBanco = await fetchComToken(url);            
        
        if (nomeBanco && nomeBanco.codbanco) { 
            document.getElementById("banco").value = nomeBanco.nmbanco;        
        } else {        
    
            Swal.fire({
                icon: 'info',
                title: 'Banco não encontrado',
                text: `Nenhum banco encontrado com o código '${codBanco}'.`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });           
        }
    } catch (error) {        
           
        if (error.message !== 'Sessão expirada') {
            Swal.fire({
                icon: 'error',
                title: 'Erro de busca de banco',
                text: 'Não foi possível buscar as informações do banco. Verifique o código e tente novamente.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    }
}

// --- Função auxiliar para criar o SELECT de funcionários ---
function criarSelectFuncionario(funcionarios) {
    const select = document.createElement("select");
    select.id = "nome"; // Usamos 'nome' como ID para manter a consistência
    select.name = "nome";
    select.className = "form-2colunas";
    select.required = true;

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Selecione um funcionário...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    funcionarios.forEach(funcionario => {
        const option = document.createElement("option");
        option.value = funcionario.nome;
        option.textContent = funcionario.nome;
        option.dataset.idfuncionario = funcionario.idfuncionario;
        option.dataset.nome = funcionario.nome;
        option.dataset.apelido = funcionario.apelido || '';
        select.appendChild(option);
    });
    
    return select;
}
function criarSelectApelido(funcionarios) {
    const select = document.createElement("select");
    select.id = "apelido"; // Usamos 'nome' como ID para manter a consistência
    select.name = "apelido";
    select.className = "form-2colunas";
    select.required = true;

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Selecione um apelido...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    funcionarios.forEach(funcionario => {
        const option = document.createElement("option");
        option.value = funcionario.apelido; // O valor da opção será o nome para a busca
        option.textContent = funcionario.apelido;
        option.setAttribute('data-id', funcionario.idFuncionario); // Armazenar o ID no data-attribute
        option.setAttribute('data-nome', funcionario.nome); 
        select.appendChild(option);
    });

    return select;
}


function atualizarCamposLinguas() {
  const select = document.getElementById('Linguas');
  const container = document.getElementById('idiomasContainer');
  const selectFluencia = select.value;
  let valor = "";

  switch (selectFluencia) {
    case "Monolingue":
        valor = "1";
        break; 
    case "Bilingue":
        valor = "2";
        break;
    case "Trilingue":
        valor = "3";
        break;
    case "Poliglota":
        valor = "custom";
        break;
    default:        
        valor = ""; 
        break;
}
  container.innerHTML = ""; // Limpa campos anteriores

if (valor === "") return;

// Sempre adiciona o campo "Português"
const inputPT = document.createElement("input");
inputPT.type = "text";
inputPT.value = "Português";
inputPT.disabled = true;
inputPT.className = "idiomaInput";
// inputPT.style.marginBottom = "5px";
inputPT.style.width = "100px";
container.appendChild(inputPT);

  if (valor === "1") {
    return; // Monolíngue
  }

  console.log("QTD LINGUAS", valor);

if (valor === "2" || valor === "3") {
const qtd = parseInt(valor) - 1;
for (let i = 1; i <= qtd; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Idioma ${i + 1}`;
    input.name = `idioma${i + 1}`;
    input.className = "idiomaInput";
    input.style.width = "100px";

    container.appendChild(input);
}
} else if (valor === "custom") {
const grupo = document.createElement("div");
grupo.style.display = "flex";
grupo.style.flexDirection = "column";
grupo.style.alignItems = "center";
    grupo.style.width = "100px";
    grupo.style.marginLeft = "50px";


const label = document.createElement("p");
label.textContent = "Quantos idiomas (incluindo Português)?";
label.style.fontSize = "15px";
label.style.marginleft = "150px";
label.style.padding = "0";
label.style.lineHeight = "1.2";
label.style.width = "300px";

const inputQtd = document.createElement("input");
inputQtd.type = "number";
inputQtd.min = 4;
inputQtd.placeholder = "Min: 4";
    inputQtd.style.width = "100px";


inputQtd.onchange = function () {
    grupo.style.display = "none";
    gerarCamposPoliglota(parseInt(this.value));
};

grupo.appendChild(label);
grupo.appendChild(inputQtd);
container.appendChild(grupo);
}
}

function gerarCamposPoliglota(qtd) {
const container = document.getElementById('idiomasContainer');
while (container.children.length > 3) {
container.removeChild(container.lastChild);
}

for (let i = 1; i < qtd; i++) { // Começa em 1 porque o primeiro já é "Português"
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Idioma ${i + 1}`;
    input.name = `idioma${i + 1}`;
    input.className = "idiomaInput";
    // container.appendChild(document.createElement("br"));
    container.appendChild(input);
}
}


function limparCamposFuncionarios(){
    sairModoBuscaFuncionarios(); // encerra a busca (remove a lista suspensa, se houver)
    const camposParaLimpar = [
        "idFuncionario", "nome", "cpf", "rg",
        "celularPessoal", "celularFamiliar", "email", "site",
        "banco", "codBanco", "pix", "nConta", "digitoConta",
        "agencia", "digitoAgencia", "dataNasc", "tpConta",
        "cep", "rua", "numero", "complemento", "bairro",
        "cidade", "estado", "pais", "nomeFamiliar", "apelido", "funcao", "admisao", "cbo", "salario", "dependentes","admissao"
    ];

    // --- Limpeza específica para Checkboxes (PCD e Ativo) ---
    const campoPcd = document.getElementById("pcd");
    if (campoPcd && campoPcd.type === "checkbox") {
        campoPcd.checked = false; 
    }

    const campoBonificado = document.getElementById("bonificado");
    if (campoBonificado && campoBonificado.type === "checkbox") {
        campoBonificado.checked = false;
    }

    const campoMei = document.getElementById("mei");
    if (campoMei && campoMei.type === "checkbox") {
        campoMei.checked = false;
    }

    const campoAdesaoPlanoSaude = document.getElementById("adesaoPlanoSaude");
    if (campoAdesaoPlanoSaude && campoAdesaoPlanoSaude.type === "checkbox") {
        campoAdesaoPlanoSaude.checked = false;
    }
    // Remove os tipos herdados de um plano anterior (mantém só o placeholder).
    const selectTipoPlanoSaudeLimpar = document.getElementById("tipoPlanoSaude");
    if (selectTipoPlanoSaudeLimpar) {
        selectTipoPlanoSaudeLimpar.querySelectorAll("option:not([value=''])").forEach((o) => o.remove());
    }
    atualizarTipoPlanoSaude(); // desabilita e limpa os selects de plano/acomodação

    // 🎯 CAMPO ATIVO: Garante que o checkbox 'ativo' é MARCADO (true por padrão)
    const campoAtivo = document.getElementById("ativo");
    if (campoAtivo && campoAtivo.type === "checkbox") {
        campoAtivo.checked = true; // 🎯 DEVE SER TRUE
    }
    // -----------------------------------------------------------


    // Limpa campos de texto e inputs de forma genérica
    camposParaLimpar.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.value = "";
            // Remove a classe 'active' de labels para garantir que a UI volte ao estado inicial
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) {
                label.classList.remove('active');
            }
        }
    });

    // Zera a quantidade de dependentes e remove os campos dinâmicos gerados.
    const campoDependentes = document.getElementById("dependentes");
    if (campoDependentes) campoDependentes.value = "0";
    gerarCamposDependentes(0);

    // --- Limpeza específica para Radio Buttons (Perfil) ---
    const radioPerfil = document.querySelectorAll('input[name="perfil"]'); // Seleciona todos os rádios com name="perfil"
    radioPerfil.forEach(radio => {
        radio.checked = false; // Desmarca cada radio button
    });
    atualizarFieldsetFinanceiro(); // sem perfil => esconde o Financeiro

    // --- Limpeza específica para Selects ---
    const selectLinguas = document.getElementById('Linguas');
    if (selectLinguas) {
        selectLinguas.value = ""; // Define o valor para a opção "Selecione o nível de fluência" (assumindo value="" para ela)
        // Opcional: selectLinguas.selectedIndex = 0; // Se a primeira opção for sempre a de placeholder
    }

    const selectTipoConta = document.getElementById('TPconta');
    if (selectTipoConta) {
        selectTipoConta.value = "selecionado"; // Define o valor para a opção "Tipo de Conta" (assumindo value="selecionado" para ela)
        // Opcional: selectTipoConta.selectedIndex = 0; // Se a primeira opção for sempre a de placeholder
    }

    // --- Limpeza de campos de Idiomas gerados dinamicamente ---
    const idiomasContainer = document.getElementById('idiomasContainer');
    if (idiomasContainer) {
        idiomasContainer.innerHTML = ""; // Remove todos os campos filhos do container
    }

    // --- Limpeza do Preview de Foto ---
    const previewFoto = document.getElementById('previewFoto');
    const fileName = document.getElementById('fileName');
    const hiddenInputFoto = document.getElementById('linkFotoFuncionarios');
    const uploadHeader = document.getElementById('uploadHeader');
    const inputFile = document.getElementById('file');

    if (previewFoto) {
        previewFoto.src = "#";
        previewFoto.style.display = 'none'; // Esconde a pré-visualização
    }
    if (fileName) {
        fileName.textContent = 'Nenhum arquivo selecionado'; // Reseta o texto do nome do arquivo
    }
    if (hiddenInputFoto) {
        hiddenInputFoto.value = ''; // Limpa o valor do input hidden
    }
    if (uploadHeader) {
        uploadHeader.style.display = 'block'; // Mostra o cabeçalho de upload novamente
    }
    if (inputFile) {
        inputFile.value = ''; // Limpa o input de arquivo selecionado
    }

    
    
    const campoNome = document.querySelector("#nome");
    if (campoNome.tagName === "SELECT") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "nome";
        input.name = "nome";
        input.className = "form";
        input.value = ""; 
        input.classList.add("uppercase");
        input.required = true;
        campoNome.parentNode.replaceChild(input, campoNome);
    }
    
    const campoApelido = document.querySelector("#apelido");
    if (campoApelido.tagName === "SELECT") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "apelido";
        input.name = "apelido";
        input.className = "form";
        input.value = ""; 
        input.classList.add("uppercase");
        input.required = true;
        campoApelido.parentNode.replaceChild(input, campoApelido);
    }
}

 function configurarEventosFuncionarios() {
    console.log("Configurando eventos Funcionarios...");
    verificaFuncionarios(); // Carrega os Funcionarios ao abrir o modal
    configurarPreviewFoto();
    atualizarCamposLinguas();
    adicionarEventoBlurFuncionario();
   // inputFile.dataset.previewSet = "true"; // Evita configurar mais de uma vez
  }
  window.configurarEventosFuncionarios = configurarEventosFuncionarios;

  function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'funcionarios') {
    configurarEventosFuncionarios();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para LocalMontagem.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['Funcionarios'] = { // A chave 'Funcionarios' (com F maiúsculo) deve corresponder ao seu Index.js
    configurar: configurarEventosFuncionarios,
    desinicializar: desinicializarFuncionariosModal
};