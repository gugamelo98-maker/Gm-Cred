
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { ShieldCheck, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = location.state?.from?.pathname || '/dashboard';

  const validate = () => {
    const newErrors = {};
    if (!email) newErrors.email = 'E-mail ou Usuário é obrigatório';
    if (!password) newErrors.password = 'Senha é obrigatória';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setErrors({}); // Clear previous errors

    try {
      await login(email, password);
      toast({
        title: "Login realizado com sucesso",
        description: "Bem-vindo ao CPF Validator Pro.",
        className: "bg-green-50 border-green-200"
      });
      navigate(from, { replace: true });
    } catch (error) {
      toast({
        title: "Falha no Login",
        description: error.message,
        variant: "destructive"
      });
      setErrors({ form: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-violet-900 via-slate-900 to-black p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8 pb-6 text-center border-b border-gray-100">
            <motion.div 
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner"
            >
              <ShieldCheck className="w-10 h-10 text-violet-600" />
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">CPF Validator Pro</h1>
            <p className="text-gray-500 text-sm mt-2">Acesso seguro à plataforma de validação</p>
          </div>

          <div className="p-8 pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">E-mail ou Usuário</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="usuario@empresa.com ou nome_usuario"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`bg-gray-50 border-gray-200 focus:border-violet-500 focus:ring-violet-200 transition-all ${errors.email ? 'border-red-300 bg-red-50' : ''}`}
                />
                {errors.email && <span className="text-xs text-red-500">{errors.email}</span>}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                   <Label htmlFor="password" className="text-gray-700 font-medium">Senha</Label>
                   <a href="#" className="text-xs text-violet-600 hover:text-violet-700 hover:underline">Esqueceu a senha?</a>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`bg-gray-50 border-gray-200 focus:border-violet-500 focus:ring-violet-200 transition-all pr-10 ${errors.password ? 'border-red-300 bg-red-50' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <span className="text-xs text-red-500">{errors.password}</span>}
              </div>

              {errors.form && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm text-center">
                  {errors.form}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-6 rounded-xl shadow-lg hover:shadow-violet-500/30 transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    Entrar na Plataforma
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center border-t border-gray-100 pt-6">
               <p className="text-sm text-gray-500">
                 Não tem uma conta?{' '}
                 <Link to="/register" className="font-semibold text-violet-600 hover:text-violet-700 hover:underline">
                    Crie uma agora
                 </Link>
               </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
