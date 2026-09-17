#!/usr/bin/env node
/**
 * Migra cores hardcoded dos CSS para os tokens semânticos do tema claro/escuro
 * (definidos em public/css/Roots/Roots.css).
 *
 * Por que um script e não na mão: são ~1.300 ocorrências de branco/preto espalhadas
 * por 51 arquivos e 33 mil linhas. Na mão, além de lento, é onde se esquece um
 * `color: #fff` que no modo escuro vira texto invisível.
 *
 * A regra central é que a PROPRIEDADE diz qual token usar:
 *
 *    background: #fff   →  var(--surface-1)
 *    color: #000        →  var(--text-1)
 *    border: 1px #ddd   →  var(--border-1)
 *
 * A exceção que exige olhar o bloco inteiro é `color: #fff` sobre fundo de marca
 * (botão vermelho JA com texto branco). Esse precisa virar var(--on-brand), que é
 * branco nos DOIS temas — se virasse var(--text-1), no escuro o botão vermelho
 * ficaria com texto cinza-claro... e no claro, com texto preto. Por isso o script
 * inspeciona o bloco antes de decidir.
 *
 * Uso:
 *    node scripts/migrar-css-tema.js public/css/index/Main.css          # simulação
 *    node scripts/migrar-css-tema.js --aplicar public/css/index/Main.css
 *
 * Sem --aplicar ele só mostra o diff proposto e a lista de casos duvidosos. Os
 * duvidosos NUNCA são alterados automaticamente: saem no relatório pra revisão.
 */

const fs = require('fs');

const aplicar = process.argv.includes('--aplicar');
const arquivos = process.argv.slice(2).filter(a => a !== '--aplicar');

if (!arquivos.length) {
    console.error('Uso: node scripts/migrar-css-tema.js [--aplicar] <arquivo.css> [...]');
    process.exit(1);
}

// ── Vocabulário de cores ────────────────────────────────────────────────────────
//
// A classificação em si vive em scripts/lib/cores-tema.js, compartilhada com os
// outros migradores. Ela não é uma lista de hex: é calculada a partir de
// luminância e saturação, justamente porque a versão por lista deste script
// deixava cores de fora e convertia só metade de um bloco — fundo escurecia,
// texto não, e o título sumia no tema escuro.
const {
    paraRgb, normalizarHex, luminancia,
    BRANCO, PRETO, CINZA_CLARO, CINZA_BORDA, CINZA_TEXTO, CINZA_APOIO,
    tokenSobreFundo,
} = require('./lib/cores-tema');

