import { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';

interface Ordem {
  id: string;
  dentista_nome: string;
  nome_paciente: string;
  tipo_servico: string;
  data_entrega_prevista: string;
  status: string;
  valor?: number;
  pago?: boolean;
}

export function PaginaFinanceiro() {
  const [ordens, setOrdens] = useState<Ordem[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "ordens_servico"));
    const unsub = onSnapshot(q, snap => {
      setOrdens(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Ordem[]);
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  function formatarMoeda(v?: number) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarData(data: string) {
    if (!data) return '--';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  const totalRecebido = ordens.filter(o => o.pago === true).reduce((acc, o) => acc + (o.valor || 0), 0);
  const totalAreceber = ordens.filter(o => !o.pago).reduce((acc, o) => acc + (o.valor || 0), 0);
  const totalGeral = totalRecebido + totalAreceber;

  const pendentes = ordens
    .filter(o => !o.pago)
    .sort((a, b) => (a.data_entrega_prevista || '').localeCompare(b.data_entrega_prevista || ''));

  // Agrupamento por dentista (somando tudo, pago ou não, para visão de volume de negócio)
  const porDentista = ordens.reduce((acc, o) => {
    const nome = o.dentista_nome || 'Sem dentista';
    acc[nome] = (acc[nome] || 0) + (o.valor || 0);
    return acc;
  }, {} as Record<string, number>);

  const rankingDentistas = Object.entries(porDentista)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (carregando) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Caixa (já recebido)</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-bold text-emerald-600 tracking-tight">{formatarMoeda(totalRecebido)}</span>
            <span className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">A receber (pendente)</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-bold text-slate-800 tracking-tight">{formatarMoeda(totalAreceber)}</span>
            <span className="bg-slate-100 text-slate-600 p-2 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Faturamento total</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-bold text-blue-600 tracking-tight">{formatarMoeda(totalGeral)}</span>
            <span className="bg-blue-50 text-blue-600 p-2 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pendências */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">Pendências de pagamento</h3>
            <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{pendentes.length}</span>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {pendentes.map(o => (
              <div key={o.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{o.nome_paciente}</p>
                  <p className="text-xs text-slate-400">Dr(a). {o.dentista_nome} · {formatarData(o.data_entrega_prevista)}</p>
                </div>
                <span className="text-sm font-bold text-slate-700">{formatarMoeda(o.valor)}</span>
              </div>
            ))}
            {pendentes.length === 0 && (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">Nenhuma pendência. Tudo recebido!</div>
            )}
          </div>
        </div>

        {/* Ranking por dentista */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-800 text-sm">Faturamento por dentista</h3>
          </div>
          <div className="p-5 space-y-3">
            {rankingDentistas.map(([nome, valor]) => {
              const percentual = totalGeral > 0 ? (valor / totalGeral) * 100 : 0;
              return (
                <div key={nome}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{nome}</span>
                    <span className="text-sm font-bold text-slate-800">{formatarMoeda(valor)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percentual}%` }} />
                  </div>
                </div>
              );
            })}
            {rankingDentistas.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-8">Sem dados ainda.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}