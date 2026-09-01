import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { InvoicesListPage } from './pages/invoices/InvoicesListPage';
import { CreateInvoicePage } from './pages/invoices/CreateInvoicePage';
import { InvoiceDetailPage } from './pages/invoices/InvoiceDetailPage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { ProductsPage } from './pages/products/ProductsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { InvoiceCopilotDraft } from '@billing/shared';

function RouterShell() {
  const { user, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/dashboard');
  const [copilotDraft, setCopilotDraft] = useState<InvoiceCopilotDraft | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const handleApplyDraft = (draft: InvoiceCopilotDraft) => {
    setCopilotDraft(draft);
    navigate('/invoices/create');
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Adaptive AI Billing Platform</h2>
          <p style={{ color: 'var(--text-muted)' }}>Initializing tenant workspace...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated Routes
  if (!user) {
    if (currentPath === '/register') {
      return <RegisterPage onNavigate={navigate} />;
    }
    return <LoginPage onNavigate={navigate} />;
  }

  // Protected Page Router
  const renderCurrentPage = () => {
    if (currentPath === '/onboarding') {
      return <OnboardingPage onNavigate={navigate} />;
    }

    if (currentPath === '/invoices/create') {
      return <CreateInvoicePage onNavigate={navigate} copilotDraft={copilotDraft} />;
    }

    if (currentPath.startsWith('/invoices/')) {
      const invoiceId = currentPath.replace('/invoices/', '');
      return <InvoiceDetailPage invoiceId={invoiceId} onNavigate={navigate} />;
    }

    if (currentPath === '/invoices' || currentPath === '/payments') {
      return <InvoicesListPage onNavigate={navigate} />;
    }

    if (currentPath === '/customers') {
      return <CustomersPage />;
    }

    if (currentPath === '/products') {
      return <ProductsPage />;
    }

    if (currentPath === '/settings') {
      return <SettingsPage />;
    }

    return <DashboardPage onNavigate={navigate} />;
  };

  return (
    <AppLayout
      currentPath={currentPath}
      onNavigate={navigate}
      onApplyDraftToInvoice={handleApplyDraft}
    >
      {renderCurrentPage()}
    </AppLayout>
  );
}

export function App() {
  return (
    <AuthProvider>
      <RouterShell />
    </AuthProvider>
  );
}

export default App;
