
import React from 'react';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-[70px] bg-white border-b border-gray-100 shadow-sm flex items-center justify-between px-6 sticky top-0 z-50 transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-tr from-violet-600 to-violet-800 rounded-lg shadow-lg shadow-violet-500/20">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-gray-900 leading-tight">CPF Validator Pro</h1>
          <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">Enterprise Edition</span>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <Button
              onClick={logout}
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
