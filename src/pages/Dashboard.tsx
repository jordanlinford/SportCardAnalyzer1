import React, { useEffect, useState } from "react";
import { useCards } from "@/hooks/useCards";
import { Card as CardType } from "@/types/Card";
import { MessageCenter } from "@/components/MessageCenter";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDisplayCases } from '@/hooks/display/useDisplayCases';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Line } from 'react-chartjs-2'; // Make sure to install react-chartjs-2 and chart.js
import { useAuth } from "@/context/AuthContext";
import 'chart.js/auto';

export default function Dashboard() {
  const { data: cards = [], isLoading, error, retryFetchCards } = useCards();
  const { displayCases = [], isLoading: isLoadingCases } = useDisplayCases();
  const [valueHistory, setValueHistory] = useState<{ timestamp: any; totalValue: number }[]>([]);
  const { user } = useAuth();

  console.log("Dashboard rendering with cards:", cards.length, "isLoading:", isLoading, "error:", !!error);

  // Basic Stats - handle undefined values correctly
  const totalCards = cards.length;
  const totalValue = cards.reduce((sum, card) => {
    const value = card.currentValue || card.price || 0;
    return sum + value;
  }, 0);
  
  const totalCost = cards.reduce((sum, card) => {
    return sum + (card.pricePaid || 0);
  }, 0);
  
  const totalProfit = totalValue - totalCost;
  const averagePricePaid = totalCards ? (totalCost / totalCards) : 0;
  const roiPercentage = totalCost ? ((totalProfit / totalCost) * 100) : 0;

  // Player Stats
  const playerCount: Record<string, number> = {};
  cards.forEach((card) => {
    const player = card.playerName || "Unknown";
    playerCount[player] = (playerCount[player] || 0) + 1;
  });
  const topPlayer = Object.entries(playerCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  // Grade Distribution
  const gradeCount: Record<string, number> = {};
  cards.forEach((card) => {
    const grade = card.condition || "Raw";
    gradeCount[grade] = (gradeCount[grade] || 0) + 1;
  });
  const mostCommonGrade = Object.entries(gradeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  // Most Valuable Card
  const mostValuableCard = cards.reduce((max, card) => {
    const currentCardValue = card.currentValue || card.price || 0;
    const maxCardValue = max.currentValue || max.price || 0;
    return currentCardValue > maxCardValue ? card : max;
  }, { playerName: "N/A", currentValue: 0, price: 0 } as CardType);

  const mostValuableCardValue = mostValuableCard.currentValue || mostValuableCard.price || 0;

  // Add graded card count logic
  function isGraded(condition: string | undefined) {
    if (!condition) return false;
    const normalized = condition.toUpperCase();
    return (
      normalized.includes("PSA") ||
      normalized.includes("BGS") ||
      normalized.includes("SGC") ||
      normalized.includes("CGC")
    );
  }
  const gradedCardCount = cards.filter(card => isGraded(card.condition)).length;

  // Most Active Display Case
  const mostActiveDisplayCase = displayCases.length > 0
    ? displayCases.reduce((max, dc) => {
        const activity = (dc.likes || 0) + (dc.comments?.length || 0) + (dc.visits || 0);
        const maxActivity = (max.likes || 0) + (max.comments?.length || 0) + (max.visits || 0);
        return activity > maxActivity ? dc : max;
      }, displayCases[0])
    : null;

  useEffect(() => {
    async function fetchValueHistory() {
      if (!user) return;
      const q = query(collection(db, 'users', user.uid, 'value_history'), orderBy('timestamp'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc: any) => doc.data() as { timestamp: any; totalValue: number });
      setValueHistory(data);
    }
    fetchValueHistory();
  }, [user]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Collection Dashboard</h1>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center items-center mb-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mr-2" />
          <span className="text-blue-500">Loading collection data...</span>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p className="text-red-600 mb-2">There was a problem loading your collection data.</p>
          <Button 
            variant="outline" 
            onClick={retryFetchCards}
            className="flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <DashboardCard 
          title="Total Cards" 
          value={isLoading ? "Loading..." : totalCards}
          isLoading={isLoading}
          hasError={!!error && !isLoading}
        />
        <DashboardCard 
          title="Total Value" 
          value={isLoading ? "Loading..." : `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          isLoading={isLoading}
          hasError={!!error && !isLoading}
        />
        <DashboardCard 
          title="Average Price" 
          value={isLoading ? "Loading..." : `$${averagePricePaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          isLoading={isLoading}
          hasError={!!error && !isLoading}
        />
        <DashboardCard 
          title="ROI" 
          value={isLoading ? "Loading..." : `${roiPercentage.toFixed(1)}%`}
          valueColor={roiPercentage >= 0 ? "text-green-600" : "text-red-600"}
          isLoading={isLoading}
          hasError={!!error && !isLoading}
        />
      </div>

      {/* Message Center */}
      <div className="mb-8">
        <MessageCenter />
      </div>

      {/* Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Collection Insights</h2>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : error ? (
              <div className="flex justify-center py-4 text-red-500">
                Unable to load insights
              </div>
            ) : (
              <>
            <InsightRow 
              label="Most Valuable Card"
              value={`${mostValuableCard.playerName} - $${mostValuableCardValue.toLocaleString()}`}
            />
            <InsightRow 
              label="Most Common Grade"
              value={mostCommonGrade}
            />
            <InsightRow 
              label="Top Player"
              value={topPlayer}
            />
            <InsightRow 
              label="Graded Cards"
              value={gradedCardCount}
            />
            <InsightRow 
              label="Total Profit/Loss"
              value={`$${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              valueColor={totalProfit >= 0 ? "text-green-600" : "text-red-600"}
            />
            {mostActiveDisplayCase && (
              <InsightRow
                label="Most Active Display Case"
                value={`${mostActiveDisplayCase.name} (❤️ ${mostActiveDisplayCase.likes || 0}, 💬 ${mostActiveDisplayCase.comments?.length || 0}, 👁️ ${mostActiveDisplayCase.visits || 0})`}
              />
            )}
              </>
            )}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Collection Value Over Time</h2>
          <div className="my-8">
            {valueHistory.length > 1 ? (
              <Line
                data={{
                  labels: valueHistory.map(v => v.timestamp.toDate().toLocaleDateString()),
                  datasets: [
                    {
                      label: 'Total Value',
                      data: valueHistory.map(v => v.totalValue),
                      borderColor: 'rgb(34,197,94)',
                      backgroundColor: 'rgba(34,197,94,0.2)',
                      tension: 0.3,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            ) : (
              <div className="text-gray-500">No value history yet. Update all card values to start tracking.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ 
  title, 
  value, 
  valueColor = "text-gray-900",
  isLoading = false,
  hasError = false
}: { 
  title: string; 
  value: string | number;
  valueColor?: string;
  isLoading?: boolean;
  hasError?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-background-dark rounded-2xl shadow-lg p-6 flex flex-col items-start gap-2 border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-shadow group cursor-pointer">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="font-heading text-lg md:text-xl text-primary dark:text-secondary uppercase tracking-wide">{title}</h2>
      </div>
      {isLoading ? (
        <div className="mt-2 flex items-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary dark:text-secondary mr-2" />
          <span className="text-gray-500">Loading...</span>
        </div>
      ) : hasError ? (
        <div className="mt-2 flex items-center">
          <span className="text-red-500">Error loading data</span>
        </div>
      ) : (
        <p className={`mt-2 text-3xl md:text-4xl font-mono font-bold ${valueColor} group-hover:text-accent transition-colors`}>{value}</p>
      )}
    </div>
  );
}

function InsightRow({ 
  label, 
  value,
  valueColor = "text-gray-900"
}: { 
  label: string; 
  value: string | number;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      <span className={`font-medium ${valueColor}`}>{value}</span>
    </div>
  );
} 