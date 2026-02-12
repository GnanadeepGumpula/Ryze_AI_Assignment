# Ryze Deterministic UI Generator

A **Phase 2 advanced AI-powered UI generator** that combines multi-step agent orchestration, deterministic component rendering, and real-time streaming to create safe, predictable, and iteratively refinable user interfaces.

---

## 1. Architecture Overview

The system follows a **3-tier architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js 14 / React 18 / TypeScript)                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐│
│  │ Chat Interface       │  │ Real-time Preview                ││
│  │ (prompt input)       │──│ • Code panel (streaming chunks)  ││
│  │ Version Management   │  │ • Live component rendering       ││
│  │ Rollback            │  │ • Explainer panel                 ││
│  └──────────────────────┘  └──────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                     POST /api/agents
                    (streaming response)
                              │
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND API (Next.js Route Handler)                            │
│  ┌──────────────────────────────────────────────────────────────┤
│  │ 1. Inject prompt (server-owner: PLANNER_PROMPT)              │
│  │ 2. Defense: Detect prompt injection signals                  │
│  │ 3. Call selected LLM (OpenAI GPT-4o-mini or Anthropic Claude)│
│  │ 4. Validate response (schema + whitelist)                    │
│  │ 5. Stream validated chunks back to client                    │
│  └──────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
                              │
                     POST (LLM API Key)
                    (streaming response)
                              │
┌─────────────────────────────────────────────────────────────────┐
│  EXTERNAL LLM PROVIDER                                          │
│  ┌──────────────────────────────────────────────────────────────┤
│  │ OpenAI: gpt-4o-mini                                          │
│  │ Anthropic: claude-3-5-sonnet                                 │
│  └──────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

### Key Flow

1. **User submits prompt** (e.g., "Create a login form with email and password fields")
2. **Frontend calls POST /api/agents** with `{ agent: 'planner', input, context?, stream: true }`
3. **Backend**:
   - Validates input against injection signals
   - Injects `PLANNER_PROMPT` (server-owned, never exposed to client)
   - Calls LLM with system prompt + user input
   - Parses response as JSON (UIPlan schema)
   - Validates plan against component whitelist
   - **Streams validated chunks** back to client as readable stream
4. **Frontend**:
   - Collects streaming chunks in code panel (live token visibility)
   - Parses final JSON as UIPlan
   - Passes plan to **Generator** (converts JSON to React code)
   - Calls **Explainer** agent (explains reasoning in 2–3 sentences)
   - Renders result in preview panel using `renderPlan()` (actual React components)
   - Creates snapshot: `{ id, prompt, plan, code, explanation, createdAt }`
   - Stores snapshot in `versions[]` for rollback

---

## 2. Agent Design: 3-Step Orchestration

The system uses a **3-agent pipeline** with context passing for iterative refinement:

### Agent 1: Planner (JSON Schema Generator)

**Purpose**: Transform natural language request into a **deterministic JSON schema**.

**Input**:
- `input`: User query (e.g., "Login form with email/password")
- `context`: (Optional) Previous UIPlan for iterative edits (passed from currentPlan)

**Output**:
```json
{
  "layout": "grid|flex|sidebar-layout",
  "components": [
    {
      "type": "Card",
      "props": { "title": "Login", "description": "Enter credentials" },
      "children": [
        { "type": "Input", "props": { "label": "Email", "placeholder": "you@example.com", "type": "email" } },
        { "type": "Input", "props": { "label": "Password", "placeholder": "••••••", "type": "password" } },
        { "type": "Button", "props": { "label": "Sign In", "variant": "primary", "size": "md" } }
      ]
    }
  ]
}
```

**Details**:
- Outputs only **allowed components** from registry (Button, Card, Input, Table, Layout)
- Props must match registry **allowedProps** and **allowedValues**
- Used by **Explainer** to reason about layout choices
- Validated at gate before any code generation

---

