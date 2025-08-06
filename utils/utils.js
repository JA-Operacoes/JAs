// async function fetchComToken(url, options = {}) {
//     const token = localStorage.getItem("token");
//     const idempresaLocalStorage = localStorage.getItem("idempresa"); // Corrigindo a variável
    
//     if (!options.headers) options.headers = {};
//     options.headers["Authorization"] = "Bearer " + token;

//     // if (options.body && typeof options.body === 'string' && options.body.startsWith('{')) {
//     //     options.headers['Content-Type'] = 'application/json'; // Adiciona Content-Type para JSON
//     // }

//     const isFormData = options.body instanceof FormData;

//     if (!isFormData) {
//         if (options.body && typeof options.body === 'object') {
//             options.headers["Content-Type"] = "application/json";
//             options.body = JSON.stringify(options.body);
//         }
//     }

//     if (!options.headers['idempresa']) { // Lógica MUITO mais inteligente para idempresa
//         if (
//             idempresaLocalStorage &&
//             idempresaLocalStorage !== 'null' &&
//             idempresaLocalStorage !== 'undefined' &&
//             idempresaLocalStorage.trim() !== '' &&
//             !isNaN(idempresaLocalStorage) &&
//             Number(idempresaLocalStorage) > 0
//         ) {
//             options.headers['idempresa'] = idempresaLocalStorage;
//         } else {
//             console.warn('[fetchComToken] idempresa inválido no localStorage, não será enviado no header:', idempresaLocalStorage);
//         }
//     } else {
//         console.log('[fetchComToken] idempresa já definido no options.headers, usando-o:', options.headers['idempresa']);
//     }

//     const resposta = await fetch(url, options);

//     let responseBody = null;
//     try {
//         responseBody = await resposta.json(); // Tenta JSON
//     } catch (jsonError) {
//         try {
//             responseBody = await resposta.text(); // Se falhar, tenta TEXTO
//         } catch (textError) {
//             responseBody = null;
//         }
//     }

//     if (!resposta.ok) {
//         const errorMessage = (responseBody && responseBody.erro) || (responseBody && responseBody.message) || responseBody || resposta.statusText;
//         throw new Error(`Erro na requisição: ${errorMessage}`); // Melhor tratamento de erro
//     }

//     return responseBody;
// }

async function fetchComToken(url, options = {}) {
    const token = localStorage.getItem("token");
    const idempresaLocalStorage = localStorage.getItem("idempresa");

    if (!options.headers) options.headers = {};
    options.headers["Authorization"] = "Bearer " + token;

    const isFormData = options.body instanceof FormData;

    if (!isFormData) {
        if (options.body && typeof options.body === 'object') {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(options.body);
        }
    }

    if (!options.headers['idempresa']) {
        if (
            idempresaLocalStorage &&
            idempresaLocalStorage !== 'null' &&
            idempresaLocalStorage !== 'undefined' &&
            idempresaLocalStorage.trim() !== '' &&
            !isNaN(idempresaLocalStorage) &&
            Number(idempresaLocalStorage) > 0
        ) {
            options.headers['idempresa'] = idempresaLocalStorage;
        } else {
            console.warn('[fetchComToken] idempresa inválido no localStorage, não será enviado no header:', idempresaLocalStorage);
        }
    } else {
        console.log('[fetchComToken] idempresa já definido no options.headers, usando-o:', options.headers['idempresa']);
    }

    const resposta = await fetch(url, options);

    console.log("FETCHCOMTOKEN", resposta.status);

    // --- Nova lógica para tratamento de token expirado/invalido ---
    if (resposta.status === 401 || resposta.status === 403) {
        console.warn("[fetchComToken] Erro de autenticação (401/403). Redirecionando para o login.");
        
        // Limpa o token e idempresa do localStorage
        localStorage.removeItem("token");
        localStorage.removeItem("idempresa");
        // Remove quaisquer outros dados de sessão se houver

        // Redireciona para a página de login
        // Certifique-se de que o caminho para o login esteja correto
        window.location.href = '/login.html'; // Ou '/login' dependendo da sua rota
        
        // Impede que o restante da função seja executado
        throw new Error("Sessão expirada ou inválida. Redirecionando para o login.");
    }
    // --- Fim da nova lógica ---

    let responseBody = null;
    try {
        responseBody = await resposta.json();
    } catch (jsonError) {
        try {
            responseBody = await resposta.text();
        } catch (textError) {
            responseBody = null;
        }
    }

    if (!resposta.ok) {
        const errorMessage = (responseBody && responseBody.erro) || (responseBody && responseBody.message) || responseBody || resposta.statusText;
        throw new Error(`Erro na requisição: ${errorMessage}`);
    }

    return responseBody;
}

async function fetchHtmlComToken(url, options = {}) {
  console.log("FETCH HTML", url, options);
  const token = localStorage.getItem("token");
  const idempresa = localStorage.getItem("idempresa");

  if (!options.headers) options.headers = {};
  options.headers["Authorization"] = "Bearer " + token;
  if (idempresa) options.headers["idempresa"] = idempresa;

  const resposta = await fetch(url, options);

  if (resposta.status === 401) {
    localStorage.clear();
    await Swal.fire({
      icon: "warning",
      title: "Sessão expirada",
      text: "Por favor, faça login novamente.",
    });
    window.location.href = "login.html";
    throw new Error("Sessão expirada");
  }

  if (!resposta.ok) {
    const textoErro = await resposta.text();
    throw new Error(`Erro ${resposta.status}: ${textoErro}`);
  }

  // Aqui quem chama decide se quer .text() ou .json()
  return resposta.text();
  //return await resposta.json();
}


export { fetchComToken, fetchHtmlComToken };