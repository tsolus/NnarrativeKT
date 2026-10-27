import type { Rules } from '../data';
import type { Band, Game, GameResult } from './model';

export interface PlayedGame { game: Game; number: number; result: GameResult; exploits: number; points: number }

const byDate = (a: Game, b: Game) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt;

export function gamePoints(r: Rules, result: GameResult, exploits: number, number: number): number {
  const s = r.campaign.scoring;
  const base = (result === 'win' ? s.win : result === 'draw' ? s.draw : s.loss) + exploits * s.perExploit;
  return number === s.finalGame ? base * s.finalMultiplier : base;
}

/** Parties d'une bande dans l'ordre chronologique, numérotées 1, 2, 3… pour cette bande. */
export function bandHistory(r: Rules, bandId: string, games: Game[]): PlayedGame[] {
  return games
    .filter((g) => g.sides.some((s) => s.bandId === bandId))
    .sort(byDate)
    .map((game, i) => {
      const side = game.sides.find((s) => s.bandId === bandId)!;
      return { game, number: i + 1, result: side.result, exploits: side.exploits, points: gamePoints(r, side.result, side.exploits, i + 1) };
    });
}

export interface BandStats { played: number; points: number; win: number; draw: number; loss: number; exploits: number }

export function bandStats(r: Rules, bandId: string, games: Game[]): BandStats {
  const st: BandStats = { played: 0, points: 0, win: 0, draw: 0, loss: 0, exploits: 0 };
  for (const p of bandHistory(r, bandId, games)) {
    st.played++;
    st.points += p.points;
    st[p.result]++;
    st.exploits += p.exploits;
  }
  return st;
}

export function actFor(r: Rules, gameNumber: number) {
  const acts = r.campaign.acts;
  const n = Math.min(Math.max(gameNumber, 1), acts[acts.length - 1]!.toGame);
  return acts.find((a) => n >= a.fromGame && n <= a.toGame) ?? acts[acts.length - 1]!;
}

export interface RankingRow { band: Band; stats: BandStats; catchUp: boolean }

/** Classement : points, puis exploits. Le dernier (s'il y a au moins deux bandes) bénéficie du rattrapage. */
export function ranking(r: Rules, bands: Band[], games: Game[]): RankingRow[] {
  const rows = bands.map((band) => ({ band, stats: bandStats(r, band.id, games), catchUp: false }));
  rows.sort((a, b) => b.stats.points - a.stats.points || b.stats.exploits - a.stats.exploits);
  if (rows.length > 1) {
    const min = Math.min(...rows.map((x) => x.stats.points));
    rows.forEach((x) => (x.catchUp = x.stats.points === min));
  }
  return rows;
}
