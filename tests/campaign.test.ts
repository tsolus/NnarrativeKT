import { describe, expect, it } from 'vitest';
import { newCampaignCode, parseCampaign } from '../src/state/campaign';

describe('code de campagne', () => {
  it('se lit dans un lien d’invitation ou tel quel', () => {
    expect(parseCampaign('https://tsolus.github.io/NnarrativeKT/#c=abcd2345efgh')).toBe('abcd2345efgh');
    expect(parseCampaign('  ABCD2345EFGH ')).toBe('abcd2345efgh');
    expect(parseCampaign('court')).toBeNull();
    expect(parseCampaign('https://exemple.fr/')).toBeNull();
  });
  it('nouveau code valide', () => {
    const c = newCampaignCode();
    expect(parseCampaign(c)).toBe(c);
    expect(c).not.toBe(newCampaignCode());
  });
});
