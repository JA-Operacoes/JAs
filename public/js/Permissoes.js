document.addEventListener('DOMContentLoaded', () => {
    carregarUsuarios();

    document.getElementById('usuarioSelect').addEventListener('change', carregarPermissaoAtual);
    document.getElementById('moduloSelect').addEventListener('change', carregarPermissaoAtual);
    document.getElementById('salvarPermissao').addEventListener('click', salvarPermissao);
  });

  async function carregarUsuarios() {
    try {
      const response = await fetch('/usuarios'); // ajuste se sua rota for diferente
      const usuarios = await response.json();
      const select = document.getElementById('usuarioSelect');
      select.innerHTML = '<option value="">Selecione</option>';
      usuarios.forEach(usuario => {
        const option = document.createElement('option');
        option.value = usuario.idusuario;
        option.textContent = usuario.nome; // ajuste conforme o nome no seu banco
        select.appendChild(option);
      });
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  }

  async function carregarPermissaoAtual() {
    const idusuario = document.getElementById('usuarioSelect').value;
    const modulo = document.getElementById('moduloSelect').value;

    if (!idusuario || !modulo) return;

    try {
      const response = await fetch(`/permissoes/${idusuario}`);
      const permissoes = await response.json();
      const permissaoDoModulo = permissoes.find(p => p.modulo === modulo);

      document.getElementById('cadastrar').checked = permissaoDoModulo?.cadastrar || false;
      document.getElementById('alterar').checked = permissaoDoModulo?.alterar || false;
      document.getElementById('pesquisar').checked = permissaoDoModulo?.pesquisar || false;
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
    }
  }

  async function salvarPermissao() {
    const idusuario = document.getElementById('usuarioSelect').value;
    const modulo = document.getElementById('moduloSelect').value;
    const cadastrar = document.getElementById('cadastrar').checked;
    const alterar = document.getElementById('alterar').checked;
    const pesquisar = document.getElementById('pesquisar').checked;

    if (!idusuario || !modulo) {
      Swal.fire('Erro', 'Selecione o usuário e o módulo.', 'warning');
      return;
    }

    try {
      const response = await fetch('/permissoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idusuario, modulo, cadastrar, alterar, pesquisar })
      });

      const resultado = await response.json();

      if (response.ok) {
        Swal.fire('Sucesso', resultado.mensagem, 'success');
      } else {
        Swal.fire('Erro', resultado.erro || 'Erro ao salvar.', 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar permissão:', error);
      Swal.fire('Erro', 'Erro de comunicação com o servidor.', 'error');
    }
  }