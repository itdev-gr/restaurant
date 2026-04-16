import { transliterate } from "transliteration";

// Greek digraphs that the default transliteration map renders with "y" for upsilon.
// Pre-replace so e.g. "ου" -> "ou" instead of "oy", matching standard Greek romanization.
const GREEK_DIGRAPHS: Array<[RegExp, string]> = [
  [/ου/g, "ou"],
  [/Ου/g, "Ou"],
  [/ΟΥ/g, "OU"],
  [/οΥ/g, "oU"],
  [/αυ/g, "av"],
  [/Αυ/g, "Av"],
  [/ΑΥ/g, "AV"],
  [/αΥ/g, "aV"],
  [/ευ/g, "ev"],
  [/Ευ/g, "Ev"],
  [/ΕΥ/g, "EV"],
  [/εΥ/g, "eV"],
];

export function slugify(input: string): string {
  // Strip combining diacritical marks first so accented digraphs (e.g. "ού") match.
  const stripped = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return transliterate(stripped, { replace: GREEK_DIGRAPHS })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateUniqueSlug(
  raw: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(raw) || "restaurant";
  if (!(await exists(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Could not generate unique slug after 1000 attempts.");
}
