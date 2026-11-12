/** A single normalized activity event from one of the sources. */
export interface Activity {
  /** Which collector produced this event. */
  source: "git" | "claude" | "codex" | "gemini";
  /** Event time in milliseconds since the Unix epoch. */
  ts: number;
  /** Project / repository this event belongs to, when known. */
  project?: string;
  /** A one-line summary (commit subject, prompt, etc.). */
  title: string;
  /** Optional extra detail (changed files, session id, etc.). */
  detail?: string;
}

/** An inclusive-start, exclusive-end time window in epoch milliseconds. */
export interface Window {
  startMs: number;
  endMs: number;
}
