import React, { useState } from 'react';
import { Sparkles, Bot, Send, X, ArrowRight, CheckCircle2, TrendingUp } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { InvoiceCopilotDraft, AskBusinessQueryResponse } from '@billing/shared';

interface AiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyDraftToInvoice?: (draft: InvoiceCopilotDraft) => void;
}

export const AiCopilotDrawer: React.FC<AiCopilotDrawerProps> = ({
  isOpen,
  onClose,
  onApplyDraftToInvoice,
}) => {
  const [activeTab, setActiveTab] = useState<'copilot' | 'ask'>('copilot');

  // Invoice Copilot State
  const [invoicePrompt, setInvoicePrompt] = useState<string>('');
  const [draftResult, setDraftResult] = useState<InvoiceCopilotDraft | null>(null);
  const [isCopilotLoading, setIsCopilotLoading] = useState<boolean>(false);

  // Ask Business State
  const [chatQuery, setChatQuery] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<{ query: string; response: AskBusinessQueryResponse }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleParseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoicePrompt.trim()) return;

    setIsCopilotLoading(true);
    try {
      const res = await apiRequest<InvoiceCopilotDraft>('/ai/copilot/draft-invoice', {
        method: 'POST',
        body: JSON.stringify({ prompt: invoicePrompt }),
      });
      if (res.success && res.data) {
        setDraftResult(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const handleAskBusiness = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const queryToSend = customQuery || chatQuery;
    if (!queryToSend.trim()) return;

    setIsChatLoading(true);
    try {
      const res = await apiRequest<AskBusinessQueryResponse>('/ai/ask-business', {
        method: 'POST',
        body: JSON.stringify({ query: queryToSend }),
      });
      if (res.success && res.data) {
        setChatHistory((prev) => [...prev, { query: queryToSend, response: res.data! }]);
        setChatQuery('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          height: '100%',
          background: '#ffffff',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          animation: 'fadeIn 0.25s ease-out',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)',
              }}
            >
              <Sparkles size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>Adaptive AI Copilot</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Tool-grounded invoicing and conversational financial data
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: '#f8fafc' }}>
          <button
            onClick={() => setActiveTab('copilot')}
            style={{
              flex: 1,
              padding: '0.85rem',
              background: activeTab === 'copilot' ? '#ffffff' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'copilot' ? '2px solid var(--accent-primary)' : 'none',
              color: activeTab === 'copilot' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <Bot size={16} /> Natural-Language Invoicing
          </button>
          <button
            onClick={() => setActiveTab('ask')}
            style={{
              flex: 1,
              padding: '0.85rem',
              background: activeTab === 'ask' ? '#ffffff' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'ask' ? '2px solid var(--accent-primary)' : 'none',
              color: activeTab === 'ask' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <TrendingUp size={16} /> Ask Your Business
          </button>
        </div>

        {/* Drawer Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {activeTab === 'copilot' ? (
            <div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.45' }}>
                Describe what you want to invoice in plain English. The AI matches catalog SKUs, client accounts, and statutory tax rules.
              </p>

              {/* Sample Prompts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Quick Prompt Templates:</span>
                {[
                  'Invoice Apex Logistics: 2 cloud infra units at ₹75,000, 18% GST',
                  'Bill Aethelgard FinTech for 1 SOC2 Audit and 20 hours consulting',
                  'Create invoice for Horizon Health: 3 Dedicated Servers, due in 15 days',
                ].map((sample) => (
                  <button
                    key={sample}
                    onClick={() => setInvoicePrompt(sample)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    "{sample}"
                  </button>
                ))}
              </div>

              <form onSubmit={handleParseInvoice}>
                <div className="form-group">
                  <label className="form-label">Natural Language Invoice Instruction</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    placeholder="e.g. Invoice for Apex Logistics: 2 units of Cloud Server at ₹75,000 each, due in 15 days with 18% GST..."
                    value={invoicePrompt}
                    onChange={(e) => setInvoicePrompt(e.target.value)}
                  />
                  <span className="element-desc">Freeform English or voice prompt</span>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }} disabled={isCopilotLoading}>
                  {isCopilotLoading ? 'Analyzing & Grounding with Catalog...' : '✨ Generate Structured Invoice Draft'}
                </button>
              </form>

              {/* Parsed Result Preview */}
              {draftResult && (
                <div
                  className="glass-panel"
                  style={{ marginTop: '1.25rem', padding: '1.25rem', border: '1px solid #c7d2fe', animation: 'fadeIn 0.2s ease' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span className="badge badge-paid">
                      <CheckCircle2 size={12} /> Confidence: {Math.round(draftResult.confidenceScore * 100)}%
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Database Match</span>
                  </div>

                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    Matched Client: <span style={{ color: 'var(--accent-primary)' }}>{draftResult.customerName}</span>
                  </p>

                  <div style={{ background: '#f8fafc', borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '0.75rem', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      PARSED LINE ITEMS ({draftResult.items.length}):
                    </p>
                    {draftResult.items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                          padding: '0.35rem 0',
                          borderBottom: idx < draftResult.items.length - 1 ? '1px solid #e2e8f0' : 'none',
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>
                          {item.quantity}x {item.productName}
                        </span>
                        <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>₹{(item.quantity * item.unitPrice).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', fontStyle: 'italic' }}>
                    {draftResult.explanation}
                  </p>

                  {onApplyDraftToInvoice && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => {
                        onApplyDraftToInvoice(draftResult);
                        onClose();
                      }}
                    >
                      Apply To Invoicing Studio <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Ask financial questions in real-time. Responses are calculated directly from your tenant's MongoDB ledger.
              </p>

              {/* Sample Queries */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Quick Financial Queries:</span>
                {[
                  'What is our total revenue and collected amount?',
                  'Which invoices are currently overdue?',
                  'Show breakdown of our customer accounts',
                ].map((sample) => (
                  <button
                    key={sample}
                    onClick={() => handleAskBusiness(undefined, sample)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    "{sample}"
                  </button>
                ))}
              </div>

              {/* Chat Thread */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                {chatHistory.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* User bubble */}
                    <div
                      style={{
                        alignSelf: 'flex-end',
                        background: 'var(--accent-primary)',
                        color: '#ffffff',
                        padding: '0.6rem 0.9rem',
                        borderRadius: '12px 12px 2px 12px',
                        fontSize: '0.8125rem',
                        maxWidth: '85%',
                      }}
                    >
                      {item.query}
                    </div>

                    {/* AI Response bubble */}
                    <div
                      className="glass-panel"
                      style={{
                        alignSelf: 'flex-start',
                        background: '#f8fafc',
                        padding: '0.85rem 1rem',
                        borderRadius: '12px 12px 12px 2px',
                        fontSize: '0.8125rem',
                        maxWidth: '92%',
                        lineHeight: '1.45',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{item.response.answer}</div>

                      {/* Chart Data Summary */}
                      {item.response.chartData && (
                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.6rem', margin: '0.5rem 0' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Aggregated Metric:
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.3rem' }}>
                            {item.response.chartData.labels.map((lbl, lIdx) => (
                              <div key={lbl} style={{ fontSize: '0.75rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{lbl}:</span>{' '}
                                <strong style={{ fontFamily: 'var(--font-mono)' }}>₹{(item.response.chartData?.datasets[0]?.data[lIdx] || 0).toLocaleString()}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Follow-Up Suggestions */}
                      {item.response.suggestedFollowUps && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                          {item.response.suggestedFollowUps.map((fu, fIdx) => (
                            <button
                              key={fIdx}
                              onClick={() => handleAskBusiness(undefined, fu)}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '9999px',
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.7rem',
                                color: 'var(--accent-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              + {fu}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleAskBusiness} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ask a question about your revenue, clients..."
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={isChatLoading || !chatQuery.trim()}>
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
