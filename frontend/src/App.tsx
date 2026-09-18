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
import { PaymentsPage } from './pages/payments/PaymentsPage';
import { RecurringPage } from './pages/recurring/RecurringPage';
import { CreditNotesPage } from './pages/credit-notes/CreditNotesPage';
import { ApprovalsPage } from './pages/approvals/ApprovalsPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { ProductsPage } from './pages/products/ProductsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { AuditLogsPage } from './pages/audit/AuditLogsPage';
import { PointOfSalePage } from './pages/pos/PointOfSalePage';
import { InvoiceCopilotDraft } from '@billing/shared';

function RouterShell() {
  const { user, organization, isLoading } = useAuth();
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
    if (user && organization && !organization.isOnboarded && path !== '/onboarding') {
      alert("Please complete the AI Business Architect setup first, or click 'Skip' at the bottom to continue with defaults.");
      return;
    }
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const handleApplyDraft = (draft: InvoiceCopilotDraft) => {
    setCopilotDraft(draft);
    navigate('/invoices/create');
  };

  useEffect(() => {
    if (!isLoading && user && organization && !organization.isOnboarded && currentPath !== '/onboarding') {
      navigate('/onboarding');
    }
  }, [user, organization, isLoading, currentPath]);

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

    if (currentPath === '/invoices') {
      return <InvoicesListPage onNavigate={navigate} />;
    }

    if (currentPath === '/payments') {
      return <PaymentsPage onNavigate={navigate} />;
    }

    if (currentPath === '/recurring') {
      return <RecurringPage onNavigate={navigate} />;
    }

    if (currentPath === '/credit-notes') {
      return <CreditNotesPage onNavigate={navigate} />;
    }

    if (currentPath === '/approvals') {
      return <ApprovalsPage onNavigate={navigate} />;
    }

    if (currentPath === '/reports') {
      return <ReportsPage />;
    }

    if (currentPath === '/customers') {
      return <CustomersPage />;
    }

    if (currentPath === '/products') {
      return <ProductsPage />;
    }

    if (currentPath === '/pos') {
      return <PointOfSalePage />;
    }

    if (currentPath === '/settings') {
      if (user?.role !== 'admin' && user?.role !== 'manager') {
        return (
          <div style={{ padding: '2rem', textAlign: 'center', marginTop: '10vh' }}>
            <h2 style={{ color: 'var(--color-danger)' }}>Access Denied</h2>
            <p>You do not have permission to view organizational settings.</p>
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>Return to Dashboard</button>
          </div>
        );
      }
      return <SettingsPage />;
    }

    if (currentPath === '/audit') {
      if (user?.role !== 'admin') {
        return (
          <div style={{ padding: '2rem', textAlign: 'center', marginTop: '10vh' }}>
            <h2 style={{ color: 'var(--color-danger)' }}>Access Denied</h2>
            <p>Only administrators can view compliance and audit logs.</p>
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>Return to Dashboard</button>
          </div>
        );
      }
      return <AuditLogsPage />;
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
