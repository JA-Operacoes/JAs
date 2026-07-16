// Tela de edição das alíquotas / parâmetros fiscais da folha (tabela `aliquotas`).
// Aberta a partir do modo RH (RH.js importa este módulo dinamicamente).
// Consome GET /rh/parametros?ano= e PUT /rh/parametros/:ano.
import { fetchComToken, fetchHtmlComToken } from '../utils/utils.js';

const ALIQ_URL = 'CadAliquotas.html';

// Conversões: alíquotas guardadas como fração (0,075) e exibidas como % (7,5).
const paraPct = (frac) => (Number(frac) || 0) * 100;
const paraFrac = (pct) => (Number(pct) || 0) / 100;
const num = (el) => (el && el.value.trim() !== '' ? parseFloat(el.value) : null);

// Leitura/exibição de valores monetários (R$), usando os helpers globais de Formataçoes.js.
// moeda(): lê o campo formatado ("R$ 1.234,56") e devolve número puro (1234.56) ou null.
const moeda = (el) => {
  if (!el || el.value.trim() === '') return null;
  const n = window.desformatarReais(el.value);
  return n === '' ? null : n;
};
// fmtMoeda(): número do banco (1234.56) -> texto formatado ("R$ 1.234,56") p/ preencher o campo.
const fmtMoeda = (n) => (n != null && n !== '' ? 'R$ ' + window.formatarReaisValor(n) : '');

function fecharAliquotas() {
  const cont = document.getElementById('modal-container');
  if (cont) cont.innerHTML = '';
  const ov = document.getElementById('modal-overlay');
  if (ov) ov.style.display = 'none';
  document.body.classList.remove('modal-open');
}

function aviso(icon, title, text) {
  if (window.Swal) return Swal.fire({ icon, title, text });
  alert(`${title}\n${text || ''}`);
}

