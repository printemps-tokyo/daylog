/**
 * Redact obvious secrets from free text before it is shown or written out.
 *
 * This is a best-effort guard for the common `key: value` shapes (passwords,
 * API keys, tokens). It is deliberately conservative and is not a substitute
 * for keeping real secrets out of commit messages and prompts in the first
 * place.
 */

// A label that introduces a secret, followed by a separator and the value.
const SECRET_RE =
  /(パスワード|password|passwd|\bpass\b|api[\s_-]?key|apikey|secret|token|アクセスキー|秘密鍵|access[\s_-]?key)(\s*[:：=]\s*)(\S+)/gi;

/** Replace secret values with `[masked]`, keeping the label and separator. */
export function maskSecrets(text: string): string {
  return text.replace(SECRET_RE, (_m, label, sep) => `${label}${sep}[masked]`);
}

/** Collapse whitespace and trim, so multi-line prompts become one tidy line. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
