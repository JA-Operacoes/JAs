#!/usr/bin/env node
/**
 * Converte as cores hardcoded dos estilos INLINE gerados em JavaScript.
 *
 * Boa parte das telas deste sistema não é HTML estático: Main.js monta os painéis
 * com template strings e `style="background:#fff;color:#333"` embutido. Esse
 * estilo inline vence qualquer CSS, então migrar só os arquivos .css deixa faixas
 * brancas no meio da tela escura — é de onde vêm a barra de filtros e as linhas
 * de evento que continuam claras no tema escuro.
 *
 * Um `style` inline aceita var() normalmente, então a conversão é a mesma dos
 * CSS: a propriedade decide o token, e a classificação vem de lib/cores-tema.js.
 *
 * O que ele NÃO faz, de propósito:
 *   - Não toca em cor interpolada (`background:${cor}`): o valor vem de lógica.
 *   - Não toca em cor de status/marca (vermelho, verde, azul). Só neutros.
 *   - Não toca em `color` sobre fundo colorido no mesmo style (fica --on-brand).
 *
 * Uso:
 *    node scripts/migrar-js-tema.js public/js/Main.js            # simulação
 *    node scripts/migrar-js-tema.js --aplicar public/js/Main.js
 */

const fs = require('fs');
const {
    normalizarHex, luminancia, paraRgb,
    BRANCO, PRETO, CINZA_CLARO, CINZA_BORDA, CINZA_TEXTO, CINZA_APOIO,
    tokenSobreFundo,
} = require('./lib/cores-tema');

const aplicar = process.argv.includes('--aplicar');
const arquivos = process.argv.slice(2).filter(a => a !== '--aplicar');

if (!arquivos.length) {
    console.error('Uso: node scripts/migrar-js-tema.js [--aplicar] <arquivo.js> [...]');
    process.exit(1);
}

const COR = String.raw`#[0-9a-fA-F]{3,6}|\bwhite\b|\bblack\b|\bwhitesmoke\b|rgba?\([^)]*\)`;

// Decide o token de uma declaração dentro de um bloco de estilo inline.
// `temFundoColorido` diz se o MESMO style pinta um fundo que não muda com o tema.
function decidir(prop, valor, fundoFixo) {
    const p = prop.trim().toLowerCase();
    const cor = normalizarHex(valor);

    if (p === 'background' || p === 'background-color') {
        if (BRANCO(cor)) return '--surface-1';
        if (CINZA_CLARO(cor)) return '--surface-3';
        if (CINZA_BORDA(cor)) return '--surface-4';
        if (CINZA_APOIO(cor)) return '--surface-inativo';
        return null; // preto e cores de status ficam como estão
    }

    if (p === 'color') {
        // Texto sobre um fundo que não inverte precisa de cor fixa também, senão
        // fica claro por cima de um fundo que continuou claro.
        //
        // Aqui o token preserva a POLARIDADE que o desenvolvedor escolheu, em vez
        // de recalcular pela luminância do fundo como o migrador de CSS faz. A
        // diferença importa: recalculando, um `color:white` sobre um fundo claro
        // virava --on-brand-escuro, ou seja, o script trocava a cor do texto por
        // conta própria. Num style inline não há cascata pra conferir a intenção,
        // então o certo é só congelar o que já está lá.
        if (fundoFixo) {
            if (BRANCO(cor)) return '--on-brand';
            if (PRETO(cor) || CINZA_TEXTO(cor)) return '--on-brand-escuro';
            return null;
        }
        if (PRETO(cor)) return '--text-1';
        if (CINZA_TEXTO(cor)) return luminancia(paraRgb(cor)) <= 90 ? '--text-1' : '--text-2';
        if (CINZA_APOIO(cor)) return '--text-3';
        // Branco sem fundo declarado no mesmo style: quase sempre herda um fundo
        // colorido do elemento pai. Trocar cegaria o tema claro.
        return null;
    }

    if (p.startsWith('border')) {
        if (CINZA_BORDA(cor) || CINZA_CLARO(cor)) return '--border-1';
        if (CINZA_APOIO(cor) || PRETO(cor)) return '--border-2';
        return null;
    }

    return null;
}

