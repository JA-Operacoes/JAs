# Checklist — antes de habilitar o envio automático pro portal

**Atualização 2026-08-21 — mudança de rota:** descobrimos que **não existe upload
manual de arquivo XML** no portal da prefeitura pro layout com CBS/IBS (só "Online"
digitando nota por nota, ou "Web Service") — confirmado pelo próprio aviso da tela
"Envio de RPS em Lote" e por orientação oficial da prefeitura. Isso tornou a seção 3
original (testar via upload manual) inaplicável, e adiantou a construção da automação
(seção 4) — que já está implementada e testada com sucesso de verdade contra o
ambiente real (`TesteEnvioLoteRPS`).

## 1. Assinatura digital (depende do certificado A1) — ✅ RESOLVIDO

- [x] Tamanho da cadeia de `<Assinatura>` do RPS — **não eram 85 nem 86, são 90**
      (confirmado 2026-08-21 testando contra o ambiente real: a prefeitura devolve a
      string que ela mesma verificou quando a assinatura está errada, dava pra
      comparar campo a campo). Faltavam 2 coisas na fórmula documentada em
      `utils/gerarXmlRpsLote.js` (`montarCadeiaAssinaturaRPS`): CCM do prestador com
      **12 dígitos** (não 8), e um dígito indicador de tipo de documento do tomador
      (1=CPF/2=CNPJ) que não existia na cadeia.
- [x] Assinatura RSA-SHA1 da cadeia — aceita, confirmado (erro 1206 sumiu depois da
      correção acima).
- [x] `<ds:Signature>` XMLDSig do envelope — aceito, nenhum problema encontrado.

## 2. Dados de negócio — parcialmente confirmado

- [x] Testado de ponta a ponta com uma nota real (nota #4, JA-EXPO) —
      `TesteEnvioLoteRPS` retornou **sucesso, sem erros nem alertas** depois de
      corrigir: `ValorInicialCobrado` → `ValorFinalCobrado` (campo descontinuado),
      código de serviço com dígito trocado (07191→07161), `MunicipioPrestacao` não
      deve ser enviado pro nosso caso (serviço tributado em SP), `<atvEvento>` com
      endereço do local de montagem (novo, ver `db/migrations/20260821_094227_*`),
      e `AliquotaServicos` em fração decimal (0.025), não percentual (2.5).
- [ ] Testar nota emitida por mais de uma empresa emissora diferente.
- [ ] Testar cliente pessoa física (CPF) além de pessoa jurídica (CNPJ).
- [ ] Testar orçamento parcelado e orçamento à vista.
- [ ] Preencher o endereço (rua/número/bairro/CEP, tela Local de Montagem) de cada
      venue realmente usado — sem isso, `<atvEvento>` fica incompleto e a geração do
      XML falha com erro claro ("Campo obrigatório X está vazio") antes mesmo de
      chegar na prefeitura.

## 3. ~~Upload manual no portal~~ — não se aplica (ver nota do topo)

## 4. Automação — ✅ IMPLEMENTADA E TESTADA COM SUCESSO

- [x] Consulta de situação do lote — não necessária (`EnvioLoteRPS` é síncrono, já
      documentado abaixo desde 2026-08-12).
- [x] Chamada HTTP/SOAP de verdade pro Web Service síncrono
      (`utils/enviarLoteWebService.js`, rota `POST /notafiscal/xml-lote/enviar`) —
      SOAPAction, nome do elemento do pedido (`<Metodo>Request`) e do campo de
      retorno (`RetornoXML`) confirmados contra o WSDL real (não seguem a convenção
      ingênua — foram obtidos baixando o WSDL de verdade com o certificado).
- [x] Tratamento de rejeição pela API — três desfechos possíveis:
      `Emitida` (sucesso), `Rejeitada` (a prefeitura respondeu recusando —
      `mensagemenvio` guarda o motivo por nota) e `Envio Incerto` (falha de
      rede/timeout — nunca tratado como sucesso ou rejeição, precisa conferência
      manual antes de tentar de novo). Ver migration
      `20260821_171348_adiciona_rejeitada_envio_incerto_e_mensagemenvio_em_notasfis.sql`.
- [ ] Ambiente de homologação separado — não existe pra esse fluxo (confirmado: só
      "Online" e "Web Service" pro layout com CBS/IBS, nenhum dos dois documenta uma
      homologação à parte). Testes reais usam `TesteEnvioLoteRPS`, que não substitui
      RPS por NF-e de verdade — é o mais próximo de "homologação" que existe aqui.

---

Restam principalmente os itens da seção 2 (cobertura de cenários — múltiplas
emissoras, CPF, parcelado) antes de considerar o "Enviar direto" pronto pra uso
rotineiro sem supervisão. O botão "Testar envio" (seguro, não substitui nada) deve
continuar sendo o primeiro passo pra qualquer nota/cenário ainda não coberto acima.
