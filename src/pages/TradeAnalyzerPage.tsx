import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/types/Card';
import { TradeInputSection } from '@/components/trade/TradeInputSection';
import { TradeSummaryPanel } from '@/components/trade/TradeSummaryPanel';
import { TradeCardGrid } from '@/components/trade/TradeCardGrid';
import { analyzeTrade, TradeResult, saveTrade, getSavedTrades, deleteSavedTrade, SavedTrade } from '@/lib/trade/TradeAnalyzer';
import { Loader2, Save, Clock, X, Share2, Copy, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const TradeAnalyzerPage = () => {
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
  
  // Update trade analysis whenever cards change
  useEffect(() => {
    if (cardsA.length > 0 || cardsB.length > 0) {
      setIsAnalyzing(true);
      // Add a small delay to show loading state for better UX
      const timer = setTimeout(async () => {
        try {
          const result = await analyzeTrade(cardsA, cardsB);
          setTradeResult(result);
        } catch (error) {
          console.error('Error analyzing trade:', error);
          toast.error('Failed to analyze trade. Please try again.');
        } finally {
          setIsAnalyzing(false);
        }
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      setTradeResult(null);
    }
  }, [cardsA, cardsB]);

  const handleSaveTrade = () => {
    if (!tradeResult || !tradeName) return;
    
    const savedTrade = saveTrade(tradeName, cardsA, cardsB, tradeResult);
    setSavedTrades([...savedTrades, savedTrade]);
    setSaveDialogOpen(false);
    setTradeName('');
    toast.success('Trade saved successfully!');
  };

  const handleLoadTrade = (trade: SavedTrade) => {
    setCardsA(trade.cardsA);
    setCardsB(trade.cardsB);
    setTradeResult(trade.result);
    setLoadDialogOpen(false);
    toast.success('Trade loaded successfully!');
  };

  const handleDeleteTrade = (tradeId: string) => {
    if (deleteSavedTrade(tradeId)) {
      setSavedTrades(savedTrades.filter(trade => trade.id !== tradeId));
      toast.success('Trade deleted successfully!');
    }
  };

  const handleShareTrade = () => {
    if (!tradeResult) return;
    
    // Create a shareable link
    const shareableData = {
      cardsA,
      cardsB,
      result: tradeResult,
      date: new Date().toISOString()
    };
    
    const shareableLink = `${window.location.origin}/trade/share/${btoa(JSON.stringify(shareableData))}`;
    setShareLink(shareableLink);
    setShareDialogOpen(true);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      toast.success('Link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy link. Please try again.');
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Trade Analyzer</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Cards</h2>
          <TradeInputSection 
            side="A"
            label="You Give"
            selectedCards={cardsA}
            onUpdate={setCardsA}
          />
          <TradeCardGrid 
            cards={cardsA}
            title="Your Cards"
            emptyMessage="No cards selected"
          />
        </div>
        
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Their Cards</h2>
          <TradeInputSection 
            side="B"
            label="You Receive"
            selectedCards={cardsB}
            onUpdate={setCardsB}
          />
          <TradeCardGrid 
            cards={cardsB}
            title="Their Cards"
            emptyMessage="No cards selected"
          />
        </div>
      </div>

      {isAnalyzing ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-3">Analyzing trade...</span>
        </div>
      ) : tradeResult && (
        <div className="mt-8">
          <TradeSummaryPanel result={tradeResult} />
          
          <div className="flex gap-4 mt-6">
            <Button onClick={() => setSaveDialogOpen(true)}>
              <Save className="w-4 h-4 mr-2" />
              Save Trade
            </Button>
            <Button onClick={() => setLoadDialogOpen(true)} variant="outline">
              <Clock className="w-4 h-4 mr-2" />
              Load Saved Trade
            </Button>
            <Button onClick={handleShareTrade} variant="outline">
              <Share2 className="w-4 h-4 mr-2" />
              Share Trade
            </Button>
          </div>
        </div>
      )}

      {/* Save Trade Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Trade</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter trade name"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTrade}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Trade Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Saved Trade</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {savedTrades.length === 0 ? (
              <p className="text-center text-gray-500">No saved trades found</p>
            ) : (
              <div className="space-y-4">
                {savedTrades.map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-semibold">{trade.name}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(trade.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleLoadTrade(trade)} size="sm">
                        Load
                      </Button>
                      <Button
                        onClick={() => handleDeleteTrade(trade.id)}
                        variant="destructive"
                        size="sm"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Trade Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Trade</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex gap-2">
              <Input value={shareLink} readOnly />
              <Button onClick={handleCopyLink} variant="outline">
                {copySuccess ? (
                  <CheckCheck className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TradeAnalyzerPage; 