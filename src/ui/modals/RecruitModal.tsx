import { useMemo, useState } from 'preact/hooks';
import { act, bands, closeModal, rules } from '../../state/app';
import * as A from '../../domain/actions';
import { recruitCost } from '../../domain/costs';
import type { Profile } from '../../domain/model';
import { catalogue, factions, freeName, isAgent, sameProfile, type CatalogueQuery } from '../../domain/roster';
import { Btn, Modal, Select, Tag } from '../components/ui';

const FACTIONS = factions(rules);
const SHOWN = 250;

export function RecruitModal({ bandId }: { bandId: string }) {
  const band = bands.value.find((b) => b.id === bandId);
  const [text, setText] = useState('');
  const [faction, setFaction] = useState<string>(band?.faction ?? '*');
  const [source, setSource] = useState<NonNullable<CatalogueQuery['source']>>('all');
  const [sel, setSel] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [free, setFree] = useState(false);
  const list = useMemo(() => (band ? catalogue(rules, band, { text, faction, source }) : []), [band?.killteam, band?.faction, text, faction, source]);
  if (!band) return null;
  const alliance = rules.killteams.find((k) => k.name === band.killteam)?.alliance ?? '?';
  const cost = sel ? recruitCost(rules, band, sel) : null;
  const agent = sel ? isAgent(band, { profile: sel }) : false;
  const pick = (p: Profile) => { setSel(p); setName(freeName(band, p.name)); };
  const confirm = () => { if (sel && act(bandId, (c, b) => A.recruit(c, b, sel, name, free), `${name || sel.name} rejoint la bande.`)) closeModal(); };

  return (
    <Modal title="Recruter" footer={<><span class="sp tiny muted">Cochez « Gratuit » pour une découverte (Spécialiste égaré) ou des renforts.</span><Btn onClick={closeModal}>Fermer</Btn></>}>
      <p class="small muted" style="margin:0 0 10px">Tous les soldats de toutes les armées : fiches Kill Team et unités Warhammer 40k. Un opérateur hors de votre kill team est un agent ({rules.campaign.roster.maxAgents} au plus, compté dans le seuil de renforts).</p>
      <div class="row">
        <input type="search" class="sp" placeholder="Rechercher…" aria-label="Rechercher" value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
        <Select aria-label="Faction" value={faction} options={[['*', 'Toutes les factions'], ['alliance', `Mon alliance (${alliance})`], ...FACTIONS.map((f) => [f, f] as [string, string])]} onChange={setFaction} />
        <Select aria-label="Source" value={source} options={[['all', 'Fiches + unités 40k'], ['killteam', 'Fiches Kill Team'], ['unit40k', 'Unités 40k']]} onChange={setSource} />
      </div>
      <div class="plist" role="listbox">
        {list.slice(0, SHOWN).map((p, i) => {
          const own = !isAgent(band, { profile: p });
          const c = recruitCost(rules, band, p);
          return (
            <div key={i} role="option" aria-selected={!!sel && sameProfile(sel, p)} class={`pitem ${sel && sameProfile(sel, p) ? 'sel' : ''}`} onClick={() => pick(p)}>
              <span class="sp">{p.name}<div class="tiny muted">{p.source === 'killteam' && `${p.killteam} · `}{p.faction}{p.pts40k != null && ` · ${p.pts40k} pts/fig.`}</div></span>
              {own ? <Tag tone="gold">Recrue</Tag> : <Tag>Agent</Tag>}
              <b class="small">{c == null ? '—' : `${c} RQ`}</b>
            </div>
          );
        })}
        {!list.length && <div class="pitem muted">Aucun résultat.</div>}
        {list.length > SHOWN && <div class="pitem tiny muted">{list.length - SHOWN} de plus : affinez la recherche.</div>}
      </div>
      {sel && (
        <div class="res">
          <div class="row"><b class="sp">{sel.name}</b>{agent ? <Tag>Agent</Tag> : <Tag tone="gold">Recrue</Tag>}</div>
          {agent && sel.faction !== band.faction && <div class="tiny" style="margin:4px 0">Hors de la faction {band.faction} : à valider avec vos adversaires (un agent doit partager un mot-clé de faction).</div>}
          <div class="row" style="margin-top:6px">
            <input type="text" class="sp" aria-label="Nom de l'opérateur" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            <label class="small row" style="gap:4px"><input type="checkbox" checked={free} onChange={(e) => setFree((e.target as HTMLInputElement).checked)} />Gratuit</label>
            <Btn variant="pri" disabled={cost == null && !free} onClick={confirm}>Recruter{!free && cost != null && ` (${cost} RQ)`}</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
