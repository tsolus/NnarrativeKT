import { useEffect, useState } from 'preact/hooks';
import { loadUnitSheet, type UnitSheet } from '../../data/sheets';
import type { Profile } from '../../domain/model';
import { chosenOptions, ktSheetOfProfile, unitChoice, withChoice } from '../../domain/sheets';
import { rules } from '../../state/app';
import { Select } from './ui';

// Choix des options d'armes d'un opérateur : un menu par groupe d'options (ex. tir et mêlée).
// Utilisé à la création de la bande, au recrutement et dans le registre ; la fiche technique n'affiche que le choix fait.

const groupLabel = (name: string, n: number) => (n === 1 || name === 'Armes' ? 'Armes' : name);

export function LoadoutPicker({ profile, loadout, onChange, compact }: { profile: Profile; loadout: string[]; onChange: (l: string[]) => void; compact?: boolean }) {
  if (profile.source === 'unit40k') return <UnitLoadoutPicker profile={profile} loadout={loadout} onChange={onChange} compact={compact} />;
  const sheet = ktSheetOfProfile(rules, profile);
  if (!sheet) return null;
  const groups = sheet.weaponGroups.filter((g) => g.options.length > 1);
  const chosen = chosenOptions(sheet.weaponGroups, loadout);
  return (
    <>
      {sheet.weaponGroups.map((g, i) => g.options.length > 1 && (
        <label key={g.name} class={compact ? 'tiny row loadout' : 'row small loadout'}>
          {!compact && <span class="lbl">{groupLabel(g.name, groups.length)}</span>}
          <Select aria-label={`${groupLabel(g.name, groups.length)} de ${profile.name}`} value={chosen[i]!.name} options={g.options.map((o) => o.name)}
            onChange={(v) => onChange(withChoice(loadout, g.options.map((o) => o.name), v))} />
        </label>
      ))}
    </>
  );
}

function UnitLoadoutPicker({ profile, loadout, onChange, compact }: { profile: Profile; loadout: string[]; onChange: (l: string[]) => void; compact?: boolean }) {
  const [sheet, setSheet] = useState<UnitSheet | null>(null);
  useEffect(() => {
    let live = true;
    loadUnitSheet(profile.name, profile.faction).then((r) => live && setSheet(r?.sheet ?? null), () => live && setSheet(null));
    return () => { live = false; };
  }, [profile.name, profile.faction]);
  if (!sheet) return null;
  const options = sheet.models.flatMap((m) => m.options.map((o) => o.name));
  if (options.length < 2) return null;
  const choice = unitChoice(sheet, loadout);
  return (
    <label class={compact ? 'tiny row loadout' : 'row small loadout'}>
      {!compact && <span class="lbl">Armes</span>}
      <Select aria-label={`Armes de ${profile.name}`} value={choice!.opt.name} options={options} onChange={(v) => onChange(withChoice(loadout, options, v))} />
    </label>
  );
}
