import sys
import json
import os
from datetime import datetime
from docxtpl import DocxTemplate, RichText
from num2words import num2words
from dateutil import parser
import io
import locale

# Marcadores para RichText
TITLE_MARKER_START = "[[RT_TITLE_START]]"
TITLE_MARKER_END = "[[RT_TITLE_END]]"

# Garante saída UTF-8 para Node.js
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')

# Configura o locale para formatação de data em português
try:
    locale.setlocale(locale.LC_TIME, "pt_BR.utf8")
except locale.Error:
    try:
        locale.setlocale(locale.LC_TIME, "Portuguese_Brazil.1252")
    except locale.Error:
        print("Aviso: Configuração regional de português falhou.", file=sys.stderr)


def format_title_rt(text):
    """
    Cria um objeto RichText com a formatação solicitada (Abel, Negrito, Itálico).
    Força a fonte 'Abel'.
    """
    rt = RichText()
    rt.add(text, font='Abel', bold=True, italic=True) 
    return rt

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

def get_staff_function_name(item_staff_string):
    """
    Extrai o nome limpo da função de staff da string formatada.
    Ex: "1 Fiscal Diurno, (VISTORIA)" -> "Fiscal Diurno"
    """
    name_part = item_staff_string.strip()
    
    if name_part.startswith("• "):
        name_part = name_part[2:]
        
    # Remove tudo após a primeira vírgula (que geralmente marca o início de datas/diárias)
    if "," in name_part:
        # A parte da função pode conter o detalhe de setor, ex: "Atendimento Mono (BOLSÃO)"
        # Precisamos da parte ANTES da primeira vírgula.
        name_part = name_part.split(",")[0].strip()

    # Se o nome da função ainda contém o setor, remove-o para a extração do nome limpo da função
    if "(" in name_part and ")" in name_part:
        # Remove a parte do setor, ex: "Atendimento Mono (BOLSÃO)" -> "Atendimento Mono"
        # O split/strip complexo garante a remoção do setor mantendo o resto.
        parts = name_part.split('(', 1)
        name_part_without_sector = parts[0].strip()
        
        # Agora tentamos remover o número inicial da quantidade (Ex: "1 Fiscal" -> "Fiscal")
        parts = name_part_without_sector.split(' ', 1)
        if len(parts) == 2 and parts[0].isdigit():
            return parts[1].strip()
        
        return name_part_without_sector.strip()
    
    # Tenta remover o número inicial da quantidade (Ex: "1 Fiscal" -> "Fiscal")
    parts = name_part.split(' ', 1)
    if len(parts) == 2 and parts[0].isdigit():
        return parts[1].strip()
    
    return name_part.strip()
    
def formatar_escopo_servicos(escopo):
    """
    Formata o texto do escopo de serviços para adicionar espaçamento
    e marcadores RichText nos tópicos principais.
    """
    if not escopo:
        return ""
    
    # Todos os títulos que precisam da formatação RichText (Abel)
    titulos = [
        "GESTÃO OPERACIONAL",
        "ATUALIZAÇÃO DE PLANTA",
        "ANÁLISE DE PROJETOS VIA SISTEMA",
        "ANALISTA DE PROJETOS"
    ]
    
    # 1. Aplica a formatação de quebra de linha e adiciona os marcadores
    for titulo in titulos:
        # Garante duas quebras de linha antes do título para separar o bloco
        escopo = escopo.replace(titulo, f"\n\n{TITLE_MARKER_START}{titulo}{TITLE_MARKER_END}")

    return escopo.strip()

