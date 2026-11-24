import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Play, Loader2, Check, Shield, FileJson, Database } from 'lucide-react';

const APITestingSuite = ({ addLog, clearLogs }) => {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL;
  const API_USERNAME = import.meta.env.VITE_API_USERNAME;
  const API_PASSWORD = import.meta.env.VITE_API_PASSWORD;
  
  const runRequest = async (config) => {
    const { attempt, format, auth, proxy } = config;
    const startTime = performance.now();
    addLog({ type: 'PENDING', message: `Tentativa #${attempt}: ${format} com ${auth}` });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    let response;
    let requestBody;
    const headers = {};

    // Build Body
    if (format === 'JSON') {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify({ username: API_USERNAME, password: API_PASSWORD });
    } else if (format === 'Form-Data') {
        const formData = new FormData();
        formData.append('username', API_USERNAME);
        formData.append('password', API_PASSWORD);
        requestBody = formData;
    } else if (format === 'x-www-form-urlencoded') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        requestBody = new URLSearchParams({ username: API_USERNAME, password: API_PASSWORD });
    }
    
    // Build Auth
    if (auth === 'Basic Auth') {
        headers['Authorization'] = `Basic ${btoa(`${API_USERNAME}:${API_PASSWORD}`)}`;
    } else if (auth === 'Bearer Token') {
        // This will likely fail as we don't have a token yet, but we test it.
        headers['Authorization'] = `Bearer FAKE_TOKEN_FOR_TESTING`;
    }

    try {
        response = await fetch(API_URL, {
            method: 'POST',
            headers,
            body: requestBody,
            signal: controller.signal,
        });

        const endTime = performance.now();
        const responseTime = (endTime - startTime).toFixed(2);
        const responseData = await response.json();

        if (response.ok) {
            addLog({ type: 'SUCCESS', message: `Sucesso em ${responseTime}ms. Status: ${response.status}`, payload: { responseData } });
            return { success: true, format, auth, status: response.status, responseData };
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

    } catch (error) {
        const endTime = performance.now();
        const responseTime = (endTime - startTime).toFixed(2);
        const errorMessage = error.name === 'AbortError' ? 'Timeout' : error.message;
        addLog({ type: 'ERROR', message: `Falha em ${responseTime}ms: ${errorMessage}`, payload: { format, auth } });
        return { success: false, format, auth, error: errorMessage };
    } finally {
        clearTimeout(timeoutId);
    }
  };

  const startTesting = async () => {
    setIsTesting(true);
    clearLogs();
    setTestResults(null);
    toast({ title: 'Iniciando bateria de testes...', description: 'Aguarde os resultados.' });

    const tests = [
      { attempt: 1, format: 'JSON', auth: 'No Auth' },
      { attempt: 2, format: 'JSON', auth: 'Basic Auth' },
      { attempt: 3, format: 'JSON', auth: 'Bearer Token' },
      { attempt: 4, format: 'Form-Data', auth: 'No Auth' },
      { attempt: 5, format: 'x-www-form-urlencoded', auth: 'No Auth' },
    ];

    for (const test of tests) {
      const result = await runRequest(test);
      if (result.success) {
        setTestResults(result);
        toast({
          title: '✅ Conexão bem-sucedida!',
          description: `Formato: ${result.format}, Auth: ${result.auth}`,
        });
        setIsTesting(false);
        return;
      }
    }
    
    toast({
      title: '❌ Todos os testes falharam',
      description: 'Verifique o painel de debug para mais detalhes.',
      variant: 'destructive',
    });
    setIsTesting(false);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Bateria de Testes da API</CardTitle>
        <CardDescription>Execute testes automáticos para encontrar a configuração correta de conexão.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button onClick={startTesting} disabled={isTesting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
          {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          {isTesting ? 'Testando...' : 'Iniciar Testes de Conexão'}
        </Button>

        {testResults && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
                <Check className="h-6 w-6 text-green-600"/>
                <h3 className="text-lg font-semibold text-green-900">Configuração Vencedora Encontrada!</h3>
            </div>
            <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-gray-600"/>
                <span className="text-sm font-medium">Formato:</span>
                <span className="text-sm font-bold text-gray-800">{testResults.format}</span>
            </div>
             <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-600"/>
                <span className="text-sm font-medium">Autenticação:</span>
                <span className="text-sm font-bold text-gray-800">{testResults.auth}</span>
            </div>
             <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-gray-600"/>
                <span className="text-sm font-medium">Status:</span>
                <span className="text-sm font-bold text-gray-800">{testResults.status}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default APITestingSuite;