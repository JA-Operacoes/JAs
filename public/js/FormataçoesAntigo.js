document.addEventListener("DOMContentLoaded", function () {



  //  ----------------------- Upload de Imagem -----------------------


  const inputFile = document.querySelector("#pictureInput");
  const pictureImage = document.querySelector(".pictureImage");
  if (pictureImage) pictureImage.innerText = "Foto 3x4";

  if (inputFile) {
      inputFile.addEventListener("change", function (e) {
          const file = e.target.files[0];
          if (file) {
              const reader = new FileReader();
              reader.onload = function (event) {
                  const img = document.createElement("img");
                  img.src = event.target.result;
                  img.classList.add("pictureImage");
                  pictureImage.innerHTML = "";
                  pictureImage.appendChild(img);
              };
              reader.readAsDataURL(file);
          } else {
              pictureImage.innerText = "Foto 3x4";
          }
      });

  }


  //  ----------------------- Formatação CPF -----------------------



  window.formatCPF = function (input) {
    if (!input.value) return;

    let cpf = input.value.replace(/\D/g, ""); // Remove tudo que não for número
    if (cpf.length > 11) cpf = cpf.slice(0, 11); // Limita a 11 números

    // Aplica a formatação automaticamente
    input.value = cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})$/, "$1.$2.$3-$4");
}

function formatCNPJ(input) {
    if (!input.value) return;

    let cnpj = input.value.replace(/\D/g, ""); // Remove tudo que não for número
    if (cnpj.length > 14) cnpj = cnpj.slice(0, 14); // Limita a 14 números

    // Aplica a formatação automaticamente
    input.value = cpf.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})$/, "$1.$2.$3/$4-$5");
}

// Adiciona evento automaticamente ao input CPF
document.addEventListener("DOMContentLoaded", function () {
    let cpfInput = document.querySelector("#cpf");
    if (cpfInput) {
        cpfInput.addEventListener("input", function () {
            formatCPF(this);
        });
    }
});





  //  ----------------------- Formatação RG -----------------------



 window.formatRG = function(input) {
    if (!input.value) return;

    let rg = input.value.replace(/\D/g, ""); // Remove tudo que não for número
    if (rg.length > 9) rg = rg.slice(0, 9); // Limita a 9 números

    // Aplica a formatação automaticamente
    input.value = rg.replace(/^(\d{2})(\d{3})(\d{3})([\dXx]?)$/, "$1.$2.$3-$4");
}





  //  ----------------------- Formatação CEP -----------------------





// 📌 Formatação e Busca de CEP - Agora independente!
window.formatCEP = function (input) {
  let value = input.value.replace(/\D/g, ''); // Remove tudo que não for número
  input.value = value.length > 5 ? value.substring(0, 5) + '-' + value.substring(5, 8) : value;

  if (value.length === 0) {
      esconderEndereco();
  } else if (value.length >= 4) {
      let pais = identificarpaisPorPadrao(value);
      if (pais) {
          buscarCEP(value, pais);
      } else {
          exibirSelecaopais(value);
      }
  }
};

// 📌 Identifica o país do CEP
window.identificarpaisPorPadrao = function (cep) {
  if (/^\d{8}$/.test(cep)) return "br"; // Brasil
  if (/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/.test(cep)) return "ca"; // Canadá
  if (/^\d{5}(-\d{4})?$/.test(cep)) return "us"; // EUA
  if (/^\d{5}$/.test(cep)) return "de"; // Alemanha
  if (/^\d{2}[ ]?\d{3}$/.test(cep)) return "fr"; // França
  if (/^\d{5}$/.test(cep)) return "es"; // Espanha
  if (/^\d{5}$/.test(cep)) return "it"; // Itália
  if (/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/.test(cep)) return "gb"; // Reino Unido
  return null;
};

// 📌 Exibe a seleção de país
window.exibirSelecaopais = function (cep) {
  let selectContainer = document.getElementById("selectpaisContainer");
  let select = document.getElementById("selecaopais");

  if (!selectContainer || !select) return; // Evita erros se os elementos não existirem

  select.innerHTML = `
      <option value="">Selecione o país</option>
      <option value="br">Brasil</option>
      <option value="us">EUA</option>
      <option value="ca">Canadá</option>
      <option value="de">Alemanha</option>
      <option value="fr">França</option>
      <option value="es">Espanha</option>
      <option value="it">Itália</option>
      <option value="gb">Reino Unido</option>
  `;

  selectContainer.style.display = "block";

  select.onchange = function () {
      let paisSelecionado = this.value;
      if (paisSelecionado) {
          selectContainer.style.display = "none";
          buscarCEP(cep, paisSelecionado);
      }
  };
};

// 📌 Faz a requisição da API do CEP
window.buscarCEP = function (cep, pais) {
  let url = pais === "br"
      ? `https://viacep.com.br/ws/${cep}/json/`
      : `https://api.zippopotam.us/${pais}/${cep}`;

  fetch(url)
      .then(response => {
          if (!response.ok) throw new Error("CEP não encontrado");
          return response.json();
      })
      .then(data => {
          if (data.erro || (data.places && data.places.length === 0)) {
              mostrarErro();
              return;
          }
          preencherEndereco(data, pais);
      })
      .catch(() => mostrarErro());
};