### Agent 2: Generator (Code → React)

**Purpose**: Convert validated UIPlan JSON into **runnable React component code**.

**Algorithm**:
1. Write import statement for components from registry
2. Wrap all components in `<Layout type={plan.layout}>`
3. Recursively render each node with `pickAllowedProps()` (strips disallowed keys)
4. Generate inline JSX (no external CSS files, only Tailwind from components)

**Output**:
```tsx
import React from 'react';
import { Layout, Card, Input, Button } from '@/components/lib';

export default function GeneratedUI() {
  return (
    <Layout type="grid">
      <Card title="Login" description="Enter credentials">
        <Input label="Email" placeholder="you@example.com" type="email" />
        <Input label="Password" placeholder="••••••" type="password" />
        <Button label="Sign In" variant="primary" size="md" />
      </Card>
    </Layout>
  );
}
```

---

### Agent 3: Explainer (Reasoning)

**Purpose**: Provide 2–3 sentence summary of **why** the layout/components were chosen.

**Input**:
- `input`: Original user query
- `context`: UIPlan JSON generated by Planner

**Output** (example):
> "I created a centered Card layout with title and description for visual hierarchy. The Input fields use proper HTML types (email, password) for semantic meaning, and the primary Button variant draws focus to the sign-in action."

**Uses**:
- Displayed in the Explainer panel (left sidebar in Claude-style layout)
- Included in chat history for context
- Helps user understand AI reasoning before visually inspecting the preview

---

### Context Passing for Iteration

**Problem**: How do users iteratively refine the UI?

**Solution**: Pass `currentPlan` as context to the Planner:

```typescript
// Frontend: page.tsx
const plan = await callPlanner(input, currentPlan, callback);
// ↓ sends: { agent: 'planner', input, context: JSON.stringify(currentPlan), stream: true }

// Backend: /api/agents
const systemPrompt = buildSystemPrompt(agent, input, context);
// ↓ context injected into PLANNER_PROMPT template:
// "Previous layout was X. User now wants Y. Edit the plan to..."
```

**Result**: User can say "**Change the Card styling to use a sidebar layout**" and Planner receives previous output, making edits relative to current state instead of generating from scratch.

---

## 3. Component System: Deterministic & Safe

All UI components are **deterministically styled**, **whitelist-enforced**, and **validation-gated**.

### Available Components

| Component | Props | Example |
|-----------|-------|---------|
| **Button** | `label` (str), `variant` (primary\|secondary\|outline), `size` (sm\|md\|lg) | `<Button label="Click me" variant="primary" size="md" />` |
| **Card** | `title` (str), `description` (str), `content` (str) | `<Card title="Header" description="Subtext" content="Body text" />` |
| **Input** | `label` (str), `placeholder` (str), `type` (text\|email\|password\|number\|search\|tel\|url) | `<Input label="Email" placeholder="you@example.com" type="email" />` |
| **Table** | `headers` (str[]), `rows` (str[][]), `caption` (str) | `<Table headers={["Name", "Email"]} rows={[["Alice", "alice@ex.com"]]} />` |
| **Layout** | `type` (grid\|flex\|sidebar-layout) | `<Layout type="grid">{children}</Layout>` |

### Styling Philosophy: No User CSS

- **All components use locked Tailwind classes** (defined in component source files)
- **Zero CSS injection**: Components don't accept `className`, `style`, or `customClass` props
- **No inline styles**: All styling is hard-coded, theme-aware Tailwind
- **Example**: Button always uses `px-4 py-2 rounded bg-primary-600 hover:bg-primary-700` (exact values depend on theme)

### Safety Gate: 3-Layer Validation

