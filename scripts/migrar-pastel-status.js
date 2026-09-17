#!/usr/bin/env node
/**
 * Converte os fundos pastel de status (e o texto colorido por cima deles) para os
 * tokens --status-<familia>-bg / -fg definidos em public/css/Roots/Roots.css.
 *
 * Isso é separado do migrar-css-tema.js de propósito. Aquele script trabalha com
 * cinzas: converte superfície e texto neutros. Estas cores são o oposto — o matiz
 * DELAS é a informação (verde = pago, vermelho = vencido), então não podem virar
 * --surface-N. Mas também não podem ficar fixas: um cartão #e3f5ea no meio de uma
 * tela escura vira uma mancha clara, e o texto verde-escuro por cima some quando
 * o fundo é o único convertido.
 *
 * A regra é converter o PAR. Se um bloco tem fundo pastel, o `color` dele vai
 * junto para o -fg da mesma família, mesmo que a tonalidade não bata exatamente.
 *
 * Uso:
 *    node scripts/migrar-pastel-status.js public/css/index/Main.css
 *    node scripts/migrar-pastel-status.js --aplicar public/css/index/Main.css
 */

const fs = require('fs');

const aplicar = process.argv.includes('--aplicar');
const arquivos = process.argv.slice(2).filter(a => a !== '--aplicar');

if (!arquivos.length) {
    console.error('Uso: node scripts/migrar-pastel-status.js [--aplicar] <arquivo.css> [...]');
    process.exit(1);
}

// ── Cor ─────────────────────────────────────────────────────────────────────────

function paraRgb(hex) {
    const c = hex.trim().toLowerCase();
    const h = /^#[0-9a-f]{3}$/.test(c) ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
    if (!/^#[0-9a-f]{6}$/.test(h)) return null;
    return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
}

function paraHsl([r, g, b]) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
    return [h * 360, s, l];
}

// Em qual família de status esta cor cai. Os limites seguem o círculo cromático;
// o verde tem a faixa mais larga porque engloba do verde-limão ao verde-azulado.
function familia(hue) {
    if (hue < 20 || hue >= 340) return 'erro';    // vermelhos
    if (hue < 45) return 'alerta';                // laranjas
    if (hue < 70) return 'alerta';                // amarelos
    if (hue < 165) return 'ok';                   // verdes
    // A fronteira azul/roxo fica em 240, não nos 260 teóricos: os azuis reais do
    // projeto param em 229 (#e0e7ff) e o lavanda #ede9fe dá 251, que com o corte
    // em 260 era classificado como azul e perdia o roxo do badge de salário.
    if (hue < 240) return 'info';                 // azuis
    return 'roxo';                                // roxos e magentas
}

// Pastel = claro o bastante pra ser fundo, colorido o bastante pra não ser cinza,
// e não tão saturado a ponto de ser um badge vivo tipo #ffcc00 (esses continuam
// como estão; o texto por cima deles já é tratado pelo --on-brand-escuro).
function ehPastel(rgb) {
    const [, s, l] = paraHsl(rgb);
    // A distância absoluta entre os canais entra junto com a saturação HSL porque,
    // num tom quase branco, a saturação sozinha engana: o bege #f7f2ee marca 0.36
    // de saturação mas seus canais distam só 9 — é superfície, não status, e
    // convertê-lo pintava de amarelo uma área que hoje é praticamente branca.
    const amplitude = Math.max(...rgb) - Math.min(...rgb);
    // Não há teto de saturação: num tom muito claro a saturação HSL satura em 1.0
    // por construção (#fff3cd, #e0e7ff), e um teto de 0.95 barrava justamente os
    // pastéis mais típicos. Quem separa pastel de badge vivo é a luminosidade —
    // #ffcc00 tem l=0.50 e nem chega aqui.
    return l >= 0.85 && l <= 0.98 && s >= 0.15 && amplitude >= 14;
}

// Texto colorido escuro — o par natural de um fundo pastel.
function ehTextoColoridoEscuro(rgb) {
    const [, s, l] = paraHsl(rgb);
    return l <= 0.55 && s >= 0.12;
}

