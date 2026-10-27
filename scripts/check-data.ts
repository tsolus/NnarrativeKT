// Valide tous les fichiers de data/ (schémas + cohérence). Lancé avant chaque build.
import { loadRules } from '../src/data';

try {
  const r = loadRules();
  console.log(`Données valides : ${r.killteams.length} kill teams, ${r.units.length} unités 40k, ${r.sequelae.sequelae.length} séquelles.`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
