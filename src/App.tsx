import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Dashboard from "@/pages/Dashboard";
import CardSearch from "./components/CardSearch";
import CollectionPage from './pages/CollectionPage';
import Login from './pages/Login';
import Layout from './components/Layout';
import PublicDisplayCase from './pages/PublicDisplayCase';
import SimplePublicDisplayCase from './pages/SimplePublicDisplayCase';
import DisplayCases from './pages/DisplayCases';
import DisplayCasePage from './pages/DisplayCasePage';
import MarketAnalyzerPage from './pages/MarketAnalyzerPage';
import TradeAnalyzer from './pages/TradeAnalyzer';
import SharedTradeView from './pages/SharedTradeView';
import HomePage from './pages/HomePage';
import { ProtectedRoute } from './components/ProtectedRoute';
import ProfilePage from './pages/ProfilePage';
import PricingPage from './pages/PricingPage';
import ForceGridFix from './pages/ForceGridFix';
import About from '@/pages/About';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';

// Import TradeProvider
import TradeProvider from './context/TradeContext';

const App: React.FC = () => {
  console.log('App component rendering...');
  
  return (
    <>
      <Layout>
        <TradeProvider>
          <Routes>
            <Route 
              path="/" 
              element={<HomePage />} 
            />
            <Route 
              path="/display/:publicId" 
              element={<SimplePublicDisplayCase />} 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/collection" 
              element={
                <ProtectedRoute>
                  <CollectionPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/market-analyzer" 
              element={<MarketAnalyzerPage />} 
            />
            <Route 
              path="/trade-analyzer" 
              element={
                <ProtectedRoute>
                  <TradeAnalyzer />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/trade-analyzer/share/:tradeData" 
              element={<SharedTradeView />} 
            />
            <Route 
              path="/login" 
              element={<Login />} 
            />
            <Route 
              path="/display-cases" 
              element={<DisplayCases />} 
            />
            <Route 
              path="/display-cases/:id" 
              element={<DisplayCasePage />} 
            />
            <Route 
              path="/profile" 
              element={<ProfilePage />} 
            />
            <Route 
              path="/pricing" 
              element={<PricingPage />} 
            />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
          </Routes>
        </TradeProvider>
      </Layout>
      <Toaster position="top-right" />
      <ForceGridFix />
    </>
  );
};

export default App;