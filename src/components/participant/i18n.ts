export type ParticipantMessages = Record<string, string>;

/** Tiny translator for participant pages: the study language, not the interface language, applies. */
export function makeTr(messages: ParticipantMessages) {
  return (key: string, vars?: Record<string, string | number>) => {
    let s = messages[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}
export type Tr = ReturnType<typeof makeTr>;

/** Convert Arabic-Indic and Persian digits to ASCII so numeric answers parse. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, "");
}
