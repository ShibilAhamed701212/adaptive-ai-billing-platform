import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { AiCopilotDrawer } from '../ai-copilot/AiCopilotDrawer';
import { InvoiceCopilotDraft } from '@billing/shared';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  onApplyDraftToInvoice?: (draft: InvoiceCopilotDraft) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  currentPath,
  onNavigate,
  onApplyDraftToInvoice,
}) => {
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  // On narrow screens the sidebar is an off-canvas drawer (see .app-sidebar-slot in index.css).
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsSidebarOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSidebarOpen]);

  const navigateAndClose = (path: string) => {
    setIsSidebarOpen(false);
    onNavigate(path);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <div className={`no-print app-sidebar-slot${isSidebarOpen ? ' is-open' : ''}`}>
        <Sidebar currentPath={currentPath} onNavigate={navigateAndClose} />
      </div>
      <div
        className={`no-print app-sidebar-backdrop${isSidebarOpen ? ' is-open' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="no-print">
          <Navbar
            onOpenAiDrawer={() => setIsAiDrawerOpen(true)}
            onNavigate={onNavigate}
            onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
            isSidebarOpen={isSidebarOpen}
          />
        </div>

        <main className="app-main" style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>{children}</div>
        </main>
      </div>

      {/* Global AI Copilot Drawer */}
      <div className="no-print">
        <AiCopilotDrawer
          isOpen={isAiDrawerOpen}
          onClose={() => setIsAiDrawerOpen(false)}
          onApplyDraftToInvoice={onApplyDraftToInvoice}
        />
      </div>
    </div>
  );
};

