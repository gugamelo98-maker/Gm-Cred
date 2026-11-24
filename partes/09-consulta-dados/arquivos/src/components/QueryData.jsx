
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, FileText, Loader2, XCircle } from 'lucide-react';
import { useQueryDataStorage } from '@/hooks/useQueryDataStorage';
import QueryResults from './QueryResults';
import { validateCPF, getApiUser } from '@/services/apiService';
import { useToast } from '@/components/ui/use-toast';

const QueryData = () => {
  const [mode, setMode] = useState('single'); // 'single' | 'batch'
  const [singleCpf, setSingleCpf] = useState('');
  const [singleId, setSingleId] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [currentUser, setCurrentUser] = useState(getApiUser());
  
  const { queryData, batchQueryData, cancelBatch, getResults, loading, results } = useQueryDataStorage();
  const { toast } = useToast();

  useEffect(() => {
    setCurrentUser(getApiUser());
  }, []);

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
  };

  const handleSingleSubmit = async (e) => {
      e.preventDefault();
      
      const cpfValidation = validateCPF(singleCpf);
      if (!cpfValidation.valid) {
          toast({ title: "Erro de Validação", description: cpfValidation.message, variant: "destructive" });
          return;
      }
      
      if (!singleId.trim()) {
          toast({ title: "Erro de Validação", description: "O ID da Consulta é obrigatório.", variant: "destructive" });
          return;
      }

      try {
          await queryData(singleCpf, singleId);
      } catch (e) {
          // Error handling inside hook, already sets error state there potentially or throws
          toast({ title: "Erro na Consulta", description: e.message, variant: "destructive" });
      }
  };

  const handleBatchSubmit = async () => {
      const lines = batchInput.split('\n').filter(l => l.trim().length > 0);
      const items = [];
      const errors = [];

      lines.forEach((line, idx) => {
          // Parse by splitting on whitespace instead of comma/separators
          const parts = line.trim().split(/\s+/);
          
          if (parts.length !== 2) {
              errors.push(`Linha ${idx + 1}: Formato inválido (Esperado: CPF ConsultId)`);
              return;
          }
          const cpf = parts[0];
          const id = parts[1];
          
          const cpfVal = validateCPF(cpf);
          if (!cpfVal.valid) {
               errors.push(`Linha ${idx + 1}: CPF inválido`);
               return;
          }
          items.push({ cpf, consultId: id });
      });

      if (errors.length > 0) {
          toast({
              title: "Erros no formato do lote",
              description: (
                  <div className="max-h-32 overflow-auto">
                      {errors.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
              ),
              variant: "destructive"
          });
          if (items.length === 0) return;
      }
      
      await batchQueryData(items);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card className="bg-white border-violet-600 shadow-lg">
        <CardHeader className="bg-violet-50 border-b border-violet-100 rounded-t-lg">
           <div className="flex items-center gap-2">
               <Search className="h-6 w-6 text-violet-700" />
               <div className="flex-1">
                   <div className="flex justify-between items-center">
                       <CardTitle className="text-violet-900">Consultar Dados da Simulação</CardTitle>
                       <span className="text-xs text-violet-600 bg-violet-100 px-2 py-1 rounded-full font-mono">
                           User: {currentUser}
                       </span>
                   </div>
                   <CardDescription>Consulte os detalhes aprovados (margem, valores, taxas) usando CPF e ID.</CardDescription>
               </div>
           </div>
        </CardHeader>
        <CardContent className="pt-6">
            <div className="flex gap-2 mb-6 p-1 bg-violet-100 rounded-lg w-fit">
                <Button 
                    variant={mode === 'single' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => handleModeSwitch('single')}
                    className={mode === 'single' ? 'bg-violet-600 text-white' : 'text-violet-700 hover:text-violet-900'}
                >
                    Consulta Individual
                </Button>
                <Button 
                    variant={mode === 'batch' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => handleModeSwitch('batch')}
                    className={mode === 'batch' ? 'bg-violet-600 text-white' : 'text-violet-700 hover:text-violet-900'}
                >
                    Processar em Lote
                </Button>
            </div>

            {mode === 'single' ? (
                <form onSubmit={handleSingleSubmit} className="space-y-4 max-w-md">
                    <div className="space-y-2">
                        <Label>CPF do Cliente</Label>
                        <Input 
                            placeholder="000.000.000-00" 
                            value={singleCpf}
                            onChange={e => setSingleCpf(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>ID da Consulta (ConsultId)</Label>
                        <Input 
                            placeholder="Ex: 12345" 
                            value={singleId}
                            onChange={e => setSingleId(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>}
                        Consultar
                    </Button>
                </form>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Cole os dados (Formato: CPF ConsultId - um por linha)</Label>
                        <Textarea 
                            placeholder={"000.000.000-00 12345\n111.111.111-11 67890"}
                            className="min-h-[150px] font-mono text-sm border-violet-300 focus:border-violet-600"
                            value={batchInput}
                            onChange={e => setBatchInput(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleBatchSubmit} className="bg-violet-600 hover:bg-violet-700" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4"/>}
                            {loading ? 'Processando...' : 'Iniciar Processamento em Lote'}
                        </Button>
                        {loading && (
                            <Button variant="destructive" onClick={cancelBatch}>
                                <XCircle className="mr-2 h-4 w-4"/> Cancelar
                            </Button>
                        )}
                    </div>
                    {loading && (
                        <p className="text-xs text-amber-600 font-medium animate-pulse">
                            Atenção: Respeitando limite de 20 requisições por minuto e intervalo de 3s entre consultas.
                        </p>
                    )}
                </div>
            )}
        </CardContent>
      </Card>
      
      {(results.length > 0 || loading) && (
          <QueryResults results={results} loading={loading} />
      )}
    </div>
  );
};

export default QueryData;
