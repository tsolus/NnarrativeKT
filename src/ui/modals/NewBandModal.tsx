import { useState } from 'preact/hooks';
import { closeModal, ctx, me, notify, openBand, rules, saveBand } from '../../state/app';
import * as A from '../../domain/actions';
import type { Operative } from '../../domain/model';
import { defaultRoster, factions, freeName, newOperative, profileFromKillteam, selectionWeight } from '../../domain/roster';
import { Btn, Modal, Select } from '../components/ui';

const FACTIONS = factions(rules);

export function NewBandModal() {
  const first = rules.killteams[0]!;
  const [name, setName] = useState('');
  const [player, setPlayer] = useState('');
  const [ktName, setKtName] = useState(first.name);
  const [faction, setFaction] = useState(first.faction);
  const [ops, setOps] = useState<Operative[]>(() => defaultRoster(first));
  const kt = rules.killteamByName.get(ktName)!;
  const startArsenal = (k = kt) => [...rules.universalEquipment.slice(0, rules.campaign.start.universalEquipment).map((e) => e.name), ...k.factionEquipment.slice(0, rules.campaign.start.factionEquipment)];
  const [arsenal, setArsenal] = useState<string[]>(startArsenal);
  const [toAdd, setToAdd] = useState(kt.operatives[0]!.name);

  // Changer de kill team préremplit faction, sélection et arsenal : tout reste modifiable ensuite.
  const pickKt = (n: string) => {
    const k = rules.killteamByName.get(n)!;
    setKtName(n); setFaction(k.faction); setOps(defaultRoster(k)); setArsenal(startArsenal(k)); setToAdd(k.operatives[0]!.name);
  };
  const patchOp = (i: number, p: Partial<Operative>) => setOps(ops.map((o, j) => (j === i ? { ...o, ...p } : o)));
  const add = () => {
    const d = kt.operatives.find((o) => o.name === toAdd)!;
    const fake = { operatives: ops } as Parameters<typeof freeName>[0];
    setOps([...ops, newOperative(profileFromKillteam(kt, d), freeName(fake, d.name), { elite: false })]);
  };
  const elites = ops.filter((o) => o.elite).length;
  const nUni = rules.campaign.start.universalEquipment;
  const create = () => {
    if (!name.trim()) { notify('Donnez un nom à la bande.'); return; }
    // Les autres écarts (nombre d'Élites…) n'empêchent pas la création : ils sont signalés.
    const errs = A.startingChecks(rules, { name, killteam: ktName, operatives: ops });
    const band = A.createBand(ctx(), { name, player, ownerId: me.value, killteam: ktName, faction, operatives: ops, arsenal });
    closeModal();
    void saveBand(band);
    openBand(band.id);
    if (errs.length) notify(errs.join(' '));
  };

  return (
    <Modal title="Nouvelle bande" footer={<><span class="sp tiny muted">Départ : {rules.campaign.start.requisitions} RQ, {rules.campaign.start.glory} ☼.</span><Btn onClick={closeModal}>Annuler</Btn><Btn variant="pri" onClick={create}>Créer la bande</Btn></>}>
      <div class="grid two">
        <label class="small">Nom de la bande<br /><input type="text" class="full" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
        <label class="small">Joueur<br /><input type="text" class="full" value={player} onInput={(e) => setPlayer((e.target as HTMLInputElement).value)} /></label>
        <label class="small">Kill team de base<br /><Select class="full" value={ktName} options={rules.killteams.map((k) => k.name)} onChange={pickKt} /></label>
        <label class="small">Faction (modifiable)<br /><Select class="full" value={faction} options={FACTIONS} onChange={setFaction} /></label>
      </div>
      <h3 style="margin-top:14px">Sélection de départ <span class="small muted">{selectionWeight(ops)} / {kt.selectionSize} · {elites} Élite{elites > 1 ? 's' : ''} sur {rules.campaign.start.elites}</span></h3>
      <p class="tiny muted" style="margin:2px 0 6px">{kt.selectionRule} Préremplie avec la kill team de base : renommez, retirez ou ajoutez. Cochez Élite pour le chef + 1 opérateur.</p>
      <div class="plist" style="max-height:34vh">
        {ops.map((o, i) => (
          <div key={o.id} class="pitem static">
            <input type="text" class="sp" aria-label="Nom" value={o.name} onInput={(e) => patchOp(i, { name: (e.target as HTMLInputElement).value })} />
            <span class="tiny muted">{o.profile.name}</span>
            <label class="tiny row" style="gap:3px"><input type="checkbox" checked={o.elite} disabled={o.profile.noUpgrades} onChange={(e) => patchOp(i, { elite: (e.target as HTMLInputElement).checked })} />Élite</label>
            <Btn small aria-label="Retirer" onClick={() => setOps(ops.filter((_, j) => j !== i))}>×</Btn>
          </div>
        ))}
      </div>
      <div class="row" style="margin-top:8px">
        <Select aria-label="Opérateur à ajouter" value={toAdd} options={kt.operatives.map((o) => o.name)} onChange={setToAdd} />
        <Btn onClick={add}>Ajouter</Btn>
        <Btn onClick={() => setOps(defaultRoster(kt))}>Réinitialiser</Btn>
      </div>
      <h3 style="margin-top:14px">Arsenal de départ</h3>
      <p class="tiny muted" style="margin:2px 0 6px">{nUni} équipements universels et {rules.campaign.start.factionEquipment} de faction, gratuits.</p>
      <div class="row">
        {arsenal.map((e, i) => (
          <Select key={i} aria-label={`Équipement ${i + 1}`} value={e} options={i < nUni ? rules.universalEquipment.map((x) => x.name) : kt.factionEquipment}
            onChange={(v) => setArsenal(arsenal.map((x, j) => (j === i ? v : x)))} />
        ))}
      </div>
    </Modal>
  );
}