// ── Varredura ───────────────────────────────────────────────────────────────────

function processar(caminho) {
    const original = fs.readFileSync(caminho, 'utf8');
    const trocas = [];

    const saida = original.replace(/([^{}]*)\{([^{}]*)\}/g, (bloco, seletor, corpo) => {
        const bg = corpo.match(/(?:^|[;{\s])(background|background-color)\s*:\s*(#[0-9a-f]{3,6})\b/i);

        // Caso sem fundo pastel: o bloco já tem uma superfície que inverte com o
        // tema, mas o texto continua num tom colorido ESCURO (#991b1b, #5c2d91).
        // No claro funciona; no escuro é vinho sobre cinza-escuro, 1.7:1. O texto
        // vai para o -fg da família dele, que clareia junto com o tema.
        if (!bg) {
            const sobreSuperficie = /(?:background|background-color)\s*:\s*var\(--surface-[1-4]\)/i.test(corpo);
            if (!sobreSuperficie) return bloco;

            let mudou = false;
            const corpoNovo = corpo.replace(/(^|[;{\s])(color)\s*:\s*(#[0-9a-f]{3,6})\b/gi, (m, pre, prop, hex) => {
                const rgbTexto = paraRgb(hex);
                if (!rgbTexto || !ehTextoColoridoEscuro(rgbTexto)) return m;
                const fam = familia(paraHsl(rgbTexto)[0]);
                mudou = true;
                trocas.push({ seletor: seletor.trim().replace(/\s+/g, ' ').slice(0, 60), de: hex, para: `--status-${fam}-fg` });
                return `${pre}${prop}: var(--status-${fam}-fg)`;
            });
            return mudou ? `${seletor}{${corpoNovo}}` : bloco;
        }

        const rgbFundo = paraRgb(bg[2]);
        if (!rgbFundo || !ehPastel(rgbFundo)) return bloco;

        const fam = familia(paraHsl(rgbFundo)[0]);
        let novoCorpo = corpo;

        novoCorpo = novoCorpo.replace(
            new RegExp(`((?:background|background-color)\\s*:\\s*)${bg[2]}\\b`, 'gi'),
            `$1var(--status-${fam}-bg)`
        );
        trocas.push({ seletor: seletor.trim().replace(/\s+/g, ' ').slice(0, 60), de: bg[2], para: `--status-${fam}-bg` });

        // O texto do mesmo bloco acompanha o fundo. Sem isso o par se desfaz: o
        // fundo escurece e o texto continua no tom escuro, ilegível por cima dele.
        novoCorpo = novoCorpo.replace(/(^|[;{\s])(color)\s*:\s*(#[0-9a-f]{3,6})\b/gi, (m, pre, prop, hex) => {
            const rgbTexto = paraRgb(hex);
            if (!rgbTexto || !ehTextoColoridoEscuro(rgbTexto)) return m;
            trocas.push({ seletor: seletor.trim().replace(/\s+/g, ' ').slice(0, 60), de: hex, para: `--status-${fam}-fg` });
            return `${pre}${prop}: var(--status-${fam}-fg)`;
        });

        return `${seletor}{${novoCorpo}}`;
    });

    return { original, saida, trocas };
}

let total = 0;
for (const caminho of arquivos) {
    const { original, saida, trocas } = processar(caminho);
    total += trocas.length;
    if (!trocas.length) continue;

    console.log(`\n=== ${caminho} ===`);
    for (const t of trocas) console.log(`  ${t.de} → var(${t.para})   (${t.seletor})`);

    if (aplicar && saida !== original) {
        fs.writeFileSync(caminho, saida, 'utf8');
        console.log('  ✔ arquivo atualizado');
    }
}

console.log(`\n──────────────────────────────────────────`);
console.log(`${total} substituição(ões) de pastel de status.`);
if (!aplicar) console.log('Simulação — nada foi gravado. Use --aplicar para gravar.');
