import { useState } from 'preact/hooks';
import { act, games, notify, openModal, rules } from '../../state/app';
import * as A from '../../domain/actions';
import { cryptoRng, rollMany } from '../../domain/dice';
import { Band, gone } from '../../domain/model';
import { allHonours, describeReward, explorationFor, explorationResult, honourLabel, rollExploration, rollHonours, rollTrauma, traumaResult, type HonourRoll, type TraumaResult } from '../../domain/phase';
import { bandStats } from '../../domain/scoring';
import { killteamOf } from '../../domain/roster';
import { Btn, Confirm, Select, Tag, TextField } from '../components/ui';

// L'état des jets (dés lancés, résultat en attente) est local à l'écran : il n'est enregistré qu'à la confirmation.

export function PhaseTab({ band }: { band: Band }) {
  const played = bandStats(rules, band.id, games.value).played;
  return (
    <>
      <p class="muted small" style="margin-top:0">Après chaque partie, dans l'ordre : traumatismes, promotion et expérience, renforts, exploration, intendance (recrues et améliorations dans le Registre, équipement dans Arsenal).</p>
      <Trauma band={band} />
      <Promotion band={band} />
      <div class="panel step">
        <h3>3. Renforts</h3>
        <p class="small muted">Optionnel, si vous ne pouvez plus aligner une sélection légale : videz l'arsenal et les RQ, complétez gratuitement le registre avec des troupes (case « Gratuit » au recrutement), puis sautez l'exploration et l'intendance.</p>
        <Btn onClick={() => openModal(<Confirm title="Appeler des renforts ?" text="L'arsenal et les Réquisitions sont vidés." choices={[{ label: 'Vider arsenal et RQ', variant: 'danger', run: () => act(band, A.callReinforcements) }]} />)}>Appeler des renforts</Btn>
      </div>
      <Exploration band={band} played={played} />
    </>
  );
}

