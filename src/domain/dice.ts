/** Générateur aléatoire injectable : les tests passent une suite de valeurs fixée. */
export type Rng = (sides: number) => number;

export const cryptoRng: Rng = (sides) => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return 1 + ((a[0] ?? 0) % sides);
};

/** Rng de test : renvoie les valeurs données, dans l'ordre. */
export function fixedRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i++];
    if (v === undefined) throw new Error('fixedRng : plus de valeurs');
    return v;
  };
}

export const d6 = (rng: Rng) => rng(6);
export const d66 = (rng: Rng) => rng(6) * 10 + rng(6);
export const twoD6 = (rng: Rng) => rng(6) + rng(6);
export const rollMany = (rng: Rng, n: number, sides = 6) => Array.from({ length: n }, () => rng(sides));

/** Vrai si v est dans une plage du livret : "11", "41-63", "10+", "7 ou moins". */
export function inRange(range: string, v: number): boolean {
  const m = range.match(/^(\d+)(?:-(\d+)|(\+)|( ou moins))?$/);
  if (!m) return false;
  const a = Number(m[1]);
  if (m[3]) return v >= a;
  if (m[4]) return v <= a;
  const b = m[2] ? Number(m[2]) : a;
  return v >= a && v <= b;
}

export const isD66 = (v: number) => Number.isInteger(v) && v >= 11 && v <= 66 && v % 10 >= 1 && v % 10 <= 6;
