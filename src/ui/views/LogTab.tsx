import { games, rules } from '../../state/app';
import type { Band } from '../../domain/model';
import { statement } from '../../domain/treasury';

const fmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '');

export function LogTab({ band }: { band: Band }) {
  // relevé du plus récent au plus ancien, avec le solde après chaque ligne
  let rq = 0, glory = 0;
  const lines = statement(rules, band, games.value).map((l) => { rq += l.rq; glory += l.glory; return { ...l, rqAfter: rq, gloryAfter: glory }; }).reverse();
  return (
    <>
      <div class="panel">
        <h3 class="mb">Relevé des comptes</h3>
        <p class="tiny muted" style="margin-top:0">Chaque mouvement de Réquisitions et de Gloire. La Gloire des exploits vient des parties enregistrées : supprimer une partie la retire.</p>
        {lines.length ? (
          <div class="tw"><table>
            <thead><tr><th>Date</th><th>Mouvement</th><th>RQ</th><th>☼</th><th>Solde</th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td class="tiny muted nowrap">{fmt.format(l.at)}</td>
                  <td>{l.label}{l.points ? <span class="muted"> ({signed(l.points)} pts)</span> : null}</td>
                  <td class={l.rq < 0 ? 'neg' : 'pos'}>{signed(l.rq)}</td>
                  <td class={l.glory < 0 ? 'neg' : 'pos'}>{signed(l.glory)}</td>
                  <td class="small nowrap">{l.rqAfter} RQ · {l.gloryAfter} ☼</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : <p class="muted small">Aucun mouvement.</p>}
      </div>
      <div class="panel sec">
        <h3 class="mb">Journal</h3>
        {band.log.length ? (
          <table><tbody>
            {band.log.map((l, i) => <tr key={i}><td class="tiny muted nowrap">{fmt.format(l.at)}</td><td>{l.text}</td></tr>)}
          </tbody></table>
        ) : <p class="muted">Le journal se remplit avec les achats, traumatismes et découvertes.</p>}
      </div>
    </>
  );
}
