import sys
import io
import os
import json
from datetime import datetime

from docxtpl import DocxTemplate

# Garante saída UTF-8 para o Node.js (mesmo padrão de Proposta.py/Contrato.py)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')


def gerar_checklist(dados):
    nmevento = dados.get("nmevento") or "Evento"
    categorias_entrada = dados.get("categorias") or []
    rede_entrada = dados.get("rede") or ["Switch", "Cabo de rede", "Testador de cabo de rede"]

    categorias = []
    for categoria in categorias_entrada:
        nome = categoria.get("descequip", "Equipamento")
        qtd = categoria.get("qtdorcada", 0)
        complementos = categoria.get("complementos") or []
        itens = [{"nome": nome, "qtd": qtd}] + [{"nome": item, "qtd": ""} for item in complementos]
        categorias.append({"nome": nome, "qtd": qtd, "itens": itens})

    rede = [{"nome": item, "qtd": ""} for item in rede_entrada]

    pasta_script = os.path.dirname(os.path.abspath(__file__))
    caminho_modelo = os.path.join(pasta_script, "..", "..", "models", "ChecklistSeparacaoEquipamentos.docx")

    doc = DocxTemplate(caminho_modelo)
    doc.render({"nmevento": nmevento, "categorias": categorias, "rede": rede})

    pasta_saida = os.path.join(pasta_script, "..", "..", "uploads", "Checklist")
    os.makedirs(pasta_saida, exist_ok=True)

    nome_seguro = "".join(c for c in nmevento if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nome_arquivo = f"ChecklistSeparacao_{nome_seguro}_{timestamp}.docx"
    caminho_saida = os.path.join(pasta_saida, nome_arquivo)

    doc.save(caminho_saida)
    print(f"✅ Checklist salvo: {caminho_saida}", file=sys.stderr)
    return caminho_saida


if __name__ == "__main__":
    try:
        dados = json.load(sys.stdin)
        caminho_saida = gerar_checklist(dados)
        print(os.path.abspath(caminho_saida), flush=True)
        sys.exit(0)
    except Exception as e:
        print(f"❌ Erro no Python (ChecklistSeparacao): {e}", file=sys.stderr)
        sys.exit(1)
