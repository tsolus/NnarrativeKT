import { Game, GameResult, SCHEMA_VERSION } from './model';
import { newId } from './roster';

export interface NewGame { date: string; mission: string; notes: string; sides: { bandId: string; result: GameResult; exploits: number }[] }

export function gameErrors(g: NewGame): string[] {
  const e: string[] = [];
  const sides = g.sides.filter((s) => s.bandId);
  if (sides.length < 2) e.push('Choisissez au moins deux bandes.');
  if (new Set(sides.map((s) => s.bandId)).size < sides.length) e.push('Une bande apparaît deux fois.');
  if (sides.some((s) => s.exploits < 0 || !Number.isInteger(s.exploits))) e.push('Nombre d’exploits invalide.');
  return e;
}

export function createGame(now: number, g: NewGame): Game {
  return Game.parse({
    schemaVersion: SCHEMA_VERSION, id: newId(), date: g.date, mission: g.mission.trim(), notes: g.notes.trim(),
    sides: g.sides.filter((s) => s.bandId), createdAt: now,
  });
}
