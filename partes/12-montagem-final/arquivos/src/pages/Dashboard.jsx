import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import CPFValidator from '@/components/CPFValidator';
import SimulationHistory from '@/components/SimulationHistory';
import BatchProcessing from '@/components/BatchProcessing';
import QueryData from '@/components/QueryData';
import { checkRateLimit, recordRequest } from '@/services/rateLimiter';
import { validateDatabase, initDB, deleteDatabase } from '@/services/indexedDBService';
import { Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('validator');
  
  // Rate Limit State Logic
  const [rateLimitState, setRateLimitState] = useState({ 
    allowed: true, 
    remaining: 50, 
    usage: 0, 
    limit: 50, 
    resetTime: null 
  });

  const refreshRateLimit = useCallback(() => {
    const status = checkRateLimit();
    setRateLimitState(prev => {
        if (prev.usage !== status.usage || prev.remaining !== status.remaining) {
            return status;
        }
        return prev;
    });
  }, []);

  useEffect(() => {
    const checkDB = async () => {
      const isValid = await validateDatabase();
      if (!isValid) {
        try {
          await deleteDatabase();
          await initDB();
        } catch (e) {
          console.error("Critical: DB Recovery failed on startup", e);
        }
      }
    };
    checkDB();
  }, []);

  useEffect(() => {
    refreshRateLimit();
    const interval = setInterval(refreshRateLimit, 1000);
    const handleStorageEvent = (e) => {
        if (e.key === 'api_request_timestamps') refreshRateLimit();
    };
    const handleCustomEvent = () => refreshRateLimit();
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('rate_limit_updated', handleCustomEvent);
    return () => {
        clearInterval(interval);
        window.removeEventListener('storage', handleStorageEvent);
        window.removeEventListener('rate_limit_updated', handleCustomEvent);
    };
  }, [refreshRateLimit]);

  const handleRecordRequest = () => {
    const recorded = recordRequest();
    if (recorded) refreshRateLimit();
    return recorded;
  };

  const pageVariants = {
    initial: { opacity: 0, x: 10 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: -10 }
  };

  const pageTransition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.3
  };

  return (
    <>
      <Helmet>
        <title>Dashboard - CPF Validator Pro</title>
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        
        <div className="flex flex-1 relative overflow-hidden">
           <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
           
           <main className="flex-1 p-6 md:ml-[80px] pb-20 md:pb-6 overflow-y-auto bg-gray-50/50">
              <div className="max-w-7xl mx-auto py-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial="initial"
                    animate="in"
                    exit="out"
                    variants={pageVariants}
                    transition={pageTransition}
                  >
                    {activeTab === 'validator' && (
                      <CPFValidator 
                        rateLimitState={rateLimitState} 
                        checkRateLimit={checkRateLimit}
                        recordRequest={handleRecordRequest}
                      />
                    )}
                    
                    {activeTab === 'batch' && (
                      <BatchProcessing 
                        rateLimitState={rateLimitState} 
                        checkRateLimit={checkRateLimit}
                        recordRequest={handleRecordRequest}
                      />
                    )}
                    
                    {activeTab === 'queryData' && (
                        <QueryData />
                    )}

                    {activeTab === 'history' && (
                      <SimulationHistory />
                    )}

                    {activeTab === 'settings' && (
                      <div className="flex items-center justify-center h-[50vh]">
                          <Card className="w-full max-w-md text-center p-6 bg-white/80 backdrop-blur-sm border-violet-100 shadow-xl rounded-2xl">
                            <CardContent className="flex flex-col items-center gap-4 pt-6">
                                <div className="p-4 rounded-full bg-violet-100 text-violet-600 shadow-inner">
                                  <Settings className="w-8 h-8" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-800">Configurações</h2>
                                <p className="text-gray-500">
                                  Funcionalidade em desenvolvimento. Em breve você poderá configurar parâmetros da API aqui.
                                </p>
                            </CardContent>
                          </Card>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
           </main>
        </div>
      </div>
    </>
  );
};

export default Dashboard;