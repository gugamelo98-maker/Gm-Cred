
import React, { useState, useRef, useEffect } from 'react';
import BatchProcessor from './BatchProcessor';
import BatchResults from './BatchResults';
import RateLimitIndicator from './RateLimitIndicator';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileJson, FileSpreadsheet } from 'lucide-react';
import { useSimulationStorage } from '@/hooks/useSimulationStorage';
import { exportToCSV, exportToJSON } from '@/services/indexedDBService';
import { useToast } from '@/components/ui/use-toast';
import { validateCPF, callAPIWithTimeout, validateAPIResponse, getApiUser } from '@/services/apiService';
import { motion } from 'framer-motion';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const BatchProcessing = ({ rateLimitState, checkRateLimit, recordRequest }) => {
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, success: 0, error: 0, processed: 0 });
  const [startTime, setStartTime] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [currentUser, setCurrentUser] = useState(getApiUser());
  
  const abortControllerRef = useRef(null);
  const { save } = useSimulationStorage();
  const { toast } = useToast();

  const BASE_URL = "https://servicos-api-clt-v8-multi-login.nttja3.easypanel.host";

  useEffect(() => {
    // Refresh user from localStorage on mount and when changed
    setCurrentUser(getApiUser());
  }, [isProcessing]); // Re-check before processing starts/stops

  const updateStats = (currentResults) => {
    const total = currentResults.length;
    const processed = currentResults.filter(r => r.status === 'success' || r.status === 'error').length;
    const success = currentResults.filter(r => r.status === 'success').length;
    const error = currentResults.filter(r => r.status === 'error').length;
    
    setStats({ total, success, error, processed });
    setProgress(total === 0 ? 0 : Math.round((processed / total) * 100));

    if (startTime && processed > 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = total - processed;
      const etaSeconds = rate > 0 ? remaining / rate : 0;
      setEstimatedTime(Math.ceil(etaSeconds));
    }
  };

  const processItem = async (item, updateStatus) => {
    if (item.status === 'success') return item; 

    if (abortControllerRef.current?.signal.aborted) {
        return { ...item, status: 'error', error: 'Cancelado pelo usuário' };
    }

    // Delay between requests (3 seconds as per new rate limit 20 req/min)
    updateStatus('waiting', 'Aguardando 3s...');
    await wait(1000);
    if (abortControllerRef.current?.signal.aborted) return { ...item, status: 'error', error: 'Cancelado pelo usuário' };
    updateStatus('waiting', 'Aguardando 2s...');
    await wait(1000);
    if (abortControllerRef.current?.signal.aborted) return { ...item, status: 'error', error: 'Cancelado pelo usuário' };
    updateStatus('waiting', 'Aguardando 1s...');
    await wait(1000);
    if (abortControllerRef.current?.signal.aborted) return { ...item, status: 'error', error: 'Cancelado pelo usuário' };

    let limitStatus = checkRateLimit();
    while (!limitStatus.allowed) {
        if (abortControllerRef.current?.signal.aborted) return { ...item, status: 'error', error: 'Cancelado pelo usuário' };
        updateStatus('rate_limit_waiting', `Limite atingido. Aguardando ${limitStatus.waitSeconds}s...`);
        await wait(1000);
        limitStatus = checkRateLimit();
    }

    updateStatus('processing', 'Processando...');

    const validation = validateCPF(item.cpf);
    if (!validation.valid) {
      return { ...item, status: 'error', error: validation.message, statusMessage: null };
    }
    
    // Get fresh user for this item (in case it changed during long batch)
    const activeUser = getApiUser();

    try {
      recordRequest();

      const simResult = await callAPIWithTimeout(
        `${BASE_URL}/simular`, 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpf: item.cpf, usuario: activeUser }),
          signal: abortControllerRef.current?.signal
        },
        10000 
      );

      if (!simResult.success) {
         return { ...item, status: 'error', error: simResult.error, statusMessage: null };
      }

      if (simResult.response.status === 429) {
          return { ...item, status: 'error', error: "Erro 429: Limite excedido", statusMessage: null };
      }

      if (!simResult.response.ok) {
         return { ...item, status: 'error', error: `Erro Servidor: ${simResult.response.status}`, statusMessage: null };
      }
      
      let simData;
      try { simData = await simResult.response.json(); } 
      catch { return { ...item, status: 'error', error: "Resposta JSON inválida da Simulação", statusMessage: null }; }
      
      const consultId = simData.consultId || simData.id || (simData.data && simData.data.consultId) || (simData.data && simData.data.id);
      
      let finalData = simData.data || simData;
      
      if (consultId) {
        limitStatus = checkRateLimit();
        while (!limitStatus.allowed) {
            updateStatus('rate_limit_waiting', `Aguardando limite para consulta...`);
            await wait(1000);
            limitStatus = checkRateLimit();
        }
        recordRequest();

        const consultResult = await callAPIWithTimeout(
             `${BASE_URL}/consultar-simulacoes`, 
             {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpf: item.cpf, usuario: activeUser, consultId }),
                signal: abortControllerRef.current?.signal
             },
             10000 
        );

        if (consultResult.success && consultResult.response.ok) {
            try {
                const consultJson = await consultResult.response.json();
                if (consultJson.data) {
                    finalData = { ...finalData, ...consultJson.data };
                }
            } catch (e) {
                console.warn(`Erro ao parsear consulta para ${item.cpf}`, e);
            }
        }
      }

      const simulationRecord = {
        id: crypto.randomUUID(),
        cpf: item.cpf,
        usuario: activeUser,
        id_simulation: consultId || null,
        status: simResult.response.status,
        margem: finalData.margem || 0,
        valor_solicitado: finalData.valor_solicitado || 0,
        numero_parcelas: finalData.numero_parcelas || 0,
        valor_parcela: finalData.valor_parcela || 0,
        valor_cliente_recebe: finalData.valor_cliente_recebe || 0,
        iof_amount: finalData.iof_amount || 0,
        insurance_amount: finalData.insurance_amount || 0,
        provider: finalData.provider || 'N/A',
        first_installment_date: finalData.first_installment_date || null,
        is_insured: finalData.is_insured !== undefined ? finalData.is_insured : false,
        data_simulacao: new Date().toISOString(),
        resposta_completa: finalData
      };

      await save(simulationRecord);

      return {
        ...item,
        status: 'success',
        consultId: consultId,
        data: finalData,
        error: null,
        statusMessage: 'Concluído'
      };

    } catch (err) {
      return { ...item, status: 'error', error: err.message || "Erro desconhecido", statusMessage: null };
    }
  };

  const startBatch = async (cpfs) => {
    setResults(cpfs.map(cpf => ({ cpf, status: 'pending', data: null, error: null, statusMessage: null })));
    setStats({ total: cpfs.length, success: 0, error: 0, processed: 0 });
    setIsProcessing(true);
    setStartTime(Date.now());
    setEstimatedTime(null);
    
    abortControllerRef.current = new AbortController();

    const queue = cpfs.map(cpf => ({ cpf, status: 'pending', data: null, error: null }));
    const maxConcurrent = 5;
    let currentIndex = 0;

    const next = async () => {
        if (abortControllerRef.current?.signal.aborted) return;
        if (currentIndex >= queue.length) return;

        const index = currentIndex++;
        
        const updateStatus = (status, message) => {
            setResults(prev => {
                const newResults = [...prev];
                if(newResults[index]) {
                    newResults[index] = { ...newResults[index], status, statusMessage: message };
                }
                return newResults;
            });
        };

        const result = await processItem(queue[index], updateStatus);

        setResults(prev => {
            const newResults = [...prev];
            if(newResults[index]) {
                newResults[index] = result;
            }
            updateStats(newResults);
            return newResults;
        });

        await next();
    };

    const workers = [];
    for (let i = 0; i < maxConcurrent && i < queue.length; i++) {
        workers.push(next());
    }

    await Promise.all(workers);
    
    setIsProcessing(false);
    setStartTime(null);
    setEstimatedTime(null);
    
    if (!abortControllerRef.current?.signal.aborted) {
        toast({ title: "Processamento Concluído", description: "Todos os CPFs foram processados." });
    }
  };

  const cancelBatch = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    setIsProcessing(false);
    toast({ title: "Cancelado", description: "O processamento foi interrompido.", variant: "destructive" });
  };

  const reprocessErrors = async () => {
    const erroredCpfs = results.filter(r => r.status === 'error').map(r => r.cpf);
    if (erroredCpfs.length === 0) return;
    startBatch(erroredCpfs);
  };

  const handleExportCSV = () => {
    const exportData = results.map(r => ({
        cpf: r.cpf,
        status: r.status,
        id_simulation: r.consultId,
        margem: r.data?.margem,
        valor_solicitado: r.data?.valor_solicitado,
        error: r.error
    }));
    
    const csv = exportToCSV(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `batch_results_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const json = exportToJSON(results);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `batch_results_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-1 h-full space-y-4"
        >
            <Card className="p-4 bg-white/80 backdrop-blur-sm border-violet-100 shadow-lg">
               <BatchProcessor 
                  onStartProcessing={startBatch} 
                  isProcessing={isProcessing} 
                  onCancel={cancelBatch}
               />
            </Card>
            
            <RateLimitIndicator 
                usage={rateLimitState.usage} 
                limit={rateLimitState.limit} 
                remaining={rateLimitState.remaining} 
            />
        </motion.div>
        
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-2 flex flex-col gap-4"
        >
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-violet-100 shadow-lg">
                <div className="flex flex-col space-y-4">
                    <div className="flex justify-between text-sm text-gray-700 font-medium">
                        <span>Progresso: {stats.processed} de {stats.total}</span>
                        {isProcessing && estimatedTime !== null && (
                            <span className="text-violet-600 font-bold animate-pulse">
                                ETA: {estimatedTime}s
                            </span>
                        )}
                    </div>
                    <Progress value={progress} className="h-2 bg-gray-100" indicatorClassName="bg-gradient-to-r from-violet-600 to-violet-400" />
                    <div className="flex justify-between gap-2 text-xs font-medium text-gray-600">
                         <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-100 text-green-700">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span> Sucesso: {stats.success}
                         </span>
                         <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-100 text-red-700">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span> Falha: {stats.error}
                         </span>
                    </div>
                </div>
            </Card>

            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={results.length === 0} className="hover:text-green-700 hover:border-green-200">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportJSON} disabled={results.length === 0} className="hover:text-violet-700 hover:border-violet-200">
                    <FileJson className="mr-2 h-4 w-4" />
                    Exportar JSON
                </Button>
            </div>

            <div className="flex-1 min-h-[400px]">
                <BatchResults 
                    results={results} 
                    onReprocessErrors={reprocessErrors}
                    isProcessing={isProcessing}
                />
            </div>
        </motion.div>
      </div>
    </div>
  );
};

export default BatchProcessing;