```
┌──────────────────────────────────────┐
│ User Input                           │
└──────────────────────────────────────┘
              ↓
┌──────────────────┐  ← GATE 1: Injection Detection
│ PLANNER_PROMPT   │  Reject if input contains: "ignore previous", "jailbreak", etc.
└──────────────────┘
              ↓
┌──────────────────┐  ← GATE 2: Schema Validation (validatePlan)
│ JSON Parsing     │  - Plan must have layout + components array
└──────────────────┘  - Each component.type must be in COMPONENT_REGISTRY
              ↓        - Each component.props must exist in allowedProps
┌──────────────────┐  - Each prop value must match allowedValues constraints
│ GENERATOR        │  ← GATE 3: Prop Filtering (pickAllowedProps)
└──────────────────┘  - Strip any non-whitelisted props before rendering
              ↓        - Ensure prop values are within allowed enum
┌──────────────────┐
│ React Components │
└──────────────────┘
```

### Code: pickAllowedProps & validatePlan

```typescript
// validation.ts: pickAllowedProps
export function pickAllowedProps(
  type: ComponentType,
  props: Record<string, unknown> | undefined
): Record<string, unknown> {
  const spec = COMPONENT_REGISTRY[type];
  const safe: Record<string, unknown> = {};
  
  for (const key of spec.allowedProps) {
    if (props && key in props) {
      const value = props[key];
      // Check if value is in allowedValues enum (if constraint exists)
      if (spec.allowedValues && key in spec.allowedValues) {
        if (spec.allowedValues[key].includes(value as string)) {
          safe[key] = value;
        }
      } else {
        safe[key] = value;
      }
    }
  }
  
  return safe;
}

// validation.ts: validatePlan
export function validatePlan(plan: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!isRecord(plan)) {
    return { isValid: false, errors: ['Plan must be an object.'] };
  }
  
  if (typeof plan.layout !== 'string' || !layoutTypes.has(plan.layout)) {
    errors.push(`Invalid layout: must be grid, flex, or sidebar-layout.`);
  }
  
  if (!Array.isArray(plan.components)) {
    errors.push('Components must be an array.');
  } else {
    plan.components.forEach((node, i) => validateNode(node, i, errors));
  }
  
  return { isValid: errors.length === 0, errors };
}
```

### Live Preview: renderPlan & renderNode

Frontend renders validated components using `renderPlan()`:

```typescript
// page.tsx: renderPlan
function renderPlan(plan: UIPlan | null): React.ReactNode {
  if (!plan) return null;
  return (
    <Layout type={plan.layout as any}>
      {plan.components.map((node, i) => renderNode(node, i))}
    </Layout>
  );
}

// page.tsx: renderNode
function renderNode(node: PlanNode, key: React.Key): React.ReactNode {
  const safeProps = pickAllowedProps(node.type, node.props);
  const children = node.children?.map((c, i) => renderNode(c, i));
  
  switch (node.type) {
    case 'Button':
      return <Button key={key} {...(safeProps as any)} />;
    case 'Card':
      return <Card key={key} {...(safeProps as any)}>{children}</Card>;
    case 'Input':
      return <Input key={key} {...(safeProps as any)} />;
    case 'Table':
      return <Table key={key} {...(safeProps as any)} />;
    default:
      return null;
  }
}
```

**Result**: Live preview shows **actual React components**, not HTML mockups. Users see real styling, spacing, and behavior before deployment.

---

## 4. Engineering Judgments

### Judgment 1: JSON Schema for Planner Output (Not Raw Code)

**Decision**: Planner outputs a **JSON schema** (UIPlan) instead of raw React code.

**Why This Choice**:

| Aspect | Raw Code | JSON Schema (✓ chosen) |
|--------|----------|----------------------|
| **Safety** | Hard to validate; LLM could inject arbitrary code | Easy to validate; schema enforced at gate |
| **Composability** | Each generation is isolated | Plan can be passed as context to next iteration |
| **Error Recovery** | Invalid code breaks the pipeline | Invalid JSON caught and user notified |
| **Determinism** | LLM token variance → different code each time | Same JSON input → exactly same React output |
| **Explainability** | Code is opaque; hard to reason about choices | Schema structure reveals intent (layout + components) |
| **Version Tracking** | Large code strings in snapshots | Compact JSON stored in `versions[]` |