function Trauma({ band }: { band: Band }) {
  const alive = band.operatives.filter((o) => !gone(o));
  const [opId, setOpId] = useState(alive[0]?.id ?? '');
  const [manual, setManual] = useState('');
  const [res, setRes] = useState<{ opId: string; t: TraumaResult; done: boolean } | null>(null);
  const op = alive.find((o) => o.id === opId) ?? alive[0];
  const show = (t: TraumaResult | null) => (t ? setRes({ opId: op!.id, t, done: false }) : notify('Résultat invalide.'));
  const target = res && band.operatives.find((o) => o.id === res.opId);
  return (
    <div class="panel step">
      <h3>1. Traumatismes</h3>
      <p class="small muted">Troupe : d6 (1 mort, 2 rate la prochaine partie). Élite : d66 sur la table des Séquelles ; Cicatrice sauf de {rules.sequelae.noScarFrom} à 66.</p>
      {!op ? <p class="muted small">Aucun opérateur.</p> : (
        <div class="row">
          <Select aria-label="Opérateur" value={op.id} options={alive.map((o) => [o.id, `${o.name}${o.elite ? ' (Élite)' : ''}`] as [string, string])} onChange={setOpId} />
          <Btn variant="pri" onClick={() => show(rollTrauma(rules, cryptoRng, op))}>Lancer</Btn>
          <span class="small muted">ou résultat</span>
          <input type="number" aria-label="Résultat du dé" placeholder={op.elite ? 'd66' : 'd6'} style="width:80px" value={manual} onInput={(e) => setManual((e.target as HTMLInputElement).value)} />
          <Btn onClick={() => show(traumaResult(rules, op, Number(manual)))}>Valider</Btn>
        </div>
      )}
      {res && target && (
        <div class="res">
          {target.name} : {res.t.die} = <b>{res.t.value}</b> · <b>{res.t.title}</b>, {res.t.text}
          {res.t.die === 'd66' && res.t.scar && <> · <Tag tone="red">Cicatrice</Tag></>}
          <div class="row" style="margin-top:8px">
            <Btn variant="pri" disabled={res.done} onClick={() => { if (act(band, (c, b) => A.applyTrauma(c, b, res.opId, res.t))) setRes({ ...res, done: true }); }}>{res.done ? 'Appliqué' : 'Appliquer à la fiche'}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function Promotion({ band }: { band: Band }) {
  const elites = band.operatives.filter((o) => !gone(o) && o.elite);
  const fieldedElites = elites.filter((o) => o.fielded);
  const tableNames = rules.honours.tables.map((t) => t.name);
  const [n, setN] = useState(1);
  const [prom, setProm] = useState<number[] | null>(null);
  const [opId, setOpId] = useState(elites[0]?.id ?? '');
  const [tables, setTables] = useState<string[]>(tableNames.slice(0, 2));
  const [rolls, setRolls] = useState<{ opId: string; rolls: HonourRoll[]; done: boolean } | null>(null);
  const [free, setFree] = useState('');
  const op = elites.find((o) => o.id === opId) ?? elites[0];
  const target = rolls && band.operatives.find((o) => o.id === rolls.opId);
  const keep = (h: string) => {
    if (!rolls || !h) return;
    if (act(band, (c, b) => A.addHonour(c, b, rolls.opId, h))) setRolls({ ...rolls, done: true });
  };
  return (
    <div class="panel step">
      <h3>2. Promotion et expérience</h3>
      <p class="small muted">Dés de promotion : 1d6 + 1 par Exploit glorieux de la bande ; au premier 6 la troupe devient Élite (6 automatique après 5 échecs). Chaque Élite qui a joué et survécu gagne 1 XP, +1 si elle a accompli un Exploit.</p>
      <div class="row">
        <span class="small">Dés de promotion</span>
        <input type="number" min={1} max={20} aria-label="Nombre de dés" value={n} style="width:60px" onInput={(e) => setN(Math.max(1, Math.min(20, Number((e.target as HTMLInputElement).value) || 1)))} />
        <Btn onClick={() => setProm(rollMany(cryptoRng, n))}>Lancer</Btn>
        {prom && <span>{prom.map((x, i) => <span key={i} class={`die static ${x === 6 ? 're' : ''}`}>{x}</span>)}</span>}
      </div>
      <div class="row" style="margin-top:8px">
        <Btn disabled={!fieldedElites.length} onClick={() => act(band, A.xpToFieldedElites, '+1 XP attribué.')}>+1 XP aux Élites alignées ({fieldedElites.length})</Btn>
      </div>
      {op && (
        <div class="row" style="margin-top:8px">
          <span class="small">Jet d'Honneur pour</span>
          <Select aria-label="Élite" value={op.id} options={elites.map((o) => [o.id, o.name] as [string, string])} onChange={setOpId} />
          {tableNames.map((t) => (
            <label key={t} class="small row" style="gap:3px">
              <input type="checkbox" checked={tables.includes(t)} onChange={(e) => setTables((e.target as HTMLInputElement).checked ? [...tables, t] : tables.filter((x) => x !== t))} />{t}
            </label>
          ))}
          <Btn variant="pri" onClick={() => (tables.length === 2 ? setRolls({ opId: op.id, rolls: rollHonours(rules, cryptoRng, tables), done: false }) : notify('Choisissez deux tables.'))}>Lancer 2 × 2d6</Btn>
        </div>
      )}
      {rolls && target && (
        <div class="res">
          <b>{target.name}</b>
          {rolls.rolls.map((r) => {
            const label = r.name ? honourLabel(r.name, r.table) : '';
            return (
              <div key={r.table} class="row" style="margin:4px 0">
                <span class="sp">{r.table} : 2d6 = <b>{r.value}</b> · {r.free ? <b>choix libre dans n'importe quelle table</b> : <><b>{r.name}</b>, {r.effect}{target.honours.includes(label) && <> <Tag tone="red">déjà acquis : prenez le suivant</Tag></>}</>}</span>
                {!r.free && <Btn small disabled={rolls.done} onClick={() => keep(label)}>Garder</Btn>}
              </div>
            );
          })}
          <div class="row small" style="margin-top:6px">Ou au choix :
            <Select aria-label="Honneur au choix" value={free} options={[['', '—'], ...allHonours(rules).map((h) => [h, h] as [string, string])]} onChange={setFree} />
            <Btn small disabled={rolls.done || !free} onClick={() => keep(free)}>Garder</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function Exploration({ band, played }: { band: Band; played: number }) {
  const ex = explorationFor(rules, played);
  const kt = killteamOf(rules, band);
  const [table, setTable] = useState(ex.tables[0]!);
  const [nDice, setNDice] = useState(ex.dice);
  const [dice, setDice] = useState<number[] | null>(null);
  const [rerolled, setRerolled] = useState<number[]>([]);
  const [mod, setMod] = useState(0);
  const [looted, setLooted] = useState(false);
  const [rewardIdx, setRewardIdx] = useState(0);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [relic, setRelic] = useState('');
  const [toPoints, setToPoints] = useState(0);
  const res = dice && explorationResult(rules, table, dice, mod);
  const known = !!res?.place && res.place.name !== 'Pillé' && band.discoveredPlaces.includes(res.place.name);
  const rewards = known ? [] : res?.place?.rewards ?? [];
  const reward = rewards[rewardIdx] ?? rewards[0];
  const eqOptions = reward?.equipment ? (reward.equipment.type === 'faction' ? kt.factionEquipment : rules.universalEquipment.map((e) => e.name)) : [];
  const relicOptions = reward?.relic ? rules.relics.filter((x) => reward.relic!.maxGlory === null || x.glory <= reward.relic!.maxGlory) : [];
  const eqChosen = reward?.equipment ? Array.from({ length: reward.equipment.count }, (_, i) => equipment[i] ?? eqOptions[0] ?? '') : [];
  const relicChosen = relic || relicOptions[0]?.name || '';
  const roll = () => { setDice(rollExploration(cryptoRng, nDice)); setRerolled([]); setMod(0); setLooted(false); setRewardIdx(0); setEquipment([]); setRelic(''); setToPoints(0); };
  const collect = () => {
    if (!res) return;
    const ok = act(band, (c, b) => A.explore(c, b, {
      loot: res.loot, place: res.place?.name ?? null, reward,
      equipment: eqChosen, relic: relicChosen, gloryToPoints: toPoints,
    }), 'Exploration encaissée.');
    if (ok) setLooted(true);
  };
  return (
    <div class="panel step">
      <h3>4. Exploration</h3>
      <p class="small muted">{played} partie{played > 1 ? 's' : ''} jouée{played > 1 ? 's' : ''} : {ex.dice} dés, table {ex.tables.join(' ou ')}. Relancez 1 dé (2 si vous avez gagné) en cliquant dessus. Butin = total ÷ {rules.campaign.exploration.lootDivisor} en RQ, crédité avec la découverte.</p>
      <div class="row">
        <Select aria-label="Table" value={table} options={rules.exploration.tables.map((t) => t.name)} onChange={setTable} />
        <span class="small">Dés</span>
        <input type="number" aria-label="Nombre de dés" value={nDice} style="width:60px" onInput={(e) => setNDice(Math.max(1, Math.min(12, Number((e.target as HTMLInputElement).value) || 1)))} />
        <Btn variant="pri" onClick={roll}>Lancer</Btn>
      </div>
      {dice && res && (
        <>
          <div class="row" style="margin-top:8px">
            {dice.map((x, i) => (
              <button type="button" key={i} class={`die ${rerolled.includes(i) ? 're' : ''}`} title="Relancer ce dé" disabled={looted}
                onClick={() => { const d = [...dice]; d[i] = cryptoRng(6); setDice(d); setRerolled([...rerolled, i]); }}>{x}</button>
            ))}
            <span class="small muted">Modificateur</span>
            <input type="number" aria-label="Modificateur" value={mod} style="width:60px" disabled={looted} onInput={(e) => setMod(Number((e.target as HTMLInputElement).value) || 0)} />
          </div>
          <div class="res">
            <b>Total {res.total}</b> sur la table {table} : <b>{res.place?.name ?? '?'}</b>, {res.place?.discovery}
            {known && <> · <Tag tone="red">déjà découvert : compte comme Pillé</Tag></>}
            <div style="margin-top:6px">Butin : <b>{res.loot} RQ</b></div>
            {rewards.length > 1 && (
              <div class="row small" style="margin-top:6px">Récompense :
                {rewards.map((rw, i) => (
                  <label key={i} class="row" style="gap:3px"><input type="radio" name="reward" checked={rewardIdx === i} disabled={looted} onChange={() => setRewardIdx(i)} />{describeReward(rw)}</label>
                ))}
              </div>
            )}
            {rewards.length === 1 && reward && <div class="small" style="margin-top:6px">Récompense : <b>{describeReward(reward)}</b></div>}
            {reward?.equipment && (
              <div class="row small" style="margin-top:6px">Équipement :
                {eqChosen.map((e, i) => <Select key={i} aria-label={`Équipement gratuit ${i + 1}`} value={e} options={eqOptions} onChange={(v) => setEquipment(eqChosen.map((x, j) => (j === i ? v : x)))} />)}
              </div>
            )}
            {reward?.relic && (
              <div class="row small" style="margin-top:6px">Relique :
                <Select aria-label="Relique gratuite" value={relicChosen} options={relicOptions.map((x) => [x.name, `${x.name} (${x.glory} ☼)`] as [string, string])} onChange={setRelic} />
              </div>
            )}
            {reward?.gloryToPoints && (
              <div class="row small" style="margin-top:6px">Gloire échangée contre des points :
                <input type="number" min={0} max={reward.gloryToPoints} aria-label="Gloire échangée" style="width:60px" value={toPoints} onInput={(e) => setToPoints(Math.max(0, Math.min(reward.gloryToPoints!, Number((e.target as HTMLInputElement).value) || 0)))} />
              </div>
            )}
            {!known && res.place && res.place.name !== 'Pillé' && !rewards.length && <div class="tiny muted" style="margin-top:6px">Effet à appliquer à la main sur la fiche (il n'y a rien à créditer).</div>}
            <div class="row" style="margin-top:8px">
              <Btn variant="pri" disabled={looted} onClick={collect}>{looted ? 'Encaissé' : 'Encaisser et noter le lieu'}</Btn>
            </div>
          </div>
        </>
      )}
      {band.discoveredPlaces.length > 0 && (
        <p class="small" style="margin-bottom:0"><span class="muted">Lieux découverts :</span>{' '}
          {band.discoveredPlaces.map((p, i) => <span key={p} class="chip">{p}<button type="button" aria-label="Retirer" onClick={() => act(band, (c, b) => A.removePlace(c, b, i))}>×</button></span>)}
        </p>
      )}
      <div class="row small" style="margin-top:8px">
        <span class="muted">Compétences d'exploration</span>
        <TextField class="sp" placeholder="ex. Relance, Recherche" value={band.explorationSkills} onCommit={(v) => act(band, (c, b) => A.setBandField(c, b, 'explorationSkills', v))} />
      </div>
    </div>
  );
}
