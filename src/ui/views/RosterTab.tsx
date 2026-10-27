import { act, games, openBand, openModal, rules } from '../../state/app';
import * as A from '../../domain/actions';
import { lineup, rosterChecks } from '../../domain/checks';
import { agentValue, upgradeLimit } from '../../domain/costs';
import { Band, Operative, OperativeStatus, STATUS_LABEL, gone } from '../../domain/model';
import { rankOf } from '../../domain/phase';
import { isAgent, killteamOf, profileLabel } from '../../domain/roster';
import { Btn, Chip, Confirm, Notes, Select, Stepper, Tag, TextField } from '../components/ui';
import { RecruitModal } from '../modals/RecruitModal';
import { UpgradeModal } from '../modals/UpgradeModal';

export function RosterTab({ band }: { band: Band }) {
  const kt = killteamOf(rules, band);
  const L = lineup(rules, band, games.value);
  const alive = band.operatives.filter((o) => !gone(o));
  const fallen = band.operatives.filter(gone);
  return (
    <>
      <div class="grid wide">
        <div class="panel">
          <h3 class="mb">Contrôles du registre</h3>
          <Notes items={rosterChecks(rules, band)} okText="Registre conforme." />
          <p class="small muted" style="margin:8px 0 0">{kt.selectionRule}</p>
        </div>
        <div class="panel">
          <h3 class="mb">Prochaine partie (n° {L.nextGame}, {L.act.name})</h3>
          <div class="row small">
            <span><b>{L.weight}</b> / {kt.selectionSize} alignés</span>
            <span><b>{L.agents}</b> agent{L.agents > 1 ? 's' : ''}</span>
            <span>Renforts <b>{L.reinforcementValue}</b> / {L.act.threshold} RQ</span>
          </div>
          <div style="margin-top:6px"><Notes items={L.warnings} okText="Sélection prête." /></div>
          <p class="tiny muted" style="margin:6px 0 0">Cochez « Aligné » sur chaque opérateur pour préparer la sélection.</p>
        </div>
      </div>
      <div class="row sec">
        <h2 class="sp">Registre <span class="muted small">({alive.length})</span></h2>
        <Btn variant="pri" onClick={() => openModal(<RecruitModal bandId={band.id} />)}>Recruter</Btn>
      </div>
      <div class="grid">{alive.map((o) => <OperativeCard key={o.id} band={band} o={o} />)}</div>
      {fallen.length > 0 && (
        <details><summary>Tombés et retraités ({fallen.length})</summary>
          <div class="grid">{fallen.map((o) => <OperativeCard key={o.id} band={band} o={o} />)}</div>
        </details>
      )}
    </>
  );
}

const STATUSES = OperativeStatus.options.map((s) => [s, STATUS_LABEL[s]] as [OperativeStatus, string]);

