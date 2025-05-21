import { Card } from "@/types/Card";
import { calculateCardMarketValue } from "@/lib/trade/TradeAnalyzer";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUp, ArrowDown } from "lucide-react";

interface Props {
  cards: Card[];
  title?: string;
  emptyMessage?: string;
}

export function TradeCardGrid({ cards, title, emptyMessage = "No cards selected" }: Props) {
  const [hoverCard, setHoverCard] = useState<Card | null>(null);
  
  if (cards.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 border border-dashed rounded-lg">
        {emptyMessage}
      </div>
    );
  }
  
  // Create fake price history data for demo
  const generatePriceData = (card: Card) => {
    const currentValue = calculateCardMarketValue(card);
    const volatility = 0.05; // 5% volatility
    
    return Array.from({ length: 12 }, (_, i) => {
      const monthsAgo = 11 - i;
      const randomFactor = 1 + (Math.random() * volatility * 2 - volatility);
      // Generate a slightly increasing trend
      const baseValue = currentValue * (0.9 + (i * 0.01));
      const value = baseValue * randomFactor;
      
      return {
        month: monthsAgo,
        price: value
      };
    });
  };
  
  // Calculate price trend (up or down)
  const getPriceTrend = (card: Card) => {
    const data = generatePriceData(card);
    const firstPrice = data[0].price;
    const lastPrice = data[data.length - 1].price;
    
    return lastPrice > firstPrice ? "up" : "down";
  };
  
  return (
    <div>
      {title && <h3 className="font-medium text-lg mb-3">{title}</h3>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map(card => (
          <Popover key={card.id}>
            <PopoverTrigger asChild>
              <div 
                className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onMouseEnter={() => setHoverCard(card)}
                onMouseLeave={() => setHoverCard(null)}
              >
                {card.imageUrl ? (
                  <div className="relative aspect-[2/3]">
                    <img 
                      src={card.imageUrl} 
                      alt={card.playerName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback for broken images
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x300?text=No+Image';
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                      <div className="text-white text-sm font-medium">${calculateCardMarketValue(card).toFixed(2)}</div>
                    </div>
                    <div className="absolute top-2 right-2 bg-white bg-opacity-90 rounded-full p-1">
                      {getPriceTrend(card) === "up" ? (
                        <ArrowUp className="h-3 w-3 text-green-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-red-600" />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="aspect-[2/3] bg-gray-100 flex items-center justify-center">
                    <div className="text-center p-2">
                      <div className="font-medium">{card.playerName}</div>
                      <div className="text-xs text-gray-500">${calculateCardMarketValue(card).toFixed(2)}</div>
                    </div>
                  </div>
                )}
                <div className="p-2">
                  <div className="font-medium text-sm truncate">{card.playerName}</div>
                  <div className="text-xs text-gray-600 truncate">
                    {card.year} {card.cardSet} {card.cardNumber && `#${card.cardNumber}`}
                  </div>
                  <div className="text-xs text-gray-600">
                    {card.condition || 'Raw'}
                  </div>
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="p-1">
                <h4 className="font-medium">{card.playerName}</h4>
                <div className="text-sm text-gray-600 mb-3">
                  {card.year} {card.cardSet} {card.cardNumber && `#${card.cardNumber}`} • {card.condition || 'Raw'}
                </div>
                
                <div className="mb-3">
                  <div className="text-sm text-gray-500">Current Value</div>
                  <div className="text-lg font-semibold">${calculateCardMarketValue(card).toFixed(2)}</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-500 mb-1">Price History (12 Months)</div>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={generatePriceData(card)}
                        margin={{
                          top: 5,
                          right: 5,
                          left: 0,
                          bottom: 5,
                        }}
                      >
                        <XAxis 
                          dataKey="month" 
                          tickFormatter={(value) => value === 0 ? 'Now' : `${value}m`}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis 
                          tickFormatter={(value) => `$${value.toFixed(0)}`}
                          tick={{ fontSize: 10 }}
                          width={30}
                        />
                        <Tooltip 
                          formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Price']}
                          labelFormatter={(value) => value === 0 ? 'Now' : `${value} months ago`}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="#8884d8"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
} 