import { useState } from 'preact/hooks';
import { bands, closeModal, notify, saveGame } from '../../state/app';
import { createGame, gameErrors, type NewGame } from '../../domain/games';
import { GameResult, RESULT_LABEL } from '../../domain/model';
import { Btn, Modal, Select } from '../components/ui';

const RESULTS = GameResult.options.map((r) => [r, RESULT_LABEL[r]] as [GameResult, string]);
type Side = NewGame['sides'][number];

export function GameModal() {
  const bs = bands.value;
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mission, setMission] = useState('');
  const [notes, setNotes] = useState('');
  const [sides, setSides] = useState<Side[]>([
    { bandId: '', result: 'win', exploits: 0 }, { bandId: '', result: 'loss', exploits: 0 },
    { bandId: '', result: 'loss', exploits: 0 }, { bandId: '', result: 'loss', exploits: 0 },
  ]);
  const patch = (i: number, p: Partial<Side>) => setSides(sides.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const save = () => {
    const g = { date, mission, notes, sides };
    const errs = gameErrors(g);
    if (errs.length) { notify(errs[0]!); return; }
    closeModal();
    void saveGame(createGame(Date.now(), g));
    notify('Partie enregistrée. Passez à la phase de campagne de chaque bande.');
  };
  return (
    <Modal title="Enregistrer une partie" footer={<><span class="sp" /><Btn onClick={closeModal}>Annuler</Btn><Btn variant="pri" onClick={save}>Enregistrer</Btn></>}>
      <div class="row" style="margin-bottom:10px">
        <input type="date" aria-label="Date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
        <input type="text" class="sp" placeholder="Mission" value={mission} onInput={(e) => setMission((e.target as HTMLInputElement).value)} />
      </div>
      {sides.map((s, i) => (
        <div key={i} class="row" style="margin-bottom:6px">
          <Select class="sp" aria-label={`Bande ${i + 1}`} value={s.bandId} options={[['', i < 2 ? 'Bande…' : '(aucune)'], ...bs.map((b) => [b.id, `${b.name} (${b.killteam})`] as [string, string])]} onChange={(v) => patch(i, { bandId: v })} />
          <Select aria-label={`Résultat ${i + 1}`} value={s.result} options={RESULTS} onChange={(v) => patch(i, { result: v })} />
          <span class="small">Exploits</span>
          <input type="number" min={0} max={3} aria-label={`Exploits ${i + 1}`} style="width:56px" value={s.exploits} onInput={(e) => patch(i, { exploits: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) })} />
        </div>
      ))}
      <p class="tiny muted">Deux bandes pour une partie normale, jusqu'à quatre pour la finale. Les points sont calculés automatiquement.</p>
      <input type="text" class="full" placeholder="Notes (exploits accomplis, faits marquants…)" value={notes} onInput={(e) => setNotes((e.target as HTMLInputElement).value)} />
    </Modal>
  );
}
