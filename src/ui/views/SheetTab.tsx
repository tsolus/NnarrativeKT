import { useEffect, useState } from 'preact/hooks';
import { rules } from '../../state/app';
import { rosterChecks } from '../../domain/checks';
import { loadUnitSheet, type KtWeapon, type UnitSheetResult, type W40kWeapon } from '../../data/sheets';
import { Band, Operative, gone } from '../../domain/model';
import { rankOf } from '../../domain/phase';
import { isAgent, profileLabel } from '../../domain/roster';
import { equipmentText, glossary, ktGlossary, ktSheetOf, ktWeapons, unitChoice, type Glossary } from '../../domain/sheets';
import { Btn, Notes, Select, Tag } from '../components/ui';
import { Rich, Tip, WeaponRules } from '../components/Tip';

// Fiche technique de la bande : profils, armes retenues, capacités, équipement et suivi de campagne.
// Seules les armes choisies (création, recrutement ou registre) apparaissent. Les mots-clés et règles d'armes ont une infobulle. La page s'imprime proprement (bouton Imprimer).
export function SheetTab({ band }: { band: Band }) {
  const [all, setAll] = useState(false);
  const checks = rosterChecks(rules, band);
  const ops = band.operatives.filter((o) => !gone(o) && (all || o.fielded));
  const kt = rules.sheets.killteams[band.killteam];
  const g = ktGlossary(rules, band.killteam);
  const prose = glossary(rules.sheets.weaponRules);
  return (
    <div class="sheet">
      <div class="panel">
        <div class="row">
          <div class="sp">
            <h2>{band.name}</h2>
            <div class="small muted">{band.killteam} · {band.faction}{band.player && ` · ${band.player}`}</div>
          </div>
          <div class="row noprint">
            <Select aria-label="Opérateurs affichés" value={all ? 'all' : 'fielded'} options={[['fielded', 'Opérateurs alignés'], ['all', 'Tout le registre']]} onChange={(v) => setAll(v === 'all')} />
            <Btn onClick={() => window.print()}>Imprimer</Btn>
          </div>
        </div>
        {checks.length ? <div style="margin-top:8px"><Tag tone="red">Fiche provisoire</Tag><Notes items={checks} okText="" /></div>
          : <p class="small" style="margin:8px 0 0"><Tag tone="ok">Bande complète</Tag></p>}
        {kt && kt.factionRules.length > 0 && (
          <details class="sec"><summary>Règles de faction ({kt.factionRules.length})</summary>
            {kt.factionRules.map((r) => <div key={r.name} class="rule"><b>{r.name}</b> <Rich text={r.text} g={prose} /></div>)}
          </details>
        )}
      </div>
      {ops.length === 0 && <p class="muted">Aucun opérateur aligné : cochez « Aligné » dans le registre, ou affichez tout le registre.</p>}
      <div class="sheets">{ops.map((o) => <OperativeSheet key={o.id} band={band} o={o} g={g} prose={prose} />)}</div>
      {band.arsenal.length > 0 && (
        <div class="panel sec">
          <h3 class="mb">Arsenal</h3>
          {band.arsenal.map((e, i) => { const t = equipmentText(rules, band, e); return <div key={i} class="rule"><b>{e}</b> {t ? <Rich text={t.text} g={prose} /> : <span class="muted">(texte non trouvé)</span>}</div>; })}
        </div>
      )}
      <p class="tiny muted">Profils : données BSData, vérifiées contre les règles d'équipe officielles. Unités 40k : BSData (10e édition).</p>
    </div>
  );
}

function Header({ band, o }: { band: Band; o: Operative }) {
  return (
    <div class="row sh-head">
      <div class="sp"><h3>{o.name}</h3><div class="tiny muted">{profileLabel(o.profile)}</div></div>
      {o.profile.leader && !isAgent(band, o) && <Tag tone="gold">Chef</Tag>}
      {o.elite ? <Tag tone="gold">Élite · {rankOf(rules, o.xp).name}</Tag> : <Tag>Troupe</Tag>}
      {isAgent(band, o) && <Tag>Agent</Tag>}
      {o.status !== 'active' && <Tag tone="red">{o.status === 'injured' ? 'blessé' : 'capturé'}</Tag>}
    </div>
  );
}

