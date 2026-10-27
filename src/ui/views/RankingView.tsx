import { bands, games, openBand, rules } from '../../state/app';
import { gone } from '../../domain/model';
import { ranking } from '../../domain/scoring';
import { Tag } from '../components/ui';

export function RankingView() {
  const rows = ranking(rules, bands.value, games.value);
  const s = rules.campaign.scoring;
  return (
    <>
      <h2 style="margin-bottom:12px">Classement</h2>
      {!rows.length ? <p class="muted">Aucune bande.</p> : (
        <div class="panel tw">
          <table>
            <thead><tr><th>#</th><th>Bande</th><th>Points</th><th>J</th><th>V</th><th>N</th><th>D</th><th>Exploits</th><th>Élites</th><th>RQ</th><th>☼</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.band.id}>
                  <td>{i + 1}</td>
                  <td>
                    <button type="button" class="link" onClick={() => openBand(r.band.id)}><b>{r.band.name}</b></button>
                    <div class="tiny muted">{r.band.killteam}{r.band.player && ` · ${r.band.player}`}{r.catchUp && <> · <Tag tone="gold">rattrapage</Tag></>}</div>
                  </td>
                  <td><b>{r.stats.points}</b></td><td>{r.stats.played}</td><td>{r.stats.win}</td><td>{r.stats.draw}</td><td>{r.stats.loss}</td>
                  <td>{r.stats.exploits}</td><td>{r.band.operatives.filter((o) => !gone(o) && o.elite).length}</td><td>{r.band.requisitions}</td><td>{r.band.glory}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="tiny muted">Victoire {s.win}, nul {s.draw}, défaite {s.loss}, +{s.perExploit} par Exploit glorieux ; la {s.finalGame}e partie de chaque bande compte ×{s.finalMultiplier}. Rattrapage : le dernier gagne 1 PC au TP1 et une relance d'exploration.</p>
        </div>
      )}
    </>
  );
}
