import React, { useState } from 'react';
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <div className="no-print">
        <Sidebar currentPath={currentPath} onNavigate={onNavigate} />
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="no-print">
          <Navbar onOpenAiDrawer={() => setIsAiDrawerOpen(true)} onNavigate={onNavigate} />
        </div>

        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
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

