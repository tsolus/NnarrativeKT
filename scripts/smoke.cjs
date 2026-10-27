// Test de fumée dans un vrai navigateur (Playwright requis) : node scripts/smoke.cjs [dist/index.html]
// Parcourt création de bande, recrutement, partie, phase de campagne, et la reprise de données v1.
const { chromium } = require('playwright');
const path = require('node:path');

const file = 'file://' + path.resolve(process.argv[2] || 'dist/index.html');
const v1 = { bands: { b1: { name: 'Ancienne', kt: 'Warpcoven', faction: 'Thousand Sons', rq: 4, glory: 2, ops: [
  { id: 'o1', name: 'Ahriman', card: { src: 'kt', kt: 'Warpcoven', n: 'Sorcerer of Destiny', pts: 80, lead: true }, elite: true, xp: 6, scars: 0, seq: [], hon: [], upg: [], relic: '', status: 'actif', next: true, origin: 'départ', cost: 0 }],
  arsenal: [], relics: [], places: [], log: [], created: 1 } }, games: [] };

(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: 1200, height: 900 } });
  p.setDefaultTimeout(5000);
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.addInitScript((d) => localStorage.setItem('ktc-local-v1', JSON.stringify(d)), v1);
  await p.goto(file);
  await p.getByText('Ancienne').waitFor();
  const step = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); errors.push(name); } };

  await step('données v1 relues', async () => {
    await p.getByText('Ancienne').click();
    await p.getByText('2 Honneurs à tirer').waitFor({ timeout: 2000 });
    await p.locator('.stat', { hasText: 'Réquisitions' }).getByText('4', { exact: true }).waitFor(); // solde v1 repris
  });
  await step('création avec kill team préremplie', async () => {
    await p.getByRole('button', { name: '← Bandes' }).click();
    await p.getByRole('button', { name: 'Nouvelle bande' }).click();
    await p.getByRole('dialog').locator('select').first().selectOption('Nemesis Claw');
    await p.getByRole('dialog').locator('input[type=text]').first().fill('Les Griffes');
    await p.getByRole('dialog').locator('input[type=checkbox]').nth(1).check();
    await p.getByRole('button', { name: 'Créer la bande' }).click();
    await p.getByText('Registre conforme.').waitFor({ timeout: 2000 });
  });
  await step('recrutement toutes armées', async () => {
    await p.getByRole('button', { name: 'Recruter' }).click();
    await p.getByLabel('Faction').last().selectOption('*');
    await p.getByLabel('Rechercher').fill('intercessor');
    await p.locator('.pitem').first().click();
    await p.getByRole('dialog').getByRole('checkbox', { name: 'Gratuit', exact: true }).check();
    await p.getByRole('dialog').getByRole('button', { name: /^Recruter/ }).click();
    await p.getByText('Agent', { exact: true }).first().waitFor({ timeout: 2000 });
  });
  await step('amélioration achetée', async () => {
    await p.getByRole('button', { name: /\+ Amélioration/ }).first().click();
    await p.getByText('Entraînement au tir').click();
    await p.getByRole('button', { name: /^Acheter/ }).click();
    await p.locator('.chip', { hasText: 'Entraînement au tir' }).waitFor({ timeout: 2000 });
  });
  await step('partie et classement', async () => {
    await p.getByRole('button', { name: 'Parties' }).click();
    await p.getByRole('button', { name: 'Enregistrer une partie' }).click();
    const opts = await p.getByLabel('Bande 1').locator('option').evaluateAll((o) => o.map((x) => x.value));
    await p.getByLabel('Bande 1').selectOption(opts[2]);
    await p.getByLabel('Bande 2').selectOption(opts[1]);
    await p.getByLabel('Exploits 1').fill('1');
    await p.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
    await p.getByText('4 pts').waitFor({ timeout: 2000 });
    await p.getByRole('button', { name: 'Classement' }).click();
    await p.getByText('rattrapage', { exact: true }).waitFor({ timeout: 2000 });
  });
  await step('phase de campagne', async () => {
    await p.getByRole('button', { name: 'Les Griffes' }).click();
    await p.getByRole('tab', { name: 'Phase de campagne' }).click();
    await p.getByRole('button', { name: 'Lancer', exact: true }).first().click();
    await p.getByRole('button', { name: 'Appliquer à la fiche' }).click();
    await p.getByRole('button', { name: 'Lancer 2 × 2d6' }).click();
    await p.getByRole('button', { name: 'Lancer', exact: true }).last().click();
    await p.getByRole('button', { name: /Encaisser/ }).click();
    await p.getByRole('tab', { name: 'Trésorerie et journal' }).click();
    await p.getByText(/Exploration : butin/).first().waitFor({ timeout: 2000 });
  });
  await step('trésorerie automatique et correction motivée', async () => {
    await p.getByText(/1 exploit glorieux/).waitFor();      // Gloire de la partie créditée
    await p.getByText('Dotation de départ').waitFor();
    await p.getByText(/: Entraînement au tir/).first().waitFor(); // achat débité
    await p.getByRole('button', { name: 'Corriger' }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
    await p.getByText('Indiquez le motif de la correction.').waitFor();
    await p.getByLabel('Gloire (±)').fill('2');
    await p.getByLabel('Motif (obligatoire)').fill('Rançon reçue');
    await p.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
    await p.getByText('Correction : Rançon reçue').waitFor();
  });
  await p.screenshot({ path: 'smoke-journal.png' });
  await step('fiche technique : armes choisies et infobulles', async () => {
    await p.getByRole('tab', { name: 'Registre' }).click();
    await p.getByLabel('Armes de Visionary').first().selectOption('Plasma pistol; Nostraman chainblade');
    await p.getByRole('tab', { name: 'Fiche technique' }).click();
    await p.getByLabel('Opérateurs affichés').selectOption('all');
    const card = p.locator('.sheet-card', { hasText: 'Nostraman chainblade' });
    await card.waitFor();
    if (await card.getByText('Power fist').count()) throw new Error('arme non choisie affichée');
    await card.locator('.wr-col .tip', { hasText: 'Rending' }).hover();
    await p.locator('.tip-box', { hasText: 'critical successes' }).waitFor();
  });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.getByRole('tab', { name: 'Registre' }).click();
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(overflow ? 'FAIL débordement horizontal sur mobile' : 'ok   pas de débordement sur mobile');
  await p.screenshot({ path: 'smoke-mobile.png' });
  await br.close();
  if (errors.length || overflow) { console.log('Erreurs :', errors); process.exit(1); }
})();
