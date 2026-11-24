
import React, { useState, useMemo, useEffect } from 'react';
import { useSimulationStorage } from '@/hooks/useSimulationStorage';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  FileJson, 
  FileSpreadsheet, 
  Search, 
  History,
  Eye,
  RefreshCw,
  Trash
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { exportHistoryToExcel } from '@/services/indexedDBService';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";

const StatusBadge = ({ fieldData }) => {
  if (typeof fieldData !== 'object' || fieldData === null) {
      if (fieldData === undefined || fieldData === null) {
          return <span className="text-gray-400">-</span>;
      }
      return <span className="text-gray-700 font-medium">{fieldData}</span>;
  }

  const { status, value } = fieldData;
  const displayValue = value !== null && value !== undefined ? value : '-';

  let badgeVariant = 'outline';
  if (status === 'Sucesso') badgeVariant = 'success';
  if (status === 'Processando') badgeVariant = 'warning';
  if (status === 'Erro') badgeVariant = 'destructive';

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={badgeVariant} className="text-[10px] h-5 px-1.5 rounded-sm border-0">
        {status}
      </Badge>
      <span className="text-sm font-medium">{displayValue}</span>
    </div>
  );
};

const formatCurrency = (val) => {
  if (val === '-' || val === undefined || val === null) return val;
  if (typeof val === 'string' && val.includes('R$')) return val;
  try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  } catch (e) {
      return val;
  }
};

const CurrencyBadge = ({ fieldData }) => {
    let displayValue = fieldData;
    let status = 'Sucesso';

    if (typeof fieldData === 'object' && fieldData !== null) {
        status = fieldData.status;
        displayValue = fieldData.value;
    }

    if (displayValue !== null && displayValue !== undefined) {
        displayValue = formatCurrency(displayValue);
    }
    
    const safeData = typeof fieldData === 'object' && fieldData !== null 
        ? { ...fieldData, value: displayValue }
        : { status, value: displayValue };
        
    return <StatusBadge fieldData={safeData} />;
};


