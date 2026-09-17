#!/usr/bin/env node
/**
 * Procura, sem abrir o navegador, os pares de cor que quebram no tema escuro:
 * texto escuro sobre fundo escuro, texto claro sobre fundo claro, e "ilhas"
 * brancas que sobraram no meio de uma tela escura.
 *
 * Por que isso existe: a migração pra tokens converte uma declaração de cada vez.
 * Quando ela acerta o `background` de um bloco mas erra (ou não reconhece) o
 * `color` dele, o resultado não é um erro de CSS — é um título que simplesmente
 * some da tela. Nada no build acusa isso, e revisar 33 mil linhas no olho não
 * escala. O script resolve as variáveis do Roots.css nos dois temas, refaz a
 * conta de contraste da WCAG e lista o que ficaria ilegível.
 *
 * Uso:
 *    node scripts/auditar-contraste-tema.js                    # todos os CSS
 *    node scripts/auditar-contraste-tema.js public/css/index/Main.css
 *
 * Limite conhecido: só avalia blocos que declaram fundo E texto juntos. Um bloco
 * que só tem `color` herda o fundo de um ancestral que o CSS sozinho não revela
 * — esses saem na seção "ilhas claras" quando o fundo é o suspeito.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ROOTS = path.join(RAIZ, 'public/css/Roots/Roots.css');
const DIR_CSS = path.join(RAIZ, 'public/css');

// Abaixo disso o texto deixa de ser confortavelmente legível. A WCAG pede 4.5
// pra texto normal; 3.0 é o piso pra texto grande e o ponto em que uma falha
// vira visível a olho nu, que é o que interessa aqui.
const CONTRASTE_MINIMO = 3.0;

// ── Cor ─────────────────────────────────────────────────────────────────────────

const NOMES = {
    white: '#ffffff', black: '#000000', whitesmoke: '#f5f5f5', gray: '#808080',
    grey: '#808080', red: '#ff0000', transparent: null, inherit: null,
};

function paraRgb(cor) {
    if (!cor) return null;
    const c = String(cor).trim().toLowerCase();
    if (c in NOMES) return NOMES[c] ? paraRgb(NOMES[c]) : null;
    let hex = null;
    if (/^#[0-9a-f]{3}$/.test(c)) hex = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    else if (/^#[0-9a-f]{6}$/.test(c)) hex = c;
    if (hex) return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const m = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?/);
    if (m) {
        // Cor translúcida não dá pra avaliar sem saber o que está atrás dela.
        if (m[4] !== undefined && parseFloat(m[4]) < 0.85) return null;
        return [+m[1], +m[2], +m[3]];
    }
    return null;
}

// Luminância relativa da WCAG (com a correção de gama), não a média dos canais.
function luminanciaRelativa(rgb) {
    const [r, g, b] = rgb.map(v => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(rgb1, rgb2) {
    const a = luminanciaRelativa(rgb1);
    const b = luminanciaRelativa(rgb2);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ── Variáveis do tema ───────────────────────────────────────────────────────────

// Lê os blocos do Roots.css e monta dois dicionários de variáveis: um com o tema
// claro, outro com o escuro aplicado por cima.
function lerVariaveis() {
    // Os comentários saem ANTES do parse. Sem isso o bloco de comentário que
    // precede `:root` entra junto no "seletor", e como ele explica o tema escuro
    // (a string data-theme="dark" aparece no texto), o :root dos tokens CLAROS
    // era classificado como escuro — o tema claro ficava sem nenhuma variável e
    // o auditor comparava os dois temas com os mesmos valores.
    const css = fs.readFileSync(ROOTS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const claro = {};
    const escuro = {};

    const blocos = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    for (const [, seletorBruto, corpo] of blocos) {
        const seletor = seletorBruto.trim();
        const ehDark = seletor.includes('[data-theme="dark"]');
        // A empresa JA-OPER entra como representante das cores de marca: todas as
        // onze definem as mesmas variáveis, mudando só os valores.
        const ehBase = seletor === ':root' || seletor === '.tema-JA-OPER';
        if (!ehDark && !ehBase) continue;

        for (const [, nome, valor] of corpo.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/gi)) {
            const v = valor.trim();
            if (ehDark) escuro[nome] = v;
            else { claro[nome] = v; if (!(nome in escuro)) escuro[nome] = v; }
        }
    }
    // Um token só definido no bloco escuro (nenhum hoje, mas nada impede) não pode
    // faltar no claro, senão o auditor reportaria falso positivo lá.
    for (const k of Object.keys(escuro)) if (!(k in claro)) claro[k] = escuro[k];
    return { claro, escuro };
}

// Resolve var(--x, fallback) até chegar numa cor literal.
function resolver(valor, vars, profundidade = 0) {
    if (!valor || profundidade > 10) return null;
    let v = String(valor).trim();

    const m = v.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/i);
    if (m) {
        const alvo = vars[m[1]];
        if (alvo !== undefined) return resolver(alvo, vars, profundidade + 1);
        if (m[2]) return resolver(m[2], vars, profundidade + 1);
        return null;
    }
    return paraRgb(v);
}

// ── Varredura dos blocos ────────────────────────────────────────────────────────

function blocosDe(css) {
    // Ignora @media/@keyframes como agrupadores, mas mantém as regras de dentro:
    // remover só a linha do @ deixa os blocos internos visíveis ao matcher.
    const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '');
    return [...limpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .map(m => ({ seletor: m[1].trim().replace(/\s+/g, ' '), corpo: m[2], indice: m.index }))
        .filter(b => b.seletor && !b.seletor.startsWith('@') && !/^\d+%$/.test(b.seletor));
}

function declaracao(corpo, props) {
    let achado = null;
    for (const [, prop, valor] of corpo.matchAll(/([a-z-]+)\s*:\s*([^;]+)/gi)) {
        if (props.includes(prop.trim().toLowerCase())) achado = valor.trim().replace(/\s*!important\s*$/i, '');
    }
    return achado;
}

function linhaDe(texto, offset) {
    return texto.slice(0, offset).split('\n').length;
}

function auditar(caminho, vars) {
    const css = fs.readFileSync(caminho, 'utf8');
    const problemas = [];

    for (const bloco of blocosDe(css)) {
        const bgBruto = declaracao(bloco.corpo, ['background', 'background-color']);
        const corBruta = declaracao(bloco.corpo, ['color']);

        // Gradientes e imagens não têm uma cor só; ficam de fora.
        const bgSimples = bgBruto && !/gradient|url\(/i.test(bgBruto) ? bgBruto.split(/\s+(?![^(]*\))/)[0] : null;

        const linha = linhaDe(css, bloco.indice);

        for (const tema of ['claro', 'escuro']) {
            const dicionario = vars[tema === 'claro' ? 'claro' : 'escuro'];
            const bg = resolver(bgSimples, dicionario);
            const fg = resolver(corBruta, dicionario);

            if (bg && fg) {
                const razao = contraste(bg, fg);
                if (razao < CONTRASTE_MINIMO) {
                    problemas.push({
                        tipo: 'contraste', tema, linha, seletor: bloco.seletor,
                        detalhe: `${corBruta} sobre ${bgSimples} = ${razao.toFixed(2)}:1`,
                    });
                }
            }
        }

        // Ilha clara: fundo que continua claro no tema escuro. Só acusa quando o
        // valor é literal — se veio de um token, ele já acompanha o tema.
        if (bgSimples && !/var\(/.test(bgSimples)) {
            const rgb = paraRgb(bgSimples);
            if (rgb && luminanciaRelativa(rgb) > 0.55) {
                problemas.push({
                    tipo: 'ilha-clara', tema: 'escuro', linha, seletor: bloco.seletor,
                    detalhe: `fundo ${bgSimples} fixo — continua claro no tema escuro`,
                });
            }
        }
    }
    return problemas;
}

// ── Execução ────────────────────────────────────────────────────────────────────

function listarCss(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? listarCss(p) : (e.name.endsWith('.css') ? [p] : []);
    });
}

const alvos = process.argv.slice(2).length ? process.argv.slice(2) : listarCss(DIR_CSS);
const vars = lerVariaveis();

let totalContraste = 0;
let totalIlhas = 0;

for (const caminho of alvos) {
    const problemas = auditar(caminho, vars);
    if (!problemas.length) continue;

    const contrastes = problemas.filter(p => p.tipo === 'contraste');
    const ilhas = problemas.filter(p => p.tipo === 'ilha-clara');
    totalContraste += contrastes.length;
    totalIlhas += ilhas.length;

    console.log(`\n=== ${path.relative(RAIZ, caminho).replace(/\\/g, '/')} ===`);
    for (const p of contrastes) {
        console.log(`  [${p.tema}] linha ${p.linha}: ${p.seletor}`);
        console.log(`      ${p.detalhe}`);
    }
    for (const p of ilhas) {
        console.log(`  [ilha]  linha ${p.linha}: ${p.seletor}`);
        console.log(`      ${p.detalhe}`);
    }
}

console.log(`\n──────────────────────────────────────────`);
console.log(`${totalContraste} par(es) de contraste insuficiente, ${totalIlhas} ilha(s) clara(s).`);
