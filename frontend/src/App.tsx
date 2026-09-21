import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
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
import { SuppliersPage } from './pages/suppliers/SuppliersPage';
import { PurchasesPage } from './pages/purchases/PurchasesPage';
import { ReturnsPage } from './pages/returns/ReturnsPage';
import { ShiftsPage } from './pages/shifts/ShiftsPage';
import { ExpensesPage } from './pages/expenses/ExpensesPage';
import { InventoryPage } from './pages/inventory/InventoryPage';
import { HeldBillsPage } from './pages/held-bills/HeldBillsPage';
import { BackupPage } from './pages/backup/BackupPage';
import { TeamPage } from './pages/team/TeamPage';
import { NewOrganizationPage } from './pages/organizations/NewOrganizationPage';
import { BillingTestPage } from './pages/dev/BillingTestPage';
import { SaaSManagementPage } from './pages/saas/SaaSManagementPage';
import { AgencyManagementPage } from './pages/agency/AgencyManagementPage';
import { InvoiceCopilotDraft } from '@billing/shared';

function AccessDenied({ onNavigate, message }: { onNavigate: (p: string) => void; message: string }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', marginTop: '10vh' }}>
      <h2 style={{ color: 'var(--color-danger)' }}>Access Denied</h2>
      <p>{message}</p>
      <button className="btn btn-secondary" onClick={() => onNavigate('/dashboard')} style={{ marginTop: '1rem' }}>
        Return to Dashboard
      </button>
    </div>
  );
}

function RouterShell() {
  const { user, organization, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/dashboard');
  const [copilotDraft, setCopilotDraft] = useState<InvoiceCopilotDraft | null>(null);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname || '/dashboard');
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Adaptive AI Billing Platform</h2>
          <p style={{ color: 'var(--text-muted)' }}>Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated routes
  if (!user) {
    if (currentPath === '/register') return <RegisterPage onNavigate={navigate} />;
    return <LoginPage onNavigate={navigate} />;
  }

  const renderCurrentPage = () => {
    if (currentPath === '/organizations/new') {
      return <NewOrganizationPage onNavigate={navigate} />;
    }

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

    if (currentPath === '/invoices') return <InvoicesListPage onNavigate={navigate} />;
    if (currentPath === '/payments') return <PaymentsPage onNavigate={navigate} />;
    if (currentPath === '/plans') return <SaaSManagementPage section="plans" />;
    if (currentPath === '/subscriptions') return <SaaSManagementPage section="subscriptions" />;
    if (currentPath === '/projects') return <AgencyManagementPage section="projects" />;
    if (currentPath === '/timesheets') return <AgencyManagementPage section="timesheets" />;
    if (currentPath === '/retainers') return <AgencyManagementPage section="retainers" />;
    if (currentPath === '/recurring') return <RecurringPage onNavigate={navigate} />;
    if (currentPath === '/credit-notes') return <CreditNotesPage onNavigate={navigate} />;
    if (currentPath === '/approvals') return <ApprovalsPage onNavigate={navigate} />;
    if (currentPath === '/reports') return <ReportsPage />;
    if (currentPath === '/customers') return <CustomersPage />;
    if (currentPath === '/products') return <ProductsPage />;
    if (currentPath === '/pos') return <PointOfSalePage />;
    if (currentPath === '/suppliers') return <SuppliersPage />;
    if (currentPath === '/purchases') return <PurchasesPage />;
    if (currentPath === '/returns') return <ReturnsPage />;
    if (currentPath === '/shifts') return <ShiftsPage />;
    if (currentPath === '/expenses') return <ExpensesPage />;
    if (currentPath === '/inventory') return <InventoryPage />;
    if (currentPath === '/held-bills') return <HeldBillsPage onNavigate={navigate} />;
    
    if (currentPath === '/dev/billing-test') {
      if (user.role !== 'admin') {
        return <AccessDenied onNavigate={navigate} message="Only administrators can run system tests." />;
      }
      return <BillingTestPage />;
    }

    if (currentPath === '/team') {
      if (user.role !== 'admin' && user.role !== 'manager') {
        return <AccessDenied onNavigate={navigate} message="You do not have permission to manage the team." />;
      }
      return <TeamPage />;
    }

    if (currentPath === '/backup') {
      if (user.role !== 'admin') {
        return <AccessDenied onNavigate={navigate} message="Only administrators can access backup and restore." />;
      }
      return <BackupPage />;
    }

    if (currentPath === '/settings') {
      if (user.role !== 'admin' && user.role !== 'manager') {
        return <AccessDenied onNavigate={navigate} message="You do not have permission to view organization settings." />;
      }
      return <SettingsPage />;
    }

    if (currentPath === '/audit') {
      if (user.role !== 'admin') {
        return <AccessDenied onNavigate={navigate} message="Only administrators can view compliance and audit logs." />;
      }
      return <AuditLogsPage />;
    }

    return <DashboardPage onNavigate={navigate} />;
  };

  // Onboarding enforcement: authenticated users with an incomplete organization
  // are kept in the onboarding flow until they complete or deliberately skip it.
  const isOnboarded = organization?.isOnboarded !== false;
  const onboardingExempt = currentPath === '/onboarding' || currentPath === '/organizations/new';
  if (!isOnboarded && !onboardingExempt) {
    return (
      <AppLayout key={organization?._id || 'org'} currentPath="/onboarding" onNavigate={navigate} onApplyDraftToInvoice={handleApplyDraft}>
        <OnboardingPage onNavigate={navigate} />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      key={organization?._id || 'org'}
      currentPath={currentPath}
      onNavigate={navigate}
      onApplyDraftToInvoice={handleApplyDraft}
    >
      {renderCurrentPage()}
    </AppLayout>
  );
}

import { POSCartProvider } from './context/POSCartContext';

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <POSCartProvider>
          <RouterShell />
        </POSCartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
