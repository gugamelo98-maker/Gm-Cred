
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, AlertCircle, CheckCircle, Clock, Hourglass, Timer } from 'lucide-react';

const ResultBadge = ({ status, value, type = 'text' }) => {
    let displayValue = value;
    let badgeStatus = 'Aguardando';
    let badgeVariant = 'outline'; // Default styling base
    
    if (value !== undefined && value !== null) {
        badgeStatus = 'Sucesso';
        badgeVariant = 'success';
    } else if (status === 'error') {
        badgeStatus = 'Erro';
        badgeVariant = 'destructive';
    } else if (status === 'processing') {
        badgeStatus = 'Processando';
        badgeVariant = 'warning'; // Using yellow for processing
    }

    if (type === 'currency' && displayValue) {
        displayValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayValue);
    }
    
    if (!displayValue) displayValue = '-';

    return (
        <div className="flex flex-col items-start gap-1">
            <Badge variant={badgeVariant} className="text-[10px] h-4 px-1 rounded-sm border-0">
                {badgeStatus}
            </Badge>
            <span className="text-xs font-medium truncate max-w-[100px] text-gray-700">{displayValue}</span>
        </div>
    );
};


const BatchResults = ({ results, onReprocessErrors, isProcessing }) => {
  
  const hasErrors = results.some(r => r.status === 'error');

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Erro</Badge>;
      case 'processing':
        return <Badge className="flex items-center gap-1 bg-yellow-400 text-yellow-900 hover:bg-yellow-500"><RefreshCw className="h-3 w-3 animate-spin" /> Processando</Badge>;
      case 'waiting':
        return <Badge variant="secondary" className="flex items-center gap-1"><Hourglass className="h-3 w-3 animate-pulse" /> Aguardando</Badge>;
      case 'rate_limit_waiting':
        return <Badge className="flex items-center gap-1 bg-orange-400 hover:bg-orange-500 text-white"><Timer className="h-3 w-3 animate-pulse" /> Rate Limit</Badge>;
      default:
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
    }
  };

  return (
    <Card className="h-full shadow-lg border-violet-600 bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-violet-100 bg-violet-50 rounded-t-lg">
        <CardTitle className="text-lg text-violet-900">Resultados do Processamento</CardTitle>
        {hasErrors && !isProcessing && (
          <Button variant="outline" size="sm" onClick={onReprocessErrors} className="text-red-600 border-red-200 hover:bg-red-50">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reprocessar Erros
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader className="bg-violet-800 sticky top-0 z-10 shadow-sm">
              <TableRow className="hover:bg-violet-800 border-b border-violet-700">
                <TableHead className="w-[140px] text-white font-semibold">CPF</TableHead>
                <TableHead className="text-white font-semibold">Status</TableHead>
                <TableHead className="text-white font-semibold">ID Consulta</TableHead>
                <TableHead className="text-white font-semibold">Margem</TableHead>
                <TableHead className="text-white font-semibold">Valor Solicitado</TableHead>
                <TableHead className="text-white font-semibold">Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                    Aguardando início do processamento...
                  </TableCell>
                </TableRow>
              ) : (
                results.map((item, index) => (
                  <TableRow key={item.cpf} className={index % 2 === 0 ? "bg-white hover:bg-violet-50" : "bg-violet-50 hover:bg-violet-100"}>
                    <TableCell className="font-mono font-medium text-gray-900">{item.cpf}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell><ResultBadge status={item.status} value={item.consultId} /></TableCell>
                    <TableCell><ResultBadge status={item.status} value={item.data?.margem} type="currency" /></TableCell>
                    <TableCell><ResultBadge status={item.status} value={item.data?.valor_solicitado} type="currency" /></TableCell>
                    <TableCell className="text-gray-500 text-xs truncate max-w-[200px]" title={item.error || item.statusMessage || 'OK'}>
                      {item.error || item.statusMessage || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default BatchResults;
