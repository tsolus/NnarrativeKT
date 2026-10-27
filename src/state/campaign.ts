// Code de la campagne en ligne : il figure dans le lien d'invitation (#c=…) et ce navigateur s'en souvient.
const KEY = 'ktc-campaign';
const VALID = /^[a-z0-9-]{8,40}$/;

export const isCampaignCode = (s: string) => VALID.test(s);

/** Extrait un code d'un lien d'invitation ou d'un code collé tel quel. */
export function parseCampaign(input: string): string | null {
  const s = input.trim().toLowerCase();
  const m = /[#&?]c=([a-z0-9-]+)/.exec(s);
  const code = m ? m[1]! : s;
  return isCampaignCode(code) ? code : null;
}

export function newCampaignCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** Code de l'adresse, sinon celui retenu par ce navigateur. */
export function currentCampaign(): string | null {
  const fromUrl = parseCampaign(location.hash);
  if (fromUrl) return fromUrl;
  try { const saved = localStorage.getItem(KEY); return saved && isCampaignCode(saved) ? saved : null; } catch { return null; }
}

export function rememberCampaign(code: string | null): void {
  try { code ? localStorage.setItem(KEY, code) : localStorage.removeItem(KEY); } catch { /* navigation privée : le lien suffit */ }
  history.replaceState(null, '', code ? `#c=${code}` : location.pathname + location.search);
}

export const inviteLink = (code: string) => `${location.origin}${location.pathname}#c=${code}`;
