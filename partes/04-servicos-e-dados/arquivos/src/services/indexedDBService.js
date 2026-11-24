
import * as XLSX from 'xlsx';

const DB_NAME = 'SimuladorDB';
const DB_VERSION = 1;
const STORE_NAME = 'simulacoes';

/**
 * Deletes the entire database.
 * Useful for recovering from corruption or clearing all data.
 */
export const deleteDatabase = () => {
  return new Promise((resolve, reject) => {
    // Close any existing connections if possible (browsers manage this differently)
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onerror = (event) => {
      console.error("Error deleting database:", event.target.error);
      reject(`Error deleting database: ${event.target.error}`);
    };

    request.onsuccess = (event) => {
      console.log("Database deleted successfully");
      resolve(true);
    };
    
    request.onblocked = () => {
       console.warn("Database deletion blocked. Please close other tabs.");
    };
  });
};

/**
 * Validates if the database and object store exist and are accessible.
 */
export const validateDatabase = async () => {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      throw new Error(`Object store ${STORE_NAME} not found`);
    }
    return true;
  } catch (error) {
    console.error("Database validation failed:", error);
    return false;
  }
};

/**
 * Opens the database connection.
 * Handles upgrades and versioning.
 */
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      reject(`Database error: ${event.target.error}`);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log(`Creating object store: ${STORE_NAME}`);
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('cpf', 'cpf', { unique: false });
        objectStore.createIndex('data_simulacao', 'data_simulacao', { unique: false });
      }
    };
  });
};

/**
 * Executes an operation with automatic retry/recovery on failure.
 * If a DB error suggests corruption (e.g., NotFoundError), it attempts to reset the DB.
 */
const executeWithRecovery = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    console.error("Database operation failed:", error);
    
    // Check for specific errors that imply corruption or missing stores
    const errorMessage = typeof error === 'string' ? error : (error.message || '');
    const isCorruption = 
        errorMessage.includes('NotFoundError') || 
        errorMessage.includes('not found') || 
        errorMessage.includes('version change') ||
        errorMessage.includes('corrupted');

    if (isCorruption) {
      console.warn("Database appears corrupted or missing. Attempting recovery...");
      try {
        await deleteDatabase();
        await initDB();
        // Retry operation once after recovery
        return await operation();
      } catch (recoveryError) {
        console.error("Recovery failed:", recoveryError);
        throw new Error("Falha crítica no banco de dados. Por favor, recarregue a página.");
      }
    }
    
    throw error;
  }
};

export const initDB = async () => {
  try {
    await openDB();
    console.log('IndexedDB initialized');
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    // Attempt recovery on init failure
    await deleteDatabase();
    await openDB();
  }
};

/**
 * Saves or Updates a simulation record.
 * If ID exists, it attempts to merge, but `updateSimulation` is preferred for partial updates.
 */
export const saveSimulation = async (simulationData) => {
  return executeWithRecovery(async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const dataToSave = {
        ...simulationData,
        id: simulationData.id || crypto.randomUUID(),
        timestamp: simulationData.timestamp || Date.now(),
        updatedAt: Date.now()
      };

      const request = store.put(dataToSave);

      request.onsuccess = () => {
        resolve(dataToSave);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  });
};

/**
 * Updates specific fields of an existing simulation record.
 * Merges top-level keys.
 */
export const updateSimulation = async (id, fieldsToUpdate) => {
  return executeWithRecovery(async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // First get the existing record
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existingRecord = getRequest.result;
        
        if (!existingRecord) {
          // If record doesn't exist, we can't update it partially.
          // Depending on requirements, we might want to reject or create new.
          // Here we reject to be safe about data integrity.
          reject(new Error(`Record with id ${id} not found for update.`));
          return;
        }

        const updatedRecord = {
          ...existingRecord,
          ...fieldsToUpdate,
          id: id, // Ensure ID doesn't change
          updatedAt: Date.now()
        };

        const putRequest = store.put(updatedRecord);
        
        putRequest.onsuccess = () => {
          resolve(updatedRecord);
        };
        
        putRequest.onerror = (e) => reject(e.target.error);
      };

      getRequest.onerror = (e) => reject(e.target.error);
    });
  });
};

export const getAllSimulations = async () => {
  return executeWithRecovery(async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        // Sort by timestamp descending
        results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(results);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  });
};

export const getSimulationByCPF = async (cpf) => {
  return executeWithRecovery(async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('cpf');
      const request = index.getAll(cpf);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  });
};

export const deleteSimulation = async (id) => {
  return executeWithRecovery(async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  });
};

// --- Formatting Helpers for Export ---
const formatCurrency = (val) => {
  if (val === undefined || val === null) return '';
  // Check if val is an object (new structure) or number (old)
  const rawValue = typeof val === 'object' && val !== null ? val.value : val;
  if (rawValue === undefined || rawValue === null) return '';
  
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(rawValue)
    .replace(/\s/g, ' ');
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
};

