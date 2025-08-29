import sys
import json
import os
from datetime import datetime
from docxtpl import DocxTemplate
from num2words import num2words
from dateutil import parser
import io

# Garante saída UTF-8 para Node.js
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')

def capitalizar_palavras(texto):
    """
    Capitaliza a primeira letra de cada palavra em uma string.
    """
    if not texto:
        return ""
    return ' '.join(word.capitalize() for word in texto.lower().split())

def to_unicode(valor):
    """
    Converte qualquer valor para string Unicode segura.
    """
    if valor is None:
        return ""
    if isinstance(valor, str):
            return valor
    if isinstance(valor, (int, float)):
        return str(valor)
    return str(valor)

def formatar_data(data):
    """
    Converte datas ISO ou objetos datetime para DD/MM/YYYY.
    """
    if not data:
        return "N/D"
    try:
        if isinstance(data, datetime):
            return data.strftime("%d/%m/%Y")
        dt = parser.isoparse(str(data))
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return str(data)

def formatar_escopo_servicos(escopo):
    """
    Formata o texto do escopo de serviços para adicionar espaçamento
    entre os tópicos principais, usando uma quebra de linha dupla.
    """
    if not escopo:
        return ""
    
    titulos = [
        "GESTÃO OPERACIONAL",
        "ATUALIZAÇÃO DE PLANTA",
        "ANALISTA DE PROJETOS"
    ]

    for titulo in titulos:
        escopo = escopo.replace(titulo, f"\n\n{titulo}")

    return escopo.strip()

# Gera contrato DOCX
def gerar_contrato(dados):
    pasta_script = os.path.dirname(os.path.abspath(__file__))

    caminho_base = os.path.join(
        os.path.dirname(os.path.dirname(pasta_script)),
        "models",
        "Contrato_LAAD_2025-RJ.docx"
    )

    if not os.path.exists(caminho_base):
        raise FileNotFoundError(f"Arquivo de modelo não encontrado: {caminho_base}")

    print(f"🔹 Caminho do modelo: {caminho_base}", file=sys.stderr)

    doc = DocxTemplate(caminho_base)

    inicio_realizacao = formatar_data(dados.get("inicio_realizacao"))
    fim_realizacao = formatar_data(dados.get("fim_realizacao"))
    periodo_realizacao = f"DE: {inicio_realizacao} ATÉ: {fim_realizacao}" \
    if inicio_realizacao and fim_realizacao else inicio_realizacao or fim_realizacao or "N/D"

    ano_atual = datetime.now().year
    dia_atual = datetime.now().strftime("%d/%m/%Y")

    valor_total = float(str(dados.get("valor_total", "0")).replace("R$", "").replace(",", ".").strip() or 0)
    reais = int(valor_total)
    centavos = int(round((valor_total - reais) * 100))
    valor_total_extenso = f"{num2words(reais, lang='pt_BR')} reais"
    if centavos > 0:
        valor_total_extenso += f" e {num2words(centavos, lang='pt_BR')} centavos"

    context = {
        "cliente_nome": to_unicode(dados.get("cliente_nome")),
        "forma_pagamento": to_unicode(dados.get("forma_pagamento")),
        "escopo_servicos": formatar_escopo_servicos(to_unicode(dados.get("escopo_servicos"))),
        "cliente_cnpj": to_unicode(dados.get("cliente_cnpj")),
        "cliente_rua": to_unicode(dados.get("cliente_rua")),
        "cliente_numero": to_unicode(dados.get("cliente_numero")),
        "cliente_complemento": to_unicode(dados.get("cliente_complemento")),
        "cliente_cep": to_unicode(dados.get("cliente_cep")),
        "cliente_insc_estadual": to_unicode(dados.get("cliente_insc_estadual")),
        "cliente_responsavel": to_unicode(dados.get("cliente_responsavel")),
        "evento_nome": to_unicode(dados.get("evento_nome")),
        "local_montagem": to_unicode(dados.get("local_montagem")),
        "nm_pavilhao": to_unicode(dados.get("nm_pavilhao")),
        "periodo_marcacao": to_unicode(dados.get("periodo_marcacao")),
        "periodo_montagem": to_unicode(dados.get("periodo_montagem")),
        "periodo_realizacao": periodo_realizacao,
        "periodo_desmontagem": to_unicode(dados.get("periodo_desmontagem")),
        "valor_total": f"R$ {valor_total:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
        "valor_total_extenso": valor_total_extenso,
        "nr_orcamento": to_unicode(dados.get("nr_orcamento")),
        "data_assinatura": formatar_data(dados.get("data_assinatura", dia_atual)),
        "ano_atual": to_unicode(ano_atual),
        "dia_atual": to_unicode(dia_atual),
        # ✅ NOVO: Adiciona as listas de itens categorizados e adicionais
        "itens_categorias": dados.get("itens_categorias", []),
        "adicionais": dados.get("adicionais", []),
        "nomenclatura": to_unicode(dados.get("nomenclatura"))
    }

    doc.render(context)

    pasta_saida = os.path.join(os.path.dirname(pasta_script), "..", "uploads", "contratos")
    os.makedirs(pasta_saida, exist_ok=True)

    nome_arquivo = f"Contrato_{to_unicode(dados.get("nomenclatura"))}_{to_unicode(dados.get('evento_nome', 'Sem Evento'))}_.docx"
    caminho_saida = os.path.join(pasta_saida, nome_arquivo)

    doc.save(caminho_saida)
    print(f"✅ Contrato salvo: {caminho_saida}", file=sys.stderr)
    return caminho_saida

if __name__ == "__main__":
    try:
        dados = json.load(sys.stdin)
        caminho_saida = gerar_contrato(dados)
        print(caminho_saida, flush=True)
        sys.exit(0)
    except Exception as e:
        print(f"❌ Erro no Python: {e}", file=sys.stderr)
        sys.exit(1)