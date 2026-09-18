import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Wand2,
  RefreshCw,
  HelpCircle,
  Cpu,
  Layers,
  ShieldCheck,
  Zap,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface OnboardingPageProps {
  onNavigate: (path: string) => void;
}

interface ClarifyingQuestion {
  id: string;
  question: string;
  options: string[];
}

interface ArchitectureBlueprint {
  modelName: string;
  baseBillingModel: string;
  matchScore: number;
  summary: string;
  customFields: Array<{
    targetEntity: string;
    fieldName: string;
    label: string;
    fieldType: string;
    options?: string[];
    required?: boolean;
    placeholder?: string;
  }>;
  businessRules: Array<{
    ruleName: string;
    description: string;
    event: string;
    condition: any;
    action: any;
  }>;
  recommendedModules: string[];
  suggestedTaxSystem: string;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onNavigate }) => {
  const { updateOrganization } = useAuth();
  const [businessDescription, setBusinessDescription] = useState<string>(
    'We provide cloud infrastructure subscriptions, DevOps retainers, and SOC2 compliance audit packages to tech startups.'
  );

  // Conversation & AI state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [customInputAnswer, setCustomInputAnswer] = useState<Record<string, string>>({});
  const [blueprint, setBlueprint] = useState<ArchitectureBlueprint | null>(null);
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'interviewing' | 'ready'>('idle');

  const startInterview = async (customDesc?: string) => {
    const descToSend = customDesc || businessDescription;
    if (!descToSend.trim()) return;

    setIsAnalyzing(true);
    try {
      const res = await apiRequest<{
        status: 'interviewing' | 'ready';
        aiMessage: string;
        clarifyingQuestions: ClarifyingQuestion[];
        architecture: ArchitectureBlueprint;
      }>('/ai/onboarding/interview', {
        method: 'POST',
        body: JSON.stringify({
          businessDescription: descToSend,
          answers: {},
          forceFinalize: false,
        }),
      });

      if (res.success && res.data) {
        setStatus(res.data.status);
        setAiMessage(res.data.aiMessage);
        setQuestions(res.data.clarifyingQuestions || []);
        setBlueprint(res.data.architecture);
      }
    } catch (e) {
      console.error('Error in AI onboarding interview:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectAnswer = async (questionId: string, answerText: string) => {
    const updatedAnswers = { ...selectedAnswers, [questionId]: answerText };
    setSelectedAnswers(updatedAnswers);

    // If all questions are answered or to refine blueprint
    setIsAnalyzing(true);
    try {
      const allAnswered = questions.length > 0 && Object.keys(updatedAnswers).length >= questions.length;

      const res = await apiRequest<{
        status: 'interviewing' | 'ready';
        aiMessage: string;
        clarifyingQuestions: ClarifyingQuestion[];
        architecture: ArchitectureBlueprint;
      }>('/ai/onboarding/interview', {
        method: 'POST',
        body: JSON.stringify({
          businessDescription,
          answers: updatedAnswers,
          forceFinalize: allAnswered,
        }),
      });

      if (res.success && res.data) {
        setStatus(res.data.status);
        setAiMessage(res.data.aiMessage);
        if (res.data.clarifyingQuestions && res.data.clarifyingQuestions.length > 0) {
          setQuestions(res.data.clarifyingQuestions);
        }
        setBlueprint(res.data.architecture);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFinalizeBlueprint = async () => {
    setIsAnalyzing(true);
    try {
      const res = await apiRequest<{
        status: 'ready';
        aiMessage: string;
        clarifyingQuestions: ClarifyingQuestion[];
        architecture: ArchitectureBlueprint;
      }>('/ai/onboarding/interview', {
        method: 'POST',
        body: JSON.stringify({
          businessDescription,
          answers: selectedAnswers,
          forceFinalize: true,
        }),
      });

      if (res.success && res.data) {
        setStatus('ready');
        setAiMessage(res.data.aiMessage);
        setBlueprint(res.data.architecture);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeployArchitecture = async () => {
    if (!blueprint) return;
    setIsProvisioning(true);

    try {
      const res = await apiRequest('/organizations/apply-architecture', {
        method: 'POST',
        body: JSON.stringify({ architecture: blueprint }),
      });

      if (res.success && res.data) {
        updateOrganization(res.data);
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        setTimeout(() => {
          onNavigate('/dashboard');
        }, 1200);
      }
    } catch (e) {
      console.error('Failed to deploy architecture:', e);
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleSkip = async () => {
    setIsProvisioning(true);
    try {
      const res = await apiRequest('/organizations/settings', {
        method: 'PATCH',
        body: JSON.stringify({ isOnboarded: true }),
      });
      if (res.success && res.data) {
        updateOrganization(res.data);
        onNavigate('/dashboard');
      }
    } catch (e) {
      console.error('Failed to skip onboarding:', e);
    } finally {
      setIsProvisioning(false);
    }
  };

  return (
    <div style={{ maxWidth: '980px', margin: '1rem auto' }}>
      {/* Wizard Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div
          style={{
            width: '3.75rem',
            height: '3.75rem',
            borderRadius: '24px',
            background: 'var(--accent-gradient)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--accent-glow)',
            marginBottom: '1rem',
          }}
        >
          <Wand2 size={30} color="#fff" />
        </div>
        <h1 style={{ fontSize: '2.1rem', marginBottom: '0.5rem', fontWeight: 800 }}>
          Interactive AI Business Architect
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '680px', margin: '0 auto', lineHeight: 1.5 }}>
          Have an intelligent discovery conversation with the AI Architect. The AI will ask clarifying questions about your billing mechanics, generate custom database schemas, and deploy a tailored billing engine.
        </p>
      </div>

      {/* Step 1: Initial Discovery Form */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} color="var(--accent-primary)" /> Step 1: Describe Your Business Model
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Conversational Grounding</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Describe what you sell, how you bill clients, or any specialized industry workflows:
        </p>

        <div className="form-group">
          <textarea
            className="form-textarea"
            rows={3}
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            placeholder="e.g. We operate a dental clinic and hospital with patient consultation fees, surgical packages, and monthly dental care subscriptions..."
          />
        </div>

        {/* Quick Industry Templates */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { label: 'SaaS & Subscriptions', text: 'We provide SaaS tiered subscription plans with per-seat billing, annual contracts, and automated renewal cycles.' },
              { label: 'Heavy Equipment Rental', text: 'We rent construction machinery and AV equipment with daily/monthly hire rates, operator fees, and refundable security deposits.' },
              { label: 'Freight Logistics', text: 'We operate interstate truck freight logistics billing per ton per kilometer with consignment tracking, toll, and fuel surcharges.' },
              { label: 'Consulting & Legal', text: 'We are a specialized law and consulting firm billing milestone retainers, hourly rate cards, and disbursement expenses.' },
              { label: 'Healthcare & Clinic', text: 'We run a medical healthcare clinic offering doctor consultations, diagnostic lab tests, pharmacy bills, and monthly wellness memberships.' },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setBusinessDescription(chip.text);
                  startInterview(chip.text);
                }}
                style={{ border: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={() => startInterview()}
            disabled={isAnalyzing || !businessDescription.trim()}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Analyzing with Gemini...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Start AI Discovery Interview
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step 2: AI Clarifying Questions & Interactive Interview */}
      {status !== 'idle' && (
        <div className="glass-panel animate-fade-in" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid #c7d2fe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '12px',
                background: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--text-primary)' }}>
                Step 2: AI Architectural Discovery & Clarification
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Answer the questions below to fine-tune your dynamic database schema and business rules
              </p>
            </div>
          </div>

          {/* AI Message */}
          {aiMessage && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginBottom: '1.75rem',
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                lineHeight: 1.6,
              }}
            >
              {aiMessage.split('\n').map((line, idx) => (
                <p key={idx} style={{ margin: '0.25rem 0' }}>
                  {line}
                </p>
              ))}
            </div>
          )}

          {/* Clarifying Questions List */}
          {questions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.75rem' }}>
              {questions.map((q, idx) => {
                const isAnswered = !!selectedAnswers[q.id];
                return (
                  <div
                    key={q.id || idx}
                    style={{
                      background: isAnswered ? '#f0fdf4' : '#ffffff',
                      border: isAnswered ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span
                        style={{
                          width: '1.5rem',
                          height: '1.5rem',
                          borderRadius: '50%',
                          background: isAnswered ? '#22c55e' : 'var(--accent-primary)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {isAnswered ? '✓' : idx + 1}
                      </span>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{q.question}</h4>
                    </div>

                    {/* Option Chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {q.options.map((opt) => {
                        const isSelected = selectedAnswers[q.id] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleSelectAnswer(q.id, opt)}
                            style={{
                              padding: '0.5rem 0.85rem',
                              borderRadius: '9999px',
                              border: isSelected ? '2px solid var(--accent-primary)' : '1px solid #cbd5e1',
                              background: isSelected ? '#eef2ff' : '#ffffff',
                              color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                              fontWeight: isSelected ? 700 : 500,
                              fontSize: '0.8125rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              transition: 'all 0.15s',
                            }}
                          >
                            {isSelected && <CheckCircle2 size={13} color="var(--accent-primary)" />}
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Answer Input */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Or type custom specification..."
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                        value={customInputAnswer[q.id] || ''}
                        onChange={(e) => setCustomInputAnswer({ ...customInputAnswer, [q.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customInputAnswer[q.id]?.trim()) {
                            e.preventDefault();
                            handleSelectAnswer(q.id, customInputAnswer[q.id]);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          if (customInputAnswer[q.id]?.trim()) {
                            handleSelectAnswer(q.id, customInputAnswer[q.id]);
                          }
                        }}
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handleFinalizeBlueprint}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Refining Architecture...' : '⚡ Generate Architecture Blueprint Now'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Generated Tailored Architecture Blueprint */}
      {blueprint && (
        <div
          className="glass-panel animate-fade-in"
          style={{ padding: '2rem', border: '1px solid var(--border-active)', marginBottom: '2.5rem' }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <span
                  style={{
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {blueprint.modelName}
                </span>
                <span className="badge badge-paid">
                  <CheckCircle2 size={13} /> {blueprint.matchScore}% Match
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Base Engine Architecture: <strong style={{ color: 'var(--accent-primary)', textTransform: 'capitalize' }}>{blueprint.baseBillingModel}</strong> • Tax System: <strong>{blueprint.suggestedTaxSystem}</strong>
              </span>
            </div>

            <span className="badge badge-model" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
              <Layers size={14} style={{ display: 'inline', marginRight: '0.35rem' }} /> AI-Tailored Solution
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            {blueprint.summary}
          </p>

          {/* Dynamic Custom Fields Blueprint */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h4 style={{ fontSize: '0.825rem', color: 'var(--accent-primary)', textTransform: 'uppercase', margin: 0, fontWeight: 700, letterSpacing: '0.05em' }}>
                Auto-Configured Dynamic Schema & Custom Fields ({blueprint.customFields.length}):
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MongoDB Schema Extension</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
              {blueprint.customFields.map((field, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    padding: '0.75rem 0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                    {field.label}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                    Entity: <code style={{ color: 'var(--accent-primary)', background: '#eef2ff', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>{field.targetEntity}</code> • Type: <code style={{ background: '#f1f5f9', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>{field.fieldType}</code>
                  </div>
                  {field.options && field.options.length > 0 && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      Options: {field.options.slice(0, 3).join(', ')}{field.options.length > 3 ? '...' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Business Rules Blueprint */}
          {blueprint.businessRules && blueprint.businessRules.length > 0 && (
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.825rem', color: '#6d28d9', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                ⚡ Auto-Configured Business Rules ({blueprint.businessRules.length}):
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {blueprint.businessRules.map((rule, idx) => (
                  <div key={idx} style={{ background: '#ffffff', border: '1px solid #e9d5ff', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#5b21b6' }}>{rule.ruleName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{rule.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Enabled Modules Preview */}
          <div style={{ marginBottom: '1.75rem' }}>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 700 }}>
              Enabled Workspace Modules:
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {blueprint.recommendedModules.map((mod) => (
                <span key={mod} className="badge badge-draft" style={{ textTransform: 'capitalize' }}>
                  ✓ {mod.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* Deploy Call To Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
            <button className="btn btn-secondary" onClick={handleSkip} disabled={isProvisioning}>
              Skip & Keep Current Defaults
            </button>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleDeployArchitecture}
              disabled={isProvisioning}
            >
              {isProvisioning ? (
                <>
                  <RefreshCw size={18} className="animate-spin" /> Provisioning Dynamic Schema...
                </>
              ) : (
                <>
                  Apply Architecture & Launch Workspace <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
