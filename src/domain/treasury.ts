import type { Rules } from '../data';
import type { Band, Game, Transaction } from './model';
import { newId } from './roster';
import { bandHistory } from './scoring';

// Trésorerie d'une bande. Deux sources, jamais de saisie directe des soldes :
// 1. le livre de comptes de la bande (achats, ventes, butins, récompenses, corrections motivées) ;
// 2. la Gloire des exploits, recalculée depuis les parties : supprimer une partie la retire d'elle-même.

export interface Balance { rq: number; glory: number; points: number }

/** Lignes du relevé, dans l'ordre chronologique, y compris la Gloire tirée des parties. */
export interface StatementLine { at: number; label: string; rq: number; glory: number; points: number; fromGame: boolean }

export function gameRewards(r: Rules, bandId: string, games: Game[]): StatementLine[] {
  const per = r.campaign.rewards.gloryPerExploit;
  return bandHistory(r, bandId, games)
    .filter((p) => p.exploits > 0)
    .map((p) => ({
      at: p.game.createdAt,
      label: `Partie ${p.number}${p.game.mission ? ` (${p.game.mission})` : ''} : ${p.exploits} exploit${p.exploits > 1 ? 's' : ''} glorieux`,
      rq: 0, glory: p.exploits * per, points: 0, fromGame: true,
    }));
}

export function statement(r: Rules, band: Band, games: Game[]): StatementLine[] {
  return [
    ...band.transactions.map((t) => ({ at: t.at, label: t.label, rq: t.rq, glory: t.glory, points: t.points, fromGame: false })),
    ...gameRewards(r, band.id, games),
  ].sort((a, b) => a.at - b.at);
}

export function balance(r: Rules, band: Band, games: Game[]): Balance {
  const b: Balance = { rq: 0, glory: 0, points: 0 };
  for (const t of band.transactions) { b.rq += t.rq; b.glory += t.glory; b.points += t.points; }
  for (const g of gameRewards(r, band.id, games)) b.glory += g.glory;
  return b;
}

/** Ajoute un mouvement au livre de comptes (la bande doit déjà être une copie modifiable). */
export function addTransaction(b: Band, at: number, t: Omit<Transaction, 'id' | 'at' | 'rq' | 'glory' | 'points'> & Partial<Pick<Transaction, 'rq' | 'glory' | 'points'>>): void {
  // un montant absent (undefined) compte pour 0
  b.transactions.push({ id: newId(), at, label: t.label, kind: t.kind, rq: t.rq ?? 0, glory: t.glory ?? 0, points: t.points ?? 0 });
}
