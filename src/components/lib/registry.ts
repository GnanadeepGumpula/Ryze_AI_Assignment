export type ComponentSpec = {
  allowedProps: readonly string[];
  allowedValues?: Record<string, readonly string[]>;
};

export const COMPONENT_REGISTRY = {
  Button: {
    allowedProps: ['label', 'variant', 'size'],
    allowedValues: {
      variant: ['primary', 'secondary', 'outline'],
      size: ['sm', 'md', 'lg'],
    },
  },
  Card: {
    allowedProps: ['title', 'description', 'content'],
  },
  Input: {
    allowedProps: ['label', 'placeholder', 'type'],
    allowedValues: {
      type: ['text', 'email', 'password', 'number', 'search', 'tel', 'url'],
    },
  },
  Table: {
    allowedProps: ['headers', 'rows', 'caption'],
  },
  Layout: {
    allowedProps: ['type'],
    allowedValues: {
      type: ['grid', 'flex', 'sidebar-layout'],
    },
  },
} as const satisfies Record<string, ComponentSpec>;

export type ComponentType = keyof typeof COMPONENT_REGISTRY;
