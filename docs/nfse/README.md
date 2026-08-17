# NFS-e São Paulo — material de referência

Base técnica oficial usada pra construir `utils/gerarXmlRpsLote.js` e a tela
de Emissão de Nota Fiscal. Guardado aqui (em vez de só um link) porque a
prefeitura já atualizou esses arquivos mais de uma vez desde que a Reforma
Tributária começou (Ago/2025 em diante) — se o link mudar de novo, a cópia
que validamos continua aqui.

## Arquivos

- **`Manual_WebService_SP_v3.3.7.pdf`** — Manual de Utilização do Web Service
  da Prefeitura de SP (18/06/2026). Descreve os métodos SOAP (`EnvioLoteRPS`,
  `ConsultaSituacaoLoteRPS`, etc.), a assinatura digital (XMLDSig e a cadeia
  de 85/86 caracteres do `<Assinatura>` de cada RPS — ver ATENÇÃO abaixo) e
  as regras de negócio de cada campo.
  Fonte original: https://notadomilhao.sf.prefeitura.sp.gov.br/wp-content/uploads/2026/05/NFe_Web_Service-v3.3.7.pdf

- **`schemas/`** — os 24 arquivos `.xsd` oficiais do "Layout versão 2"
  (compatível com a Reforma Tributária, em produção desde 14/05/2026).
  `PedidoEnvioLoteRPS_v02.xsd` é o que valida o XML que o sistema gera hoje.
  `RetornoEnvioLoteRPS_v02.xsd` / `RetornoConsulta_v02.xsd` mostram o formato
  da resposta da prefeitura — referência pra quando formos automatizar o
  envio direto (ver checklist).
  Fonte original: https://notadomilhao.sf.prefeitura.sp.gov.br/schemas-reformatributaria-v02-5

## ATENÇÃO — divergência ainda não resolvida

O manual (seção `tpAssinatura`) diz em prosa que a cadeia de assinatura do
RPS "deverá conter 86 posições", mas a soma dos tamanhos de cada campo,
documentados logo abaixo no mesmo bloco, dá **85**. O gerador usa 85 (ver
comentário em `utils/gerarXmlRpsLote.js`, função `montarCadeiaAssinaturaRPS`).
Isso só se confirma de verdade testando contra o ambiente da prefeitura —
está na lista de testes manuais (`checklist-antes-do-automatico.md`).

## Outros documentos desta pasta

- [`checklist-antes-do-automatico.md`](checklist-antes-do-automatico.md) — o
  que precisa ser testado manualmente antes de habilitar o envio direto
  (automático) pro portal.
