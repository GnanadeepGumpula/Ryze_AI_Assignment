"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Layout, Table, pickAllowedProps, validatePlan } from '@/components/lib';
import type { PlanNode, UIPlan } from '@/components/lib';
import { generateReactCode } from '@/components/lib/agents/generator';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type GenerationVersion = {
  id: string;
  prompt: string;
  plan: UIPlan;
  code: string;
  explanation: string;
  createdAt: string;
};

type PlannerResponse = UIPlan;

type AgentPayload = {
  agent: 'planner' | 'explainer';
  input: string;
  context?: string;
  stream?: boolean;
};

export default function AssignmentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [versions, setVersions] = useState<GenerationVersion[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number | null>(null);
  const [currentPlan, setCurrentPlan] = useState<UIPlan | null>(null);
  const [currentCode, setCurrentCode] = useState('');
  const [currentExplanation, setCurrentExplanation] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeMobileView, setActiveMobileView] = useState<'code' | 'preview'>('code');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system');
  const [activeLeftPanel, setActiveLeftPanel] = useState<'conversation' | 'explainer'>('conversation');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isCodeModified, setIsCodeModified] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem('ryze-theme') as 'light' | 'dark' | 'system' | null;
    const initialTheme = storedTheme || 'system';
    setThemeMode(initialTheme);
    applyTheme(initialTheme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setSystemPrefersDark(mediaQuery.matches);
      if (themeMode === 'system') {
        applyTheme('system');
      }
    };

    setSystemPrefersDark(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const applyTheme = (mode: 'light' | 'dark' | 'system') => {
    const html = document.documentElement;
    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.classList.remove('light', 'dark');
      html.classList.add(prefersDark ? 'dark' : 'light');
      html.dataset.theme = 'system';
    } else {
      html.classList.remove('light', 'dark', 'system');
      html.classList.add(mode);
      html.dataset.theme = mode;
    }
  };

  const handleThemeChange = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
    localStorage.setItem('ryze-theme', mode);
    applyTheme(mode);
  };

  const effectiveTheme =
    themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode;

  const hasHistory = versions.length > 0;
  const currentVersion = useMemo(() => {
    if (currentVersionIndex === null) {
      return null;
    }
    return versions[currentVersionIndex] ?? null;
  }, [currentVersionIndex, versions]);

  const handleSendMessage = async (input: string) => {
    setIsGenerating(true);
    setCurrentCode('// Generating code...');
    setCurrentExplanation('');

    try {
      const plan = await callPlanner(input, currentPlan, (chunk) => {
        setCurrentCode(chunk);
      });
      const validation = validatePlan(plan);
      if (!validation.isValid) {
        setCurrentCode(`// Invalid plan:\n${validation.errors.join('\n')}`);
        setIsGenerating(false);
        return;
      }

      const code = generateReactCode(plan);
      setCurrentCode(code);
      const explanation = await callExplainer(input, plan, (chunk) => {
        setCurrentExplanation(chunk);
      });

      const version: GenerationVersion = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        prompt: input,
        plan,
        code,
        explanation,
        createdAt: new Date().toISOString(),
      };

      setVersions((prev) => {
        const next = [...prev, version];
        setCurrentVersionIndex(next.length - 1);
        return next;
      });

      setCurrentPlan(plan);
      setCurrentCode(code);
      setCurrentExplanation(explanation);
      setIsCodeModified(false);
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: input },
        { role: 'assistant', content: explanation },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate UI.';
      setCurrentCode(`// ${message}`);
      setCurrentExplanation('Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    const input = trimmedPrompt.length > 0 ? trimmedPrompt : 'Generate a clean SaaS UI layout.';
    await handleSendMessage(input);
  };

  const handleRollback = (index: number) => {
    if (index < 0 || index >= versions.length) {
      return;
    }
    const version = versions[index];
    setCurrentVersionIndex(index);
    setCurrentPlan(version.plan);
    setCurrentCode(version.code);
    setCurrentExplanation(version.explanation);
  };

  const handleNewSession = () => {
    setMessages([]);
    setVersions([]);
    setCurrentVersionIndex(null);
    setCurrentPlan(null);
    setCurrentCode('');
    setCurrentExplanation('');
    setPrompt('');
    setIsGenerating(false);
    setIsCodeModified(false);
    setShowHistoryModal(false);
    setActiveLeftPanel('conversation');
    setActiveMobileView('code');
  };

  return (
    <main className="app-bg relative min-h-screen overflow-hidden">
      <div className="shell">
        <header className="topbar fade-in">
          <div className="brand">
            <div className="brand-mark">RZ</div>
            <div>
              <p className="eyebrow">Ryze Studio</p>
              <h1 className="brand-title">Deterministic UI Generator</h1>
            </div>
          </div>
          <div className="actions">
            <button
              className={`btn btn-icon ${
                effectiveTheme === 'light'
                  ? 'bg-yellow-200 text-yellow-800'
                  : effectiveTheme === 'dark'
                  ? 'bg-slate-700 text-slate-100'
                  : 'bg-purple-200 text-purple-800'
              }`}
              onClick={() => {
                const modes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
                const currentIndex = modes.indexOf(themeMode);
                const nextMode = modes[(currentIndex + 1) % modes.length];
                handleThemeChange(nextMode);
              }}
              type="button"
              title={`Theme: ${themeMode} (click to cycle)`}
            >
              {themeMode === 'light' && '☀️'}
              {themeMode === 'dark' && '🌙'}
              {themeMode === 'system' && '💻'}
            </button>
            <button className="btn btn-ghost" onClick={handleNewSession} type="button">
              New Session
            </button>
            <button className="btn btn-primary" onClick={() => setShowHistoryModal(true)}>
              View History
            </button>
          </div>
        </header>

        <section className="claude-layout">
          <div className="left-rail">
            <div className="surface">
              <div className="panel-head">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Describe a UI</h2>
                  <p className="text-sm text-muted">Plan the layout and generate deterministic code.</p>
                </div>
                <span className="tag">Planner</span>
              </div>
              <div className="panel-body">
                <textarea
                  className="textarea"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Example: A clean pricing page with three cards, monthly toggle, and a FAQ table."
                />
                <div className="left-actions">
                  <button className="btn btn-ghost" onClick={() => setPrompt('')}>
                    Clear
                  </button>
                  <button className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating}>
                    {isGenerating ? 'Generating...' : 'Generate UI'}
                  </button>
                </div>
              </div>
            </div>

            <div className="surface">
              <div className="panel-head">
                <div>
                  <h2 className="text-lg font-semibold text-primary">
                    {activeLeftPanel === 'conversation' ? 'Conversation' : 'Explainer'}
                  </h2>
                  <p className="text-sm text-muted">
                    {activeLeftPanel === 'conversation'
                      ? 'Track prompts and explanations.'
                      : 'Why the system chose these components.'}
                  </p>
                </div>
                <span className="tag">{activeLeftPanel === 'conversation' ? 'Chat' : 'Explainer'}</span>
              </div>
              <div className="panel-body">
                {activeLeftPanel === 'conversation' ? (
                  messages.length > 0 ? (
                    <div className="chat-list">
                      {messages.map((message, index) => (
                        <div
                          key={`${message.role}-${index}`}
                          className={`chat-bubble ${message.role === 'user' ? 'is-user' : 'is-assistant'}`}
                        >
                          <p className="chat-role">{message.role === 'user' ? 'You' : 'Explainer'}</p>
                          <p className="chat-text">{message.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">Start by generating a UI to populate the chat.</p>
                  )
                ) : currentExplanation ? (
                  <p className="text-sm text-muted">{currentExplanation}</p>
                ) : (
                  <p className="text-sm text-muted">Generate a UI to see the reasoning here.</p>
                )}
              </div>
              <div className="mt-2 flex gap-2 border-t pt-2">
                <button
                  className={`flex-1 text-xs px-2 py-1 rounded transition ${
                    activeLeftPanel === 'conversation'
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:bg-opacity-80'
                  }`}
                  onClick={() => setActiveLeftPanel('conversation')}
                  type="button"
                >
                  Conversation
                </button>
                <button
                  className={`flex-1 text-xs px-2 py-1 rounded transition ${
                    activeLeftPanel === 'explainer'
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:bg-opacity-80'
                  }`}
                  onClick={() => setActiveLeftPanel('explainer')}
                  type="button"
                >
                  Explainer
                </button>
              </div>
            </div>
          </div>

          <div className="right-rail">
            <div className="surface">
              <div className="panel-head">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Generated Code</h2>
                  <p className="text-sm text-muted">Editable output ready to export.</p>
                </div>
                <span className="tag">Generator</span>
              </div>
              <div className="panel-body code-body">
                <div className="mobile-toggle">
                  <button
                    className={`seg-btn ${activeMobileView === 'code' ? 'is-active' : ''}`}
                    onClick={() => setActiveMobileView('code')}
                    type="button"
                  >
                    Code
                  </button>
                  <button
                    className={`seg-btn ${activeMobileView === 'preview' ? 'is-active' : ''}`}
                    onClick={() => setActiveMobileView('preview')}
                    type="button"
                  >
                    Preview
                  </button>
                </div>
                <textarea
                  className="code-editor"
                  value={currentCode}
                  onChange={(event) => {
                    setCurrentCode(event.target.value);
                    setIsCodeModified(true);
                  }}
                  spellCheck={false}
                  data-visible={activeMobileView === 'code'}
                />
              </div>
            </div>

            <div className="surface">
              <div className="panel-head">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Live Preview</h2>
                  <p className="text-sm text-muted">Rendered output with design tokens applied.</p>
                </div>
                <span className="tag">Preview</span>
              </div>
              <div className="panel-body preview-body" data-visible={activeMobileView === 'preview'}>
                <div className="preview-pane">
                  {isCodeModified && (
                    <div className="mb-3 p-3 bg-yellow-100 dark:bg-yellow-900 rounded border border-yellow-300 dark:border-yellow-700">
                      <p className="text-xs text-yellow-800 dark:text-yellow-100">
                        ⚠️ Code has been edited manually. Click <strong>"Generate UI"</strong> to update the preview.
                      </p>
                    </div>
                  )}
                  {currentPlan ? (
                    <div className="preview-live">
                      {renderPlan(currentPlan)}
                    </div>
                  ) : (
                    <div className="preview-placeholder">
                      <p className="text-sm text-muted">Generate a UI to see a live preview.</p>
                    </div>
                  )}
                  {/* This is where your generated component is rendered */}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="surface modal-content relative w-full max-w-2xl max-h-96 overflow-auto rounded-lg">
            <div className="panel-head sticky top-0 bg-inherit border-b flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-primary">Version History</h2>
                <p className="text-sm text-muted">Rollback to any previous generation.</p>
              </div>
              <button
                className="btn btn-ghost absolute top-4 right-4"
                onClick={() => setShowHistoryModal(false)}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {hasHistory ? (
                <div className="history-list space-y-2">
                  {versions.map((version, index) => (
                    <button
                      key={version.id}
                      className={`history-item w-full text-left ${currentVersionIndex === index ? 'is-active' : ''}`}
                      onClick={() => {
                        handleRollback(index);
                        setShowHistoryModal(false);
                      }}
                    >
                      <div className="history-title">Version {index + 1}</div>
                      <div className="history-meta">{new Date(version.createdAt).toLocaleString()}</div>
                      <div className="history-snippet">{version.prompt}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No versions yet. Generate your first UI.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

async function callPlanner(
  input: string,
  currentPlan: UIPlan | null,
  onChunk?: (text: string) => void
): Promise<PlannerResponse> {
  const context = currentPlan
    ? `CURRENT UI PLAN (modify instead of rewrite):\n${JSON.stringify(currentPlan, null, 2)}`
    : 'No current UI plan. Create a new plan.';

  const response = onChunk
    ? await callAgentStream({ agent: 'planner', input, context, stream: true }, onChunk)
    : await callAgent({ agent: 'planner', input, context });
  return parsePlannerResponse(response);
}

async function callExplainer(
  input: string,
  plan: UIPlan,
  onChunk?: (text: string) => void
): Promise<string> {
  const payload: AgentPayload = { agent: 'explainer', input, context: JSON.stringify(plan) };
  return onChunk ? callAgentStream({ ...payload, stream: true }, onChunk) : callAgent(payload);
}

async function callAgent(payload: AgentPayload): Promise<string> {
  const response = await fetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Agent request failed.');
  }

  const data = (await response.json()) as { content?: string };
  if (!data?.content) {
    throw new Error('Agent response missing content.');
  }

  return data.content;
}

async function callAgentStream(
  payload: AgentPayload,
  onChunk: (text: string) => void
): Promise<string> {
  const response = await fetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = 'Agent request failed';
    try {
      const errorData = (await response.json()) as { error?: string };
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      errorMessage = response.statusText || 'Server error';
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error('Response body is empty.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) {
      fullText += chunk;
      onChunk(fullText);
    }
  }

  return fullText;
}

function parsePlannerResponse(raw: string): PlannerResponse {
  const cleaned = raw.trim();
  if (!cleaned) {
    throw new Error('Planner response was empty.');
  }

  try {
    return JSON.parse(cleaned) as PlannerResponse;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('Planner response did not contain valid JSON.');
    }
    const jsonSlice = cleaned.slice(start, end + 1);
    return JSON.parse(jsonSlice) as PlannerResponse;
  }
}

function renderPlan(plan: UIPlan) {
  const layoutType = plan.layout as unknown as 'grid' | 'flex' | 'sidebar-layout';
  return (
    <Layout type={layoutType}>
      {plan.components.map((node, index) => (
        <React.Fragment key={`${node.type}-${index}`}>
          {renderNode(node)}
        </React.Fragment>
      ))}
    </Layout>
  );
}

function renderNode(node: PlanNode): React.ReactNode {
  const safeProps = pickAllowedProps(node.type, node.props) as unknown;
  const children = node.children?.map((child, index) => (
    <React.Fragment key={`${child.type}-${index}`}>{renderNode(child)}</React.Fragment>
  ));

  switch (node.type) {
    case 'Button':
      return <Button {...(safeProps as React.ComponentProps<typeof Button>)} />;
    case 'Card':
      return <Card {...(safeProps as React.ComponentProps<typeof Card>)}>{children}</Card>;
    case 'Input':
      return <Input {...(safeProps as React.ComponentProps<typeof Input>)} />;
    case 'Table':
      return <Table {...(safeProps as React.ComponentProps<typeof Table>)} />;
    case 'Layout':
      return <Layout {...(safeProps as React.ComponentProps<typeof Layout>)}>{children}</Layout>;
    default:
      return null;
  }
}
