export const DOCUMENTATION_IDS = [
  "readme",
  "architecture",
  "database",
  "domain",
  "rules",
  "permissions",
  "authApi",
  "usersApi",
  "flowsApi",
  "personalApi",
  "versionsApi",
  "robotDocumentationApi",
] as const;

export type DocumentationId = (typeof DOCUMENTATION_IDS)[number];
export type DocumentationSources = Record<DocumentationId, string>;
