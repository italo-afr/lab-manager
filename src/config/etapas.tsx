// ===========================================================================
//  ETAPAS DE PRODUÇÃO
//  Edite a lista abaixo para refletir EXATAMENTE o fluxo do laboratório.
//  - A ordem do array é a ordem real da produção (de cima para baixo).
//  - A ÚLTIMA etapa é considerada "finalizada" e move a O.S. para o Histórico.
//  - `id` é interno (sem espaços/acentos). `nome` é o que aparece na tela.
// ===========================================================================

export interface Etapa {
  id: string;   // identificador interno (sem espaços/acentos)
  nome: string; // texto que aparece na tela
  cor: string;  // classes Tailwind do badge (fundo + texto + borda)
}

export const ETAPAS: Etapa[] = [
  { id: 'recebido',   nome: 'Recebido',   cor: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: 'modelagem',  nome: 'Modelagem',  cor: 'bg-blue-50 text-blue-700 border-blue-100' },
  { id: 'prova',      nome: 'Prova',      cor: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'acabamento', nome: 'Acabamento', cor: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'pronto',     nome: 'Pronto',     cor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

export const PRIMEIRA_ETAPA = ETAPAS[0];
export const ULTIMA_ETAPA = ETAPAS[ETAPAS.length - 1];

// Descobre a etapa atual de uma O.S. (com retrocompatibilidade):
// 1) se a O.S. já tem o campo `etapa`, usa ele;
// 2) se não tem, mas o status é 'pronto', assume a última etapa;
// 3) caso contrário, assume a primeira etapa.
export function resolverEtapa(ordem: { etapa?: string; status?: string }): Etapa {
  if (ordem.etapa) {
    const achou = ETAPAS.find(e => e.id === ordem.etapa);
    if (achou) return achou;
  }
  if (ordem.status === 'pronto') return ULTIMA_ETAPA;
  return PRIMEIRA_ETAPA;
}

export function indiceEtapa(etapaId: string): number {
  return ETAPAS.findIndex(e => e.id === etapaId);
}