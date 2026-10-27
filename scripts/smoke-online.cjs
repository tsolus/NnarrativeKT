// Test de la campagne en ligne contre les émulateurs Firebase : deux joueurs, deux navigateurs.
// Lancer avec : npm run smoke:online (construit dist-online/ puis démarre les émulateurs).
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.resolve(process.argv[2] || 'dist-online/index.html'));
const server = http.createServer((_, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(page); });

(async () => {
  await new Promise((r) => server.listen(5179, '127.0.0.1', r));
  const url = 'http://127.0.0.1:5179/';
  const br = await chromium.launch();
  const errors = [];
  const player = async () => {
    const ctx = await br.newContext({ viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    p.setDefaultTimeout(8000);
    p.on('pageerror', (e) => errors.push(e.message));
    return p;
  };
  const step = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); errors.push(name); } };
  const createBand = async (p, kt, name) => {
    await p.getByRole('button', { name: /Créer une bande|Nouvelle bande/ }).first().click();
    await p.getByRole('dialog').locator('select').first().selectOption(kt);
    await p.getByRole('dialog').locator('input[type=text]').first().fill(name);
    await p.getByRole('button', { name: 'Créer la bande' }).click();
    await p.getByRole('button', { name: '← Bandes' }).click();
  };

  const a = await player();
  const b = await player();
  let link = '';
  await step('accueil sans campagne', async () => {
    await a.goto(url);
    await a.getByRole('heading', { name: 'Rejoindre une campagne' }).waitFor();
  });
  await step('nouvelle campagne et lien d’invitation', async () => {
    await a.getByRole('button', { name: 'Nouvelle campagne' }).click();
    await a.getByRole('button', { name: 'Inviter' }).click();
    link = await a.getByLabel("Lien d'invitation").inputValue();
    if (!/#c=[a-z0-9]{12}$/.test(link)) throw new Error('lien inattendu ' + link);
    await a.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
    await createBand(a, 'Nemesis Claw', 'Les Griffes');
    await a.getByText('Ma bande').waitFor();
  });
  await step('un autre joueur rejoint par le lien collé', async () => {
    await b.goto(url);
    await b.getByLabel('Lien ou code de campagne').fill(link);
    await b.getByRole('button', { name: 'Rejoindre' }).click();
    // premier chargement parfois lent contre l'émulateur (le SDK cherche son mode de connexion)
    await b.getByText('Les Griffes').waitFor({ timeout: 30000 });
    if (await b.getByText('Ma bande').count()) throw new Error('la bande de A est marquée comme celle de B');
  });
  await step('modifications visibles en direct chez l’autre', async () => {
    await createBand(b, 'Warpcoven', 'Les Boyz');
    await a.getByText('Les Boyz').waitFor();
  });
  await step('le navigateur se souvient de la campagne', async () => {
    await b.goto(url);
    await b.getByText('Les Griffes').waitFor();
  });
  await step('changer de campagne', async () => {
    await b.getByRole('button', { name: 'Inviter' }).click();
    await b.getByRole('button', { name: 'Changer de campagne' }).click();
    await b.getByRole('heading', { name: 'Rejoindre une campagne' }).waitFor();
    await b.goto(link);
    await b.getByText('Les Boyz').waitFor();
  });
  await step('règles : refus sans connexion ni code valide', async () => {
    const base = 'http://127.0.0.1:8080/v1/projects/demo-ktc/databases/(default)/documents';
    const code = link.split('#c=')[1];
    const anon = await fetch(`${base}/campaigns/${code}/bands`);
    if (anon.status !== 403) throw new Error('lecture anonyme autorisée : ' + anon.status);
    const list = await fetch(`${base}/campaigns`);
    if (list.status !== 403) throw new Error('liste des campagnes autorisée : ' + list.status);
  });

  await br.close();
  server.close();
  if (errors.length) { console.log('Échecs :', errors.join(' | ')); process.exit(1); }
  console.log('Campagne en ligne : tout est bon.');
})();
