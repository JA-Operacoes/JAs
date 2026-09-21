/**
 * Classificação de cores compartilhada pelos scripts de migração do tema
 * claro/escuro (migrar-css-tema.js, migrar-js-tema.js, migrar-pastel-status.js).
 *
 * Isso mora num módulo só de propósito. A primeira versão tinha as regras
 * copiadas em cada script, e elas divergiram: um reconhecia #f1f3f4 como cinza
 * claro e o outro não, o que produziu blocos com fundo convertido e texto não
 * convertido — título invisível no tema escuro. Regra de cor nova entra AQUI.
 *
 * O critério nunca é uma lista de hex (elas ficam desatualizadas na primeira cor
 * nova que alguém escrever). É calculado a partir de luminância e saturação.
 */

const NOMES = {
    white: '#ffffff', black: '#000000', whitesmoke: '#f5f5f5',
    gray: '#808080', grey: '#808080',
};

function paraRgb(cor) {
    if (!cor) return null;
    const c = String(cor).trim().toLowerCase();
    if (NOMES[c]) return paraRgb(NOMES[c]);
    let hex = null;
    if (/^#[0-9a-f]{3}$/.test(c)) hex = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    else if (/^#[0-9a-f]{6}$/.test(c)) hex = c;
    if (hex) return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    return null;
}

function normalizarHex(cor) {
    const c = String(cor).trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(c)) return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    return c;
}

// Luminância percebida, 0 a 255. O verde pesa mais que o azul porque o olho é
// mais sensível a ele — não é a média dos três canais.
function luminancia(rgb) {
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function amplitude(rgb) {
    return Math.max(...rgb) - Math.min(...rgb);
}

// Saturação no modelo HSL. Serve pra distinguir um cinza de interface de uma cor
// de status: num tom muito claro, uma diferença pequena entre canais já é cor
// saturada, e a amplitude bruta sozinha não enxerga isso.
function saturacao(rgb) {
    const max = Math.max(...rgb);
    const min = Math.min(...rgb);
    if (max === min) return 0;
    const soma = max + min;
    return (max - min) / (soma > 255 ? 510 - soma : soma);
}

// Cinza = superfície neutra (converte para token de superfície/texto).
// Colorido = decoração ou status (não converte, o matiz é a informação).
//
// O corte em 0.30 é o vão mais largo entre os dois grupos reais deste projeto:
// os cinzas de interface vão até ~0.28 (#1f2937, #cbd5e1) e as cores de status
// começam em ~0.41 (#d4edda, o verde de sucesso).
function ehCinza(rgb) {
    return amplitude(rgb) <= 26 && saturacao(rgb) <= 0.30;
}

function BRANCO(cor) {
    const rgb = paraRgb(cor);
    return !!rgb && ehCinza(rgb) && luminancia(rgb) >= 250;
}

function PRETO(cor) {
    const rgb = paraRgb(cor);
    return !!rgb && ehCinza(rgb) && luminancia(rgb) <= 12;
}

// Cinza quase-branco de fundo de apoio: faixa zebrada, cabeçalho de tabela, área
// rebaixada. A segunda condição cobre os quase-brancos COM um respiro de cor
// (#f7f2ee bege, #f4f7ff azulado): pelo critério de saturação não são cinza, mas
// na tela passam por branco — são superfície, não status.
function CINZA_CLARO(cor) {
    const rgb = paraRgb(cor);
    if (!rgb) return false;
    const lum = luminancia(rgb);
    if (lum < 228 || lum >= 250) return false;
    return ehCinza(rgb) || amplitude(rgb) <= 14;
}

// Faixa das bordas e divisórias (#ccc, #ddd, #dadce0, #e0e0e0).
function CINZA_BORDA(cor) {
    const rgb = paraRgb(cor);
    return !!rgb && ehCinza(rgb) && luminancia(rgb) >= 190 && luminancia(rgb) < 228;
}

// Cinza escuro o bastante pra ser texto sobre fundo claro (#333, #202124, #666).
function CINZA_TEXTO(cor) {
    const rgb = paraRgb(cor);
    return !!rgb && ehCinza(rgb) && luminancia(rgb) > 12 && luminancia(rgb) <= 150;
}

// Cinza médio (#888, #999, #aaa, #9ca3af): como texto é legenda apagada, como
// borda é divisória forte, como fundo é elemento inativo.
function CINZA_APOIO(cor) {
    const rgb = paraRgb(cor);
    return !!rgb && ehCinza(rgb) && luminancia(rgb) > 150 && luminancia(rgb) < 190;
}

// Qual token de texto FIXO usar por cima de um fundo que não muda com o tema.
// Um #ffcc00 é claro e pede texto escuro; um #c8102e é escuro e pede branco.
function tokenSobreFundo(hexFundo) {
    const rgb = paraRgb(hexFundo);
    if (!rgb) return '--on-brand';
    return luminancia(rgb) >= 140 ? '--on-brand-escuro' : '--on-brand';
}

module.exports = {
    paraRgb, normalizarHex, luminancia, amplitude, saturacao, ehCinza,
    BRANCO, PRETO, CINZA_CLARO, CINZA_BORDA, CINZA_TEXTO, CINZA_APOIO,
    tokenSobreFundo,
};
