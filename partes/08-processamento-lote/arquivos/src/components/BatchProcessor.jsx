
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { List, Play, XCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { validateCPF, getApiUser } from '@/services/apiService';

const BatchProcessor = ({ onStartProcessing, isProcessing, onCancel }) => {
  const [inputText, setInputText] = useState('');
  const [validCpfs, setValidCpfs] = useState([]);
  const [currentUser, setCurrentUser] = useState(getApiUser());

  useEffect(() => {
    setCurrentUser(getApiUser());
  }, []);

  const handleTextChange = (e) => {
    const text = e.target.value;
    setInputText(text);

    const lines = text.split('\n');
    const cpfs = lines
      .map(line => line.replace(/\D/g, ''))
      .filter(cpf => {
        // Basic length check for pre-filtering, full validation happens later but we want to show count of "plausible" CPFs
        return cpf.length === 11;
      });
    
    // Unique CPFs only
    setValidCpfs([...new Set(cpfs)]);
  };

  const handleProcess = () => {
    // We only send plausible CPFs to the processor
    // The processor will perform strict validation on each item
    if (validCpfs.length > 0) {
      onStartProcessing(validCpfs);
    }
  };

  return (
    <Card className="h-full shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <List className="h-5 w-5 text-blue-600" />
              <CardTitle>Entrada de CPFs</CardTitle>
            </div>
            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-1 rounded">
                API User: {currentUser}
            </span>
        </div>
        <CardDescription>
          Cole a lista de CPFs abaixo (um por linha). A aplicação respeita o limite de 20 requisições por minuto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cpf-batch-input">Lista de CPFs</Label>
          <Textarea
            id="cpf-batch-input"
            className="min-h-[200px]"
            placeholder="000.000.000-00&#10;111.111.111-11&#10;222.222.222-22"
            value={inputText}
            onChange={handleTextChange}
            disabled={isProcessing}
          />
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>CPFs identificados: <span className="font-bold text-gray-900">{validCpfs.length}</span></span>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-3">
        {isProcessing ? (
          <Button variant="destructive" onClick={onCancel}>
            <XCircle className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        ) : (
          <Button onClick={handleProcess} disabled={validCpfs.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Play className="mr-2 h-4 w-4" />
            Processar Lote
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default BatchProcessor;