# Gera proposta DOCX
def gerar_proposta(dados):
    pasta_script = os.path.dirname(os.path.abspath(__file__))

    # Verifica se há um template customizado para o orçamento ou usa o último arquivo carregado
    caminho_base = os.path.join(
        os.path.dirname(os.path.dirname(pasta_script)),
        "models",
        "Proposta.docx"
    )
    
    if not os.path.exists(caminho_base):
        # Usando o arquivo mais recente que você carregou
        caminho_base = "uploaded:Proposta_BGS 2025_ (8).docx" 
        print(f"⚠️ Usando modelo de backup: {caminho_base}", file=sys.stderr)


    doc = DocxTemplate(caminho_base)

    # --- (Cálculos de datas e valores) ---
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

    ano_do_evento = dados.get("edicao") 

    if not ano_do_evento:
        data_realizacao_str = dados.get("inicio_realizacao") 
        if data_realizacao_str:
            try:
                dt_realizacao = parser.isoparse(str(data_realizacao_str))
                ano_do_evento = str(dt_realizacao.year) 
            except Exception:
                ano_do_evento = str(datetime.now().year)
        else:
            ano_do_evento = str(datetime.now().year)
    
    dia_atual = datetime.now().strftime("%d/%m/%Y")

    valor_total = float(str(dados.get("valor_total", "0")).replace("R$", "").replace(",", ".").strip() or 0)
    reais = int(valor_total)
    centavos = int(round((valor_total - reais) * 100))
    valor_total_extenso = f"{num2words(reais, lang='pt_BR')} reais"
    if centavos > 0:
        valor_total_extenso += f" e {num2words(centavos, lang='pt_BR')} centavos"
    
    # ----------------------------------------------------------------------
    # 📌 Lógica para mapear e injetar o Staff Específico e separar o Staff Geral
    # ----------------------------------------------------------------------
    staff_operacional_itens = []
    categorias_restantes = [] # Categorias que NÃO são EQUIPE OPERACIONAL (Equipamentos, Suprimentos, etc.)

    # 1. Separa staff da categoria EQUIPE OPERACIONAL e guarda as demais categorias
    for categoria in dados.get("itens_categorias", []):
        nome = categoria.get("nome", "").strip().upper()
        if nome == "EQUIPE OPERACIONAL": 
            staff_operacional_itens.extend(categoria.get("itens", []))
        else:
            categorias_restantes.append(categoria)
            
    # 2. Definir mapas
    injection_marker_map = {
        "ANALISTA DE PROJETOS": "Termo de Responsabilidade);", 
        "ANALISTA DE BETTER STANDES": "Termo de Responsabilidade);",
        "SISTEMA ANÁLISE DE PROJETOS": "Termo de Responsabilidade);",
        "DOCUMENTAÇÃO": "Termo de Responsabilidade);", 
        "ATUALIZAÇÃO DE PLANTA": "Comercialização", 
        "SISTEMA DE CAEX": "FIM_SISTEMA_CAEX;",
        "ASSISTENTE DE ATENDIMENTO - PRÉ EVENTO": "FIM_ATENDIMENTO_PRE_EVENTO;", 
        "ATENDIMENTO PRÉ - BILÍNGUE": "FIM_ATENDIMENTO_BILÍNGUE;", 
        "COORDENADOR DE ATENDIMENTO - ESCRITÓRIO JA": "FIM_COORDENACAO_ESCRITORIO;",
        "ORÇAMENTISTA - ESCRITÓRIO JA": "FIM_ORCAMENTO_TEXTO;",
    }
    
    # Mapeamento de descrições de serviço (para reconstrução de orçamentos ANTIGOS)
    service_description_map = {
        "ANALISTA DE PROJETOS": """
ANALISTA DE PROJETOS
 Sistema on-line para a análise do projeto e documentação;
 Análise dos projetos de acordo com as normas de montagem do evento;
 Recebimento da documentação dos estandes: (A.R.T. ou R.R.T. e Termo de Responsabilidade);
        """,
        "ATUALIZAÇÃO DE PLANTA": """
ATUALIZAÇÃO DE PLANTA
● Atualização da Planta (2x por semana via e-mail)
● Suporte Técnico durante a Comercialização
        """,
    }

    escopo_original = to_unicode(dados.get("escopo_servicos"))
    staff_restante = [] # Staff que não foi injetado no escopo
    injected_staff_items = set() 

    # ----------------------------------------------------------------------
    # A. LÓGICA DE RECONSTRUÇÃO (Orçamentos Antigos com escopo_servicos vazio)
    # ----------------------------------------------------------------------
    if not escopo_original.strip():
        reconstructed_escopo = ""
        service_titles_added = set()
        
        for item_staff in staff_operacional_itens:
            staff_name = get_staff_function_name(item_staff).upper()
            
            if staff_name in service_description_map:
                service_text = service_description_map[staff_name].strip()
                service_title = service_text.split('\n', 1)[0].strip()
                
                # 1. Adiciona o texto de serviço (título e bullet points) apenas uma vez
                if service_title not in service_titles_added:
                    reconstructed_escopo += "\n\n" + service_text
                    service_titles_added.add(service_title)
                
                # 2. Adiciona o item de staff logo abaixo, com quebra de linha (espaço)
                reconstructed_escopo += "\n\n" + item_staff
                injected_staff_items.add(item_staff)

        escopo_original = reconstructed_escopo.strip()
        
        # O staff restante é o que NÃO foi injetado acima
        staff_restante = [
            item for item in staff_operacional_itens if item not in injected_staff_items
        ]

    # ----------------------------------------------------------------------
    # B. LÓGICA NORMAL (Orçamentos Novos com escopo_servicos preenchido)
    # ----------------------------------------------------------------------
    else:
        # Já tem o texto base. Apenas injeta o staff no ponto específico.
        for item_staff in staff_operacional_itens:
            item_injetado = False
            staff_name = get_staff_function_name(item_staff)
            
            for keyword, marker in injection_marker_map.items():
                if staff_name.lower() == keyword.lower():
                    if marker in escopo_original:
                        # Cria a string de substituição: o marcador + DUAS QUEBRAS DE LINHA + item do staff
                        new_text_to_insert = f"{marker}\n\n{item_staff}" 
                        
                        escopo_original = escopo_original.replace(
                            marker,
                            new_text_to_insert,
                            1 
                        )
                        item_injetado = True
                        break
            
            # SÓ ADICIONA À LISTA RESTANTE SE NÃO FOI INJETADO
            if not item_injetado:
                staff_restante.append(item_staff) 
        
    # ----------------------------------------------------------------------
    # C. Processamento RichText para Escopo
    # ----------------------------------------------------------------------

    # 4. Formata o escopo de serviços e adiciona os marcadores RichText
    escopo_servicos_marcado = formatar_escopo_servicos(escopo_original)
    
    # 5. Constrói o RichText final para o {{ escopo_servicos }}
    escopo_final_rt = RichText()
    parts = escopo_servicos_marcado.split(TITLE_MARKER_END)

    for part in parts:
        if TITLE_MARKER_START in part:
            plain_text, title_text = part.split(TITLE_MARKER_START, 1)
            
            # 1. Adiciona o texto simples antes do título, forçando a fonte Abel
            escopo_final_rt.add(plain_text, font='Abel')
            
            # 2. Adiciona o título formatado (RichText que já força a fonte Abel)
            escopo_final_rt.add(format_title_rt(title_text))
            
        else:
            # Adiciona o texto restante, forçando a fonte Abel
            escopo_final_rt.add(part, font='Abel')
    
    escopo_servicos_final = escopo_final_rt
    
    # ----------------------------------------------------------------------
    # 📌 D. CONSOLIDAÇÃO: Formata, ORDENA e Reúne TODAS as categorias
    # ----------------------------------------------------------------------
    
    # 1. Aplica formatação RichText e ORDENA os itens das categorias restantes (Equipamentos, Suprimentos, etc.)
    itens_categorias_formatadas = []
    for categoria in categorias_restantes:
        nome_upper = categoria.get("nome", "").strip().upper() 
        itens = categoria.get("itens", [])
        
        # Ordenação alfabética padrão dos itens da categoria
        itens_ordenados = sorted([to_unicode(item) for item in itens]) 
        
        itens_categorias_formatadas.append({
            "nome": format_title_rt(nome_upper),
            "itens": itens_ordenados # Usando a lista ordenada
        })

    # 2. Inicia a lista final de categorias com Equipamentos, Suprimentos, etc.
    itens_categorias_final = itens_categorias_formatadas
    
    # 3. Adiciona a categoria EQUIPE OPERACIONAL (staff restante) com RichText
    if staff_restante:
        # IMPLEMENTAÇÃO DA ORDENAÇÃO CUSTOMIZADA:
        # Prioridade 1: Itens SEM setor (vem primeiro: 0) vs. itens COM setor (vem depois: 1)
        # Prioridade 2: Nome da função (para itens SEM setor) ou o nome do SETOR (para itens COM setor)
        # Prioridade 3: Nome da função (critério de desempate)
        staff_restante_ordenado = sorted(
            [to_unicode(item) for item in staff_restante],
            key=lambda item: (
                1 if '(' in item and ')' in item and ',' in item else 0,  # 1. Tem Setor? (0=Não, 1=Sim)
                (item.split('(', 1)[-1].split(')', 1)[0].upper() 
                 if '(' in item and ')' in item and ',' in item else get_staff_function_name(item).upper()), # 2. Setor (se tiver) ou Função (se não tiver)
                get_staff_function_name(item).upper() # 3. Nome da Função (desempate)
            )
        )
        
        equipe_op_rt_category = {
            "nome": format_title_rt("EQUIPE OPERACIONAL"), # Texto em maiúsculo
            # Adiciona uma string vazia para forçar uma linha em branco no template
            "itens": [""] + staff_restante_ordenado 
        }
        # Adiciona o Staff Operacional no INÍCIO da lista de categorias, logo após o escopo
        itens_categorias_final = [equipe_op_rt_category] + itens_categorias_final

    # ----------------------------------------------------------------------

    context = {
        "adicionais": dados.get("adicionais", []),
        "ano_atual": to_unicode(ano_do_evento),
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
        "escopo_servicos": escopo_servicos_final,# RichText: Serviços e Staff Específico
        "evento_nome": to_unicode(dados.get("evento_nome")),
        "forma_pagamento": to_unicode(dados.get("forma_pagamento")),
        "itens_categorias": itens_categorias_final,# Lista FINAL: Ordenada alfabeticamente
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