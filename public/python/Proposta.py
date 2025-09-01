import sys
import json
import os
from datetime import datetime
from docxtpl import DocxTemplate
from num2words import num2words
from dateutil import parser
import io
import locale

# Garante saída UTF-8 para Node.js
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')

locale.setlocale(locale.LC_TIME, "Portuguese_Brazil.1252")

def formatar_data_extenso(data):
    if not data:
        return "N/D"
    try:
        if isinstance(data, datetime):
            return data.strftime("%d de %B de %Y")
        dt = parser.isoparse(str(data))
        return dt.strftime("%d de %B de %Y")
    except Exception:
        return str(data)

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

# Gera proposta DOCX
def gerar_proposta(dados):
    pasta_script = os.path.dirname(os.path.abspath(__file__))

    caminho_base = os.path.join(
        os.path.dirname(os.path.dirname(pasta_script)),
        "models",
        "Proposta.docx"
    )

    if not os.path.exists(caminho_base):
        raise FileNotFoundError(f"Arquivo de modelo não encontrado: {caminho_base}")

    print(f"🔹 Caminho do modelo: {caminho_base}", file=sys.stderr)

    doc = DocxTemplate(caminho_base)

    inicio_marcacao = formatar_data(dados.get("inicio_marcacao"))
    fim_marcacao = formatar_data(dados.get("fim_marcacao"))
    periodo_marcacao = f"{inicio_marcacao} ATÉ: {fim_marcacao}" \
    if inicio_marcacao and fim_marcacao else inicio_marcacao or fim_marcacao or "N/D"

    inicio_montagem = formatar_data(dados.get("inicio_montagem"))
    fim_montagem = formatar_data(dados.get("fim_montagem"))
    periodo_montagem = f"{inicio_montagem} ATÉ: {fim_montagem}" \
    if inicio_montagem and fim_montagem else inicio_montagem or fim_montagem or "N/D"

    inicio_realizacao = formatar_data(dados.get("inicio_realizacao"))
    fim_realizacao = formatar_data(dados.get("fim_realizacao"))
    periodo_realizacao = f"{inicio_realizacao} ATÉ: {fim_realizacao}" \
    if inicio_realizacao and fim_realizacao else inicio_realizacao or fim_realizacao or "N/D"

    inicio_desmontagem = formatar_data(dados.get("inicio_desmontagem"))
    fim_desmontagem = formatar_data(dados.get("fim_desmontagem"))
    periodo_desmontagem = f"{inicio_desmontagem} ATÉ: {fim_desmontagem}" \
    if inicio_desmontagem and fim_desmontagem else inicio_desmontagem or fim_desmontagem or "N/D"

    ano_atual = datetime.now().year
    dia_atual = datetime.now().strftime("%d/%m/%Y")

    valor_total = float(str(dados.get("valor_total", "0")).replace("R$", "").replace(",", ".").strip() or 0)
    reais = int(valor_total)
    centavos = int(round((valor_total - reais) * 100))
    valor_total_extenso = f"{num2words(reais, lang='pt_BR')} reais"
    if centavos > 0:
        valor_total_extenso += f" e {num2words(centavos, lang='pt_BR')} centavos"

    context = {
        "adicionais": dados.get("adicionais", []),
        "ano_atual": to_unicode(ano_atual),
        "cliente_celular": to_unicode(dados.get("cliente_celular")),
        "cliente_complemento": to_unicode(dados.get("cliente_complemento")),
        "cliente_cnpj": to_unicode(dados.get("cliente_cnpj")),
        "cliente_email": to_unicode(dados.get("cliente_email")),
        "cliente_insc_estadual": to_unicode(dados.get("cliente_insc_estadual")),
        "cliente_nome": to_unicode(dados.get("cliente_nome")),
        "cliente_numero": to_unicode(dados.get("cliente_numero")),
        "cliente_responsavel": to_unicode(dados.get("cliente_responsavel")),
        "cliente_rua": to_unicode(dados.get("cliente_rua")),
        "cliente_cep": to_unicode(dados.get("cliente_cep")),
        "data_assinatura": formatar_data(dados.get("data_assinatura", dia_atual)),
        "dia_atual": to_unicode(dia_atual),
        "dia_atual_extenso": formatar_data_extenso(dia_atual),
        "escopo_servicos": formatar_escopo_servicos(to_unicode(dados.get("escopo_servicos"))),
        "evento_nome": to_unicode(dados.get("evento_nome")),
        "forma_pagamento": to_unicode(dados.get("forma_pagamento")),
        "itens_categorias": dados.get("itens_categorias", []),
        "local_montagem": to_unicode(dados.get("local_montagem")),
        "nomenclatura": to_unicode(dados.get("nomenclatura")),
        "nr_orcamento": to_unicode(dados.get("nr_orcamento")),
        "periodo_desmontagem": periodo_desmontagem,
        "periodo_marcacao": periodo_marcacao,
        "periodo_montagem": periodo_montagem,
        "periodo_realizacao": periodo_realizacao,
        "pavilhoes": to_unicode(dados.get("pavilhoes", "")),
        "valor_total": f"R$ {valor_total:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
        "valor_total_extenso": valor_total_extenso
    }

    doc.render(context)

    pasta_saida = os.path.join(os.path.dirname(pasta_script), "..", "uploads", "Proposta")
    os.makedirs(pasta_saida, exist_ok=True)

    nome_arquivo = f"Proposta{to_unicode(dados.get("nomenclatura"))}_{to_unicode(dados.get('evento_nome', 'Sem Evento'))}_.docx"
    caminho_saida = os.path.join(pasta_saida, nome_arquivo)

    doc.save(caminho_saida)
    print(f"✅ Proposta salvo: {caminho_saida}", file=sys.stderr)
    return caminho_saida

if __name__ == "__main__":
    try:
        dados = json.load(sys.stdin)
        caminho_saida = gerar_proposta(dados)
        print(caminho_saida, flush=True)
        sys.exit(0)
    except Exception as e:
        print(f"❌ Erro no Python: {e}", file=sys.stderr)
        sys.exit(1)