const Stats = ({ items }: { items: [string, string][] }) => (
  <div class="stats">{items.map(([k, v]) => <div key={k}><span>{k}</span><b>{v || '–'}</b></div>)}</div>
);

/** g : glossaire complet (colonne Règles) ; prose : règles d'armes seules, liées dans les textes. */
function OperativeSheet({ band, o, g, prose }: { band: Band; o: Operative; g: Glossary; prose: Glossary }) {
  const sheet = ktSheetOf(rules, o);
  if (o.profile.source === 'unit40k') return <UnitCard band={band} o={o} />;
  if (!sheet) return <div class="card sheet-card"><Header band={band} o={o} /><p class="muted small">Pas de fiche pour ce profil.</p><Campaign band={band} o={o} g={prose} /></div>;
  // un agent d'une autre kill team garde les règles de la sienne
  const gl = o.profile.killteam && o.profile.killteam !== band.killteam ? ktGlossary(rules, o.profile.killteam) : g;
  return (
    <div class="card sheet-card">
      <Header band={band} o={o} />
      <Stats items={[['APL', sheet.stats.APL], ['Mouv.', sheet.stats.Move], ['Svg', sheet.stats.Save], ['PV', sheet.stats.Wounds]]} />
      <KtWeaponTable weapons={ktWeapons(sheet, o.loadout)} g={gl} />
      <Texts title="Capacités" items={sheet.abilities} g={prose} />
      <Texts title="Actions uniques" items={sheet.actions} g={prose} />
      <Campaign band={band} o={o} g={prose} />
      <div class="kw">{sheet.keywords.join(', ')}</div>
    </div>
  );
}

function KtWeaponTable({ weapons, g }: { weapons: KtWeapon[]; g: Glossary }) {
  if (!weapons.length) return null;
  return (
    <div class="tw"><table class="wt">
      <thead><tr><th>Arme</th><th title="Attaques">ATK</th><th title="Touche">HIT</th><th title="Dégâts normaux / critiques">DMG</th><th class="wr-col">Règles</th></tr></thead>
      <tbody>{weapons.map((w, i) => (
        <tr key={i}><td><span class="wi" title={w.type === 'melee' ? 'Mêlée' : 'Tir'}>{w.type === 'melee' ? '⚔' : '⌖'}</span> {w.name}{w.wr && <span class="wr-inline"><WeaponRules value={w.wr} g={g} /></span>}</td>
          <td>{w.atk}</td><td>{w.hit}</td><td>{w.dmg}</td><td class="wr-col"><WeaponRules value={w.wr} g={g} /></td></tr>
      ))}</tbody>
    </table></div>
  );
}

function Texts({ title, items, g }: { title: string; items: { name: string; text: string }[]; g: Glossary }) {
  if (!items.length) return null;
  return (
    <div class="small"><span class="lbl">{title}</span>
      {items.map((t) => <div key={t.name} class="rule"><b>{t.name}</b> <Rich text={t.text} g={g} /></div>)}
    </div>
  );
}

/** Ce que la campagne ajoute au profil : améliorations, équipement attitré, honneurs, séquelles, relique. */
function Campaign({ band, o, g }: { band: Band; o: Operative; g: Glossary }) {
  const lines: { name: string; text: string; tone?: string }[] = [];
  for (const u of o.upgrades) {
    const def = rules.upgrades.find((x) => x.name === u.name);
    lines.push({ name: u.name, text: def?.effect ?? '' });
    if (u.equipment) lines.push({ name: u.equipment, text: equipmentText(rules, band, u.equipment)?.text ?? '' });
  }
  for (const h of o.honours) lines.push({ name: h, text: honourEffect(h) });
  for (const s of o.sequelae) lines.push({ name: s, text: rules.sequelae.sequelae.find((x) => x.name === s)?.effect ?? '', tone: 'red' });
  if (o.relic) lines.push({ name: o.relic, text: rules.relics.find((r) => r.name === o.relic)?.effect ?? '' });
  if (!lines.length) return null;
  return (
    <div class="small campaign"><span class="lbl">Campagne</span>
      {lines.map((l, i) => <div key={i} class={`rule ${l.tone ?? ''}`}><b>{l.name}</b> {l.text && <Rich text={l.text} g={g} />}</div>)}
    </div>
  );
}

