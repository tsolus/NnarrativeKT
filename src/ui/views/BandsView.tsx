import { bands, games, me, openBand, openModal, rules } from '../../state/app';
import { rosterChecks } from '../../domain/checks';
import { gone } from '../../domain/model';
import { bandStats, bonusPoints } from '../../domain/scoring';
import { balance } from '../../domain/treasury';
import { Btn, Tag } from '../components/ui';
import { NewBandModal } from '../modals/NewBandModal';

export function BandsView() {
  const list = bands.value;
  const create = () => openModal(<NewBandModal />);
  return (
    <>
      <div class="row" style="margin-bottom:12px"><h2 class="sp">Bandes</h2><Btn variant="pri" onClick={create}>Nouvelle bande</Btn></div>
      {!list.length ? (
        <div class="panel empty">
          <h3>Aucune bande pour l'instant</h3>
          <p class="muted">Créez la vôtre : choisissez une kill team, la sélection de base est préremplie et reste modifiable.</p>
          <Btn variant="pri" onClick={create}>Créer une bande</Btn>
        </div>
      ) : (
        <div class="grid">
          {list.map((b) => {
            const st = bandStats(rules, b.id, games.value);
            const warnings = rosterChecks(rules, b).length;
            const bal = balance(rules, b, games.value);
            return (
              <div key={b.id} class="card bcard" role="button" tabIndex={0} onClick={() => openBand(b.id)} onKeyDown={(e) => e.key === 'Enter' && openBand(b.id)}>
                <div class="row"><h3 class="sp">{b.name}</h3>{b.ownerId && b.ownerId === me.value && <Tag tone="gold">Ma bande</Tag>}</div>
                <div class="small muted">{b.killteam} · {b.faction}{b.player && ` · ${b.player}`}</div>
                <div class="row small">
                  <span><b>{st.points + bonusPoints(b)}</b> pts</span><span>{st.played} parties</span><span>{bal.rq} RQ</span><span>{bal.glory} ☼</span>
                  <span>{b.operatives.filter((o) => !gone(o)).length} opérateurs</span>
                </div>
                {warnings > 0 && <div><Tag tone="red">{warnings} point{warnings > 1 ? 's' : ''} à vérifier</Tag></div>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
