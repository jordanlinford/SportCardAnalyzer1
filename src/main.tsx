import React, { useState, useEffect, ErrorInfo, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SubscriptionProvider } from './context/SubscriptionContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import './ForceGrid.css'

console.log('Starting app initialization...');

// Error boundary component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("React Error Boundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui' }}>
          <h1>Something went wrong</h1>
          <div style={{ padding: '10px', background: '#f8f8f8', borderRadius: '4px', marginBottom: '20px' }}>
            <p>{this.state.error && this.state.error.toString()}</p>
          </div>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Error Details</summary>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

// Fallback component that will always render
const AppLoader = (): JSX.Element => {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    console.log('AppLoader mounted');
    // Set a timeout to show a message if the app doesn't load in 3 seconds
    const timer = setTimeout(() => {
      setIsLoading(false);
      console.log('Loader timeout reached');
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        fontFamily: 'system-ui'
      }}>
        <h1>Loading Sports Card Analyzer...</h1>
        <p>If this screen persists, there might be an issue with the application.</p>
      </div>
    );
  }
  
  // After timeout, show the actual app wrapped in error boundary
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
};

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (!rootElement) {
  console.error('Failed to find root element!');
  // Create a root element if it doesn't exist
  const newRoot = document.createElement('div');
  newRoot.id = 'root';
  document.body.appendChild(newRoot);
  
  ReactDOM.createRoot(newRoot).render(
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>Error: Root element not found</h1>
      <p>The application could not find the root element to mount to.</p>
    </div>
  );
} else {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <SubscriptionProvider>
                <AppLoader />
              </SubscriptionProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </React.StrictMode>
    );
    console.log('App rendered successfully');
  } catch (error: any) {
    console.error('Error rendering app:', error);
    ReactDOM.createRoot(rootElement).render(
      <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
        <h1>Failed to render application</h1>
        <p>Error: {error.message}</p>
        <pre>{error.stack}</pre>
      </div>
    );
  }
}