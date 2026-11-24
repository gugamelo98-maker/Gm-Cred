
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { exportQueryResultsToExcel } from '@/services/indexedDBService';
import { useToast } from '@/components/ui/use-toast';

const QueryResults = ({ results, loading }) => {
  const { toast } = useToast();

  const handleExport = () => {
    try {
      exportQueryResultsToExcel(results);
      toast({
        title: "Exportação Concluída",
        description: "Arquivo Excel gerado com sucesso.",
        className: "bg-green-50 border-green-200"
      });
    } catch (error) {
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar o arquivo Excel.",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (val) => {
      if (val === undefined || val === null) return '-';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <Card className="mt-6 border-violet-200 shadow-md bg-white">
      <div className="p-4 border-b border-violet-100 flex justify-between items-center bg-violet-50 rounded-t-lg">
        <h3 className="font-semibold text-violet-900">Resultados da Consulta ({results.length})</h3>
        <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            disabled={results.length === 0}
            className="text-violet-700 border-violet-200 hover:bg-violet-100"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
      </div>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader className="bg-violet-100 sticky top-0 z-10">
              <TableRow>
                <TableHead>CPF</TableHead>
                <TableHead>ConsultId</TableHead>
                <TableHead>Margem</TableHead>
                <TableHead>V. Solicitado</TableHead>
                <TableHead>V. Aprovado</TableHead>
                <TableHead>Taxa</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && results.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                        <div className="flex justify-center items-center gap-2">
                             <Loader2 className="h-4 w-4 animate-spin text-violet-600"/>
                             Iniciando consulta...
                        </div>
                    </TableCell>
                 </TableRow>
              )}
              {!loading && results.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                        Nenhum resultado para exibir.
                    </TableCell>
                 </TableRow>
              )}
              {results.map((row, index) => (
                <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <TableCell className="font-mono">{row.cpf}</TableCell>
                  <TableCell className="font-mono text-xs">{row.consultId}</TableCell>
                  <TableCell>{formatCurrency(row.margem)}</TableCell>
                  <TableCell>{formatCurrency(row.valor_solicitado)}</TableCell>
                  <TableCell>{formatCurrency(row.valor_aprovado)}</TableCell>
                  <TableCell>{row.taxa ? `${row.taxa}%` : '-'}</TableCell>
                  <TableCell>{row.prazo}</TableCell>
                  <TableCell>
                    {row.status === 'Sucesso' && <Badge variant="success">Sucesso</Badge>}
                    {row.status === 'Erro' && <Badge variant="destructive">Erro</Badge>}
                    {row.error && <span className="text-xs text-red-500 block max-w-[150px] truncate" title={row.error}>{row.error}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default QueryResults;
