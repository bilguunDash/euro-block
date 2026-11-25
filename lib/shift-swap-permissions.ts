export type SwapActor = { id: string; role: string };

export function canRequestSwap(actor: SwapActor, requesterUid: string): boolean {
  return actor.role === 'operator' && actor.id === requesterUid;
}

export function canDecideSwap(actor: SwapActor, targetUid: string): boolean {
  return actor.role === 'operator' && actor.id === targetUid;
}
