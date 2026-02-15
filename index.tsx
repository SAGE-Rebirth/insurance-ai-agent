import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("Starting InsureVoice AI Application...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

// Simple Error Boundary to catch startup errors
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Application Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem', 
          color: '#ef4444', 
          backgroundColor: '#0f172a', 
          minHeight: '100vh', 
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem'}}>Something went wrong</h1>
          <pre style={{
            backgroundColor: '#1e293b', 
            padding: '1rem', 
            borderRadius: '0.5rem', 
            overflow: 'auto',
            color: '#e2e8f0'
          }}>
            {this.state.error?.toString()}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);