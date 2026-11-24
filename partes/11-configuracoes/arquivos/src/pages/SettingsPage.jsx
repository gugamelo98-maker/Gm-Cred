
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Save, Check, User, Info, LogOut, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUser } from '@/services/apiService';

const SettingsPage = () => {
  const [apiUser, setApiUser] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const { user, logout } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const savedUser = getApiUser();
    setApiUser(savedUser);
  }, []);

  const handleSave = () => {
    if (!apiUser.trim()) {
      toast({
        title: "Erro de Validação",
        description: "O nome de usuário da API não pode estar vazio.",
        variant: "destructive"
      });
      return;
    }

    localStorage.setItem('apiUser', apiUser.trim());
    setIsSaved(true);
    
    toast({
      title: "Configurações Salvas",
      description: `Usuário da API atualizado para: ${apiUser}`,
      className: "bg-green-50 border-green-200"
    });

    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <>
      <Helmet>
        <title>Configurações - CPF Validator Pro</title>
      </Helmet>
      
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        
        <div className="flex flex-1 relative overflow-hidden">
           <Sidebar activeTab="settings" onTabChange={() => {}} />
           
           <main className="flex-1 p-6 md:ml-[80px] pb-20 md:pb-6 overflow-y-auto bg-gray-50/50">
              <div className="max-w-2xl mx-auto py-8 space-y-8">
                
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Configurações</h1>
                  <p className="text-gray-500">Gerencie as preferências da sua aplicação e conta.</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                >
                  <Card className="bg-white border-violet-200 shadow-lg rounded-xl overflow-hidden">
                    <CardHeader className="bg-violet-50/50 border-b border-violet-100">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-violet-100 rounded-lg">
                           <Server className="h-5 w-5 text-violet-700" />
                        </div>
                        <div>
                          <CardTitle className="text-violet-900">Configuração da API</CardTitle>
                          <CardDescription>Defina o usuário utilizado nas requisições ao servidor.</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="apiUser" className="text-gray-700 font-medium">Usuário da API</Label>
                        <Input 
                          id="apiUser"
                          placeholder="ex: usuario_5"
                          value={apiUser}
                          onChange={(e) => setApiUser(e.target.value)}
                          className="font-mono bg-gray-50 border-gray-200 focus:border-violet-500 focus:ring-violet-200 transition-all"
                        />
                        <p className="text-xs text-gray-500">Este valor será enviado no campo <code className="bg-gray-100 px-1 rounded text-violet-600">usuario</code> das requisições.</p>
                      </div>
                    </CardContent>
                    <CardFooter className="bg-gray-50/30 border-t border-gray-100 flex justify-between items-center py-4">
                      <span className="text-xs text-gray-400">
                        Atual: <span className="font-mono text-gray-600">{localStorage.getItem('apiUser') || 'Padrão (usuario_1)'}</span>
                      </span>
                      <Button 
                        onClick={handleSave} 
                        className={`transition-all duration-300 ${isSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-violet-600 hover:bg-violet-700'}`}
                      >
                        <AnimatePresence mode="wait">
                          {isSaved ? (
                            <motion.div
                              key="saved"
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.5, opacity: 0 }}
                              className="flex items-center"
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Salvo!
                            </motion.div>
                          ) : (
                            <motion.div
                              key="save"
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.5, opacity: 0 }}
                              className="flex items-center"
                            >
                              <Save className="mr-2 h-4 w-4" />
                              Salvar Alterações
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    <Card className="h-full border-gray-100 shadow-md hover:shadow-lg transition-all rounded-xl">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <User className="h-5 w-5 text-gray-400" />
                          <CardTitle className="text-base text-gray-800">Sessão Atual</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                         <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                {user?.avatar}
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">{user?.name}</p>
                                <p className="text-sm text-gray-500">{user?.email}</p>
                            </div>
                         </div>
                         <div className="pt-4 border-t border-gray-100">
                             <Button 
                                variant="destructive" 
                                className="w-full bg-red-50 text-red-600 hover:bg-red-100 border-red-100 shadow-none hover:shadow-sm"
                                onClick={logout}
                              >
                                <LogOut className="mr-2 h-4 w-4" />
                                Encerrar Sessão
                             </Button>
                         </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                  >
                    <Card className="h-full border-gray-100 shadow-md hover:shadow-lg transition-all rounded-xl">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Info className="h-5 w-5 text-gray-400" />
                          <CardTitle className="text-base text-gray-800">Sobre</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-gray-50">
                           <span className="text-sm text-gray-500">Versão do Sistema</span>
                           <span className="text-sm font-mono font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-700">v1.0.0</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-50">
                           <span className="text-sm text-gray-500">Build</span>
                           <span className="text-sm text-gray-700">Production</span>
                        </div>
                        <div className="pt-2 text-xs text-gray-400 text-center">
                           &copy; 2026 CPF Validator Pro. Todos os direitos reservados.
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

              </div>
           </main>
        </div>
      </div>
    </>
  );
};

export default SettingsPage;
