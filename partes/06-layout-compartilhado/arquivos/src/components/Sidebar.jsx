import React from 'react';
import { Search, List, Clock, Settings, FileText, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = ({ activeTab, onTabChange }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: 'validator', label: 'Simular', icon: Search },
    { id: 'batch', label: 'Lote', icon: List },
    { id: 'queryData', label: 'Dados', icon: FileText },
    { id: 'history', label: 'Histórico', icon: Clock },
    { id: 'settings', label: 'Config', icon: Settings },
  ];

  const handleItemClick = (id) => {
    if (id === 'settings') {
      navigate('/settings');
    } else {
      if (location.pathname !== '/dashboard') {
        navigate('/dashboard');
      } else {
        if (onTabChange) {
          onTabChange(id);
        }
      }
    }
  };

  const currentActive = location.pathname === '/settings' ? 'settings' : activeTab;

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-[80px] h-[calc(100vh-70px)] fixed left-0 top-[70px] bg-gradient-to-b from-white to-gray-50 border-r border-gray-100 shadow-[2px_0_10px_-5px_rgba(0,0,0,0.05)] z-40">
        <div className="flex flex-col items-center py-8 gap-6 flex-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className="group relative flex flex-col items-center gap-1 w-full px-2"
              title={item.label}
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ease-out",
                currentActive === item.id
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30 scale-100"
                  : "bg-transparent text-gray-500 hover:bg-violet-50 hover:text-violet-600"
              )}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                currentActive === item.id ? "text-violet-700 opacity-100" : "text-gray-400 opacity-0 group-hover:opacity-100"
              )}>
                {item.label}
              </span>
              
              {currentActive === item.id && (
                <div className="absolute left-0 top-3 bottom-8 w-1 h-6 bg-violet-600 rounded-r-full" />
              )}
            </button>
          ))}
        </div>
        
        <div className="pb-8 flex justify-center border-t border-gray-200 pt-6 mx-4">
           <button 
             onClick={logout}
             className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-300"
             title="Sair"
           >
             <LogOut className="w-5 h-5" />
           </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center justify-around z-50 px-4 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)] pb-safe">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleItemClick(item.id)}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300",
              currentActive === item.id
                ? "text-violet-600 -translate-y-2 bg-violet-50 shadow-sm"
                : "text-gray-400 hover:text-violet-400"
            )}
          >
            <item.icon className={cn("w-5 h-5", currentActive === item.id && "fill-violet-200")} />
            <span className="text-[10px] font-semibold mt-1">{item.label}</span>
          </button>
        ))}
        <button
          onClick={logout}
          className="flex flex-col items-center justify-center p-2 rounded-xl text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Sair</span>
        </button>
      </div>
    </>
  );
};

export default Sidebar;