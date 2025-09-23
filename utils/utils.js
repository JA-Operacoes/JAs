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

    //console.log("Token a ser usado na requisição:", token, idempresaLocalStorage);

    if (!options.headers) options.headers = {};
  //  options.headers["Authorization"] = "Bearer " + token;

    if (token) {
        options.headers["Authorization"] = "Bearer " + token;
    } else {
        // Se não houver token, você pode lançar um erro ou redirecionar imediatamente.
        // O seu código já faz isso no 401, mas é bom ter uma segurança extra aqui.
        console.error("❌ Token JWT não encontrado. Redirecionando para o login.");
        window.location.href = '/login.html'; 
        throw new Error("Token não encontrado.");
    }

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

    if (resposta.status === 404) {
        // Retorna uma lista vazia para que o código do frontend possa tratar
        // a ausência de bancos de forma esperada.
        return [];
    }
    
    if (resposta.status === 403) {
        // Exibe um alerta de permissão negada e não redireciona
        Swal.fire({
            icon: 'error',
            title: 'Acesso Negado',
            text: 'Você não tem permissão para acessar este recurso.',
            confirmButtonText: 'OK'
        });
        
        // Impede que o código continue e trate o 403 como um erro
        throw new Error("Acesso negado (403).");
    }

    // ✅ Lógica de tratamento de token expirado (mantém o comportamento anterior para 401)
    if (resposta.status === 401) {
        console.warn("[fetchComToken] Erro de autenticação (401). Redirecionando para o login.");
        localStorage.removeItem("token");
        localStorage.removeItem("idempresa");
        window.location.href = '/login.html'; 
        throw new Error("Sessão expirada ou inválida. Redirecionando para o login.");
    }


    // --- Nova lógica para tratamento de token expirado/invalido ---
    // if (resposta.status === 401 || resposta.status === 403) {
    //     console.warn("[fetchComToken] Erro de autenticação (401/403). Redirecionando para o login.");
        
    //     // Limpa o token e idempresa do localStorage
    //     localStorage.removeItem("token");
    //     localStorage.removeItem("idempresa");
    //     // Remove quaisquer outros dados de sessão se houver

    //     // Redireciona para a página de login
    //     // Certifique-se de que o caminho para o login esteja correto
    //     window.location.href = '/login.html'; // Ou '/login' dependendo da sua rota
        
    //     // Impede que o restante da função seja executado
    //     throw new Error("Sessão expirada ou inválida. Redirecionando para o login.");
    // }
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
    console.log("Redirecionando para login...");
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

// export function aplicarTema(empresa) {
//     // Remove qualquer classe que comece com "tema-"
//     document.body.classList.forEach(cls => {
//         if (cls.startsWith("tema-")) {
//             document.body.classList.remove(cls);
//         }
//     });
//     document.body.classList.add("tema-" + empresa);
// }

// export function aplicarTemaPorId(idempresa) {
//     // pode mapear o id para o nome da classe de tema
//     const mapIdParaTema = {
//         1: 'Oper',
//         2: 'ES',
//         3: 'EA',
//         4: 'EP',
//         5: 'SNFoods',
//         6: 'TSD'
//     };
//     const tema = mapIdParaTema[idempresa];
//     if (tema) {
//         aplicarTema(tema); // usa a função existente
//     } else {
//         console.warn("ID de empresa inválido para aplicarTemaPorId:", idempresa);
//     }
// }

export function aplicarTema(empresa) {
    // Remove qualquer classe que comece com "tema-"
    document.body.classList.forEach(cls => {
        if (cls.startsWith("tema-")) {
            document.body.classList.remove(cls);
        }
    });
    document.body.classList.add("tema-" + empresa);
}


export { fetchComToken, fetchHtmlComToken};