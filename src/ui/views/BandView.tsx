import { act, bands, games, route, rules, type BandTab } from '../../state/app';
import * as A from '../../domain/actions';
import { factions } from '../../domain/roster';
import { bandStats } from '../../domain/scoring';
import { Btn, NumberField, Select, Stat, TextField } from '../components/ui';
import { RosterTab } from './RosterTab';
import { PhaseTab } from './PhaseTab';
import { ArsenalTab } from './ArsenalTab';
import { LogTab } from './LogTab';

const TABS: [BandTab, string][] = [['roster', 'Registre'], ['phase', 'Phase de campagne'], ['arsenal', 'Arsenal et reliques'], ['log', 'Journal']];
const FACTIONS = factions(rules);

export function BandView({ id, tab }: { id: string; tab: BandTab }) {
  const band = bands.value.find((b) => b.id === id);
  if (!band) return <div class="panel empty"><p class="muted">Cette bande n'existe plus.</p><Btn onClick={() => (route.value = { view: 'bands' })}>Retour aux bandes</Btn></div>;
  const st = bandStats(rules, band.id, games.value);
  return (
    <>
      <div class="row"><Btn small onClick={() => (route.value = { view: 'bands' })}>← Bandes</Btn></div>
      <div class="row" style="margin-top:10px;align-items:flex-start">
        <div class="sp" style="min-width:240px">
          <TextField class="title-input" aria-label="Nom de la bande" value={band.name} onCommit={(v) => act(band, (c, b) => A.setBandField(c, b, 'name', v))} />
          <div class="row small muted" style="margin-top:4px">
            {band.killteam} ·
            <Select aria-label="Faction" value={band.faction} options={FACTIONS} onChange={(v) => act(band, (c, b) => A.setBandField(c, b, 'faction', v))} />
            <TextField placeholder="Joueur" style="width:130px" value={band.player} onCommit={(v) => act(band, (c, b) => A.setBandField(c, b, 'player', v))} />
          </div>
        </div>
        <div class="row">
          <Stat value={st.points} label="points de campagne" />
          <Stat value={st.played} label={`parties (${st.win}V ${st.draw}N ${st.loss}D)`} />
          <Stat value={<NumberField aria-label="Réquisitions" class="stat-input" value={band.requisitions} onCommit={(v) => act(band, (c, b) => A.correctResources(c, b, v, b.glory))} />} label="Réquisitions" />
          <Stat value={<NumberField aria-label="Gloire" class="stat-input" value={band.glory} onCommit={(v) => act(band, (c, b) => A.correctResources(c, b, b.requisitions, v))} />} label="Gloire ☼" />
        </div>
      </div>
      <div class="tabs" role="tablist">
        {TABS.map(([k, l]) => <button type="button" role="tab" key={k} class={tab === k ? 'on' : ''} onClick={() => (route.value = { view: 'band', id, tab: k })}>{l}</button>)}
      </div>
      {tab === 'roster' ? <RosterTab band={band} /> : tab === 'phase' ? <PhaseTab band={band} /> : tab === 'arsenal' ? <ArsenalTab band={band} /> : <LogTab band={band} />}
    </>
  );
}
