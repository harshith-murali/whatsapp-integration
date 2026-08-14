/**
 * Shared parsing of Meta template component payloads, used by both the
 * templates:sync script and the admin-triggered sync endpoint so the two paths
 * cannot drift apart.
 */

export const extractBody = (components: any[]): string => {
  const body = components.find((component) => component.type === "BODY");
  return body?.text || "";
};

export const extractFooter = (components: any[]): string | null => {
  const footer = components.find((component) => component.type === "FOOTER");
  return footer?.text || null;
};

export const extractHeaderType = (components: any[]): string | null => {
  const header = components.find((component) => component.type === "HEADER");
  return header?.format || null;
};

/**
 * Derives the ordered variable names from the {{n}} placeholders in a template.
 * Placeholders are sorted numerically and de-duplicated so that {{1}}/{{2}} map
 * to body_1/body_2 in the order Meta expects the parameters to be supplied.
 */
export const extractParameterSchema = (components: any[]) => {
  const collect = (text: string, prefix: string): string[] => {
    const indexes = Array.from(text.matchAll(/\{\{(\d+)\}\}/g)).map((match) => Number(match[1]));
    return Array.from(new Set(indexes))
      .sort((a, b) => a - b)
      .map((index) => `${prefix}_${index}`);
  };

  const header = components.find((component) => component.type === "HEADER");
  const headerNames = header?.format === "TEXT" ? collect(header.text || "", "header") : [];
  const bodyNames = collect(extractBody(components), "body");

  if (headerNames.length === 0 && bodyNames.length === 0) return null;

  return {
    ...(headerNames.length > 0 ? { header: headerNames } : {}),
    ...(bodyNames.length > 0 ? { body: bodyNames } : {}),
  };
};
