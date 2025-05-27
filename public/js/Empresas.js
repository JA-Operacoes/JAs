let permissoesEmpresa = {
  cadastrar: false,
  alterar: false,
  excluir: false,
  pesquisar: false
};

document.addEventListener('DOMContentLoaded', async () => {
  permissoesEmpresa = await verificarPermissoes('empresa');
  carregarEmpresas();

  if (!permissoesEmpresa.cadastrar) {
    document.getElementById('btnSalvarEmpresa').style.display = 'none';
  }
});

async function verificarPermissoes(modulo) {
  try {
    const res = await fetchComToken(`/api/permissoes/${modulo}`);
    if (!res.ok) throw new Error('Falha ao verificar permissões');
    return await res.json();
  } catch (err) {
    console.error('Erro ao verificar permissões:', err);
    return { cadastrar: false, alterar: false, excluir: false, pesquisar: false };
  }
}

async function carregarEmpresas() {
  if (!permissoesEmpresa.pesquisar) return;

  try {
    const resposta = await fetchComToken('/api/empresas');
    const empresas = await resposta.json();

    const lista = document.getElementById('listaEmpresas');
    lista.innerHTML = '';

    empresas.forEach(empresa => {
      const linha = document.createElement('tr');
      linha.innerHTML = `
        <td>${empresa.nome}</td>
        <td>${empresa.cnpj || ''}</td>
        <td>${empresa.razao_social || ''}</td>
        <td>${empresa.telefone || ''}</td>
        <td>${empresa.email || ''}</td>
        <td>
          ${permissoesEmpresa.alterar ? `<button onclick="editarEmpresa(${empresa.id})">✏️</button>` : ''}
          ${permissoesEmpresa.excluir ? `<button onclick="deletarEmpresa(${empresa.id})">🗑️</button>` : ''}
        </td>
      `;
      lista.appendChild(linha);
    });
  } catch (error) {
    console.error('Erro ao carregar empresas:', error);
  }
}

async function cadastrarEmpresa() {
  if (!permissoesEmpresa.cadastrar) return;

  const nome = document.getElementById('nomeEmpresa').value;
  const cnpj = document.getElementById('cnpjEmpresa').value;
  const razao = document.getElementById('razaoSocial').value;
  const telefone = document.getElementById('telefoneEmpresa').value;
  const email = document.getElementById('emailEmpresa').value;

  const dados = { nome, cnpj, razao_social: razao, telefone, email };

  try {
    const resposta = await fetchComToken('/api/empresas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    if (resposta.ok) {
      alert('Empresa cadastrada com sucesso!');
      carregarEmpresas();
      limparFormularioEmpresa();
    } else {
      alert('Erro ao cadastrar empresa.');
    }
  } catch (error) {
    console.error('Erro ao cadastrar empresa:', error);
  }
}

async function editarEmpresa(id) {
  if (!permissoesEmpresa.alterar) return;

  try {
    const resposta = await fetchComToken(`/api/empresas/${id}`);
    const empresa = await resposta.json();

    document.getElementById('empresaId').value = empresa.id;
    document.getElementById('nomeEmpresa').value = empresa.nome;
    document.getElementById('cnpjEmpresa').value = empresa.cnpj;
    document.getElementById('razaoSocial').value = empresa.razao_social;
    document.getElementById('telefoneEmpresa').value = empresa.telefone;
    document.getElementById('emailEmpresa').value = empresa.email;
  } catch (error) {
    console.error('Erro ao editar empresa:', error);
  }
}

async function salvarEmpresa() {
  const id = document.getElementById('empresaId').value;

  if (id) {
    await atualizarEmpresa(id);
  } else {
    await cadastrarEmpresa();
  }
}

async function atualizarEmpresa(id) {
  if (!permissoesEmpresa.alterar) return;

  const nome = document.getElementById('nomeEmpresa').value;
  const cnpj = document.getElementById('cnpjEmpresa').value;
  const razao = document.getElementById('razaoSocial').value;
  const telefone = document.getElementById('telefoneEmpresa').value;
  const email = document.getElementById('emailEmpresa').value;

  const dados = { nome, cnpj, razao_social: razao, telefone, email };

  try {
    const resposta = await fetchComToken(`/api/empresas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    if (resposta.ok) {
      alert('Empresa atualizada com sucesso!');
      carregarEmpresas();
      limparFormularioEmpresa();
    } else {
      alert('Erro ao atualizar empresa.');
    }
  } catch (error) {
    console.error('Erro ao atualizar empresa:', error);
  }
}

async function deletarEmpresa(id) {
  if (!permissoesEmpresa.excluir) return;

  if (!confirm('Tem certeza que deseja excluir esta empresa?')) return;

  try {
    const resposta = await fetchComToken(`/api/empresas/${id}`, {
      method: 'DELETE'
    });

    if (resposta.ok) {
      alert('Empresa excluída com sucesso!');
      carregarEmpresas();
    } else {
      alert('Erro ao excluir empresa.');
    }
  } catch (error) {
    console.error('Erro ao excluir empresa:', error);
  }
}

function limparFormularioEmpresa() {
  document.getElementById('empresaId').value = '';
  document.getElementById('nomeEmpresa').value = '';
  document.getElementById('cnpjEmpresa').value = '';
  document.getElementById('razaoSocial').value = '';
  document.getElementById('telefoneEmpresa').value = '';
  document.getElementById('emailEmpresa').value = '';
}
