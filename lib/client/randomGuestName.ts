const ADJECTIVES = [
  "Swift",
  "Quiet",
  "Lucky",
  "Bold",
  "Calm",
  "Wise",
  "Keen",
  "Bright",
  "Cool",
  "Wild",
  "Happy",
  "Clever",
  "Brave",
  "Gentle",
  "Noble",
] as const;

const NOUNS = [
  "Heron",
  "Otter",
  "Finch",
  "Badger",
  "Raven",
  "Lynx",
  "Koala",
  "Panda",
  "Gecko",
  "Shrew",
  "Wren",
  "Crane",
  "Moose",
  "Falcon",
  "Turtle",
] as const;

function pick<T extends readonly string[]>(arr: T): T[number] {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return arr[buf[0]! % arr.length]!;
}

/** Friendly guest display name (≤ 40 chars for the join API). */
export function randomGuestDisplayName(): string {
  const n = 100 + (crypto.getRandomValues(new Uint32Array(1))[0]! % 900);
  return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${n}`;
}