const SimulationHistory = () => {
  const { simulations, loading, error, remove, clearAll, exportCSV, exportJSON, refresh } = useSimulationStorage();
  const [filterCpf, setFilterCpf] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const interval = setInterval(() => {
        refresh();
    }, 500);
    return () => clearInterval(interval);
  }, [refresh]);

  const filteredSimulations = useMemo(() => {
    return simulations.filter(sim => 
      (sim.cpf && sim.cpf.includes(filterCpf)) || 
      (sim.consultId && typeof sim.consultId === 'object' && String(sim.consultId.value).includes(filterCpf)) ||
      (sim.id_simulation && String(sim.id_simulation).includes(filterCpf))
    );
  }, [simulations, filterCpf]);

  const handleDelete = async () => {
    if (deleteId) {
      await remove(deleteId);
      setDeleteId(null);
      toast({
        title: "Registro excluído",
        description: "A simulação foi removida do histórico.",
      });
    }
  };

  const handleClearHistory = async () => {
      setIsClearing(true);
      try {
          await clearAll();
          toast({
              title: "Histórico limpo com sucesso",
              description: "Todos os registros foram removidos.",
              className: "bg-green-50 border-green-200"
          });
      } catch (e) {
          toast({
              title: "Erro ao limpar",
              description: "Não foi possível limpar o histórico.",
              variant: "destructive"
          });
      } finally {
          setIsClearing(false);
      }
  };
  
  const handleManualRefresh = async () => {
     await refresh();
     toast({
        title: "Atualizado",
        description: "Histórico sincronizado com sucesso.",
     });
  };

  const handleExportExcel = async () => {
     try {
         const count = await exportHistoryToExcel();
         toast({
             title: "Exportação Concluída",
             description: `${count} registros com ConsultId exportados para Excel.`,
             className: "bg-green-50 border-green-200"
         });
     } catch (e) {
         toast({
             title: "Erro na Exportação",
             description: e.message,
             variant: "destructive"
         });
     }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Card className="bg-white border-violet-600 shadow-lg">
        <CardHeader className="border-b border-violet-100 bg-violet-50 rounded-t-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <History className="h-6 w-6 text-violet-700" />
              <div>
                <CardTitle className="text-violet-900">Histórico de Simulações</CardTitle>
                <CardDescription>
                  {simulations.length} registros encontrados (Atualização em tempo real)
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
               <Button variant="ghost" size="sm" onClick={handleManualRefresh} disabled={loading}>
                 <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                 Atualizar
               </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={simulations.length === 0} className="text-green-700 border-green-200 hover:bg-green-50">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Baixar Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={simulations.length === 0}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportJSON} disabled={simulations.length === 0}>
                <FileJson className="mr-2 h-4 w-4" />
                JSON
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={simulations.length === 0 || loading || isClearing}>
                        <Trash className="mr-2 h-4 w-4" />
                        Limpar Histórico
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Limpar todo o histórico?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação excluirá PERMANENTEMENTE todos os {simulations.length} registros salvos localmente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearHistory} className="bg-red-600 hover:bg-red-700">
                            Confirmar Limpeza
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-violet-400" />
              <Input 
                placeholder="Filtrar por CPF ou ID..." 
                value={filterCpf}
                onChange={(e) => setFilterCpf(e.target.value)}
                className="pl-10 border-violet-300 focus:border-violet-600"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
               Erro ao carregar histórico: {error}
            </div>
          )}

          <div className="rounded-md border border-violet-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-violet-800 text-white font-semibold">
                  <tr>
                    <th className="px-4 py-3">CPF</th>
                    <th className="px-4 py-3">ConsultId</th>
                    <th className="px-4 py-3">Margem</th>
                    <th className="px-4 py-3">Valor Solicitado</th>
                    <th className="px-4 py-3">Valor Aprovado</th>
                    <th className="px-4 py-3">Taxa</th>
                    <th className="px-4 py-3">Prazo</th>
                    <th className="px-4 py-3">Status Geral</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-100 bg-white">
                  {loading && simulations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredSimulations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        Nenhuma simulação encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredSimulations.map((sim, index) => (
                      <tr key={sim.id} className={`transition-colors border-b border-violet-100 ${index % 2 === 0 ? 'bg-white' : 'bg-violet-50'} hover:bg-violet-100`}>
                        <td className="px-4 py-3 font-mono text-gray-900 font-medium align-top pt-4">
                          {sim.cpf}
                          <div className="text-[10px] text-gray-500 font-normal mt-1">
                             {formatDate(sim.timestamp)}
                          </div>
                        </td>
                        
                        <td className="px-4 py-3 align-top"><StatusBadge fieldData={sim.consultId || sim.id_simulation} /></td>
                        <td className="px-4 py-3 align-top"><CurrencyBadge fieldData={sim.margem} /></td>
                        <td className="px-4 py-3 align-top"><CurrencyBadge fieldData={sim.valorSolicitado || sim.valor_solicitado} /></td>
                        <td className="px-4 py-3 align-top"><CurrencyBadge fieldData={sim.valorAprovado || sim.valor_cliente_recebe} /></td>
                        <td className="px-4 py-3 align-top"><StatusBadge fieldData={sim.taxa} /></td>
                        <td className="px-4 py-3 align-top"><StatusBadge fieldData={sim.prazo || sim.numero_parcelas} /></td>
                        
                        <td className="px-4 py-3 align-top">
                           {(() => {
                               const status = sim.statusGeral || (sim.status === 200 ? 'Sucesso' : sim.status ? 'Erro' : 'Processando');
                               let bg = "bg-gray-100 text-gray-800";
                               if (status === 'Sucesso') bg = "bg-green-100 text-green-800";
                               if (status === 'Erro') bg = "bg-red-100 text-red-800";
                               if (status === 'Processando') bg = "bg-yellow-100 text-yellow-800 animate-pulse";
                               
                               return <span className={`px-2 py-1 rounded-full text-xs font-bold ${bg}`}>{status}</span>;
                           })()}
                        </td>

                        <td className="px-4 py-3 text-right flex items-center justify-end gap-1 align-top pt-3">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-600 hover:text-violet-800 hover:bg-violet-200">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Detalhes Completos</DialogTitle>
                                <DialogDescription>ID: {sim.id}</DialogDescription>
                              </DialogHeader>
                              <div className="text-sm mt-4">
                                <pre className="bg-gray-50 p-4 rounded overflow-auto max-h-96 text-xs text-gray-800 border border-gray-200">
                                    {JSON.stringify(sim, null, 2)}
                                </pre>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteId(sim.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Registro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Isso removerá esta simulação do histórico.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={handleDelete}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimulationHistory;
