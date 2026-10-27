import type { Band } from '../../domain/model';

const fmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export function LogTab({ band }: { band: Band }) {
  return (
    <div class="panel">
      {band.log.length ? (
        <table><tbody>
          {band.log.map((l, i) => <tr key={i}><td class="tiny muted nowrap">{fmt.format(l.at)}</td><td>{l.text}</td></tr>)}
        </tbody></table>
      ) : <p class="muted">Le journal se remplit avec les achats, traumatismes et découvertes.</p>}
    </div>
  );
}
