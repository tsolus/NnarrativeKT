import { useState } from 'preact/hooks';
import { act, bands, closeModal, rules } from '../../state/app';
import * as A from '../../domain/actions';
import { assignableEquipment } from '../../domain/costs';
import { Btn, Modal, Select, Tag } from '../components/ui';

export function UpgradeModal({ bandId, opId }: { bandId: string; opId: string }) {
  const band = bands.value.find((b) => b.id === bandId);
  const op = band?.operatives.find((o) => o.id === opId);
  const equipment = band ? assignableEquipment(rules, band) : [];
  const [choice, setChoice] = useState('');
  const [eq, setEq] = useState(equipment[0] ?? '');
  const [free, setFree] = useState(false);
  if (!band || !op) return null;
  const def = rules.upgrades.find((u) => u.name === choice);
  const price = rules.campaign.upgrades.price;
  const buy = () => { if (act(bandId, (c, b) => A.buyUpgrade(c, b, opId, choice, def?.needsEquipment ? eq : undefined, free))) closeModal(); };
  return (
    <Modal title={`Amélioration pour ${op.name}`} footer={<>
      <label class="small row sp" style="gap:4px"><input type="checkbox" checked={free} onChange={(e) => setFree((e.target as HTMLInputElement).checked)} />Gratuit (correction)</label>
      <Btn onClick={closeModal}>Annuler</Btn><Btn variant="pri" disabled={!choice} onClick={buy}>Acheter ({free ? 0 : price} RQ)</Btn>
    </>}>
      {rules.upgrades.map((u) => {
        const taken = op.upgrades.some((x) => x.name === u.name);
        return (
          <label key={u.name} class="pitem boxed">
            <input type="radio" name="upgrade" disabled={taken} checked={choice === u.name} onChange={() => setChoice(u.name)} />
            <span class="sp"><b>{u.name}</b><div class="tiny muted">{u.effect}</div></span>
            {taken && <Tag>déjà prise</Tag>}
          </label>
        );
      })}
      {def?.needsEquipment && (
        <div class="row"><span class="small">Équipement attitré :</span>
          {equipment.length ? <Select aria-label="Équipement attitré" value={eq} options={equipment} onChange={setEq} /> : <span class="small muted">aucun disponible</span>}
        </div>
      )}
    </Modal>
  );
}
