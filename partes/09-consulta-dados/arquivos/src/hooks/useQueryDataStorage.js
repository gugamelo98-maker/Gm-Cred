
import { useState, useRef } from 'react';
import { queryDataAPI } from '@/services/apiService';
import { checkRateLimit, recordRequest } from '@/services/rateLimiter';
import { saveSimulation } from '@/services/indexedDBService';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const useQueryDataStorage = () => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);

    const queryData = async (cpf, consultId) => {
        setLoading(true);
        setError(null);
        try {
            const limitStatus = checkRateLimit();
            if (!limitStatus.allowed) {
                throw new Error(`Limite de requisições excedido. Aguarde ${limitStatus.waitSeconds}s.`);
            }
            
            recordRequest();
            
            // Allow cancellation
            abortControllerRef.current = new AbortController();
            
            const data = await queryDataAPI(cpf, consultId, abortControllerRef.current.signal);
            
            const resultItem = {
                cpf,
                consultId,
                ...data,
                timestamp: Date.now()
            };

            setResults(prev => [resultItem, ...prev]);

            // Save single result to DB for history
            await saveSimulation({
                id: crypto.randomUUID(),
                cpf,
                consultId: { status: 'Sucesso', value: consultId },
                margem: { status: 'Sucesso', value: data.margem },
                valorSolicitado: { status: 'Sucesso', value: data.valor_solicitado },
                valorAprovado: { status: 'Sucesso', value: data.valor_aprovado },
                taxa: { status: 'Sucesso', value: data.taxa },
                prazo: { status: 'Sucesso', value: data.prazo },
                statusGeral: 'Sucesso',
                provider: 'Consulta Dados',
                data_simulacao: new Date().toISOString()
            });

            return resultItem;

        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const batchQueryData = async (items) => {
        // Items is array of {cpf, consultId}
        setResults([]); // Clear previous
        setLoading(true);
        setError(null);
        abortControllerRef.current = new AbortController();

        const total = items.length;
        let processed = 0;

        for (const item of items) {
            if (abortControllerRef.current.signal.aborted) break;

            // Rate Limit Logic inside loop
            let limitStatus = checkRateLimit();
            while (!limitStatus.allowed) {
                 if (abortControllerRef.current.signal.aborted) break;
                 // Ideally inform UI about waiting status here, simplifed for now
                 await wait(1000); 
                 limitStatus = checkRateLimit();
            }

            // 2s delay between requests
            if (processed > 0) {
                await wait(2000);
            }

            try {
                recordRequest();
                const data = await queryDataAPI(item.cpf, item.consultId, abortControllerRef.current.signal);
                
                const resultItem = {
                    cpf: item.cpf,
                    consultId: item.consultId,
                    ...data,
                    timestamp: Date.now()
                };

                setResults(prev => [resultItem, ...prev]);
                
                // Fire and forget save to avoid blocking UI loop significantly
                saveSimulation({
                    id: crypto.randomUUID(),
                    cpf: item.cpf,
                    consultId: { status: 'Sucesso', value: item.consultId },
                    margem: { status: 'Sucesso', value: data.margem },
                    valorSolicitado: { status: 'Sucesso', value: data.valor_solicitado },
                    valorAprovado: { status: 'Sucesso', value: data.valor_aprovado },
                    taxa: { status: 'Sucesso', value: data.taxa },
                    prazo: { status: 'Sucesso', value: data.prazo },
                    statusGeral: 'Sucesso',
                    provider: 'Consulta Dados Lote',
                    data_simulacao: new Date().toISOString()
                });

            } catch (err) {
                // Add error result
                setResults(prev => [{
                    cpf: item.cpf,
                    consultId: item.consultId,
                    status: 'Erro',
                    error: err.message
                }, ...prev]);
            }
            
            processed++;
        }
        setLoading(false);
    };

    const cancelBatch = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setLoading(false);
    };
    
    const getResults = () => results;

    return {
        queryData,
        batchQueryData,
        cancelBatch,
        getResults,
        loading,
        error,
        results
    };
};
