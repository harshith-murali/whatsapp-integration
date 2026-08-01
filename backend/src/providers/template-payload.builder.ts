export type TemplateVariableMap = Record<string, string | number | boolean | null>;

export type TemplateSnapshot = {
  name: string;
  language: string;
  components?: unknown;
  parameterSchema?: {
    body?: string[];
    header?: string[];
  } | null;
};

const toTextValue = (value: unknown, field: string): string => {
  if (value === undefined || value === null) {
    throw new Error(`Missing template variable: ${field}`);
  }
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    throw new Error(`Unsupported template variable value for ${field}`);
  }
  const text = String(value).trim();
  if (!text) {
    throw new Error(`Template variable cannot be empty: ${field}`);
  }
  return text;
};

const resolveValues = (names: string[] | undefined, variables: TemplateVariableMap): string[] => {
  if (!names || names.length === 0) return [];
  return names.map((name) => toTextValue(variables[name], name));
};

export const buildTemplatePayload = (args: {
  to: string;
  template: TemplateSnapshot;
  variables?: TemplateVariableMap | null;
}) => {
  const variables = args.variables || {};
  const schema = args.template.parameterSchema || {};
  const headerValues = resolveValues(schema.header, variables);
  const bodyValues = resolveValues(schema.body, variables);

  const suppliedKeys = Object.keys(variables);
  const allowedKeys = new Set([...(schema.header || []), ...(schema.body || [])]);
  const unexpectedKeys = suppliedKeys.filter((key) => !allowedKeys.has(key));
  if (unexpectedKeys.length > 0) {
    throw new Error(`Unexpected template variables: ${unexpectedKeys.join(", ")}`);
  }

  const components = [];
  if (headerValues.length > 0) {
    components.push({
      type: "header",
      parameters: headerValues.map((text) => ({ type: "text", text })),
    });
  }
  if (bodyValues.length > 0) {
    components.push({
      type: "body",
      parameters: bodyValues.map((text) => ({ type: "text", text })),
    });
  }

  return {
    messaging_product: "whatsapp",
    to: args.to,
    type: "template",
    template: {
      name: args.template.name,
      language: {
        code: args.template.language,
      },
      ...(components.length > 0 ? { components } : {}),
    },
  };
};
