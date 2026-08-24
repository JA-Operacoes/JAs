// public/js/Servicos.js
// Cadastro de serviços fiscais (código de serviço, NBS, cIndOp, classificação
// tributária) usado pela Emissão de Nota Fiscal. Um serviço = um código que a
// empresa usa de verdade — não uma lista genérica da LC 116.
import { fetchComToken } from '../utils/utils.js';

function aviso(icon, title, text) {
  if (window.Swal) return Swal.fire({ icon, title, text });
  alert(`${title}\n${text || ''}`);
}

let servicosCache = []; // usado pelas buscas de Código/Descrição (ver ligarBuscaServico) — a
                         // tabela que listava tudo foi removida, a busca virou o jeito de achar/editar

async function carregarServicos() {
  try {
    servicosCache = await fetchComToken('/servicos');
  } catch (err) {
    console.error('Erro ao carregar serviços:', err);
    servicosCache = [];
    aviso('error', 'Erro', 'Não foi possível carregar os serviços cadastrados.');
  }
}

function preencherFormulario(servico) {
  document.getElementById('svIdServico').value = servico.idservico;
  document.getElementById('svCodigoServico').value = servico.codigoservico;
  document.getElementById('svDescricao').value = servico.descricao || '';
  document.getElementById('svNbs').value = servico.nbs || '';
  document.getElementById('svCindop').value = servico.cindop || '';
  document.getElementById('svClassTrib').value = servico.classificacaotributaria || '';
  document.getElementById('svAliquotaIss').value = servico.aliquotaissref || '';
  document.getElementById('svAtivo').checked = !!servico.ativo;
}

function limparFormulario() {
  document.getElementById('formServico').reset();
  document.getElementById('svIdServico').value = '';
  document.getElementById('svAtivo').checked = true;
  document.querySelectorAll('.sv-combo-lista').forEach((lista) => lista.classList.remove('aberta'));
}

// ---- Busca "digitar pra buscar" nos campos Código/Descrição ----
// Só entra em ação quando NENHUM serviço está carregado (form em branco,
// pronto pra um novo cadastro) — com um serviço já aberto pra edição, os
// campos voltam a ser texto normal (senão corrigir a descrição de um
// serviço já carregado ia disparar busca sem necessidade nenhuma).
function servicoJaCarregado() {
  return !!document.getElementById('svIdServico').value;
}

function renderizarListaBuscaServico(lista, chaveCampo, termo) {
  const termoNorm = (termo || '').trim().toLowerCase();
  const filtrados = termoNorm
    ? servicosCache.filter((s) => String(s[chaveCampo] || '').toLowerCase().includes(termoNorm))
    : servicosCache;

  lista.innerHTML = '';
  if (!filtrados.length) {
    const vazio = document.createElement('li');
    vazio.className = 'sv-combo-vazio';
    vazio.textContent = termoNorm ? 'Nenhum serviço encontrado — vai ser cadastrado como novo' : 'Nenhum serviço cadastrado ainda';
    lista.appendChild(vazio);
  } else {
    filtrados.forEach((s) => {
      const li = document.createElement('li');
      li.dataset.id = s.idservico;
      li.textContent = `${s.codigoservico} — ${s.descricao}`;
      lista.appendChild(li);
    });
  }
  lista.classList.add('aberta');
}

function ligarBuscaServico(idInput, idLista, chaveCampo) {
  const input = document.getElementById(idInput);
  const lista = document.getElementById(idLista);

  input.addEventListener('input', () => {
    if (servicoJaCarregado()) return;
    renderizarListaBuscaServico(lista, chaveCampo, input.value);
  });
  input.addEventListener('focus', () => {
    if (servicoJaCarregado()) return;
    renderizarListaBuscaServico(lista, chaveCampo, input.value);
  });

  lista.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    e.preventDefault(); // antes do blur do input, senão a lista some antes do clique registrar
    const servico = servicosCache.find((s) => String(s.idservico) === li.dataset.id);
    if (servico) preencherFormulario(servico);
    lista.classList.remove('aberta');
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target !== input && !lista.contains(e.target)) lista.classList.remove('aberta');
  });
}

async function salvarServico() {
  const idServico = document.getElementById('svIdServico').value;
  const codigoServico = document.getElementById('svCodigoServico').value.trim();
  const descricao = document.getElementById('svDescricao').value.trim();

  if (!codigoServico || !descricao) {
    return aviso('warning', 'Campos obrigatórios', 'Preencha o código de serviço e a descrição.');
  }

  const body = {
    codigoServico,
    descricao,
    nbs: document.getElementById('svNbs').value.trim() || null,
    cindop: document.getElementById('svCindop').value.trim() || null,
    classificacaoTributaria: document.getElementById('svClassTrib').value.trim() || null,
    aliquotaIssRef: parseFloat(document.getElementById('svAliquotaIss').value) || null,
    ativo: document.getElementById('svAtivo').checked
  };

  try {
    if (idServico) {
      await fetchComToken(`/servicos/${idServico}`, { method: 'PUT', body });
    } else {
      await fetchComToken('/servicos', { method: 'POST', body });
    }
    await aviso('success', 'Salvo', 'Serviço salvo com sucesso!');
    limparFormulario();
    await carregarServicos();
  } catch (err) {
    console.error('Erro ao salvar serviço:', err);
    aviso('error', 'Erro', err?.message || 'Não foi possível salvar o serviço.');
  }
}

function configurarEventosServicos() {
  document.getElementById('svSalvar').addEventListener('click', salvarServico);
  document.getElementById('svLimpar').addEventListener('click', limparFormulario);
  ligarBuscaServico('svCodigoServico', 'svListaCodigo', 'codigoservico');
  ligarBuscaServico('svDescricao', 'svListaDescricao', 'descricao');
  carregarServicos();
}

// Segue o mesmo contrato do loader genérico de módulos (abrirModal/Index.js):
// cada módulo sobrescreve window.configurarEventosEspecificos diretamente —
// só um modal fica aberto por vez, então não precisa encadear com o anterior.
window.configurarEventosEspecificos = function (modulo) {
  if (modulo.trim().toLowerCase() === 'servicos') {
    configurarEventosServicos();
  }
};

// A chave precisa bater EXATAMENTE com o data-modulo do link do menu
// ("Servicos") — fecharModal() em Index.js busca por window.moduloAtual
// sem normalizar caixa, então 'servicos' (minúsculo) nunca seria encontrado.
window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['Servicos'] = {
  configurar: configurarEventosServicos,
  desinicializar: limparFormulario
};
