import { COMPONENT_REGISTRY } from '@/components/lib/registry';
import { pickAllowedProps, validatePlan, type PlanNode, type UIPlan } from '@/components/lib/validation';

export const GENERATOR_PROMPT = `
You are the "Generator" agent for a deterministic UI system.
Your job is to take the Planner JSON and output React component usage.

STRICT RULES:
1. You can ONLY use components from the provided Registry.
2. You CANNOT invent Tailwind classes or inline styles.
3. You MUST use the Layout component for top-level layout.
4. Use only allowed props and allowed values from the Registry.

OUTPUT FORMAT:
Return a JSON object matching the planner schema (no prose).
`;

// This function converts the JSON Plan into a string of React code.
export function generateReactCode(plan: UIPlan): string {
  const validation = validatePlan(plan);
  if (!validation.isValid) {
    return `/* Invalid UI plan:\n${validation.errors.join('\n')} */\n\nexport default function GeneratedUI() {\n  return <div>Invalid UI plan.</div>;\n}`;
  }

  const renderedComponents = plan.components
    .map((comp) => renderComponent(comp))
    .join('\n      ');

  return `
import React from 'react';
import { ${Object.keys(COMPONENT_REGISTRY).join(', ')} } from '@/components/lib';

export default function GeneratedUI() {
  return (
    <Layout type="${plan.layout}">
      ${renderedComponents}
    </Layout>
  );
}
  `.trim();
}

function renderComponent(node: PlanNode): string {
  const safeProps = pickAllowedProps(node.type, node.props);
  const propsString = Object.entries(safeProps)
    .map(([key, value]) => `${key}={${JSON.stringify(value)}}`)
    .join(' ');
  const children = node.children?.map((child) => renderComponent(child)).join('\n        ') ?? '';
  const hasChildren = children.trim().length > 0;

  if (hasChildren) {
    return `<${node.type}${propsString ? ` ${propsString}` : ''}>\n        ${children}\n      </${node.type}>`;
  }

  return `<${node.type}${propsString ? ` ${propsString}` : ''} />`;
}