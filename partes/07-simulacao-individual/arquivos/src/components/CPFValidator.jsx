import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send, Server, AlertCircle, CheckCircle, Search, FileText, Key, Timer } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useSimulationStorage } from '@/hooks/useSimulationStorage';
import { validateCPF, validateAPIResponse, callAPIWithTimeout, getApiUser } from '@/services/apiService';
import RateLimitIndicator from './RateLimitIndicator';
import { motion, AnimatePresence } from 'framer-motion';

const CPFValidator = ({ rateLimitState, checkRateLimit, recordRequest }) => {
  const [activeTab, setActiveTab] = useState('simular'); // 'simular' | 'consultar'
  const [cpf, setCpf] = useState('');
  const [consultId, setConsultId] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [currentUser, setCurrentUser] = useState(getApiUser());
  
  const { toast } = useToast();
  const { save, updateProgress } = useSimulationStorage();

  const BASE_URL = "https://servicos-api-clt-v8-multi-login.nttja3.easypanel.host";
  
  const endpoints = {
    simular: `${BASE_URL}/simular`,
    consultar: `${BASE_URL}/consultar-simulacoes`
  };

  useEffect(() => {
    // Refresh user from localStorage
    setCurrentUser(getApiUser());
    
    // Optional: Add event listener if you want real-time updates when settings change in another tab
    const handleStorageChange = () => setCurrentUser(getApiUser());
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
            if (prev <= 1) {
                const status = checkRateLimit();
                if (status.allowed) return 0;
                return status.waitSeconds;
            }
            return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown, checkRateLimit]);

  const handleTabChange = (tab) => {
    if (loading) return;
    setActiveTab(tab);
    setApiResponse(null);
  };

  const handleCpfChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    const masked = value
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');

    setCpf(masked);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiResponse(null);

    // Refresh user just in case
    const apiUser = getApiUser();
    setCurrentUser(apiUser);

    const limitStatus = checkRateLimit();
    if (!limitStatus.allowed) {
        setCountdown(limitStatus.waitSeconds);
        toast({
            title: "Limite de Requisições",
            description: `Aguarde ${limitStatus.waitSeconds}s para realizar novas consultas.`,
            variant: "destructive"
        });
        return;
    }

    const validation = validateCPF(cpf);
    if (!validation.valid) {
      toast({
        title: "CPF Inválido",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }

    const rawCpf = cpf.replace(/\D/g, '');
    setLoading(true);
    
    recordRequest();

    const transactionId = crypto.randomUUID();
    const initialRecord = {
        id: transactionId,
        cpf: rawCpf,
        statusGeral: 'Processando',
        consultId: { status: 'Processando', value: null },
        margem: { status: 'Aguardando', value: null },
        valorSolicitado: { status: 'Aguardando', value: null },
        valorAprovado: { status: 'Aguardando', value: null },
        taxa: { status: 'Aguardando', value: null },
        prazo: { status: 'Aguardando', value: null },
        data_simulacao: new Date().toISOString(),
        timestamp: Date.now(),
        usuario: apiUser,
        status: 102, 
        provider: 'Iniciando...' 
    };
    
    await save(initialRecord);

    const currentEndpoint = endpoints[activeTab];
    const payload = {
      cpf: rawCpf,
      usuario: apiUser
    };

    if (activeTab === 'consultar') {
      if (consultId) {
        payload.consultId = consultId;
      }
    }

    try {
      const { success, response, error: networkError } = await callAPIWithTimeout(currentEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, 10000);

      if (response && response.status === 429) {
         setCountdown(60); 
         throw new Error("Limite de requisições excedido no servidor (429).");
      }

      if (!success) {
        throw new Error(networkError);
      }

      let data;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { rawText: text };
      }

      const responseValidation = validateAPIResponse(data);
      if (!responseValidation.valid) {
         await updateProgress(transactionId, { 
             statusGeral: 'Erro',
             consultId: { status: 'Erro', value: null }
         });
         
         setApiResponse({
            status: response.status,
            ok: false,
            data: { message: "Resposta da API com formato inválido ou vazio." },
            timestamp: new Date().toLocaleTimeString(),
            endpoint: activeTab === 'simular' ? '/simular' : '/consultar-simulacoes'
         });
         return;
      }

      let capturedId = null;
      if (response.ok && data) {
         capturedId = data.consultId || data.id || (data.data && data.data.consultId) || (data.data && data.data.id);
         
         if (capturedId) {
             await updateProgress(transactionId, {
                 consultId: { status: 'Sucesso', value: capturedId },
                 statusGeral: 'Processando'
             });
             
             if (activeTab === 'simular') {
               setConsultId(capturedId);
               toast({
                 title: "ID Capturado",
                 description: `ConsultId ${capturedId} salvo.`,
               });
             }
         }
      }

      const responseObj = {
        status: response.status,
        ok: response.ok,
        data: data,
        timestamp: new Date().toLocaleTimeString(),
        endpoint: activeTab === 'simular' ? '/simular' : '/consultar-simulacoes'
      };
      
      setApiResponse(responseObj);

      if (response.ok) {
        const responseData = data.data || data || {};
        
        const finalUpdate = {
            statusGeral: 'Sucesso',
            consultId: { status: 'Sucesso', value: capturedId || consultId || responseData.consultId },
            margem: { status: 'Sucesso', value: responseData.margem },
            valorSolicitado: { status: 'Sucesso', value: responseData.valor_solicitado },
            valorAprovado: { status: 'Sucesso', value: responseData.valor_cliente_recebe },
            taxa: { status: 'Sucesso', value: responseData.taxa || 0 },
            prazo: { status: 'Sucesso', value: responseData.numero_parcelas },
            status: response.status,
            valor_parcela: responseData.valor_parcela,
            iof_amount: responseData.iof_amount,
            insurance_amount: responseData.insurance_amount,
            provider: responseData.provider || 'Simulação',
            first_installment_date: responseData.first_installment_date,
            is_insured: responseData.is_insured,
            resposta_completa: data
        };

        await updateProgress(transactionId, finalUpdate);
        
        toast({
          title: "Simulação Finalizada!",
          description: `Dados de ${rawCpf} processados com sucesso.`,
          className: "bg-green-50 border-green-200"
        });

      } else {
        await updateProgress(transactionId, { statusGeral: 'Erro' });
        
        toast({
          title: `Erro ${response.status}`,
          description: data.message || "O servidor retornou um erro.",
          variant: "destructive",
        });
      }

    } catch (error) {
      await updateProgress(transactionId, { statusGeral: 'Erro' });
      
      setApiResponse({
        status: 'Erro',
        ok: false,
        data: { message: error.message },
        timestamp: new Date().toLocaleTimeString(),
        endpoint: activeTab === 'simular' ? '/simular' : '/consultar-simulacoes'
      });
      
      toast({
        title: "Falha na Operação",
        description: error.message || "Não foi possível conectar ao servidor.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      
      <RateLimitIndicator 
        usage={rateLimitState.usage} 
        limit={rateLimitState.limit} 
        remaining={rateLimitState.remaining} 
      />

      <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-xl border border-gray-100 shadow-sm">
        <button
          onClick={() => handleTabChange('simular')}
          disabled={loading}
          className={`flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-lg transition-all duration-300 ${
            activeTab === 'simular'
              ? 'bg-violet-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-violet-50 hover:text-violet-700'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <FileText className="h-4 w-4" />
          Simular
        </button>
        <button
          onClick={() => handleTabChange('consultar')}
          disabled={loading}
          className={`flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-lg transition-all duration-300 ${
            activeTab === 'consultar'
              ? 'bg-violet-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-violet-50 hover:text-violet-700'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Search className="h-4 w-4" />
          Consultar Simulações
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-white/80 backdrop-blur-sm border-violet-100 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="border-b border-gray-50/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Server className="h-6 w-6 text-violet-700" />
              </div>
              <div>
                <CardTitle>
                  {activeTab === 'simular' ? 'Nova Simulação' : 'Consultar Existente'}
                </CardTitle>
                <CardDescription className="mt-1">
                  API User: <span className="font-mono text-violet-600 bg-violet-50 px-1 rounded">{currentUser}</span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2 group">
                <Label htmlFor="cpf" className="text-gray-700 font-medium group-focus-within:text-violet-700 transition-colors">CPF do Cliente</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCpfChange}
                  className="font-mono text-lg tracking-wide border-gray-200 focus:border-violet-500 focus:ring-violet-200 transition-all h-12"
                  disabled={loading}
                />
              </div>

              <AnimatePresence>
                {activeTab === 'consultar' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 group"
                  >
                    <Label htmlFor="consultId" className="text-gray-700 font-medium group-focus-within:text-violet-700 transition-colors">ID da Consulta (Opcional)</Label>
                    <div className="relative">
                      <Input
                        id="consultId"
                        placeholder="Ex: 12345"
                        value={consultId}
                        onChange={(e) => setConsultId(e.target.value)}
                        className="font-mono text-lg tracking-wide pl-10 border-gray-200 focus:border-violet-500 focus:ring-violet-200 transition-all h-12"
                        disabled={loading}
                      />
                      <Key className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-violet-500 transition-colors" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>

            <CardFooter className="bg-gray-50/50 pt-6">
              <Button 
                type="submit" 
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-6 text-base shadow-lg hover:shadow-violet-500/20 transition-all"
                disabled={loading || countdown > 0}
              >
                {countdown > 0 ? (
                  <>
                    <Timer className="mr-2 h-5 w-5 animate-pulse" />
                    Aguardando {countdown}s
                  </>
                ) : loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {activeTab === 'simular' ? 'Enviando Dados...' : 'Buscando Dados...'}
                  </>
                ) : (
                  <>
                    {activeTab === 'simular' ? <Send className="mr-2 h-5 w-5" /> : <Search className="mr-2 h-5 w-5" />}
                    {activeTab === 'simular' ? 'Testar Conexão' : 'Consultar'}
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>

      <AnimatePresence>
        {apiResponse && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className={`border shadow-lg ${apiResponse.ok ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
              <CardHeader className="pb-3 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-full ${apiResponse.ok ? 'bg-green-100' : 'bg-red-100'}`}>
                      {apiResponse.ok ? (
                        <CheckCircle className="h-5 w-5 text-green-700" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-700" />
                      )}
                    </div>
                    <CardTitle className={`text-base font-bold ${apiResponse.ok ? 'text-green-900' : 'text-red-900'}`}>
                      {apiResponse.ok ? 'Resposta Recebida com Sucesso' : 'Falha na Requisição'}
                    </CardTitle>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${apiResponse.ok ? 'bg-green-100 border-green-200 text-green-800' : 'bg-red-100 border-red-200 text-red-800'}`}>
                    Status: {apiResponse.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative group">
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-gray-400 bg-white border px-2 py-1 rounded">JSON</span>
                  </div>
                  <pre className="p-4 rounded-xl text-xs font-mono overflow-auto max-h-80 border bg-white border-gray-200 text-gray-800 shadow-inner custom-scrollbar">
                    {JSON.stringify(apiResponse.data, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CPFValidator;