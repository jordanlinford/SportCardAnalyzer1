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
import Home from './pages/index';
import { ProtectedRoute } from './components/ProtectedRoute';
import ProfilePage from './pages/ProfilePage';
import PricingPage from './pages/PricingPage';

const App: React.FC = () => {
  console.log('App component rendering...');
  
  return (
    <>
      <Layout>
        <Routes>
          <Route 
            path="/" 
            element={<Home />} 
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
            path="/display-case/:publicId" 
            element={<SimplePublicDisplayCase />} 
          />
          <Route 
            path="/profile" 
            element={<ProfilePage />} 
          />
          <Route 
            path="/pricing" 
            element={<PricingPage />} 
          />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </>
  );
};

export default App;