// Sinais de que o bloco pinta um fundo de marca — nesse caso o texto branco é
// proposital e precisa continuar branco nos dois temas.
const FUNDO_DE_MARCA = /(background|background-color|background-image)\s*:\s*[^;]*(var\(--primary-color|var\(--background-color|var\(--hover-color|var\(--header-color|var\(--border-color|linear-gradient|var\(--Aproved|var\(--Reject|var\(--Pending)/i;

function temFundoProprio(bloco) {
    return !!corDoFundoProprio(bloco);
}

// Devolve o hex do fundo próprio do bloco (ou null). Saber QUAL é a cor, e não só
// que existe, é o que permite escolher entre texto branco e texto escuro por cima.
function corDoFundoProprio(bloco) {
    const re = /(background|background-color)\s*:\s*[^;]*?(#[0-9a-f]{6}|#[0-9a-f]{3})\b/gi;
    let m;
    while ((m = re.exec(bloco))) {
        const hex = normalizarHex(m[2]);
        if (BRANCO(hex) || CINZA_CLARO(hex)) continue;
        return hex;
    }
    return null;
}

// ── Decisão por declaração ──────────────────────────────────────────────────────

/**
 * Recebe a propriedade, o valor e o bloco inteiro onde a declaração vive.
 * Devolve { valor } com a substituição, { duvida } pra revisão manual, ou null
 * quando não há nada a fazer.
 */
function decidir(prop, valor, bloco) {
    const p = prop.trim().toLowerCase();
    const bruto = valor.trim();
    const cor = normalizarHex(bruto.replace(/\s*!important\s*$/i, ''));
    const importante = /!important\s*$/i.test(bruto) ? ' !important' : '';
    const troca = token => ({ valor: `var(${token})${importante}` });

    // ── Fundos ──────────────────────────────────────────────────────────────
    if (p === 'background' || p === 'background-color') {
        if (BRANCO(cor)) return troca('--surface-1');
        if (CINZA_CLARO(cor)) return troca('--surface-3');
        // Faixa das bordas usada como FUNDO (#e0e0e0, #dadce0): é uma superfície
        // rebaixada, tipo campo desabilitado. --surface-4 é o equivalente escuro.
        if (CINZA_BORDA(cor)) return troca('--surface-4');
        // Cinza médio como fundo = elemento inativo/desabilitado. Antes isso saía
        // como dúvida por medo de estragar o texto branco por cima; --surface-inativo
        // resolve os dois lados, porque escurece no tema escuro e aí o branco volta
        // a contrastar (no claro o valor é o mesmo de hoje, nada muda).
        if (CINZA_APOIO(cor)) return troca('--surface-inativo');
        if (PRETO(cor)) {
            // Fundo preto proposital (faixa de destaque, overlay). Inverter pra
            // branco no modo claro seria pior que deixar como está.
            return { duvida: 'fundo preto — conferir se deve inverter ou é decorativo' };
        }
        return null;
    }

    // ── Texto ───────────────────────────────────────────────────────────────
    //
    // caret-color entra junto com color: é o tracinho piscante do campo de
    // digitação. Estava fixo em `black` na busca do sidebar e no painel de T.I.,
    // ou seja, cursor preto dentro de um campo escuro — invisível. Ninguém
    // percebe lendo o CSS; só ao tentar digitar.
    if (p === 'color' || p === 'caret-color') {
        // O fundo do próprio bloco manda: quando ele é uma cor fixa (marca,
        // status, badge), o texto por cima também tem que ser fixo. Um token que
        // inverte com o tema — --text-1, --text-2 — é exatamente o erro: o fundo
        // #ffcc00 continua amarelo no escuro e o texto vira quase branco por cima,
        // com 1.0:1 de contraste. Escolher entre branco e escuro depende da
        // luminância DAQUELE fundo, não do tema.
        // Caminho inverso do de baixo: o fundo do bloco virou um token de
        // superfície (portanto acompanha o tema), mas o texto ficou preso num
        // --on-brand* de uma passada anterior, quando o fundo ainda era fixo. O
        // par se desfez — --on-brand-escuro sobre --surface-3 dá 1.21:1 no escuro.
        if (/(?:background|background-color)\s*:\s*var\(--surface-[1-4]\)/i.test(bloco)
            && /^var\(--on-brand(-escuro)?\)$/i.test(cor)) {
            return troca('--text-1');
        }

        const fundoFixo = corDoFundoProprio(bloco);
        if (fundoFixo && !CINZA_APOIO(fundoFixo)) {
            // Aceita var(--text-N) como entrada além de hex, pra também consertar
            // o que a versão anterior deste script já converteu errado.
            const ehTextoConvertido = /^var\(--text-[123]\)$/i.test(cor);
            if (BRANCO(cor) || PRETO(cor) || CINZA_TEXTO(cor) || CINZA_APOIO(cor) || ehTextoConvertido) {
                const token = tokenSobreFundo(fundoFixo);
                return cor === `var(${token})` ? null : troca(token);
            }
            return null;
        }

        if (BRANCO(cor)) {
            if (FUNDO_DE_MARCA.test(bloco)) return troca('--on-brand');
            // Texto branco sem fundo declarado no mesmo bloco: quase sempre é
            // herdeiro de um fundo colorido do pai (item de menu dentro do header,
            // por exemplo). Trocar por --text-1 deixaria invisível no tema claro.
            return { duvida: 'texto branco sem fundo no mesmo bloco — provável --on-brand, conferir o pai' };
        }
        if (PRETO(cor)) return troca('--text-1');
        if (CINZA_TEXTO(cor)) {
            // Um #333 é o texto principal; um #888 é legenda. A fronteira em 90 de
            // luminância separa os dois — sem isso, toda legenda cinza virava texto
            // de primeira linha e a hierarquia da tela achatava.
            const rgb = paraRgb(cor);
            return troca(luminancia(rgb) <= 90 ? '--text-1' : '--text-2');
        }
        if (CINZA_APOIO(cor)) return troca('--text-3');
        return null;
    }

    // ── Bordas ──────────────────────────────────────────────────────────────
    if (p.startsWith('border') || p === 'outline' || p === 'outline-color') {
        if (CINZA_BORDA(cor) || CINZA_CLARO(cor)) return troca('--border-1');
        if (CINZA_APOIO(cor) || PRETO(cor)) return troca('--border-2');
        if (BRANCO(cor)) {
            return { duvida: 'borda branca — normalmente separa elementos sobre cor de marca' };
        }
        return null;
    }

    return null;
}

// ── Varredura ───────────────────────────────────────────────────────────────────

// Casa "propriedade: valor" até o `;` ou `}`.
//
// Note que o início da declaração NÃO é ancorado em `;`/`{`: uma primeira versão
// fazia isso e perdia metade das ocorrências. O motivo é sutil — com /g, o match
// consome o `;` que o separa da declaração anterior, então a declaração SEGUINTE
// já não tem `;` disponível pra casar e passa batida, alternadamente. Sem âncora
// o risco de falso positivo é baixo: `decidir()` só reage a um punhado de
// propriedades conhecidas, e o lookahead exige que a declaração feche em `;`/`}`
// (o que descarta seletores com pseudo-classe e condições de @media).
const RE_DECLARACAO = /([a-z-]+)\s*:\s*([^;{}]+?)\s*(?=[;}])/gi;
const RE_BORDA = /(border[a-z-]*)\s*:\s*([^;{}]*?)\s*(?=[;}])/gi;

// Esconde trechos `var(--algo)` antes de procurar nomes de cor dentro de um valor.
// Sem isso, o `black` de `var(--black-color)` é lido como a cor preta e o script
// gera `var(--var(--border-2)-color)`.
function mascararVars(valor) {
    return valor.replace(/var\([^)]*\)/gi, m => ' '.repeat(m.length));
}

// Recorta o bloco { ... } que contém a posição informada. Serve pra dar contexto
// à decisão (o bloco tem fundo de marca?).
function blocoEm(css, pos) {
    const abre = css.lastIndexOf('{', pos);
    if (abre === -1) return '';
    const fecha = css.indexOf('}', pos);
    return css.slice(abre, fecha === -1 ? css.length : fecha);
}

function processar(caminho) {
    const original = fs.readFileSync(caminho, 'utf8');
    const trocas = [];
    const duvidas = [];

    // Passo 1: declarações de cor única (background: #fff, color: #333).
    let saida = original.replace(RE_DECLARACAO, (match, prop, valor, offset) => {
        // Só declarações de cor única; compostas caem no passo de border/shadow.
        if (/\s/.test(valor.replace(/\s*!important\s*$/i, '').trim())) return match;
        const r = decidir(prop, valor, blocoEm(original, offset));
        if (!r) return match;
        if (r.duvida) {
            duvidas.push({ linha: linhaDe(original, offset), texto: `${prop}: ${valor}`, motivo: r.duvida });
            return match;
        }
        trocas.push({ linha: linhaDe(original, offset), de: `${prop}: ${valor}`, para: `${prop}: ${r.valor}` });
        return `${prop}: ${r.valor}`;
    });

    // Passo 2: bordas compostas (border: 1px solid #ddd).
    saida = saida.replace(RE_BORDA, (match, prop, valor) => {
        const m = mascararVars(valor).match(/(#[0-9a-f]{3,8}|\bwhite\b|\bblack\b)/i);
        if (!m) return match;
        const cor = normalizarHex(m[1]);
        let token = null;
        if (CINZA_BORDA(cor) || CINZA_CLARO(cor)) token = '--border-1';
        else if (CINZA_APOIO(cor) || PRETO(cor)) token = '--border-2';
        if (!token) return match;
        const novo = valor.slice(0, m.index) + `var(${token})` + valor.slice(m.index + m[1].length);
        trocas.push({ linha: '~', de: `${prop}: ${valor}`, para: `${prop}: ${novo}` });
        return `${prop}: ${novo}`;
    });

    // Passo 2b: gradientes de fundo cinza (`linear-gradient(to right, #f3f4f6,
    // #e5e7eb)`). Não são valor único, então escapavam do passo 1 e ficavam
    // brancos no tema escuro. Só convertidos quando TODAS as paradas são cinza:
    // num gradiente colorido as cores são a identidade do elemento.
    saida = saida.replace(/(linear-gradient|radial-gradient)\(([^()]*)\)/gi, (match, tipo, dentro) => {
        const hexes = dentro.match(/#[0-9a-f]{3,6}\b/gi);
        if (!hexes || !hexes.length) return match;
        const claros = hexes.map(normalizarHex).filter(h => BRANCO(h) || CINZA_CLARO(h) || CINZA_BORDA(h));
        if (claros.length !== hexes.length) return match;

        let i = 0;
        const novoDentro = dentro.replace(/#[0-9a-f]{3,6}\b/gi, h => {
            const c = normalizarHex(h);
            // Mantém o degradê: a parada mais clara vira a superfície mais clara.
            const token = BRANCO(c) ? '--surface-1' : CINZA_CLARO(c) ? '--surface-3' : '--surface-4';
            i++;
            return `var(${token})`;
        });
        trocas.push({ linha: '~', de: match, para: `${tipo}(${novoDentro})` });
        return `${tipo}(${novoDentro})`;
    });

    // Passo 3: sombras pretas translúcidas — as opacidades certas pra cada tema já
    // estão nos tokens, então a cor inteira é substituída.
    saida = saida.replace(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.\d+\s*\)/gi, m => {
        trocas.push({ linha: '~', de: m, para: 'var(--shadow-1)' });
        return 'var(--shadow-1)';
    });

    return { original, saida, trocas, duvidas };
}

function linhaDe(texto, offset) {
    return texto.slice(0, offset).split('\n').length;
}

// ── Execução ────────────────────────────────────────────────────────────────────

let totalTrocas = 0;
let totalDuvidas = 0;

for (const caminho of arquivos) {
    const { original, saida, trocas, duvidas } = processar(caminho);
    totalTrocas += trocas.length;
    totalDuvidas += duvidas.length;

    console.log(`\n=== ${caminho} ===`);
    console.log(`${trocas.length} substituições, ${duvidas.length} para revisão manual`);

    if (duvidas.length) {
        console.log('\n  Revisar à mão:');
        for (const d of duvidas) console.log(`    linha ${d.linha}: ${d.texto}  → ${d.motivo}`);
    }

    if (aplicar && saida !== original) {
        fs.writeFileSync(caminho, saida, 'utf8');
        console.log('\n  ✔ arquivo atualizado');
    }
}

console.log(`\n──────────────────────────────────────────`);
console.log(`Total: ${totalTrocas} substituições, ${totalDuvidas} para revisão manual`);
if (!aplicar) console.log('Simulação — nada foi gravado. Use --aplicar para gravar.');
