import { rules } from '../../state/app';
import { Table } from '../components/ui';

// Généré entièrement depuis data/ : modifier un prix ou une table dans les JSON met cet écran à jour.
export function RulesView() {
  const c = rules.campaign;
  const r = (title: string, el: preact.ComponentChild) => <div class="panel"><h3 class="mb">{title}</h3>{el}</div>;
  return (
    <>
      <h2>Règles de référence</h2>
      <p class="small muted">Résumé des tables du livret de campagne.</p>
      <div class="grid wide">
        {r('Coûts d’intendance', <Table head={['Achat', 'Coût']} rows={[
          ['Recrue de sa kill team', `${c.recruit.base} ÷ taille de la sélection, arrondi au supérieur ; chef ×${c.recruit.leaderMultiplier}`],
          ['Agent (autre kill team ou unité 40k)', `pts 40k par figurine ÷ ${c.agent.pointsDivisor} (min. ${c.agent.minimum}), +${c.agent.surcharge} RQ`],
          ['Amélioration', `${c.upgrades.price} RQ (${c.upgrades.perTroop} par troupe, ${c.upgrades.perElite} par Élite)`],
          ['Équipement universel', `${c.prices.universalEquipment} RQ`],
          ['Équipement de faction', `${c.prices.factionEquipment} RQ`],
          ['Chirurgie', `${c.prices.surgery} RQ`],
          ['Vente', 'moitié du prix, arrondie au supérieur'],
          ['Mercenaire (une partie)', `${c.prices.mercenaryGlory} ☼`],
        ]} />)}
        {r('Seuil de renforts', <>
          <Table head={['Acte', 'Parties', 'Seuil']} rows={c.acts.map((a) => [a.name, a.fromGame === a.toGame ? `${a.fromGame}` : `${a.fromGame} à ${a.toGame}`, `${a.threshold} RQ`])} />
          <p class="small muted">Valeur alignée = coût des agents + {c.upgrades.price} RQ par amélioration des opérateurs alignés. Le camp le plus bas gagne 1 PC au TP1 par tranche de {c.compensationStep} RQ d'écart.</p>
        </>)}
        {r('Améliorations', <Table head={['Amélioration', 'Effet']} rows={rules.upgrades.map((u) => [u.name, u.effect])} />)}
        {r('Exploits glorieux (d66)', <Table head={['d66', 'Exploit', 'Condition']} rows={rules.exploits.exploits.map((e) => [e.roll, e.name, e.condition])} />)}
        {r('Séquelles (d66)', <Table head={['d66', 'Séquelle', 'Effet']} rows={rules.sequelae.sequelae.map((s) => [s.roll, s.name, s.effect])} />)}
        {r('Rangs', <Table head={['Rang', 'XP', 'Gain']} rows={rules.ranks.map((k) => [k.name, k.xp, k.gain])} />)}
        {rules.honours.tables.map((t) => <div key={t.name} class="panel"><h3 class="mb">Honneurs : {t.name}</h3><Table head={['2d6', 'Honneur', 'Effet']} rows={t.honours.map((h) => [h.roll, h.name, h.effect])} /></div>)}
        {r('Dés d’exploration', <Table head={['Parties jouées', 'Dés', 'Table']} rows={rules.exploration.dice.map((d) => [d.toGames >= 99 ? `${d.fromGames}+` : `${d.fromGames}-${d.toGames}`, d.dice, d.tables.join(' ou ')])} />)}
        {rules.exploration.tables.map((t) => <div key={t.name} class="panel"><h3 class="mb">Exploration : table {t.name.toLowerCase()}</h3><Table head={['Total', 'Lieu', 'Découverte']} rows={t.places.map((p) => [p.total, p.name, p.discovery])} /></div>)}
        {r('Reliques', <Table head={['Relique', 'Coût', 'Effet']} rows={rules.relics.map((x) => [x.name, `${x.glory} ☼`, x.effect])} />)}
        {r('Kill teams', <Table head={['Kill team', 'Faction', 'Sélection']} rows={rules.killteams.map((k) => [k.name, k.faction, `${k.selectionSize} · ${k.selectionRule}`])} />)}
      </div>
    </>
  );
}
