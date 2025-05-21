import { useState, useEffect } from 'react';
import { Card } from '@/types/Card';
import { TradeInputSection } from '@/components/trade/TradeInputSection';
import { TradeSummaryPanel } from '@/components/trade/TradeSummaryPanel';
import { TradeCardGrid } from '@/components/trade/TradeCardGrid';
import { analyzeTrade, TradeResult, saveTrade, getSavedTrades, deleteSavedTrade, SavedTrade } from '@/lib/trade/TradeAnalyzer';
import { Loader2, Save, Clock, X, Share2, Copy, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Import TradeContext
import { useTradeContext } from '@/context/TradeContext';

export default function TradeAnalyzerPage() {
  // Use the TradeContext to get cards from market analyzer if any were added
  const { cardsA: contextCardsA, cardsB: contextCardsB } = useTradeContext();

  // Local state for selected cards in the trade
  const [cardsA, setCardsA] = useState<Card[]>([]);
  const [cardsB, setCardsB] = useState<Card[]>([]);
  const [tradeResult, setTradeResult] = useState<TradeResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [savedTrades, setSavedTrades] = useState<SavedTrade[]>([]);
  const [tradeName, setTradeName] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Load saved trades on initial render
  useEffect(() => {
    setSavedTrades(getSavedTrades());
  }, []);
  
  // Load cards from context when they change
  useEffect(() => {
    if (contextCardsA.length > 0 && cardsA.length === 0) {
      setCardsA(contextCardsA);
    }
    if (contextCardsB.length > 0 && cardsB.length === 0) {
      setCardsB(contextCardsB);
    }
  }, [contextCardsA, contextCardsB, cardsA.length, cardsB.length]);

  // Update trade analysis whenever cards change
  useEffect(() => {
    if (cardsA.length > 0 || cardsB.length > 0) {
      setIsAnalyzing(true);
      // Add a small delay to show loading state for better UX
      const timer = setTimeout(() => {
        // Call analyzeTrade asynchronously and handle the promise
        analyzeTrade(cardsA, cardsB)
          .then(result => {
            setTradeResult(result);
          })
          .catch(error => {
            console.error('Error analyzing trade:', error);
            toast.error('There was an error analyzing the trade. Please try again.');
          })
          .finally(() => {
            setIsAnalyzing(false);
          });
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      setTradeResult(null);
    }
  }, [cardsA, cardsB]);

  // Handle saving a trade
  const handleSaveTrade = () => {
    if (!tradeResult || !tradeName.trim()) return;
    
    const newTrade = saveTrade(tradeName, cardsA, cardsB, tradeResult);
    setSavedTrades([...savedTrades, newTrade]);
    setTradeName('');
    setSaveDialogOpen(false);
  };

  // Handle loading a trade
  const handleLoadTrade = (trade: SavedTrade) => {
    setCardsA(trade.cardsA);
    setCardsB(trade.cardsB);
    setTradeResult(trade.result);
    setLoadDialogOpen(false);
  };

  // Handle deleting a trade
  const handleDeleteTrade = (tradeId: string) => {
    if (deleteSavedTrade(tradeId)) {
      setSavedTrades(savedTrades.filter(trade => trade.id !== tradeId));
    }
  };

  // Handle generating a share link
  const handleShareTrade = () => {
    if (!tradeResult) return;
    
    // Create a simplified version of the trade to share
    const shareData = {
      date: new Date().toISOString(),
      cardsA: cardsA.map(card => ({
        playerName: card.playerName,
        year: card.year,
        cardSet: card.cardSet,
        cardNumber: card.cardNumber,
        variation: card.variation,
        condition: card.condition,
        currentValue: card.currentValue,
        imageUrl: card.imageUrl,
      })),
      cardsB: cardsB.map(card => ({
        playerName: card.playerName,
        year: card.year,
        cardSet: card.cardSet,
        cardNumber: card.cardNumber,
        variation: card.variation,
        condition: card.condition,
        currentValue: card.currentValue,
        imageUrl: card.imageUrl,
      })),
      result: tradeResult
    };
    
    // Convert to Base64
    const jsonString = JSON.stringify(shareData);
    const base64Data = btoa(encodeURIComponent(jsonString));
    
    // Create shareable link
    const baseUrl = window.location.origin;
    const shareLink = `${baseUrl}/trade-analyzer/share/${base64Data}`;
    
    setShareLink(shareLink);
    setShareDialogOpen(true);
  };
  
  // Handle copying the share link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopySuccess(true);
      toast.success('Share link copied to clipboard');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Trade Analyzer</h1>
          <p className="text-gray-600">
            Compare cards to evaluate potential trades.
          </p>
        </div>
        
        <div className="flex gap-2 mt-4 sm:mt-0">
          {tradeResult && (
            <>
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1">
                    <Save className="h-4 w-4" />
                    <span className="hidden sm:inline">Save Trade</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Save Trade</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <div className="mb-4">
                      <label className="text-sm font-medium mb-2 block">
                        Trade Name
                      </label>
                      <Input
                        value={tradeName}
                        onChange={(e) => setTradeName(e.target.value)}
                        placeholder="Enter a name for this trade"
                      />
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      <p>Cards from Side A: {cardsA.length}</p>
                      <p>Cards from Side B: {cardsB.length}</p>
                      <p>
                        Recommendation: 
                        <span className={
                          tradeResult.recommendation === "Accept" ? "text-green-600" :
                          tradeResult.recommendation === "Decline" ? "text-red-600" :
                          "text-blue-600"
                        }>{' '}{tradeResult.recommendation}</span>
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveTrade}>
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1" onClick={handleShareTrade}>
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Share Trade</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Share Trade Analysis</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Share this trade analysis with others by copying the link below:
                    </p>
                    
                    <div className="flex gap-2">
                      <Input
                        value={shareLink}
                        readOnly
                        className="flex-1"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <Button variant="outline" size="icon" onClick={handleCopyLink}>
                        {copySuccess ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    
                    <div className="mt-4 text-sm text-gray-600">
                      <p>This link contains a snapshot of your current trade analysis without requiring access to your collection.</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          
          <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Load Trade</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Load Saved Trade</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                {savedTrades.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No saved trades found.</p>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {savedTrades.map(trade => (
                      <div 
                        key={trade.id} 
                        className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer relative"
                        onClick={() => handleLoadTrade(trade)}
                      >
                        <button 
                          className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTrade(trade.id);
                          }}
                          aria-label="Delete trade"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="font-medium">{trade.name}</div>
                        <div className="text-sm text-gray-600">
                          {new Date(trade.date).toLocaleDateString()}
                        </div>
                        <div className="text-sm">
                          <span className={
                            trade.result.recommendation === "Accept" ? "text-green-600" :
                            trade.result.recommendation === "Decline" ? "text-red-600" :
                            "text-blue-600"
                          }>
                            {trade.result.recommendation}
                          </span>
                          {" • "}
                          ${trade.result.valueSideA.toFixed(2)} vs ${trade.result.valueSideB.toFixed(2)}
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Cards: {trade.cardsA.length}</span>
                          <span>Cards: {trade.cardsB.length}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLoadDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <TradeInputSection 
          side="A" 
          label="You Give" 
          selectedCards={cardsA}
          onUpdate={setCardsA}
        />
        <TradeInputSection 
          side="B" 
          label="You Receive" 
          selectedCards={cardsB}
          onUpdate={setCardsB}
        />
      </div>
      
      {isAnalyzing ? (
        <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow mb-8">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mr-2" />
          <span className="text-lg font-medium">Analyzing trade...</span>
        </div>
      ) : tradeResult ? (
        <div className="mb-8">
          <TradeSummaryPanel result={tradeResult} />
        </div>
      ) : null}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {cardsA.length > 0 && (
          <div>
            <TradeCardGrid 
              cards={cardsA} 
              title="Cards You Give"
            />
          </div>
        )}
        {cardsB.length > 0 && (
          <div>
            <TradeCardGrid 
              cards={cardsB} 
              title="Cards You Receive"
            />
          </div>
        )}
      </div>
    </div>
  );
} 