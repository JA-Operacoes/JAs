# Checklist — antes de habilitar o envio automático pro portal

O botão de "Enviar direto" reaproveita o mesmo gerador/assinador de XML do
"Baixar XML" manual. Por isso, boa parte da validação abaixo já acontece
naturalmente enquanto o financeiro usa o modo manual — a lista serve pra
deixar explícito o que precisa ter acontecido pelo menos algumas vezes, sem
erro, antes de tirar o humano da conferência.

## 1. Assinatura digital (depende do certificado A1)

- [ ] Confirmar o tamanho real da cadeia de `<Assinatura>` do RPS — 85 ou 86
      caracteres (ver divergência anotada no README desta pasta). Só se
      resolve testando contra o portal (ou homologação, se a prefeitura
      oferecer um ambiente de teste separado do de produção).
- [ ] Confirmar que a assinatura RSA-SHA1 dessa cadeia é aceita (nenhum RPS
      rejeitado por `Assinatura inválida` ou equivalente).
- [ ] Confirmar que o `<ds:Signature>` XMLDSig do envelope inteiro é aceito
      (KeyInfo, algoritmo, canonicalização C14N — ver `xmldsig-core-schema_v02.xsd`).

## 2. Dados de negócio batendo

- [ ] Gerar o XML de uma nota real completa (cliente com inscrição municipal
      preenchida, empresa emissora com CNPJ/inscrição municipal cadastrados)
      e conferir se ISS, IRRF, PIS/COFINS/CSLL, CBS e IBS batem com o que o
      financeiro calcularia manualmente.
- [ ] Conferir se o NBS / CIndOp / Classificação tributária cadastrados em
      Serviços estão corretos pra cada serviço que a empresa realmente presta
      (não só o de teste).
- [ ] Testar nota emitida por mais de uma empresa emissora diferente —
      confirmar que pega o CNPJ/inscrição municipal certos de cada uma.
- [ ] Testar cliente pessoa física (CPF) além de pessoa jurídica (CNPJ).
- [ ] Testar orçamento parcelado e orçamento à vista.

## 3. Upload manual no portal ("Envio de RPS em Lote")

- [ ] Subir o XML gerado pelo sistema manualmente pelo menos 3–5 vezes, com
      dados de notas diferentes, sem nenhuma rejeição.
- [ ] Conferir se o número da nota / dados que saem no portal batem com o
      que o sistema registrou (JA System → "Marcar emitida").
- [ ] Provocar uma rejeição de propósito (ex.: código de serviço errado) e
      confirmar que a mensagem de erro do portal é compreensível — isso
      antecipa que tipo de erro o envio automático vai precisar tratar.

## 4. Só depois disso — construir a automação de verdade

- [x] ~~Implementar a consulta de situação do lote~~ — CORRIGIDO (2026-08-12):
      confirmei lendo o próprio manual (`Manual_WebService_SP_v3.3.7.pdf`,
      seções 3.3.1 e 4.3.3) que "Envio de Lote de RPS" (`EnvioLoteRPS`, o
      serviço que `gerarXmlRpsLote.js` gera hoje) é o serviço **síncrono** —
      devolve o número da NF-e (`RetornoEnvioLoteRPS` → `ChaveNFeRPS` →
      `ChaveNFe.Numero`) na MESMA conexão, sem precisar de consulta depois.
      A consulta de protocolo só existe pro serviço **assíncrono**
      (`EnvioLoteRpsAsync`, seção 4.4) — um serviço SEPARADO e opcional, só
      pra quem manda volumes muito grandes e não precisa do número na hora.
      Não usamos o assíncrono, então essa etapa não é necessária.
- [ ] Implementar a chamada HTTP/SOAP de verdade pro Web Service síncrono
      (`https://nfews.prefeitura.sp.gov.br/lotenfe.asmx` — WSDL público) —
      hoje o sistema só gera o XML assinado, ainda não manda pra prefeitura.
- [ ] Decidir o que o sistema faz quando a prefeitura rejeita o lote pela API
      (deixar a nota num status "Rejeitada" pra corrigir e reenviar, avisar
      quem registrou, etc.).
- [ ] Se a prefeitura tiver um ambiente de homologação separado do de
      produção, rodar tudo lá antes de habilitar em produção.

---

Enquanto os itens acima não estiverem todos marcados, o botão de envio
automático deve continuar visível (pra mostrar que já foi construído) mas
**desabilitado**, com um texto do tipo "Enviar direto (em teste)".