function honourEffect(label: string): string {
  const name = label.replace(/\s*\(.*\)$/, '');
  for (const t of rules.honours.tables) {
    const h = t.honours.find((x) => x.name === name);
    if (h) return h.effect;
  }
  return '';
}

function UnitCard({ band, o }: { band: Band; o: Operative }) {
  const [res, setRes] = useState<UnitSheetResult | null | 'loading' | 'error'>('loading');
  useEffect(() => {
    let live = true;
    loadUnitSheet(o.profile.name, o.profile.faction).then((r) => live && setRes(r), () => live && setRes('error'));
    return () => { live = false; };
  }, [o.profile.name, o.profile.faction]);
  const base = glossary({});
  if (res === 'loading') return <div class="card sheet-card"><Header band={band} o={o} /><p class="muted small">Chargement de la fiche…</p></div>;
  if (res === 'error' || !res) return <div class="card sheet-card"><Header band={band} o={o} /><p class="muted small">{res === 'error' ? 'Fiche indisponible (connexion ?).' : 'Pas de fiche pour cette unité.'}</p><Campaign band={band} o={o} g={base} /></div>;
  const { sheet } = res;
  const g = glossary(res.rules, sheet.abilities);
  const prose = glossary(res.rules);
  const choice = unitChoice(sheet, o.loadout);
  const st = choice?.model.stats ?? sheet.models[0]?.stats ?? {};
  return (
    <div class="card sheet-card">
      <Header band={band} o={o} />
      {sheet.models.length > 1 && <div class="tiny muted">Profil : {choice?.model.name}</div>}
      <Stats items={(['M', 'T', 'SV', 'W', 'LD', 'OC'] as const).map((k) => [k, st[k] ?? ''])} />
      <UnitWeaponTable weapons={choice?.opt.weapons ?? []} g={g} />
      {sheet.rules.length > 0 && <div class="small"><span class="lbl">Règles</span> {sheet.rules.map((r, i) => { const d = g.get(r.toLowerCase()) ?? null; return <span key={r}>{i > 0 && ', '}{d ? <Tip def={d}>{r}</Tip> : r}</span>; })}</div>}
      <Texts title="Capacités" items={sheet.abilities} g={prose} />
      <Campaign band={band} o={o} g={prose} />
      <div class="kw">{[...sheet.faction, ...sheet.keywords].join(', ')}</div>
    </div>
  );
}

function UnitWeaponTable({ weapons, g }: { weapons: W40kWeapon[]; g: Glossary }) {
  if (!weapons.length) return null;
  return (
    <div class="tw"><table class="wt">
      <thead><tr><th>Arme</th><th>Portée</th><th>A</th><th title="CT / CC">CT</th><th>F</th><th>PA</th><th>D</th><th class="wr-col">Mots-clés</th></tr></thead>
      <tbody>{weapons.map((w, i) => (
        <tr key={i}><td><span class="wi">{w.type === 'melee' ? '⚔' : '⌖'}</span> {w.name}{w.keywords && <span class="wr-inline"><WeaponRules value={w.keywords} g={g} /></span>}</td>
          <td>{w.range}</td><td>{w.a}</td><td>{w.skill}</td><td>{w.s}</td><td>{w.ap}</td><td>{w.d}</td><td class="wr-col"><WeaponRules value={w.keywords} g={g} /></td></tr>
      ))}</tbody>
    </table></div>
  );
}
