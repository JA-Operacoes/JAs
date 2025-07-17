// public/js/permissoes.js
// Função para aplicar as permissões no DOM conforme o módulo atual
import { fetchComToken, fetchHtmlComToken } from '../utils/utils.js';

window.permissoesUsuario = [];

function aplicarPermissoes(permissoes) {
  const moduloAtual = window.moduloAtual;
 
  console.log("[Permissões] módulo atual:", moduloAtual);
  console.log("[Permissões] permissões recebidas:", permissoes);

  // Busca permissão correspondente ao módulo atual (ignorando case e espaços)
  const p = permissoes.find(x =>
    x.modulo &&
    moduloAtual &&
    x.modulo.trim().toLowerCase() === moduloAtual.trim().toLowerCase()
  );

  if (!p) {
    console.warn(`[Permissões] Nenhuma permissão para módulo: ${moduloAtual}`);
    return;
  }

  console.log("[Permissões] permissões para o módulo:", p);

  // Desabilita botões conforme permissões
  if (!p.pode_cadastrar) {
    document.querySelectorAll(".btnCadastrar").forEach(btn => btn.disabled = true);
  }
  if (!p.pode_alterar) {
    document.querySelectorAll(".btnAlterar").forEach(btn => btn.disabled = true);
  }
  if (!p.pode_pesquisar) {
    document.querySelectorAll(".btnPesquisar").forEach(btn => btn.disabled = true);
  }

  
  // Caso só possa pesquisar, oculta botões de envio
  if (p.pode_pesquisar && !p.pode_cadastrar && !p.pode_alterar) {
    document.querySelectorAll("button[type='submit'], .btnSalvar, .btnEnviar")
      .forEach(btn => btn.style.display = "none");
  }

  // Caso só possa alterar, altera texto e estilo do botão
  if (!p.pode_cadastrar && p.pode_alterar) {
    document.querySelectorAll("button[type='submit'], .btnSalvar, .btnEnviar").forEach(btn => {
      btn.textContent = "Atualizar";
      btn.title = "Você só pode alterar registros existentes";
      btn.classList.add("btnAtualizar");
    });
  }

  // Se não pode cadastrar nem alterar, desabilita botões de envio
  if (!p.pode_cadastrar && !p.pode_alterar) {
    document.querySelectorAll("button[type='submit'], .btnSalvar, .btnEnviar").forEach(btn => {
      btn.disabled = true;
      btn.title = "Você não tem permissão para salvar ou alterar";
      btn.classList.add("btnDesabilitado");
    });
  }
}

// Função que oculta/mostra itens do menu conforme permissões
function filtrarMenuPorPermissoes(permissoes) {
  console.log("[Permissões] Iniciando filtrarMenuPorPermissoes()");
  if (!Array.isArray(permissoes)) {
    console.error("[Permissões] Formato inválido de permissões:", permissoes);
    return;
  }

  const links = document.querySelectorAll("a[data-modulo]");
  links.forEach(link => {
    const modulo = link.dataset.modulo.trim().toLowerCase();
    const permissao = permissoes.find(p => p.modulo && p.modulo.trim().toLowerCase() === modulo);

    if (!permissao || (!permissao.cadastrar && !permissao.alterar && !permissao.pesquisar)) {
      link.style.display = "none";
    } else {
      link.style.display = ""; // garante que fique visível se permitido
    }
  });
}
// Expor globalmente para poder chamar de fora, se necessário

window.aplicarPermissoes = aplicarPermissoes;
