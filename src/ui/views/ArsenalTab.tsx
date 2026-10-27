import { useState } from 'preact/hooks';
import { act, deleteBand, openModal, rules } from '../../state/app';
import * as A from '../../domain/actions';
import { equipmentPrice, isUniversal, sellPrice } from '../../domain/costs';
import { Band, gone } from '../../domain/model';
import { killteamOf } from '../../domain/roster';
import { Btn, Confirm, Select } from '../components/ui';

export function ArsenalTab({ band }: { band: Band }) {
  const kt = killteamOf(rules, band);
  const universal = rules.universalEquipment.map((e) => e.name);
  const [uni, setUni] = useState(universal[0]!);
  const [fac, setFac] = useState(kt.factionEquipment[0] ?? '');
  const [freeEq, setFreeEq] = useState(false);
  const [relic, setRelic] = useState(rules.relics[0]!.name);
  const [freeRelic, setFreeRelic] = useState(false);
  const p = rules.campaign.prices;
  return (
    <>
      <div class="grid wide">
        <div class="panel">
          <h3>Arsenal ({band.arsenal.length})</h3>
          <p class="small muted">Avant chaque partie, jusqu'à 4 équipements pris dans l'arsenal.</p>
          {band.arsenal.length ? band.arsenal.map((e, i) => (
            <div key={i} class="row line">
              <span class="sp">{e} <span class="tiny muted">{isUniversal(rules, e) ? 'universel' : 'faction'}</span></span>
              <Btn small onClick={() => act(band, (c, b) => A.sellEquipment(c, b, i))}>Vendre (+{sellPrice(rules, equipmentPrice(rules, e))} RQ)</Btn>
              <Btn small variant="danger" title="Retirer sans vendre" onClick={() => act(band, (c, b) => A.discardEquipment(c, b, i))}>×</Btn>
            </div>
          )) : <p class="muted small">Arsenal vide.</p>}
          <div class="row" style="margin-top:10px">
            <Select aria-label="Équipement universel" value={uni} options={universal} onChange={setUni} />
            <Btn onClick={() => act(band, (c, b) => A.buyEquipment(c, b, uni, freeEq))}>Acheter ({freeEq ? 0 : p.universalEquipment} RQ)</Btn>
          </div>
          <div class="row" style="margin-top:6px">
            <Select aria-label="Équipement de faction" value={fac} options={kt.factionEquipment} onChange={setFac} />
            <Btn onClick={() => act(band, (c, b) => A.buyEquipment(c, b, fac, freeEq))}>Acheter ({freeEq ? 0 : p.factionEquipment} RQ)</Btn>
          </div>
          <label class="row small muted" style="margin-top:6px"><input type="checkbox" checked={freeEq} onChange={(e) => setFreeEq((e.target as HTMLInputElement).checked)} /> Gratuit (création, découverte)</label>
        </div>
        <div class="panel">
          <h3>Reliques ({band.relics.length})</h3>
          <p class="small muted">Payées en Gloire, une par opérateur ; attribuez-les depuis la fiche de l'opérateur.</p>
          {band.relics.length ? band.relics.map((r, i) => {
            const holder = band.operatives.find((o) => o.relic === r && !gone(o));
            return (
              <div key={i} class="row line">
                <span class="sp">{r} <span class="tiny muted">{holder ? `portée par ${holder.name}` : 'non attribuée'}</span></span>
                <Btn small variant="danger" onClick={() => act(band, (c, b) => A.discardRelic(c, b, i))}>×</Btn>
              </div>
            );
          }) : <p class="muted small">Aucune relique.</p>}
          <div class="row" style="margin-top:10px">
            <Select aria-label="Relique" value={relic} options={rules.relics.map((r) => [r.name, `${r.name} (${r.glory} ☼)`] as [string, string])} onChange={setRelic} />
            <Btn onClick={() => act(band, (c, b) => A.buyRelic(c, b, relic, freeRelic))}>Acheter</Btn>
          </div>
          <label class="row small muted" style="margin-top:6px"><input type="checkbox" checked={freeRelic} onChange={(e) => setFreeRelic((e.target as HTMLInputElement).checked)} /> Gratuite (découverte)</label>
          <div class="row" style="margin-top:12px">
            <Btn onClick={() => act(band, A.hireMercenary, 'Mercenaire loué.')}>Louer un mercenaire ({p.mercenaryGlory} ☼)</Btn>
          </div>
          <p class="tiny muted">Chirurgie ({p.surgery} RQ) : cliquez sur × à côté de la Séquelle, dans la fiche de l'opérateur.</p>
        </div>
      </div>
      <div class="panel sec">
        <h3>Supprimer la bande</h3>
        <p class="small muted">Définitif pour tous les joueurs de la campagne.</p>
        <Btn variant="danger" onClick={() => openModal(<Confirm title={`Supprimer ${band.name} ?`} text="La bande disparaît pour tous. Ses parties restent dans l'historique." choices={[{ label: 'Supprimer', variant: 'danger', run: () => void deleteBand(band.id) }]} />)}>Supprimer {band.name}</Btn>
      </div>
    </>
  );
}
