import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Bot, Send, X, ArrowRight, CheckCircle2, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
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
  const [copilotError, setCopilotError] = useState<string | null>(null);

  // Ask Business State
  const [chatQuery, setChatQuery] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<{ query: string; response: AskBusinessQueryResponse }[]>([
    {
      query: 'Hello! What can you help me with?',
      response: {
        answer: 'Hello! I am your **AI Financial Assistant**. You can ask me real-time questions about your revenue, overdue invoices, accounts receivable balances, top customers, or cashflow forecasts.',
        sourcesUsed: ['AI Assistant'],
        suggestedFollowUps: [
          'What is our total revenue and collected amount?',
          'Which invoices are currently overdue?',
          'Show breakdown of our customer accounts',
        ],
      },
    },
  ]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatLoading]);

  if (!isOpen) return null;

  // Simple Markdown to HTML formatter for bold and bullets
  const renderFormattedAnswer = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={lIdx} style={{ margin: '0.25rem 0', lineHeight: 1.5 }}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  const handleParseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoicePrompt.trim()) return;

    setIsCopilotLoading(true);
    setCopilotError(null);
    try {
      const res = await apiRequest<InvoiceCopilotDraft>('/ai/copilot/draft-invoice', {
        method: 'POST',
        body: JSON.stringify({ prompt: invoicePrompt }),
      });
      if (res.success && res.data) {
        setDraftResult(res.data);
      } else {
        setCopilotError(res.error?.message || 'Could not parse invoice prompt.');
      }
    } catch (err: any) {
      console.error(err);
      setCopilotError(err.message || 'Network error while contacting AI copilot.');
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const handleAskBusiness = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const queryToSend = customQuery || chatQuery;
    if (!queryToSend.trim()) return;

    const currentQ = queryToSend;
    setChatQuery('');
    setChatError(null);
    setIsChatLoading(true);

    try {
      const res = await apiRequest<AskBusinessQueryResponse>('/ai/ask-business', {
        method: 'POST',
        body: JSON.stringify({ query: currentQ }),
      });

      if (res.success && res.data) {
        setChatHistory((prev) => [...prev, { query: currentQ, response: res.data! }]);
      } else {
        setChatError(res.error?.message || 'Failed to retrieve business intelligence.');
      }
    } catch (err: any) {
      console.error(err);
      setChatError(err.message || 'Error processing AI query.');
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
          maxWidth: '560px',
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
                Tool-grounded invoicing and conversational financial intelligence
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
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
                    type="button"
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
                  <span className="element-desc">Freeform English prompt</span>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }} disabled={isCopilotLoading || !invoicePrompt.trim()}>
                  {isCopilotLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Loader2 size={16} className="animate-spin" /> Analyzing & Grounding with Catalog...
                    </span>
                  ) : (
                    '✨ Generate Structured Invoice Draft'
                  )}
                </button>
              </form>

              {copilotError && (
                <div style={{ marginTop: '1rem', background: '#ffe4e6', border: '1px solid #fecdd3', color: '#e11d48', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <AlertTriangle size={14} style={{ display: 'inline', marginRight: '0.35rem' }} /> {copilotError}
                </div>
              )}

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
                      type="button"
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
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Ask financial questions in real-time. Responses are calculated directly from your tenant's MongoDB ledger.
              </p>

              {/* Sample Queries */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Quick Financial Queries:</span>
                {[
                  'What is our total revenue and collected amount?',
                  'Which invoices are currently overdue?',
                  'Show breakdown of our customer accounts',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => handleAskBusiness(undefined, sample)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.4rem 0.65rem',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, marginBottom: '1rem' }}>
                {chatHistory.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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
                        maxWidth: '94%',
                        lineHeight: '1.45',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ color: 'var(--text-primary)' }}>
                        {renderFormattedAnswer(item.response.answer)}
                      </div>

                      {/* Chart Data Summary */}
                      {item.response.chartData && item.response.chartData.labels && (
                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.6rem', margin: '0.6rem 0 0.4rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Aggregated Telemetry Breakdown:
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.35rem' }}>
                            {item.response.chartData.labels.map((lbl, lIdx) => (
                              <div key={lbl} style={{ fontSize: '0.75rem', background: '#f8fafc', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{lbl}:</span>{' '}
                                <strong style={{ fontFamily: 'var(--font-mono)' }}>₹{(item.response.chartData?.datasets[0]?.data[lIdx] || 0).toLocaleString()}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Follow-Up Suggestions */}
                      {item.response.suggestedFollowUps && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.6rem' }}>
                          {item.response.suggestedFollowUps.map((fu, fIdx) => (
                            <button
                              key={fIdx}
                              type="button"
                              onClick={() => handleAskBusiness(undefined, fu)}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #c7d2fe',
                                borderRadius: '9999px',
                                padding: '0.25rem 0.6rem',
                                fontSize: '0.7rem',
                                color: 'var(--accent-primary)',
                                fontWeight: 500,
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

                {isChatLoading && (
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      background: '#f8fafc',
                      padding: '0.75rem 1rem',
                      borderRadius: '12px 12px 12px 2px',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <Loader2 size={15} className="animate-spin" color="var(--accent-primary)" />
                    Querying financial ledger & reasoning...
                  </div>
                )}

                {chatError && (
                  <div style={{ background: '#ffe4e6', border: '1px solid #fecdd3', color: '#e11d48', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                    <AlertTriangle size={14} style={{ display: 'inline', marginRight: '0.35rem' }} /> {chatError}
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleAskBusiness} style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ask about revenue, overdue invoices, customers..."
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