function OperativeCard({ band, o }: { band: Band; o: Operative }) {
  const agent = isAgent(band, o);
  const rank = rankOf(rules, o.xp);
  const limit = upgradeLimit(rules, o);
  const missingHonours = o.elite ? rank.honoursDue - o.honours.length : 0;
  const value = agent ? agentValue(rules, o.profile) : null;
  const run = (fn: Parameters<typeof act>[1]) => act(band, fn);
  const off = gone(o);

  const confirmRemove = () => openModal(
    <Confirm title={`Retirer ${o.name} ?`} text="Il passe dans « Tombés et retraités ». Ses améliorations sont perdues et sa relique revient à la bande." choices={[
      { label: 'Mort', variant: 'danger', run: () => run((c, b) => A.removeFromRoster(c, b, o.id, 'dead')) },
      { label: 'Retraite', variant: 'pri', run: () => run((c, b) => A.removeFromRoster(c, b, o.id, 'retired')) },
    ]} />);
  const confirmUpgrade = (i: number) => {
    const u = o.upgrades[i]!;
    openModal(<Confirm title="Retirer l'amélioration ?" text={`${u.name}${u.equipment ? ` : ${u.equipment}` : ''}. Une amélioration ne se revend pas.`} choices={[
      { label: `Rembourser ${rules.campaign.upgrades.price} RQ (erreur de saisie)`, run: () => run((c, b) => A.removeUpgrade(c, b, o.id, i, true)) },
      { label: 'Retirer', variant: 'danger', run: () => run((c, b) => A.removeUpgrade(c, b, o.id, i, false)) },
    ]} />);
  };
  const confirmSequela = (i: number) => openModal(
    <Confirm title={`Retirer « ${o.sequelae[i]} » ?`} text="Par la chirurgie, un Hôpital de campagne, un Implant augétique ou une correction." choices={[
      { label: `Chirurgie (${rules.campaign.prices.surgery} RQ)`, variant: 'pri', run: () => run((c, b) => A.removeSequela(c, b, o.id, i, true)) },
      { label: 'Retirer sans payer', run: () => run((c, b) => A.removeSequela(c, b, o.id, i, false)) },
    ]} />);

  return (
    <div class={`card ${off ? 'off' : ''}`}>
      <div class="row">
        <label class="row small" title="Aligné à la prochaine partie">
          <input type="checkbox" checked={o.fielded} disabled={off} onChange={(e) => run((c, b) => A.updateOperative(c, b, o.id, { fielded: (e.target as HTMLInputElement).checked }))} /> Aligné
        </label>
        <span class="sp" />
        {o.profile.leader && !agent && <Tag tone="gold">Chef</Tag>}
        {o.elite ? <Tag tone="gold">Élite</Tag> : <Tag>Troupe</Tag>}
        {agent && <Tag>Agent</Tag>}
        {o.profile.halfSelection && <Tag>½</Tag>}
        {o.status !== 'active' && <Tag tone="red">{STATUS_LABEL[o.status]}</Tag>}
      </div>
      <TextField class="nm" aria-label="Nom" value={o.name} onCommit={(v) => run((c, b) => A.updateOperative(c, b, o.id, { name: v }))} />
      <div class="tiny muted">
        {profileLabel(o.profile)}{o.profile.pts40k != null && ` · ${o.profile.pts40k} pts 40k`} · {{ start: 'départ', recruit: 'recrue', agent: 'agent' }[o.origin]}
        {o.cost > 0 && ` ${o.cost} RQ`}{value != null && ` · valeur de renfort ${value} RQ`}
      </div>
      <div class="row small"><span class="lbl">Statut</span>
        <Select value={o.status} options={STATUSES} onChange={(v) => run((c, b) => A.updateOperative(c, b, o.id, { status: v }))} />
      </div>
      {o.elite && (
        <>
          <div class="row small"><span class="lbl">XP</span>
            <Stepper label="XP" value={o.xp} onChange={(d) => run((c, b) => A.adjustXp(c, b, o.id, d))} /><span class="muted">{rank.name}</span>
            {missingHonours > 0 && <Tag tone="gold">{missingHonours} Honneur{missingHonours > 1 ? 's' : ''} à tirer</Tag>}
          </div>
          <div class="row small"><span class="lbl">Cicatrices</span>
            <Stepper label="Cicatrices" value={o.scars} onChange={(d) => run((c, b) => A.adjustScars(c, b, o.id, d))} />
            {o.scars >= rules.campaign.trauma.scarsForVoluntaryRetirement && <Tag tone="red">retraite possible</Tag>}
          </div>
        </>
      )}
      <div class="small"><span class="lbl">Améliorations ({o.upgrades.length}/{limit})</span><br />
        {o.upgrades.map((u, i) => <Chip key={i} onRemove={() => confirmUpgrade(i)}>{u.name}{u.equipment && ` : ${u.equipment}`}</Chip>)}
        {!off && limit > o.upgrades.length && <Btn small onClick={() => openModal(<UpgradeModal bandId={band.id} opId={o.id} />)}>+ Amélioration ({rules.campaign.upgrades.price} RQ)</Btn>}
      </div>
      {(o.elite || o.honours.length > 0) && (
        <div class="small"><span class="lbl">Honneurs</span><br />
          {o.honours.map((h, i) => <Chip key={i} onRemove={() => run((c, b) => A.removeHonour(c, b, o.id, i))}>{h}</Chip>)}
          {!off && <Btn small onClick={() => openBand(band.id, 'phase')}>+ Honneur</Btn>}
        </div>
      )}
      {o.sequelae.length > 0 && (
        <div class="small"><span class="lbl">Séquelles</span><br />
          {o.sequelae.map((s, i) => <Chip key={i} onRemove={() => confirmSequela(i)}>{s}</Chip>)}
        </div>
      )}
      <div class="row small"><span class="lbl">Relique</span>
        <Select value={o.relic} options={[['', '—'], ...band.relics.map((r) => [r, r] as [string, string])]} onChange={(v) => run((c, b) => A.updateOperative(c, b, o.id, { relic: v }))} />
      </div>
      <TextField placeholder="Notes (options d'armes, rancunes…)" value={o.notes} onCommit={(v) => run((c, b) => A.updateOperative(c, b, o.id, { notes: v }))} />
      <div class="row">
        {!o.profile.noUpgrades && !off && <Btn small onClick={() => run((c, b) => A.setElite(c, b, o.id, !o.elite))}>{o.elite ? 'Repasser troupe' : 'Promouvoir Élite'}</Btn>}
        <span class="sp" />
        {off ? (
          <>
            <Btn small onClick={() => run((c, b) => A.reinstate(c, b, o.id))}>Remettre au registre</Btn>
            <Btn small variant="danger" onClick={() => openModal(<Confirm title={`Effacer ${o.name} ?`} text="L'opérateur disparaît définitivement du registre." choices={[{ label: 'Effacer', variant: 'danger', run: () => run((c, b) => A.deleteOperative(c, b, o.id)) }]} />)}>Effacer</Btn>
          </>
        ) : <Btn small variant="danger" onClick={confirmRemove}>Retirer</Btn>}
      </div>
    </div>
  );
}
