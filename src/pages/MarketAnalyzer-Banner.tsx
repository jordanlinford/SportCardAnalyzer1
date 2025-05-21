import { useState } from 'react';
import { X, Sparkles, TrendingUp, Database } from 'lucide-react';

export default function MarketDataBanner() {
  const [dismissed, setDismissed] = useState(false);
  
  if (dismissed) return null;
  
  return (
    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-lg shadow-md mb-6">
      <div className="flex items-start justify-between">
        <div className="flex">
          <div className="mr-4 mt-1">
            <Sparkles className="h-6 w-6 text-yellow-300" />
          </div>
          <div>
            <h3 className="font-bold text-lg flex items-center">
              <span>Enhanced Market Data</span>
              <span className="bg-yellow-400 text-indigo-900 text-xs font-semibold ml-2 px-2 py-0.5 rounded">NEW</span>
            </h3>
            
            <p className="mt-1 text-blue-50">
              We now store historical sales data for popular cards, offering faster, more accurate market analysis!
            </p>
            
            <div className="mt-3 flex space-x-6 text-sm">
              <div className="flex items-center">
                <Database className="h-4 w-4 mr-1 text-blue-200" />
                <span>Pre-cached analytics</span>
              </div>
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 mr-1 text-blue-200" />
                <span>Historical trends</span>
              </div>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => setDismissed(true)}
          className="text-white hover:text-gray-200"
          aria-label="Dismiss notification"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
} 