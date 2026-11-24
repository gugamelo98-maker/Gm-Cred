/**
 * Service to handle API interactions with robust error handling and validation.
 */

// Helper to get the configured API user
export const getApiUser = () => {
  return localStorage.getItem('apiUser') || 'usuario_1';
};

// Validates CPF format and checksum
export const validateCPF = (cpf) => {
  if (!cpf) return { valid: false, message: 'CPF vazio.' };
  
  // Remove non-digits
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11) {
    return { valid: false, message: 'CPF deve ter 11 dígitos.' };
  }
  
  // Check for repeated digits (e.g., 111.111.111-11)
  if (/^(\d)\1+$/.test(cleanCPF)) {
    return { valid: false, message: 'CPF inválido (formato incorreto).' };
  }
  
  // Checksum validation
  let sum = 0;
  let remainder;
  
  // First digit
  for (let i = 1; i <= 9; i++) {
    sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) {
    return { valid: false, message: 'CPF inválido (dígito verificador).' };
  }
  
  // Second digit
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) {
    return { valid: false, message: 'CPF inválido (dígito verificador).' };
  }

  return { valid: true, message: 'CPF válido.' };
};

// Validates API response structure
export const validateAPIResponse = (data) => {
  if (!data) return { valid: false, message: 'Resposta vazia da API' };
  
  // Basic check: should be an object
  if (typeof data !== 'object') {
    return { valid: false, message: 'Formato de resposta inválido' };
  }
  
  return { valid: true };
};

// Wrapper for fetch with timeout and unified error handling
export const callAPIWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
  const { signal: externalSignal, ...fetchOptions } = options;
  const controller = new AbortController();
  
  // Handle external cancellation (e.g. user pressed cancel)
  if (externalSignal?.aborted) {
    return { success: false, error: 'Cancelado pelo usuário', type: 'abort' };
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => {
     controller.abort();
  };
  
  if (externalSignal) {
    externalSignal.addEventListener('abort', onExternalAbort);
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return { success: true, response };

  } catch (error) {
    clearTimeout(timeoutId);
    
    let errorMessage = 'Erro ao conectar com a API';
    let type = 'network';
    
    if (error.name === 'AbortError') {
      if (externalSignal?.aborted) {
        errorMessage = 'Cancelado pelo usuário';
        type = 'abort';
      } else {
        errorMessage = 'Requisição expirou (timeout)';
        type = 'timeout';
      }
    } else {
        console.error("API Call Error:", error);
    }
    
    return { success: false, error: errorMessage, type, originalError: error };
  } finally {
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
};

export const simulateAPI = async (cpf, user = null, signal) => {
  const BASE_URL = "https://servicos-api-clt-v8-multi-login.nttja3.easypanel.host";
  const currentUser = user || getApiUser();

  const payload = {
    cpf: cpf.replace(/\D/g, ''),
    usuario: currentUser
  };

  return callAPIWithTimeout(`${BASE_URL}/simular`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  }, 10000);
};

export const queryDataAPI = async (cpf, consultId, signal) => {
    const BASE_URL = "https://servicos-api-clt-v8-multi-login.nttja3.easypanel.host";
    
    const payload = {
        cpf: cpf.replace(/\D/g, ''),
        consultId: consultId,
        usuario: getApiUser() // Dynamically get user
    };

    try {
        const { success, response, error } = await callAPIWithTimeout(
            `${BASE_URL}/consultar-simulacoes`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: signal
            },
            10000
        );

        if (!success) {
            throw new Error(error);
        }

        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status}`);
        }

        const data = await response.json();
        const responseData = data.data || data;

        // Ensure we handle partial responses gracefully
        return {
            margem: responseData.margem,
            valor_solicitado: responseData.valor_solicitado,
            valor_aprovado: responseData.valor_cliente_recebe,
            taxa: responseData.taxa,
            prazo: responseData.numero_parcelas,
            status: 'Sucesso'
        };

    } catch (e) {
        throw new Error(e.message || "Erro desconhecido na consulta");
    }
};