// Converte o conteúdo de um bloco de estilo ("background:#fff; color:#333").
function converterEstilo(estilo, trocas, onde) {
    // Cor vinda de interpolação fica fora: `${opt.color}` é decidido em runtime.
    const temInterpolacao = /\$\{/.test(estilo);

    let fundoFixo = null;
    const mFundo = estilo.match(new RegExp(String.raw`(?:^|;)\s*background(?:-color)?\s*:\s*(${COR})`, 'i'));
    if (mFundo) {
        const hex = normalizarHex(mFundo[1]);
        if (!BRANCO(hex) && !CINZA_CLARO(hex) && !CINZA_BORDA(hex) && !CINZA_APOIO(hex)) fundoFixo = hex;
    }

    return estilo.replace(
        new RegExp(String.raw`(^|;)(\s*)([a-zA-Z-]+)(\s*:\s*)(${COR})`, 'g'),
        (m, pre, esp1, prop, sep, valor) => {
            if (temInterpolacao && /\$\{/.test(valor)) return m;
            const token = decidir(prop, valor, fundoFixo);
            if (!token) return m;
            trocas.push({ onde, de: `${prop}:${valor}`, para: `${prop}:var(${token})` });
            return `${pre}${esp1}${prop}${sep}var(${token})`;
        }
    );
}

function processar(caminho) {
    const original = fs.readFileSync(caminho, 'utf8');
    const trocas = [];
    let saida = original;

    // Forma 1: atributo style="..." dentro de template string ou HTML.
    saida = saida.replace(/style\s*=\s*(["'`])([^"'`]*?)\1/g, (m, aspas, conteudo) => {
        if (!/[:;]/.test(conteudo)) return m;
        const novo = converterEstilo(conteudo, trocas, 'style="..."');
        return novo === conteudo ? m : `style=${aspas}${novo}${aspas}`;
    });

    // Forma 2: elemento.style = "..." (atribuição do cssText inteiro).
    saida = saida.replace(/(\.style\s*=\s*)(["'`])([^"'`]*?)\2/g, (m, atrib, aspas, conteudo) => {
        if (!/[:;]/.test(conteudo)) return m;
        const novo = converterEstilo(conteudo, trocas, '.style = "..."');
        return novo === conteudo ? m : `${atrib}${aspas}${novo}${aspas}`;
    });

    // Forma 3: elemento.style.background = "#fff" (uma propriedade por vez).
    saida = saida.replace(
        new RegExp(String.raw`(\.style\.)([a-zA-Z]+)(\s*=\s*)(["'])(${COR})\4`, 'g'),
        (m, pre, propJs, sep, aspas, valor) => {
            // backgroundColor → background-color
            const prop = propJs.replace(/([A-Z])/g, '-$1').toLowerCase();
            const token = decidir(prop, valor, null);
            if (!token) return m;
            trocas.push({ onde: '.style.' + propJs, de: valor, para: `var(${token})` });
            return `${pre}${propJs}${sep}${aspas}var(${token})${aspas}`;
        }
    );

    return { original, saida, trocas };
}

let total = 0;
for (const caminho of arquivos) {
    const { original, saida, trocas } = processar(caminho);
    total += trocas.length;
    if (!trocas.length) continue;

    const resumo = {};
    for (const t of trocas) {
        const k = `${t.de} → ${t.para}`;
        resumo[k] = (resumo[k] || 0) + 1;
    }

    console.log(`\n=== ${caminho} ===`);
    console.log(`${trocas.length} substituições:`);
    Object.entries(resumo).sort((a, b) => b[1] - a[1])
        .forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}x  ${k}`));

    if (aplicar && saida !== original) {
        fs.writeFileSync(caminho, saida, 'utf8');
        console.log('  ✔ arquivo atualizado');
    }
}

console.log(`\n──────────────────────────────────────────`);
console.log(`Total: ${total} substituição(ões) em estilo inline.`);
if (!aplicar) console.log('Simulação — nada foi gravado. Use --aplicar para gravar.');
