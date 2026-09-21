// Tema claro/escuro do sistema.
//
// Como funciona, em três camadas:
//
//   1. <html data-theme="light|dark">  — o que o CSS enxerga. Os tokens de
//      superfície/texto/borda vivem em css/Roots/Roots.css.
//   2. localStorage["tema"]            — cache local, lido pelo snippet inline no
//      <head> de cada página ANTES do primeiro paint. Sem ele a tela abre branca e
//      pisca pro escuro (FOUC).
//   3. usuarios.tema no banco          — fonte de verdade. Acompanha o usuário em
//      qualquer máquina; o login já devolve esse valor.
//
// A ordem importa: o snippet pinta na hora com o cache (1+2), e este módulo depois
// confirma com o servidor (3) e corrige se divergir — o que só acontece quando o
// usuário trocou o tema em outro computador.

import { fetchComToken } from "/utils/utils.js";

const CHAVE_CACHE = "tema";
const TEMAS = ["light", "dark"];

function temaValido(valor) {
    return TEMAS.includes(valor) ? valor : null;
}

export function temaAtual() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

// Só mexe no DOM e no cache. Não fala com o servidor — quem salva é alternarTema().
export function aplicarTema(tema) {
    const escolhido = temaValido(tema) || "light";
    document.documentElement.setAttribute("data-theme", escolhido);
    localStorage.setItem(CHAVE_CACHE, escolhido);
    atualizarBotao(escolhido);
    // Bibliotecas de terceiros (ECharts, Select2 e afins) não acompanham variáveis
    // CSS; quem precisar se redesenhar escuta este evento.
    document.dispatchEvent(new CustomEvent("temaAlterado", { detail: { tema: escolhido } }));
    return escolhido;
}

function atualizarBotao(tema) {
    const botao = document.getElementById("btn-tema");
    if (!botao) return;
    const escuro = tema === "dark";
    // Mostra o ícone do DESTINO, não do estado atual: no tema escuro o botão
    // exibe o sol, porque é isso que o clique faz. É a convenção da maioria dos
    // sistemas, e o title logo abaixo tira qualquer dúvida no hover.
    botao.querySelector(".material-symbols-outlined").textContent = escuro ? "light_mode" : "dark_mode";
    botao.title = escuro ? "Mudar para tema claro" : "Mudar para tema escuro";
    botao.setAttribute("aria-label", botao.title);
    botao.setAttribute("aria-pressed", String(escuro));
}

export async function alternarTema() {
    const novo = temaAtual() === "dark" ? "light" : "dark";
    // Aplica primeiro: a troca é instantânea pro usuário mesmo se a rede estiver lenta.
    aplicarTema(novo);
    try {
        await fetchComToken("/auth/tema", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tema: novo })
        });
    } catch (erro) {
        // Falhou salvar: o tema vale nesta máquina (cache), mas não vai seguir o
        // usuário. Não desfaz a troca — seria pior tirar da tela o que ele pediu.
        console.warn("[tema] Não foi possível salvar a preferência no servidor:", erro);
    }
}

// Confirma com o banco o que o cache pintou. Se o usuário trocou o tema em outra
// máquina, é aqui que esta sessão se alinha.
async function sincronizarComServidor() {
    try {
        const dados = await fetchComToken("/auth/tema");
        const doBanco = temaValido(dados?.tema);
        if (doBanco && doBanco !== temaAtual()) aplicarTema(doBanco);
    } catch (erro) {
        console.warn("[tema] Não foi possível ler a preferência do servidor:", erro);
    }
}

// O botão fica no <ul id="menu-horizontal">, junto do sino de notificações — hoje é
// o único agrupamento de ações pessoais do header. Criado por JS pra não ter que
// repetir o mesmo HTML nas 10 páginas de index.
function montarBotao() {
    if (document.getElementById("btn-tema")) return;

    const menu = document.getElementById("menu-horizontal");
    if (!menu) return;

    // Nasce já com o ícone do estado atual em vez de sempre com a lua: criado no
    // claro e corrigido logo depois, o ícone piscaria a cada página aberta por
    // quem usa o tema escuro.
    const escuro = temaAtual() === "dark";

    const wrapper = document.createElement("div");
    wrapper.className = "tema-wrapper";
    wrapper.innerHTML = `
        <button type="button" id="btn-tema" class="btn-tema"
                aria-pressed="${escuro}"
                title="Mudar para tema ${escuro ? "claro" : "escuro"}"
                aria-label="Mudar para tema ${escuro ? "claro" : "escuro"}">
            <span class="material-symbols-outlined">${escuro ? "light_mode" : "dark_mode"}</span>
        </button>`;

    // Antes do sino, pra não empurrar o dropdown de notificações pra fora da tela.
    const sino = menu.querySelector(".notif-wrapper");
    if (sino) menu.insertBefore(wrapper, sino);
    else menu.appendChild(wrapper);

    wrapper.querySelector("#btn-tema").addEventListener("click", alternarTema);
}

function iniciar() {
    // O snippet do <head> já aplicou o cache; isso só cobre página sem o snippet.
    aplicarTema(localStorage.getItem(CHAVE_CACHE) || temaAtual());
    montarBotao();
    atualizarBotao(temaAtual());
    if (localStorage.getItem("token")) sincronizarComServidor();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
} else {
    iniciar();
}

// Duas abas abertas: trocar o tema em uma reflete na outra sem recarregar.
window.addEventListener("storage", (evento) => {
    if (evento.key === CHAVE_CACHE && temaValido(evento.newValue)) {
        aplicarTema(evento.newValue);
    }
});

window.aplicarTemaClaroEscuro = aplicarTema;