// ---- Linhas das tabelas de faixas ----
function linhaInss(tbody, faixa = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" inputmode="numeric" oninput="formatReais(this)" class="f-ate" value="${fmtMoeda(faixa.ate)}"></td>
    <td><input type="number" step="0.01" min="0" class="f-aliq" value="${faixa.aliquota != null ? paraPct(faixa.aliquota) : ''}"></td>
    <td><button type="button" class="aliq-rm" title="Remover">✕</button></td>`;
  tr.querySelector('.aliq-rm').addEventListener('click', () => tr.remove());
  tbody.appendChild(tr);
}

function linhaIrrf(tbody, faixa = {}) {
  const tr = document.createElement('tr');
  // ate vazio = última faixa (sem teto, null no banco).
  tr.innerHTML = `
    <td><input type="text" inputmode="numeric" oninput="formatReais(this)" class="f-ate" value="${fmtMoeda(faixa.ate)}" placeholder="∞"></td>
    <td><input type="number" step="0.01" min="0" class="f-aliq" value="${faixa.aliquota != null ? paraPct(faixa.aliquota) : ''}"></td>
    <td><input type="text" inputmode="numeric" oninput="formatReais(this)" class="f-ded" value="${fmtMoeda(faixa.deduzir)}"></td>
    <td><button type="button" class="aliq-rm" title="Remover">✕</button></td>`;
  tr.querySelector('.aliq-rm').addEventListener('click', () => tr.remove());
  tbody.appendChild(tr);
}

// ---- Carregar parâmetros do ano nos campos ----
async function carregar(ano) {
  let p;
  try {
    p = await fetchComToken(`/rh/parametros?ano=${ano}`);
  } catch (err) {
    console.error('Erro ao carregar alíquotas:', err);
    aviso('error', 'Erro', 'Não foi possível carregar as alíquotas.');
    return;
  }
  const $ = (id) => document.getElementById(id);

  const tbInss = document.querySelector('#aliq-inss tbody');
  tbInss.innerHTML = '';
  (p.inss_faixas || []).forEach((f) => linhaInss(tbInss, f));

  const tbIrrf = document.querySelector('#aliq-irrf tbody');
  tbIrrf.innerHTML = '';
  (p.irrf_faixas || []).forEach((f) => linhaIrrf(tbIrrf, f));

  $('aliq-dep').value = fmtMoeda(p.irrf_deducao_dependente);
  $('aliq-simpl').value = fmtMoeda(p.irrf_desconto_simplificado);
  $('aliq-fgts').value = p.fgts_aliquota != null ? paraPct(p.fgts_aliquota) : '';

  const r = p.irrf_redutor || {};
  $('aliq-red-isencao-ate').value = fmtMoeda(r.isencao_ate);
  $('aliq-red-isencao-red').value = fmtMoeda(r.isencao_redutor);
  $('aliq-red-phaseout').value = fmtMoeda(r.phaseout_ate);
  $('aliq-red-coefa').value = fmtMoeda(r.coef_a);
  $('aliq-red-coefb').value = r.coef_b ?? '';
}

// ---- Salvar (PUT) ----
async function salvar() {
  const ano = parseInt(document.getElementById('aliq-ano').value, 10);

  const inss_faixas = Array.from(document.querySelectorAll('#aliq-inss tbody tr'))
    .map((tr) => ({
      ate: moeda(tr.querySelector('.f-ate')) || 0,
      aliquota: paraFrac(num(tr.querySelector('.f-aliq'))),
    }))
    .filter((f) => f.ate > 0);

  const irrf_faixas = Array.from(document.querySelectorAll('#aliq-irrf tbody tr'))
    .map((tr) => ({
      ate: moeda(tr.querySelector('.f-ate')), // null = última faixa (sem teto)
      aliquota: paraFrac(num(tr.querySelector('.f-aliq'))),
      deduzir: moeda(tr.querySelector('.f-ded')) || 0,
    }));

  if (!inss_faixas.length || !irrf_faixas.length) {
    return aviso('warning', 'Faltam faixas', 'Cadastre ao menos uma faixa de INSS e uma de IRRF.');
  }

  const $ = (id) => document.getElementById(id);
  const body = {
    inss_faixas,
    irrf_faixas,
    irrf_deducao_dependente: moeda($('aliq-dep')) || 0,
    irrf_desconto_simplificado: moeda($('aliq-simpl')) || 0,
    fgts_aliquota: paraFrac(num($('aliq-fgts'))),
    irrf_redutor: {
      isencao_ate: moeda($('aliq-red-isencao-ate')) || 0,
      isencao_redutor: moeda($('aliq-red-isencao-red')) || 0,
      phaseout_ate: moeda($('aliq-red-phaseout')) || 0,
      coef_a: moeda($('aliq-red-coefa')) || 0,
      coef_b: num($('aliq-red-coefb')) || 0,
    },
  };

  try {
    await fetchComToken(`/rh/parametros/${ano}`, { method: 'PUT', body });
    await aviso('success', 'Salvo', `Alíquotas de ${ano} atualizadas.`);
  } catch (err) {
    console.error('Erro ao salvar alíquotas:', err);
    aviso('error', 'Erro', err?.message || 'Não foi possível salvar as alíquotas.');
  }
}

// ---- Abertura do modal (chamado pelo RH.js) ----
export async function abrirAliquotas() {

  const temPermissaoRH = temPermissao("Staff", "rh");
  const temPermissaoSupremo = temPermissao("Staff", "supremo");
  const temPermissaoTotal = temPermissaoRH || temPermissaoSupremo

  if (!temPermissaoTotal) {
    aviso('warning', 'Acesso negado', 'Você não tem permissão para acessar as alíquotas.');
    return;
  }
    


  let html;
  try {
    html = await fetchHtmlComToken(ALIQ_URL);
  } catch (err) {
    console.error('Erro ao abrir tela de alíquotas:', err);
    return;
  }
  const container = document.getElementById('modal-container');
  container.innerHTML = html;

  const overlay = document.getElementById('modal-overlay');
  const modal = container.querySelector('.modal');
  if (modal) modal.style.display = 'block';
  if (overlay) {
    overlay.style.display = 'block';
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fecharAliquotas(); });
  }
  document.body.classList.add('modal-open');
  container.querySelector('.close')?.addEventListener('click', fecharAliquotas);

  // Seletor de ano (ano atual ± alguns).
  const selAno = container.querySelector('#aliq-ano');
  const atual = new Date().getFullYear();
  for (let a = atual + 1; a >= atual - 5; a--) {
    const o = document.createElement('option');
    o.value = a; o.textContent = a;
    selAno.appendChild(o);
  }
  selAno.value = atual;
  selAno.addEventListener('change', () => carregar(selAno.value));

  container.querySelector('#aliq-add-inss')
    ?.addEventListener('click', () => linhaInss(document.querySelector('#aliq-inss tbody')));
  container.querySelector('#aliq-add-irrf')
    ?.addEventListener('click', () => linhaIrrf(document.querySelector('#aliq-irrf tbody')));

  // Rodapé: Salvar (Enviar), Recarregar (Pesquisar) e Limpar.
  container.querySelector('#Enviar')?.addEventListener('click', salvar);
  container.querySelector('#Pesquisar')?.addEventListener('click', () => carregar(selAno.value));
  container.querySelector('#Limpar')?.addEventListener('click', limpar);

  await carregar(selAno.value);
}

// Esvazia os campos (faixas e escalares) sem apagar nada no banco.
function limpar() {
  document.querySelector('#aliq-inss tbody').innerHTML = '';
  document.querySelector('#aliq-irrf tbody').innerHTML = '';
  ['aliq-dep', 'aliq-simpl', 'aliq-fgts', 'aliq-red-isencao-ate', 'aliq-red-isencao-red',
   'aliq-red-phaseout', 'aliq-red-coefa', 'aliq-red-coefb'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}
