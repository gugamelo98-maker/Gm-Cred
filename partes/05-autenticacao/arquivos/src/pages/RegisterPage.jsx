
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, UserPlus, Loader2, ArrowLeft, Mail, User, Lock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { registerUser } from '@/services/authService';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    usuario: '',
    senha: '',
    confirmarSenha: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
    // Clear error for this field when user types
    if (errors[id]) {
      setErrors(prev => ({ ...prev, [id]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.nome.trim()) newErrors.nome = 'Nome completo é obrigatório';
    
    if (!formData.email) newErrors.email = 'E-mail é obrigatório';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Formato de e-mail inválido';
    
    if (!formData.usuario) newErrors.usuario = 'Usuário é obrigatório';
    else if (formData.usuario.length < 3) newErrors.usuario = 'Mínimo de 3 caracteres';
    
    if (!formData.senha) newErrors.senha = 'Senha é obrigatória';
    else if (formData.senha.length < 6) newErrors.senha = 'Mínimo de 6 caracteres';
    
    if (formData.senha !== formData.confirmarSenha) {
      newErrors.confirmarSenha = 'As senhas não coincidem';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    
    // Simulate network delay for better UX
    setTimeout(() => {
        try {
            registerUser({
                nome: formData.nome,
                email: formData.email,
                usuario: formData.usuario,
                senha: formData.senha
            });

            toast({
                title: "Conta criada com sucesso!",
                description: "Você já pode fazer login na plataforma.",
                className: "bg-green-50 border-green-200"
            });

            navigate('/login');
        } catch (error) {
            toast({
                title: "Erro ao criar conta",
                description: error.message,
                variant: "destructive"
            });
            // If error is specific (like duplicate email), we could set field error here
            setErrors(prev => ({ ...prev, form: error.message }));
        } finally {
            setIsLoading(false);
        }
    }, 800);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-violet-900 via-slate-900 to-black p-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8 pb-6 text-center border-b border-gray-100 relative">
            <Link to="/login" className="absolute left-6 top-8 text-gray-400 hover:text-violet-600 transition-colors">
                <ArrowLeft className="h-6 w-6" />
            </Link>
            <motion.div 
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner"
            >
              <UserPlus className="w-8 h-8 text-violet-600" />
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Crie sua Conta</h1>
            <p className="text-gray-500 text-sm mt-2">Junte-se ao CPF Validator Pro hoje mesmo</p>
          </div>

          <div className="p-8 pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-gray-700 font-medium">Nome Completo</Label>
                <div className="relative">
                    <Input
                    id="nome"
                    placeholder="Ex: João da Silva"
                    value={formData.nome}
                    onChange={handleChange}
                    className={`pl-10 bg-gray-50 border-gray-200 focus:border-violet-500 focus:ring-violet-200 transition-all ${errors.nome ? 'border-red-300 bg-red-50' : ''}`}
                    />
                    <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
                {errors.nome && <span className="text-xs text-red-500">{errors.nome}</span>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-700 font-medium">E-mail</Label>
                    <div className="relative">
                        <Input
                        id="email"
                        type="email"
                        placeholder="nome@exemplo.com"
                        value={formData.email}
                        onChange={handleChange}
                        className={`pl-10 bg-gray-50 border-gray-200 focus:border-violet-500 focus:ring-violet-200 transition-all ${errors.email ? 'border-red-300 bg-red-50' : ''}`}
                        />
                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                    {errors.email && <span className="text-xs text-red-500">{errors.email}</span>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="usuario" className="text-gray-700 font-medium">Usuário</Label>
                    <div className="relative">
                        <Input
                        id="usuario"
                        placeholder="Ex: joaosilva"
                        value={formData.usuario}
                        onChange={handleChange}
                        className={`pl-10 bg-gray-50 border-gray-200 focus:border-violet-500 focus:ring-violet-200 transition-all ${errors.usuario ? 'border-red-300 bg-red-50' : ''}`}
                        />
                        <ShieldCheck className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                    {errors.usuario && <span className="text-xs text-red-500">{errors.usuario}</span>}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="senha" className="text-gray-700 font-medium">Senha</Label>
                    <div className="relative">
                        <Input
                        id="senha"
                        type="password"
                        placeholder="••••••••"
                        value={formData.senha}
                        onChange={handleChange}
                        className={`pl-10 bg-gray-50 border-gray-200 focus:border-violet-500 focus:ring-violet-200 transition-all ${errors.senha ? 'border-red-300 bg-red-50' : ''}`}
                        />
                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                    {errors.senha && <span className="text-xs text-red-500">{errors.senha}</span>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmarSenha" className="text-gray-700 font-medium">Confirmar Senha</Label>
                    <div className="relative">
                        <Input
                        id="confirmarSenha"
                        type="password"
                        placeholder="••••••••"
                        value={formData.confirmarSenha}
                        onChange={handleChange}
                        className={`pl-10 bg-gray-50 border-gray-200 focus:border-violet-500 focus:ring-violet-200 transition-all ${errors.confirmarSenha ? 'border-red-300 bg-red-50' : ''}`}
                        />
                        <CheckCircle className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                    {errors.confirmarSenha && <span className="text-xs text-red-500">{errors.confirmarSenha}</span>}
                  </div>
              </div>

              {errors.form && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm text-center">
                  {errors.form}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-6 mt-4 rounded-xl shadow-lg hover:shadow-violet-500/30 transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  "Criar Conta"
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center border-t border-gray-100 pt-6">
               <p className="text-sm text-gray-500">
                 Já tem uma conta?{' '}
                 <Link to="/login" className="font-semibold text-violet-600 hover:text-violet-700 hover:underline">
                    Faça login aqui
                 </Link>
               </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