const extractValue = (field) => {
  if (typeof field === 'object' && field !== null) return field.value;
  return field;
}

export const exportToCSV = (data) => {
  if (!data || !data.length) return '';
  
  const columns = [
    { key: 'id_simulation', header: 'ID Simulação', extractor: (row) => extractValue(row.consultId || row.id_simulation) },
    { key: 'cpf', header: 'CPF' },
    { key: 'data_simulacao', header: 'Data Simulação', formatter: formatDate },
    { key: 'statusGeral', header: 'Status Geral', extractor: (row) => row.statusGeral || row.status },
    { key: 'margem', header: 'Margem', formatter: formatCurrency },
    { key: 'valor_solicitado', header: 'Valor Solicitado', formatter: formatCurrency },
    { key: 'numero_parcelas', header: 'Nº Parcelas', extractor: (row) => extractValue(row.prazo || row.numero_parcelas) },
    { key: 'valor_parcela', header: 'Valor Parcela', formatter: formatCurrency },
    { key: 'valor_cliente_recebe', header: 'Valor Líquido', formatter: formatCurrency },
    { key: 'taxa', header: 'Taxa', extractor: (row) => extractValue(row.taxa) },
  ];

  const headerRow = columns.map(col => `"${col.header}"`).join(',');

  const rows = data.map(row => {
    return columns.map(col => {
      let val;
      if (col.extractor) {
        val = col.extractor(row);
      } else {
        val = row[col.key];
      }
      
      if (col.formatter) {
        val = col.formatter(val);
      }
      
      // Handle the new object structure for direct key access if no extractor
      if (typeof val === 'object' && val !== null && !col.extractor) {
          val = val.value;
      }

      if (val === undefined || val === null) val = '';
      const stringVal = String(val).replace(/"/g, '""');
      return `"${stringVal}"`;
    }).join(',');
  });

  return [headerRow, ...rows].join('\n');
};

export const exportToJSON = (data) => {
  return JSON.stringify(data, null, 2);
};

// --- Excel Export Services ---

const createExcelFile = (data, headers, filename) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { header: headers.map(h => h.key) });
    
    // Rename Headers
    const range = XLSX.utils.decode_range(ws['!ref']);
    for(let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1"; 
        if(!ws[address]) continue;
        const key = ws[address].v;
        const header = headers.find(h => h.key === key);
        if(header) ws[address].v = header.label;
    }

    // Basic Column Width Auto-fit Attempt
    const wscols = headers.map(h => ({ wch: Math.max(h.label.length + 5, 15) }));
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, filename);
};


export const exportQueryResultsToExcel = (results) => {
    if (!results || !results.length) return;

    const exportData = results.map(r => ({
        cpf: r.cpf,
        consultId: r.consultId,
        margem: typeof r.margem === 'object' ? r.margem?.value : r.margem,
        valorSolicitado: typeof r.valorSolicitado === 'object' ? r.valorSolicitado?.value : r.valorSolicitado,
        valorAprovado: typeof r.valorAprovado === 'object' ? r.valorAprovado?.value : r.valorAprovado,
        taxa: typeof r.taxa === 'object' ? r.taxa?.value : r.taxa,
        prazo: typeof r.prazo === 'object' ? r.prazo?.value : r.prazo,
        status: r.status
    }));

    const headers = [
        { key: 'cpf', label: 'CPF' },
        { key: 'consultId', label: 'ConsultId' },
        { key: 'margem', label: 'Margem' },
        { key: 'valorSolicitado', label: 'Valor Solicitado' },
        { key: 'valorAprovado', label: 'Valor Aprovado' },
        { key: 'taxa', label: 'Taxa' },
        { key: 'prazo', label: 'Prazo' },
        { key: 'status', label: 'Status' }
    ];

    const filename = `consulta_dados_${new Date().toISOString().slice(0,10)}.xlsx`;
    createExcelFile(exportData, headers, filename);
};

export const exportHistoryToExcel = async () => {
    const allData = await getAllSimulations();
    
    // Filter only successful queries with valid ConsultId
    const filteredData = allData
        .filter(row => {
             const consultId = extractValue(row.consultId || row.id_simulation);
             return consultId !== null && consultId !== undefined && consultId !== '';
        })
        .map(row => ({
            cpf: row.cpf,
            consultId: extractValue(row.consultId || row.id_simulation)
        }));
    
    if (filteredData.length === 0) {
        throw new Error("Nenhum registro com ConsultId encontrado para exportação.");
    }

    const headers = [
        { key: 'cpf', label: 'CPF' },
        { key: 'consultId', label: 'ConsultId' }
    ];

    const filename = `historico_consultas_${new Date().toISOString().slice(0,10)}.xlsx`;
    createExcelFile(filteredData, headers, filename);
    return filteredData.length; // Return count of exported items
};
