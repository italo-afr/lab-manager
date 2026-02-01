import { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { jsPDF } from "jspdf";

interface Props {
    aoClicarEditar: (ordem: any) => void;
    filtro: 'ativos' | 'concluidos';
}

interface Ordem {
  id: string;
  dentista_nome: string;
  nome_paciente: string;
  tipo_servico: string;
  data_entrega_prevista: string | any; 
  status: string;
  observacoes?: string;
  valor?: number;
  pago?: boolean;
}

export function ListaOrdens({ aoClicarEditar, filtro }: Props) {
  const [ordens, setOrdens] = useState<Ordem[]>([]);
  const [busca, setBusca] = useState('');
  const [carregandoDados, setCarregandoDados] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "ordens_servico"), orderBy("data_entrega_prevista", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dados = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ordem[];
      setOrdens(dados);
      setCarregandoDados(false);
    });
    return () => unsubscribe();
  }, []);

  async function excluirOrdem(id: string) {
    if (confirm("Tem certeza que deseja apagar este pedido?")) {
      await deleteDoc(doc(db, "ordens_servico", id));
    }
  }

  async function concluirOrdem(id: string) {
    await updateDoc(doc(db, "ordens_servico", id), { status: 'pronto' });
  }

  function formatarData(data: any) {
    if (!data) return "--/--";
    if (typeof data === 'string' && data.includes('-')) {
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
    }
    return "Data Inv.";
  }

  function formatarMoeda(valor: number | undefined) {
    if (!valor) return "R$ 0,00";
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // --- NOVA FUNÇÃO: Integração Google Agenda ---
  function adicionarAoAgenda(ordem: Ordem) {
    // 1. Formatar a data para YYYYMMDD (formato que o Google aceita)
    // A data vem como "2026-01-20", removemos os traços -> "20260120"
    const dataLimpa = ordem.data_entrega_prevista.replace(/-/g, '');
    
    // O Google pede data final também. Vamos colocar o mesmo dia (evento de dia inteiro)
    // Para dia inteiro, usamos o formato YYYYMMDD/YYYYMMDD
    const datas = `${dataLimpa}/${dataLimpa}`;

    // 2. Montar o texto
    const titulo = encodeURIComponent(`Entrega: ${ordem.nome_paciente} (${ordem.tipo_servico})`);
    const detalhes = encodeURIComponent(`Dentista: ${ordem.dentista_nome}\nServiço: ${ordem.tipo_servico}\nValor: ${formatarMoeda(ordem.valor)}\nObs: ${ordem.observacoes || '-'}`);
    
    // 3. Gerar o Link Mágico
    const linkGoogle = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${datas}&details=${detalhes}`;

    // 4. Abrir em nova aba
    window.open(linkGoogle, '_blank');
  }

  function imprimirEtiqueta(ordem: Ordem) {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
    doc.setFont("courier", "bold");
    doc.setFontSize(10); doc.text("LABORATÓRIO DE PRÓTESE", 10, 10);
    doc.line(10, 12, 95, 12);
    doc.setFontSize(8); doc.text("PACIENTE:", 10, 20);
    doc.setFontSize(14); doc.text(ordem.nome_paciente.toUpperCase(), 10, 26);
    doc.setFontSize(8); doc.text("DENTISTA:", 10, 35);
    doc.setFontSize(11); doc.text(ordem.dentista_nome, 10, 40);
    doc.setFontSize(8); doc.text("SERVIÇO:", 10, 50);
    doc.setFontSize(11); doc.text(ordem.tipo_servico, 10, 55);
    doc.setDrawColor(0); doc.rect(60, 15, 35, 15);
    doc.setFontSize(7); doc.text("ENTREGA:", 62, 19);
    doc.setFontSize(10); doc.text(formatarData(ordem.data_entrega_prevista), 62, 26);
    doc.setFontSize(12); 
    const textoValor = `Valor: ${formatarMoeda(ordem.valor)} ${ordem.pago ? '(PAGO)' : ''}`;
    doc.text(textoValor, 60, 55);
    doc.setFontSize(8); doc.text("OBSERVAÇÕES:", 10, 70);
    doc.setFont("courier", "normal");
    const obsTexto = ordem.observacoes || "Sem observações.";
    const linhasObs = doc.splitTextToSize(obsTexto, 85);
    doc.text(linhasObs, 10, 75);
    doc.save(`Ficha_${ordem.nome_paciente}.pdf`);
  }

  const hoje = new Date().toISOString().split('T')[0];
  const totalRecebido = ordens.filter(o => o.pago === true).reduce((acc, curr) => acc + (curr.valor || 0), 0);
  const totalAreceber = ordens.filter(o => !o.pago).reduce((acc, curr) => acc + (curr.valor || 0), 0);
  const totalAtrasados = ordens.filter(o => o.status !== 'pronto' && o.data_entrega_prevista < hoje).length;

  const ordensFiltradas = ordens.filter(ordem => {
    const textoBusca = busca.toLowerCase();
    const matchTexto = 
        ordem.nome_paciente.toLowerCase().includes(textoBusca) ||
        ordem.dentista_nome.toLowerCase().includes(textoBusca) ||
        ordem.tipo_servico.toLowerCase().includes(textoBusca);
    if (!matchTexto) return false;
    if (filtro === 'ativos') return ordem.status !== 'pronto';
    return ordem.status === 'pronto';
  });

  if (carregandoDados) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="w-full space-y-8 animate-fade-in">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider z-10">Caixa (Já Recebido)</span>
            <div className="flex items-end justify-between z-10">
                <span className="text-2xl font-bold text-emerald-600 tracking-tight">{formatarMoeda(totalRecebido)}</span>
                <span className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
            </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-28">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">A Receber (Pendente)</span>
            <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-slate-800 tracking-tight">{formatarMoeda(totalAreceber)}</span>
                <span className="bg-slate-100 text-slate-600 p-2 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
            </div>
        </div>

        <div className={`p-5 rounded-xl border shadow-sm flex flex-col justify-between h-28 ${totalAtrasados > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${totalAtrasados > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                {totalAtrasados > 0 ? '🚨 Atrasados' : 'Em Atraso'}
            </span>
            <div className="flex items-end justify-between">
                <span className={`text-3xl font-bold tracking-tight ${totalAtrasados > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {totalAtrasados}
                </span>
                <span className={`${totalAtrasados > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-50 text-slate-400'} p-2 rounded-lg`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </span>
            </div>
        </div>
      </div>

      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">
                    {filtro === 'ativos' ? '🔨 Fila de Produção' : '✅ Histórico de Entregas'}
                </h2>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                    {ordensFiltradas.length}
                </span>
            </div>
            <div className="relative w-full md:w-72">
                <input type="text" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="block w-full pl-3 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {ordensFiltradas.map((ordem) => {
                const isLate = ordem.status !== 'pronto' && ordem.data_entrega_prevista < hoje;
                
                return (
                    <div key={ordem.id} className={`
                        group p-5 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md flex flex-col justify-between bg-white
                        ${ordem.status === 'pronto' ? 'border-emerald-100 bg-emerald-50/30' : ''}
                        ${isLate ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200'}
                    `}>
                        <div>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 leading-tight line-clamp-1">{ordem.nome_paciente}</h3>
                                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">Dr(a). {ordem.dentista_nome}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${ordem.status === 'pronto' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                                        {ordem.status === 'pronto' ? 'Pronto' : 'Produção'}
                                    </span>
                                    {isLate && (
                                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200 animate-pulse">
                                            ATRASADO
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="mb-4 flex justify-between items-center">
                                <span className="inline-block px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded border border-slate-200">{ordem.tipo_servico}</span>
                                <div className="text-right">
                                    <span className="block text-sm font-semibold text-slate-700">{formatarMoeda(ordem.valor)}</span>
                                    <span className={`text-[10px] font-bold ${ordem.pago ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {ordem.pago ? 'PAGO' : 'A RECEBER'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase">Entrega</span>
                                <span className={`text-sm font-mono font-medium ${isLate ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
                                    {formatarData(ordem.data_entrega_prevista)}
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                {/* BOTÃO GOOGLE AGENDA (NOVO) */}
                                <button 
                                    onClick={() => adicionarAoAgenda(ordem)} 
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                                    title="Adicionar ao Google Agenda"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4h.25V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                                    </svg>
                                </button>

                                <button onClick={() => aoClicarEditar(ordem)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                
                                <button onClick={() => imprimirEtiqueta(ordem)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Imprimir">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                </button>
                                
                                <button onClick={() => excluirOrdem(ordem.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>

                                {ordem.status !== 'pronto' && (
                                    <button onClick={() => concluirOrdem(ordem.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-sm transition-all active:scale-95">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
        
        {!carregandoDados && ordensFiltradas.length === 0 && (
            <div className="text-center py-12 text-slate-500">Nada encontrado.</div>
        )}
      </div>
    </div>
  );
}   