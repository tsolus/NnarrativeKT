import { useState } from 'preact/hooks';
import { act, bands, closeModal, games, rules } from '../../state/app';
import * as A from '../../domain/actions';
import { balance } from '../../domain/treasury';
import { Btn, Modal } from '../components/ui';

/** Correction exceptionnelle des comptes : un mouvement motivé, visible de tous dans le relevé. */
export function CorrectionModal({ bandId }: { bandId: string }) {
  const band = bands.value.find((b) => b.id === bandId);
  const [rq, setRq] = useState(0);
  const [glory, setGlory] = useState(0);
  const [points, setPoints] = useState(0);
  const [reason, setReason] = useState('');
  if (!band) return null;
  const bal = balance(rules, band, games.value);
  const num = (set: (n: number) => void) => (e: Event) => set(Math.round(Number((e.target as HTMLInputElement).value) || 0));
  const save = () => { if (act(bandId, (c, b) => A.correction(c, b, { rq, glory, points }, reason), 'Correction enregistrée.')) closeModal(); };
  return (
    <Modal title="Corriger les comptes" footer={<><span class="sp" /><Btn onClick={closeModal}>Annuler</Btn><Btn variant="pri" onClick={save}>Enregistrer</Btn></>}>
      <p class="small muted" style="margin-top:0">
        Les comptes se tiennent tout seuls : achats, ventes, butins, récompenses d'exploration, Gloire des exploits et des rangs.
        Ne corrigez que ce que l'appli ne gère pas (rançon d'un captif, oubli, règle maison). La correction et son motif apparaissent dans le relevé.
      </p>
      <p class="small">Solde actuel : <b>{bal.rq} RQ</b>, <b>{bal.glory} ☼</b>.</p>
      <div class="row">
        <label class="small">Réquisitions (±)<br /><input type="number" value={rq} onInput={num(setRq)} /></label>
        <label class="small">Gloire (±)<br /><input type="number" value={glory} onInput={num(setGlory)} /></label>
        <label class="small">Points de campagne (±)<br /><input type="number" value={points} onInput={num(setPoints)} /></label>
      </div>
      <label class="small" style="display:block;margin-top:10px">Motif (obligatoire)<br />
        <input type="text" class="full" placeholder="ex. Rançon payée par Les Griffes pour Ahriman" value={reason} onInput={(e) => setReason((e.target as HTMLInputElement).value)} />
      </label>
    </Modal>
  );
}
