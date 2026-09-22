const { loadPedidosFunctions } = require("./helpers/loadPedidosFunctions");

// Pipeline do painel "Pedidos e Solicitações" (public/js/Main.js):
// desmembrar → agrupar → ordenar → separar por aba → contar status.
// São funções puras, então dá para testar cada etapa com dados crus do backend.
describe("pipeline de Pedidos (public/js/Main.js)", () => {
  let fns;

  beforeEach(() => {
    fns = loadPedidosFunctions();
  });

  // ── desmembrarPedidosPorStatus ────────────────────────────────────────────
  describe("desmembrarPedidosPorStatus", () => {
    it("quebra uma linha com vários campos de status em um item por campo", () => {
      const itens = fns.desmembrarPedidosPorStatus([
        {
          idpedido: 10,
          funcionario: "João",
          status_aprovacao: "pendente",
          statuscaixinha: JSON.stringify([{ status: "pendente", valor: 150 }]),
          statusmeiadiaria: JSON.stringify([{ status: "pendente" }]),
        },
      ]);

      expect(itens).toHaveLength(2);
      expect(itens.map((i) => i.categoria_item).sort()).toEqual(["statuscaixinha", "statusmeiadiaria"]);
    });

    it("cada item fica só com a própria categoria (as outras são removidas)", () => {
      const [caixinha] = fns.desmembrarPedidosPorStatus([
        {
          idpedido: 11,
          status_aprovacao: "pendente",
          statuscaixinha: JSON.stringify([{ status: "pendente" }]),
          statusmeiadiaria: JSON.stringify([{ status: "pendente" }]),
        },
      ]).filter((i) => i.categoria_item === "statuscaixinha");

      expect(caixinha.statuscaixinha).toBeDefined();
      expect(caixinha.statusmeiadiaria).toBeUndefined();
    });

    it("com a mãe pendente, vale o status de dentro do JSON do campo", () => {
      const [item] = fns.desmembrarPedidosPorStatus([
        {
          idpedido: 12,
          status_aprovacao: "pendente",
          statusdiariadobrada: "x",
          dtdiariadobrada: JSON.stringify([{ status: "autorizado", data: "2026-01-10" }]),
        },
      ]);

      expect(item.status).toBe("autorizado");
      expect(item.status_aprovacao).toBe("autorizado");
    });

    it("com a mãe já decidida, o status dela manda no item", () => {
      const [item] = fns.desmembrarPedidosPorStatus([
        {
          idpedido: 13,
          status_aprovacao: "rejeitado",
          statusdiariadobrada: "x",
          dtdiariadobrada: JSON.stringify([{ status: "pendente", data: "2026-01-10" }]),
        },
      ]);

      expect(item.status).toBe("rejeitado");
      expect(item.dtdiariadobrada[0].status).toBe("rejeitado");
    });

    it("normaliza grafias diferentes do banco para os status canônicos", () => {
      expect(fns.normalizarStatusPedido("Aprovado")).toBe("autorizado");
      expect(fns.normalizarStatusPedido("RECUSADO")).toBe("rejeitado");
      expect(fns.normalizarStatusPedido(" pendente ")).toBe("pendente");
      expect(fns.normalizarStatusPedido(null)).toBe("pendente");
    });

    it("linha sem campo de status só entra se já vier categorizada", () => {
      const itens = fns.desmembrarPedidosPorStatus([
        { idpedido: 14, funcionario: "Sem categoria" },
        { idpedido: 15, funcionario: "Com categoria", categoria_item: "statuscacheliberado" },
      ]);

      expect(itens).toHaveLength(1);
      expect(itens[0].idpedido).toBe(15);
    });
  });

  // ── agruparPedidosPorFuncionario ──────────────────────────────────────────
  describe("agruparPedidosPorFuncionario", () => {
    it("junta num grupo só tudo que tem o mesmo idfuncionario", () => {
      const grupos = fns.agruparPedidosPorFuncionario([
        { idfuncionario: 7, funcionario: "Ana", categoria_item: "statuscaixinha", id_log: 1, nomeSolicitante: "Bia" },
        { idfuncionario: 7, funcionario: "Ana", categoria_item: "statusmeiadiaria", id_log: 2, nomeSolicitante: "Caio" },
      ]);

      expect(grupos).toHaveLength(1);
      expect(grupos[0].registrosOriginais).toHaveLength(2);
    });

    it("lista todos os solicitantes do grupo em nomeSolicitante", () => {
      const [grupo] = fns.agruparPedidosPorFuncionario([
        { idfuncionario: 8, funcionario: "Ana", categoria_item: "statuscaixinha", id_log: 1, nomeSolicitante: "Bia" },
        { idfuncionario: 8, funcionario: "Ana", categoria_item: "statusmeiadiaria", id_log: 2, nomeSolicitante: "Caio" },
      ]);

      expect(grupo.nomeSolicitante).toBe("Bia, Caio");
      expect(grupo.todosSolicitantes).toBeUndefined();
    });

    it("descarta item repetido (mesmo grupo, categoria, id e solicitante)", () => {
      const [grupo] = fns.agruparPedidosPorFuncionario([
        { idfuncionario: 9, funcionario: "Ana", categoria_item: "statuscaixinha", id_log: 3, nomeSolicitante: "Bia" },
        { idfuncionario: 9, funcionario: "Ana", categoria_item: "statuscaixinha", id_log: 3, nomeSolicitante: "Bia" },
      ]);

      expect(grupo.registrosOriginais).toHaveLength(1);
    });

    it("sem idfuncionario, item de função é agrupado pelo rótulo descrição — evento — nome", () => {
      const [grupo] = fns.agruparPedidosPorFuncionario([
        {
          categoria_item: "statusvagaexcedida",
          descFuncao: "Montador",
          evento: "Feira XYZ",
          funcionario: "Ana",
          id_log: 4,
        },
      ]);

      expect(grupo.nmfuncao).toBe("Montador — Feira XYZ — Ana");
    });
  });

  // ── ordenarGruposPorSolicitacaoMaisRecente ────────────────────────────────
  it("ordena os grupos pela solicitação mais recente primeiro", () => {
    const ordenados = fns.ordenarGruposPorSolicitacaoMaisRecente([
      { funcionario: "Antigo", registrosOriginais: [{ criado_em: "2026-01-01" }] },
      { funcionario: "Recente", registrosOriginais: [{ criado_em: "2026-06-01" }] },
    ]);

    expect(ordenados.map((g) => g.funcionario)).toEqual(["Recente", "Antigo"]);
  });

  // ── separarGruposPorAba ───────────────────────────────────────────────────
  describe("separarGruposPorAba", () => {
    const aditivo = (tipoSolicitacao, id) => ({
      categoria_item: "statusvagaexcedida",
      id_log: id,
      statusvagaexcedida: JSON.stringify([{ status: "pendente", tipoSolicitacao }]),
    });

    it("aditivo FUNCEXCEDIDO vai para a aba Funcionários", () => {
      const { funcionarios, funcoes } = fns.separarGruposPorAba([
        { funcionario: "Ana", registrosOriginais: [aditivo("FUNCEXCEDIDO", 1)] },
      ]);

      expect(funcionarios).toHaveLength(1);
      expect(funcoes).toHaveLength(0);
    });

    it("aditivo de vaga (não FUNCEXCEDIDO) vai para a aba Funções", () => {
      const { funcionarios, funcoes } = fns.separarGruposPorAba([
        { funcionario: "Ana", registrosOriginais: [aditivo("VAGAEXCEDIDA", 2)] },
      ]);

      expect(funcionarios).toHaveLength(0);
      expect(funcoes).toHaveLength(1);
    });

    it("pedido comum só aparece na aba Funcionários", () => {
      const { funcionarios, funcoes } = fns.separarGruposPorAba([
        { funcionario: "Ana", registrosOriginais: [{ categoria_item: "statuscaixinha", id_log: 3 }] },
      ]);

      expect(funcionarios).toHaveLength(1);
      expect(funcoes).toHaveLength(0);
    });

    it("grupo sem funcionário não entra na aba Funcionários", () => {
      const { funcionarios } = fns.separarGruposPorAba([
        { funcionario: null, nmfuncao: "Montador", registrosOriginais: [{ categoria_item: "statuscaixinha", id_log: 4 }] },
      ]);

      expect(funcionarios).toHaveLength(0);
    });
  });

  // ── pedidoTemStatus / contarStatusDosGrupos ───────────────────────────────
  describe("contagem de status", () => {
    it("conta o pendente de um campo com aprovação própria mesmo com a mãe autorizada", () => {
      const contagem = fns.contarStatusDosGrupos([
        {
          registrosOriginais: [
            {
              status_aprovacao: "autorizado",
              statusdiariadobrada: JSON.stringify([{ status: "pendente" }]),
            },
          ],
        },
      ]);

      expect(contagem.pendente).toBe(1);
      expect(contagem.autorizado).toBe(1);
    });

    it("combo Extra Bonificado + Diária Dobrada só é autorizado com as duas pontas autorizadas", () => {
      const parcial = {
        isComboExtraDobrada: true,
        dadosBonificado: { status_aprovacao: "autorizado" },
        dadosDobrada: { status_aprovacao: "pendente" },
      };

      expect(fns.pedidoTemStatus(parcial, "autorizado")).toBe(false);
      expect(fns.pedidoTemStatus(parcial, "pendente")).toBe(true);

      const completo = {
        isComboExtraDobrada: true,
        dadosBonificado: { status_aprovacao: "autorizado" },
        dadosDobrada: { status_aprovacao: "autorizado" },
      };
      expect(fns.pedidoTemStatus(completo, "autorizado")).toBe(true);
    });

    it("campos sincronizados com a mãe seguem a decisão dela", () => {
      const pedido = {
        status_aprovacao: "autorizado",
        statusvagaexcedida: JSON.stringify([{ status: "pendente" }]),
      };

      expect(fns.pedidoTemStatus(pedido, "pendente")).toBe(false);
      expect(fns.pedidoTemStatus(pedido, "autorizado")).toBe(true);
    });

    it("grupo vazio devolve os três contadores zerados", () => {
      expect(fns.contarStatusDosGrupos([])).toEqual({ pendente: 0, autorizado: 0, rejeitado: 0 });
    });
  });

  // ── busca ─────────────────────────────────────────────────────────────────
  describe("filtrarGruposPorBusca", () => {
    const grupos = [
      {
        funcionario: "João Silva",
        registrosOriginais: [
          { id_log: 1, nomeSolicitante: "Maria Souza" },
          { id_log: 2, nomeSolicitante: "Carlos Lima" },
        ],
      },
      { funcionario: "Ana Paula", registrosOriginais: [{ id_log: 3, nomeSolicitante: "Maria Souza" }] },
    ];

    it("acha o funcionário ignorando acento e caixa", () => {
      const resultado = fns.filtrarGruposPorBusca(grupos, fns.normalizarTextoBusca("joao"), "");
      expect(resultado).toHaveLength(1);
      expect(resultado[0].funcionario).toBe("João Silva");
    });

    it("busca por solicitante filtra dentro do grupo, não o grupo inteiro", () => {
      const resultado = fns.filtrarGruposPorBusca(grupos, "", fns.normalizarTextoBusca("carlos"));
      expect(resultado).toHaveLength(1);
      expect(resultado[0].registrosOriginais).toHaveLength(1);
      expect(resultado[0].registrosOriginais[0].id_log).toBe(2);
    });

    it("sem termo algum, devolve tudo", () => {
      expect(fns.filtrarGruposPorBusca(grupos, "", "")).toHaveLength(2);
    });
  });

  // ── contagem da pílula da home ────────────────────────────────────────────
  describe("contarPedidosParaResumo (pílula #pedidosPendentes)", () => {
    it("item de custo fechado já autorizado NÃO conta como pendente", () => {
      // Regressão: a contagem antiga só olhava 5 campos de status, então
      // statuscustofechado caía no ramo 'sem categoria' e era contado pelo
      // status da raiz — que segue 'pendente' depois do item ser decidido.
      const contagem = fns.contarPedidosParaResumo([
        {
          idpedido: 1,
          id_log: 1,
          funcionario: "João",
          status_aprovacao: "pendente",
          statuscustofechado: "x",
          vlrcache: JSON.stringify([{ status: "autorizado", valor: 300 }]),
        },
      ]);

      expect(contagem.pendentes).toBe(0);
      expect(contagem.autorizados).toBe(1);
    });

    it("bate com a soma das duas abas do painel", () => {
      const pedidos = [
        {
          idpedido: 2,
          id_log: 2,
          funcionario: "Ana",
          status_aprovacao: "pendente",
          statuscaixinha: JSON.stringify([{ status: "pendente", valor: 100 }]),
        },
        {
          idpedido: 3,
          id_log: 3,
          funcionario: "Bia",
          status_aprovacao: "pendente",
          statusvagaexcedida: JSON.stringify([{ status: "pendente", tipoSolicitacao: "VAGAEXCEDIDA" }]),
        },
      ];

      const grupos = fns.agruparPedidosPorFuncionario(fns.desmembrarPedidosPorStatus(pedidos));
      const { funcionarios, funcoes } = fns.separarGruposPorAba(grupos);
      const esperado =
        fns.contarStatusDosGrupos(funcionarios).pendente + fns.contarStatusDosGrupos(funcoes).pendente;

      expect(fns.contarPedidosParaResumo(pedidos).pendentes).toBe(esperado);
    });

    it("sem pedidos, tudo zerado", () => {
      expect(fns.contarPedidosParaResumo([])).toEqual({
        pendentes: 0,
        autorizados: 0,
        rejeitados: 0,
        totalItens: 0,
      });
    });
  });

  // ── HTML das abas ─────────────────────────────────────────────────────────
  it("o rótulo das abas mostra a quantidade de pendentes", () => {
    const html = fns.montarHtmlPainelPedidos(4, 2);
    expect(html).toContain("Funcionários (4)");
    expect(html).toContain("Funções (2)");
  });
});
