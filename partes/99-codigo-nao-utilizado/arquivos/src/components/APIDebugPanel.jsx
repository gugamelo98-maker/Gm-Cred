
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const LogItem = ({ log }) => {
  const getIcon = () => {
    switch (log.type) {
      case 'SUCCESS':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'ERROR':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'PENDING':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <div className="h-5 w-5" />;
    }
  };

  const getBackgroundColor = () => {
    switch (log.type) {
      case 'SUCCESS':
        return 'bg-green-50';
      case 'ERROR':
        return 'bg-red-50';
      default:
        return 'bg-white';
    }
  };

  return (
    <div className={`p-3 border-b border-gray-200 last:border-b-0 ${getBackgroundColor()}`}>
      <div className="flex items-start gap-3">
        <div className="mt-1">{getIcon()}</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">{log.message}</p>
          {log.payload && (
            <pre className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded-md overflow-x-auto">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

const APIDebugPanel = ({ logs, clearLogs }) => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Painel de Depuração</CardTitle>
                <CardDescription>Logs de requisições em tempo real.</CardDescription>
            </div>
            {logs.length > 0 && (
                 <Button variant="outline" size="sm" onClick={clearLogs} className="text-red-500 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4 mr-2"/>
                    Limpar
                </Button>
            )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-y-auto">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center text-gray-500">
              <p>Inicie um teste para ver os logs aqui.</p>
            </div>
          ) : (
            <div>
              {logs.map((log, index) => (
                <LogItem key={`${log.timestamp}-${index}`} log={log} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default APIDebugPanel;
