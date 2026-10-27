import { bands, deleteGame, games, openModal, rules } from '../../state/app';
import { RESULT_LABEL } from '../../domain/model';
import { bandHistory } from '../../domain/scoring';
import { Btn, Confirm, Tag } from '../components/ui';
import { GameModal } from '../modals/GameModal';

export function GamesView() {
  const bs = bands.value;
  const list = [...games.value].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  // numéro et points de chaque partie pour chaque bande
  const played = new Map<string, { number: number; points: number }>();
  bs.forEach((b) => bandHistory(rules, b.id, games.value).forEach((p) => played.set(p.game.id + b.id, p)));
  return (
    <>
      <div class="row" style="margin-bottom:12px">
        <h2 class="sp">Parties</h2>
        <Btn variant="pri" disabled={bs.length < 2} onClick={() => openModal(<GameModal />)}>Enregistrer une partie</Btn>
      </div>
      {bs.length < 2 && <p class="muted">Il faut au moins deux bandes pour enregistrer une partie.</p>}
      {list.length ? (
        <div class="grid">
          {list.map((g) => (
            <div key={g.id} class="card">
              <div class="row"><b class="sp">{g.mission || 'Partie'}</b><span class="small muted">{g.date}</span></div>
              {g.sides.map((s) => {
                const b = bs.find((x) => x.id === s.bandId);
                const p = played.get(g.id + s.bandId);
                return (
                  <div key={s.bandId} class="row small">
                    <Tag tone={s.result === 'win' ? 'ok' : s.result === 'loss' ? 'red' : undefined}>{RESULT_LABEL[s.result]}</Tag>
                    <span class="sp">{b?.name ?? 'Bande supprimée'} <span class="muted">· partie {p?.number ?? '?'} · {s.exploits} exploit{s.exploits > 1 ? 's' : ''}</span></span>
                    <b>{p?.points ?? '—'} pts</b>
                  </div>
                );
              })}
              {g.notes && <div class="small muted">{g.notes}</div>}
              <div class="row"><span class="sp" />
                <Btn small variant="danger" onClick={() => openModal(<Confirm title="Supprimer cette partie ?" text="Les points de campagne seront recalculés." choices={[{ label: 'Supprimer', variant: 'danger', run: () => void deleteGame(g.id) }]} />)}>Supprimer</Btn>
              </div>
            </div>
          ))}
        </div>
      ) : bs.length >= 2 && <div class="panel empty"><p class="muted">Aucune partie enregistrée.</p></div>}
    </>
  );
}
