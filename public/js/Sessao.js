// =============================================================================
//  Sessão do usuário — empresa ativa, identidade e permissões
//  ----------------------------------------------------------------------------
//  Extraído do Main.js para que Pedidos.js (e qualquer módulo novo) possa usar
//  essas checagens sem importar o Main inteiro — o Main executa muita coisa no
//  import (fetch, setInterval, DOM), então importá-lo criaria ciclo e efeitos
//  colaterais. Aqui só há leitura de localStorage e de window.permissoes.
//
//  window.permissoes é preenchido pelo Index.js depois do fetch /auth/permissoes;
//  antes disso todas as checagens retornam false (por isso a guarda de Array).
// =============================================================================

export function getIdEmpresa() {
  return localStorage.getItem("idempresa");
}

export function getUsuarioLogado() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuário não logado");

  const payload = JSON.parse(atob(token.split(".")[1]));

  return {
    idusuario: payload.idusuario,
    nome: payload.nome || "Usuário",
    permissoes: payload.permissoes || [] // garante que sempre retorna array
  };
}

export function getIdExecutor() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuário não logado");

  const payload = JSON.parse(atob(token.split(".")[1]));
  if (!payload.idusuario) throw new Error("ID do usuário não encontrado no token");
  return payload.idusuario;
}

// As três permissões especiais vivem no módulo "Staff": master (gestão),
// financeiro (vê valores) e supremo (aprova/rejeita).
function flagDoStaff(flag) {
  if (!window.permissoes || !Array.isArray(window.permissoes)) return false;
  const permissaoStaff = window.permissoes.find(p => p.modulo?.toLowerCase() === "staff");
  if (!permissaoStaff) return false;
  return !!permissaoStaff[flag];
}

export function usuarioTemPermissao() {
  return flagDoStaff("pode_master");
}

export function usuarioTemPermissaoFinanceiro() {
  return flagDoStaff("pode_financeiro");
}

export function usuarioTemPermissaoSupremo() {
  return flagDoStaff("pode_supremo");
}
