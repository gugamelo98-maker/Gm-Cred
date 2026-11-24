
import React from 'react';
import { AlertCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const RateLimitIndicator = ({ usage = 0, limit = 50, remaining = 50, className }) => {
  const percentage = Math.min(100, (usage / limit) * 100);
  
  let colorClass = "bg-green-500";
  if (usage >= 40) colorClass = "bg-yellow-500";
  if (usage >= 50) colorClass = "bg-red-500";

  const isWarning = usage >= 40 && usage < 50;
  const isCritical = usage >= 50;

  return (
    <div className={cn("w-full space-y-2 p-4 bg-violet-100 border border-violet-600 rounded-lg shadow-sm", className)}>
      <div className="flex justify-between items-center text-sm font-medium">
        <div className="flex items-center gap-2 text-gray-800">
          <Zap className={cn("w-4 h-4", isCritical ? "text-red-500" : "text-violet-600")} />
          <span>Uso da API</span>
        </div>
        <span className={cn(
          "font-mono", 
          isCritical ? "text-red-600 font-bold" : "text-gray-800"
        )}>
          {usage}/{limit} <span className="text-xs font-normal text-gray-600">req/min</span>
        </span>
      </div>
      
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white border border-violet-200">
         <div 
            className={cn("h-full w-full flex-1 transition-all duration-500 ease-in-out", colorClass)} 
            style={{ transform: `translateX(-${100 - (percentage || 0)}%)` }} 
         />
      </div>

      {(isWarning || isCritical) && (
        <div className={cn(
            "flex items-center gap-1.5 text-xs animate-in fade-in slide-in-from-top-1 font-medium", 
            isCritical ? "text-red-600" : "text-yellow-700"
        )}>
          <AlertCircle className="w-3 h-3" />
          {isCritical 
            ? "Limite atingido. Aguarde a liberação de slots." 
            : "Atenção: Limite de requisições próximo."}
        </div>
      )}
    </div>
  );
};

export default RateLimitIndicator;
