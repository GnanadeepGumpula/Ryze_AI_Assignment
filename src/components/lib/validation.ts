import { COMPONENT_REGISTRY, ComponentType, type ComponentSpec } from './registry';

export type PlanNode = {
  type: ComponentType;
  props?: Record<string, unknown>;
  children?: PlanNode[];
};

export type UIPlan = {
  layout: string;
  components: PlanNode[];
};

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
};

const registry: Record<ComponentType, ComponentSpec> = COMPONENT_REGISTRY;
const layoutTypes = new Set<string>(registry.Layout.allowedValues?.type ?? []);

const stringProps = new Set(['label', 'placeholder', 'title', 'description', 'content', 'caption']);

export function validatePlan(plan: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(plan)) {
    return { isValid: false, errors: ['Plan must be an object.'] };
  }

  if (typeof plan.layout !== 'string' || !layoutTypes.has(plan.layout)) {
    errors.push(`Plan.layout must be one of: ${Array.from(layoutTypes).join(', ')}.`);
  }

  if (!Array.isArray(plan.components)) {
    errors.push('Plan.components must be an array.');
  } else {
    plan.components.forEach((node, index) => {
      validateNode(node, `components[${index}]`, errors);
    });
  }

  return { isValid: errors.length === 0, errors };
}

export function pickAllowedProps(
  type: ComponentType,
  props: Record<string, unknown> | undefined
): Record<string, unknown> {
  const spec = COMPONENT_REGISTRY[type];
  const safeProps: Record<string, unknown> = {};
  const input = props ?? {};

  for (const key of spec.allowedProps) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      safeProps[key] = input[key];
    }
  }

  return safeProps;
}

function validateNode(node: unknown, path: string, errors: string[]): void {
  if (!isRecord(node)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  const type = node.type;
  if (typeof type !== 'string' || !(type in COMPONENT_REGISTRY)) {
    errors.push(`${path}.type must be a whitelisted component.`);
    return;
  }

  const spec = registry[type as ComponentType];
  const props = node.props ?? {};

  if (!isRecord(props)) {
    errors.push(`${path}.props must be an object when provided.`);
    return;
  }

  for (const key of Object.keys(props)) {
    if (!spec.allowedProps.includes(key)) {
      errors.push(`${path}.props.${key} is not allowed for ${type}.`);
    }
  }

  if (spec.allowedValues) {
    for (const [prop, allowed] of Object.entries(spec.allowedValues)) {
      if (prop in props && typeof props[prop] === 'string') {
        const allowedValues = allowed as readonly string[];
        if (!allowedValues.includes(props[prop] as string)) {
          errors.push(`${path}.props.${prop} must be one of: ${allowedValues.join(', ')}.`);
        }
      }
    }
  }

  for (const [key, value] of Object.entries(props)) {
    if (stringProps.has(key) && typeof value !== 'string') {
      errors.push(`${path}.props.${key} must be a string.`);
    }
  }

  if (type === 'Table') {
    if (!Array.isArray(props.headers) || !props.headers.every((cell) => typeof cell === 'string')) {
      errors.push(`${path}.props.headers must be an array of strings.`);
    }

    if (
      !Array.isArray(props.rows) ||
      !props.rows.every(
        (row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string')
      )
    ) {
      errors.push(`${path}.props.rows must be an array of string arrays.`);
    }
  }

  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      errors.push(`${path}.children must be an array when provided.`);
    } else {
      node.children.forEach((child, index) => {
        validateNode(child, `${path}.children[${index}]`, errors);
      });
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
