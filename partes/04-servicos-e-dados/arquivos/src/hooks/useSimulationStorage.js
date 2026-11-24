
import { useState, useEffect, useCallback } from 'react';
import * as dbService from '@/services/indexedDBService';
import { useToast } from '@/components/ui/use-toast';

export const useSimulationStorage = () => {
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const handleDBError = useCallback(async (err) => {
      console.error("Storage Hook Error:", err);
      const errorMessage = typeof err === 'string' ? err : err.message;
      
      // Heuristic for severe corruption that might need manual intervention or notification
      if (errorMessage.includes("Falha crítica")) {
          toast({
              title: "Erro de Banco de Dados",
              description: "Houve um problema com o armazenamento local. O banco foi redefinido.",
              variant: "destructive"
          });
      }
      
      setError(errorMessage);
  }, [toast]);

  const loadSimulations = useCallback(async () => {
    try {
      setLoading(true);
      // Validate first on explicit loads to ensure integrity
      const isValid = await dbService.validateDatabase();
      if (!isValid) {
          console.warn("Database validation failed during load. Re-initializing...");
          await dbService.initDB();
      }
      
      const data = await dbService.getAllSimulations();
      setSimulations(data);
      setError(null);
    } catch (err) {
      await handleDBError(err);
    } finally {
      setLoading(false);
    }
  }, [handleDBError]);

  useEffect(() => {
    dbService.initDB().then(() => {
      loadSimulations();
    }).catch(err => {
        console.error("Initial DB Init failed:", err);
        // Last ditch effort recovery
        dbService.deleteDatabase().then(() => dbService.initDB().then(() => loadSimulations()));
    });
  }, [loadSimulations]);

  const save = async (data) => {
    try {
      // Don't set global loading true to avoid UI flickering during background saves
      await dbService.saveSimulation(data);
      await loadSimulations(); 
      return true;
    } catch (err) {
      await handleDBError(err);
      return false;
    }
  };

  const updateProgress = async (id, fieldsToUpdate) => {
    try {
        await dbService.updateSimulation(id, fieldsToUpdate);
        // We trigger a reload so the UI updates with the new progress
        await loadSimulations();
        return true;
    } catch (err) {
        console.error("Failed to update progress:", err);
        return false;
    }
  };

  const remove = async (id) => {
    try {
      setLoading(true);
      await dbService.deleteSimulation(id);
      await loadSimulations();
      return true;
    } catch (err) {
      await handleDBError(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearAll = async () => {
    try {
        setLoading(true);
        await dbService.deleteDatabase();
        await dbService.initDB();
        setSimulations([]);
        return true;
    } catch (err) {
        await handleDBError(err);
        return false;
    } finally {
        setLoading(false);
    }
  };
  
  const getLatestByCPF = async (cpf) => {
      try {
          const results = await dbService.getSimulationByCPF(cpf);
          if (results && results.length > 0) {
              // Sort by timestamp descending
              return results.sort((a, b) => b.timestamp - a.timestamp)[0];
          }
          return null;
      } catch (err) {
          console.error("Error fetching by CPF", err);
          return null;
      }
  };

  const exportCSV = () => {
    const csv = dbService.exportToCSV(simulations);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `simulacoes_export_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    const json = dbService.exportToJSON(simulations);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `simulacoes_export_${new Date().toISOString().slice(0,10)}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    simulations,
    loading,
    error,
    save,
    updateProgress,
    remove,
    clearAll,
    getLatestByCPF,
    exportCSV,
    exportJSON,
    refresh: loadSimulations
  };
};