// 📌 Preenche os campos do endereço com os dados da API
window.preencherEndereco = function (data, pais) {
  let rua = document.querySelector("#rua");
  let bairro = document.querySelector("#bairro");
  let cidade = document.querySelector("#cidade");
  let estado = document.querySelector("#estado");
  let paisInput = document.querySelector("#pais");

  if (!rua || !cidade || !estado || !paisInput) return; // Evita erro se os campos não existirem

  if (pais === "br") {
      rua.value = data.logradouro || '';
      bairro.value = data.bairro || '';
      cidade.value = data.localidade || '';
      estado.value = data.uf || '';
      paisInput.value = "Brasil";
  } else {
      let place = data.places[0];
      rua.value = place["place name"] || '';
      cidade.value = place["state"] || place["state abbreviation"] || '';
      estado.value = place["state"] || place["state abbreviation"] || '';
      paisInput.value = data.country || '';
      if (bairro) bairro.value = "Não disponível";
  }
};

// 📌 Limpa os campos caso o CEP seja inválido
window.mostrarErro = function () {
  esconderEndereco();
};

// 📌 Esconde/limpa os campos de endereço
window.esconderEndereco = function () {
  let rua = document.querySelector("#rua");
  let bairro = document.querySelector("#bairro");
  let cidade = document.querySelector("#cidade");
  let estado = document.querySelector("#estado");
  let pais = document.querySelector("#pais");

  if (rua) rua.value = "";
  if (bairro) bairro.value = "";
  if (cidade) cidade.value = "";
  if (estado) estado.value = "";
  if (pais) pais.value = "";
};

// 🚀 Mensagem de carregamento para depuração
document.addEventListener("DOMContentLoaded", function () {
  console.log("📢 Formatação de CEP carregada!");
});





  //  ----------------------- Formatação Celular -----------------------





 window.formatTelefone = function (input) {
    // let value = input.value.replace(/\D/g, "");
    // if (value.length > 2 && value.length <= 6) {
    //     input.value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
    // } else if (value.length > 6 && value.length <= 10) {
    //     input.value = `(${value.substring(0, 2)}) ${value.substring(2, 6)}-${value.substring(6)}`;
    // } else if (value.length > 10) {
    //     input.value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7, 11)}`;
    // } else {
    //     input.value = value;

    let value = input.value.replace(/\D/g, ""); // Remove tudo que não for dígito

    if (value.length <= 2) {
        input.value = value;
    } else if (value.length <= 6) {
        input.value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
    } else if (value.length === 10) {
        // Telefone fixo
        input.value = `(${value.substring(0, 2)}) ${value.substring(2, 6)}-${value.substring(6)}`;
    } else if (value.length >= 11) {
        // Celular
        input.value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7, 11)}`;
    } else {
        input.value = value;
    }
    // }
};



  //  ----------------------- Formatação CNPJ -----------------------




// Define a função globalmente antes de tudo
window.formatCNPJ = function (input) {
  let cnpj = input.value.replace(/\D/g, "").slice(0, 14);
  input.value = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})$/, "$1.$2.$3/$4-$5");
};

// Quando o DOM carregar, apenas exibir logs para depuração
document.addEventListener("DOMContentLoaded", function () {
  console.log("Script carregado e formatCNPJ está definido!");
});



  //  ----------------------- Buscar Cliente pelo Código -----------------------



  const buscarBtn = document.querySelector("#buscar");
  if (buscarBtn) {
      buscarBtn.addEventListener("click", function (event) {
          event.preventDefault();
          let codigo = document.querySelector("#idCliente").value;

          fetch("http://localhost:3000/clientes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ codigo: codigo })
          })
          .then(response => response.json())
          .then(data => {
              if (data.sucesso) {
                  preencherDadosCliente(data);
              } else {
                  alert("Código não encontrado!");
              }
          })
          .catch(() => alert("Erro ao buscar o código!"));
      });
  }

  function preencherDadosCliente(data) {
      document.querySelector("#nmFantasia").value = data.nome_fantasia;
      document.querySelector("#razaoSocial").value = data.razao_social;
      document.querySelector("#cnpj").value = data.cnpj;
      document.querySelector("#Nome").value = data.nome_responsavel;
      document.querySelector("#celContato").value = data.celular;
      document.querySelector("#email").value = data.email;
      document.querySelector("#emailNFE").value = data.email_nfe;
      document.querySelector("#site").value = data.site;
      document.querySelector("#inscEstadual").value = data.ie;
      document.querySelector("#cep").value = data.cep;
      document.querySelector("#rua").value = data.rua;
      document.querySelector("#numero").value = data.numero;
      document.querySelector("#complemento").value = data.complemento;
      document.querySelector("#bairro").value = data.bairro;
      document.querySelector("#cidade").value = data.cidade;
      document.querySelector("#estado").value = data.estado;
      document.querySelector("#pais").value = data.pais;
  }
});


document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("input", function(event) {
        if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") {
            event.target.value = event.target.value.toUpperCase();
        }
    });
});