**Trade-off**: Adds one extra step (Planner JSON → Generator code), but **eliminates entire classes of bugs**.

---

### Judgment 2: Server-Owned Prompts (Not Client-Sent)

**Decision**: `PLANNER_PROMPT` and `EXPLAINER_PROMPT` are stored **server-side** in `/src/components/lib/agents/`. Frontend never sees them.

**Why This Choice**:

| Aspect | Client-Sent Prompts | Server-Owned Prompts (✓ chosen) |
|--------|-------------------|------|
| **Security** | User can read prompts from network tab; craft jailbreaks | Prompts hidden from client; impossible to pre-craft attacks |
| **Version Control** | Prompt changes require frontend redeploy | Prompt updates only need backend redeploy |
| **A/B Testing** | Hard to test prompt variants without releasing to prod | Easy: backend can serve different prompts by experiment flag |
| **IP Protection** | Prompts in client code are exposed as intellectual property | Prompts are internal server logic; protected |
| **Consistency** | Users on old frontend version see outdated prompts | All users always use latest prompt (if not cached) |
| **Attack Surface** | Frontend must trust user isn't modifying POST body | Server validates LLM output; frontend can't bypass |

**Trade-off**: Slightly larger server bundle; but **massive security win**. Backend becomes source of truth.

---

## 5. Running the Application

### Setup

```bash
# Install dependencies
npm install

# Set environment variables
# .env.local
OPENAI_API_KEY=sk-proj-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
```

### Development

```bash
npm run dev
# Open http://localhost:3000
```

### Build

```bash
npm run build
npm start
```

---

## 6. Key Files Reference

| File | Purpose |
|------|---------|
| [src/app/page.tsx](src/app/page.tsx) | Main orchestration: agents, state, streaming, rendering |
| [src/app/api/agents/route.ts](src/app/api/agents/route.ts) | Backend handler: LLM gateway, validation, streaming |
| [src/components/lib/validation.ts](src/components/lib/validation.ts) | Schema validator + prop filter |
| [src/components/lib/registry.ts](src/components/lib/registry.ts) | Whitelist of allowed components |
| [src/components/lib/agents/{planner,explainer}.ts](src/components/lib/agents) | Prompt constants (server-owned) |
| [src/components/lib/agents/generator.ts](src/components/lib/agents/generator.ts) | JSON → React code converter |

---

## 7. Feature Highlights

✅ **Multi-step orchestration** (Planner → Validation → Generator → Explainer)  
✅ **Real-time streaming** (live token visibility in code panel)  
✅ **Live preview rendering** (actual React components, not mocks)  
✅ **Iterative refinement** (pass currentPlan as context for edits)  
✅ **Version snapshots & rollback** (return to any previous generation)  
✅ **Deterministic styling** (no CSS injection, locked Tailwind only)  
✅ **3-layer validation** (injection detection → schema check → prop filter)  
✅ **Warm, clean SaaS UI** (light/dark theme, Claude-style layout)  
✅ **Multi-LLM support** (OpenAI or Anthropic via environment variable)

---

## 8. Assignment Submission Notes

This project fulfills **Phase 2: Advanced Agent Orchestration**:

1. ✅ Multi-step pipeline with context passing for iterative edits
2. ✅ State management: versions array for snapshots & rollback
3. ✅ Deterministic component library with validation gate
4. ✅ Real-time streaming output (visible tokens in UI)
5. ✅ Live preview rendering (actual React components)
6. ✅ Comprehensive safety: injection detection, schema validation, prop filtering
7. ✅ Server-owned prompts (architectural security win)
8. ✅ Clean, modern UI with Claude-style layout

**Key Engineering Trade-offs Documented** in Section 4 above.
