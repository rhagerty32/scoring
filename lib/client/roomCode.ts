/** Zero-width / BOM / word joiner — common in pasted text and break strict matching. */
const INVISIBLE_CHARS = /[\u200B-\u200D\uFEFF\u2060]/g;
/** En dash, em dash, minus sign, fullwidth hyphen, etc. — normalize so spacing rules apply. */
const UNICODE_HYPHENS = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/**
 * Strip whitespace and common invisible characters while the user types or pastes.
 * (Full NFKC + URL parsing still happens in {@link normalizeRoomCodeInput}.)
 */
export function sanitizedJoinFieldInput(value: string): string {
  return value.replace(INVISIBLE_CHARS, "").replace(/\u180E/g, "").replace(/\s/g, "");
}

/**
 * Normalize pasted or typed room input: trim, uppercase, and extract a code
 * from a full invite URL when present.
 */
export function normalizeRoomCodeInput(raw: string): string {
  try {
    let s = raw.trim();
    if (!s) return "";

    s = s.normalize("NFKC").replace(INVISIBLE_CHARS, "").replace(UNICODE_HYPHENS, "-");

    // Typed codes are only letters, digits, and ASCII hyphen — never run `/g/…` extraction on them.
    // That regex can otherwise mis-parse rare NFKC / homoglyph cases as a fake invite path.
    const looksLikePlainCode = /^[A-Za-z0-9-]+$/.test(s);
    if (!looksLikePlainCode) {
      const fromPath = s.match(/\/g\/([^/?#]+)/i);
      if (fromPath) {
        try {
          s = decodeURIComponent(fromPath[1]!);
        } catch {
          s = fromPath[1]!;
        }
      } else {
        try {
          if (/^https?:\/\//i.test(s)) {
            const u = new URL(s);
            const m = u.pathname.match(/\/g\/([^/]+)/i);
            if (m) {
              try {
                s = decodeURIComponent(m[1]!);
              } catch {
                s = m[1]!;
              }
            }
          }
        } catch {
          // ignore invalid URL
        }
      }
    }

    return s.trim().toUpperCase().replace(/[\s-]+/g, "");
  } catch {
    return "";
  }
}
