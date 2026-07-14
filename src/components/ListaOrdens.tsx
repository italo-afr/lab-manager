import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { db, auth } from '../services/firebase';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { jsPDF } from "jspdf";
import { ETAPAS, resolverEtapa, indiceEtapa } from '../config/etapas';
import { DetalheOS } from './DetalheOS';

interface Props {
    aoClicarEditar: (ordem: any) => void;
    filtro: 'ativos' | 'concluidos';
    mostrarFinanceiro?: boolean;
}

interface Ordem {
  id: string;
  dentista_nome: string;
  nome_paciente: string;
  tipo_servico: string;
  data_entrega_prevista: string | any; 
  status: string;
  etapa?: string;
  observacoes?: string;
  telefone_dentista?: string;
  valor?: number;
  pago?: boolean;
}

export function ListaOrdens({ aoClicarEditar, filtro, mostrarFinanceiro = true }: Props) {
  const [ordens, setOrdens] = useState<Ordem[]>([]);
  const [busca, setBusca] = useState('');
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [modalConfirmar, setModalConfirmar] = useState<Ordem | null>(null);
  const [pagoNoModal, setPagoNoModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [ordemDetalhe, setOrdemDetalhe] = useState<Ordem | null>(null);
  const [nomeUsuarioAtual, setNomeUsuarioAtual] = useState<string>('');

  useEffect(() => {
    // Busca o nome do usuário logado uma vez, para registrar "quem fez" no histórico
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "usuarios", uid)).then(snap => {
      if (snap.exists()) {
        const dados = snap.data();
        setNomeUsuarioAtual(dados.nome || dados.email || auth.currentUser?.email || 'Usuário');
      } else {
        setNomeUsuarioAtual(auth.currentUser?.email || 'Usuário');
      }
    });
  }, []);

  useEffect(() => {
    // Busca telefones dos dentistas uma vez para cruzar com as ordens
    let telefonesPorNome: Record<string, string> = {};
    getDentistas().then(t => { telefonesPorNome = t; });

    const q = query(collection(db, "ordens_servico"), orderBy("data_entrega_prevista", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dados = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        telefone_dentista: telefonesPorNome[(doc.data() as any).dentista_nome] || ''
      })) as Ordem[];
      setOrdens(dados);
      setCarregandoDados(false);
    });
    return () => unsubscribe();
  }, []);

  async function getDentistas(): Promise<Record<string, string>> {
    const snap = await getDocs(query(collection(db, "dentistas")));
    const map: Record<string, string> = {};
    snap.docs.forEach(d => { map[d.data().nome] = d.data().telefone || ''; });
    return map;
  }

  async function excluirOrdem(id: string) {
    if (confirm("Tem certeza que deseja apagar este pedido?")) {
      await deleteDoc(doc(db, "ordens_servico", id));
    }
  }

  async function registrarHistorico(ordemId: string, descricao: string, etapaId?: string) {
    await addDoc(collection(db, "ordens_servico", ordemId, "historico"), {
      tipo: 'etapa',
      descricao,
      etapaId: etapaId || null,
      autor: nomeUsuarioAtual || null,
      criadoEm: serverTimestamp(),
    });
  }

  async function avancarEtapa(ordem: Ordem) {
    const atual = resolverEtapa(ordem);
    const idx = indiceEtapa(atual.id);
    if (idx >= ETAPAS.length - 1) return;
    const proxima = ETAPAS[idx + 1];
    const ehFinal = idx + 1 === ETAPAS.length - 1;

    if (ehFinal) {
      setModalConfirmar(ordem);
      setPagoNoModal(ordem.pago || false);
      return;
    }

    await updateDoc(doc(db, "ordens_servico", ordem.id), {
      etapa: proxima.id,
      status: 'em_producao',
    });
    await registrarHistorico(ordem.id, `Avançou para ${proxima.nome}`, proxima.id);
  }

  async function confirmarPronto() {
    if (!modalConfirmar) return;
    setSalvando(true);
    const proxima = ETAPAS[ETAPAS.length - 1];
    await updateDoc(doc(db, "ordens_servico", modalConfirmar.id), {
      etapa: proxima.id,
      status: 'pronto',
      pago: pagoNoModal,
    });
    await registrarHistorico(modalConfirmar.id, `Marcado como ${proxima.nome}`, proxima.id);
    if (pagoNoModal && !modalConfirmar.pago) {
      await registrarHistorico(modalConfirmar.id, 'Pagamento confirmado');
    }
    setSalvando(false);
    setModalConfirmar(null);
  }

  async function voltarEtapa(ordem: Ordem) {
    const atual = resolverEtapa(ordem);
    const idx = indiceEtapa(atual.id);
    if (idx <= 0) return;
    const anterior = ETAPAS[idx - 1];
    await updateDoc(doc(db, "ordens_servico", ordem.id), {
      etapa: anterior.id,
      status: 'em_producao',
    });
    await registrarHistorico(ordem.id, `Voltou para ${anterior.nome}`, anterior.id);
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

  function abrirWhatsApp(ordem: Ordem & { telefone_dentista?: string }) {
    const telefone = ordem.telefone_dentista || '';
    // Remove tudo que não é número e adiciona código do Brasil
    const numero = '55' + telefone.replace(/\D/g, '');
    const mensagem = encodeURIComponent(
      `Olá Dr(a). ${ordem.dentista_nome}, a prótese do paciente *${ordem.nome_paciente}* (${ordem.tipo_servico}) está pronta para retirada.\n\nAtt, Laboratório.`
    );
    window.open(`https://wa.me/${numero}?text=${mensagem}`, '_blank');
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
      
      <div className={`grid grid-cols-1 gap-6 ${mostrarFinanceiro ? 'md:grid-cols-2' : ''}`}>
         {mostrarFinanceiro && (
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider z-10">Caixa (Já Recebido)</span>
            <div className="flex items-end justify-between z-10">
                <span className="text-2xl font-bold text-emerald-600 tracking-tight">{formatarMoeda(totalRecebido)}</span>
                <span className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
            </div>
        </div>
        )}

        {mostrarFinanceiro && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-28">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">A Receber (Pendente)</span>
            <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-slate-800 tracking-tight">{formatarMoeda(totalAreceber)}</span>
                <span className="bg-slate-100 text-slate-600 p-2 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
            </div>
        </div>
        )}
      </div>

      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-slate-900">
                    {filtro === 'ativos' ? '🔨 Fila de Produção' : '✅ Histórico de Entregas'}
                </h2>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                    {ordensFiltradas.length}
                </span>
                {filtro === 'ativos' && totalAtrasados > 0 && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        {totalAtrasados} atrasado{totalAtrasados > 1 ? 's' : ''}
                    </span>
                )}
            </div>
            <div className="relative w-full md:w-72">
                <input type="text" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="block w-full pl-3 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {ordensFiltradas.map((ordem) => {
                const isLate = ordem.status !== 'pronto' && ordem.data_entrega_prevista < hoje;
                const etapaAtual = resolverEtapa(ordem);
                const idxEtapa = indiceEtapa(etapaAtual.id);
                const podeAvancar = idxEtapa < ETAPAS.length - 1;
                const podeVoltar = idxEtapa > 0;
                
                return (
                    <div key={ordem.id} className={`
                        rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md flex flex-col bg-white overflow-hidden
                        ${isLate ? 'border-red-200' : ordem.status === 'pronto' ? 'border-emerald-200' : 'border-slate-200'}
                    `}>
                        {/* Topo colorido com etapa */}
                        <div className={`px-4 py-2 flex items-center justify-between ${isLate ? 'bg-red-50' : ordem.status === 'pronto' ? 'bg-emerald-50' : 'bg-slate-50'} border-b ${isLate ? 'border-red-100' : 'border-slate-100'}`}>
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${etapaAtual.cor}`}>
                                    {etapaAtual.nome}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">{idxEtapa + 1}/{ETAPAS.length}</span>
                            </div>
                            {isLate && (
                                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
                                    ATRASADO
                                </span>
                            )}
                        </div>

                        {/* Corpo */}
                        <div className="p-4 flex flex-col gap-3 flex-1">

                            {/* Paciente e dentista */}
                            <div>
                                <h3 onClick={() => setOrdemDetalhe(ordem)} className="text-base font-bold text-slate-900 leading-tight cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-1 group/name" title="Ver detalhes">
                                    {ordem.nome_paciente}
                                    <svg className="w-3 h-3 text-slate-300 group-hover/name:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Dr(a). {ordem.dentista_nome}</p>
                            </div>

                            {/* Serviço + valor separados */}
                            <div className="flex items-center justify-between">
                                <span className="inline-block px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md border border-slate-200">{ordem.tipo_servico}</span>
                            </div>

                            {/* Valor em destaque (somente dono) */}
                            {mostrarFinanceiro && (
                            <div className={`rounded-lg px-3 py-2 flex items-center justify-between ${ordem.pago ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-200'}`}>
                                <span className="text-xs font-semibold text-slate-500">{ordem.pago ? '✓ Pago' : 'A receber'}</span>
                                <span className={`text-base font-bold ${ordem.pago ? 'text-emerald-600' : 'text-slate-800'}`}>{formatarMoeda(ordem.valor)}</span>
                            </div>
                            )}
                        </div>

                        {/* Rodapé: entrega + ações */}
                        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase block">Entrega</span>
                                <span className={`text-sm font-mono font-semibold ${isLate ? 'text-red-600' : 'text-slate-700'}`}>
                                    {formatarData(ordem.data_entrega_prevista)}
                                </span>
                            </div>
                            <div className="flex items-center gap-0.5">
                                <button onClick={() => adicionarAoAgenda(ordem)} className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Google Agenda">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4h.25V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" /></svg>
                                </button>
                                <button onClick={() => abrirWhatsApp(ordem)} className="p-1.5 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="WhatsApp">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                </button>
                                <button onClick={() => aoClicarEditar(ordem)} className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Editar">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button onClick={() => imprimirEtiqueta(ordem)} className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Imprimir">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                </button>
                                <button onClick={() => excluirOrdem(ordem.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* Navegação de etapa */}
                        {(podeVoltar || podeAvancar) && (
                            <div className="flex gap-2 px-4 pb-4">
                                {podeVoltar ? (
                                    <button onClick={() => voltarEtapa(ordem)} className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors w-full justify-center">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                        Voltar
                                    </button>
                                ) : <div className="w-full" />}
                                {podeAvancar && (
                                    <button onClick={() => avancarEtapa(ordem)} className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all active:scale-95 w-full justify-center shadow-sm">
                                        Avançar
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
        
        {!carregandoDados && ordensFiltradas.length === 0 && (
            <div className="text-center py-12 text-slate-500">Nada encontrado.</div>
        )}
      </div>

      {/* DETALHE DA ORDEM */}
      {ordemDetalhe && (
        <DetalheOS ordem={ordemDetalhe} aoFechar={() => setOrdemDetalhe(null)} mostrarFinanceiro={mostrarFinanceiro} />
      )}

      {/* MODAL: renderizado via Portal direto no body, fora de qualquer div pai */}
      {modalConfirmar && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setModalConfirmar(null)} />

          {/* Card */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            {/* Ícone */}
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Marcar como Pronto?</h3>
            <p className="text-sm text-slate-500 text-center mb-5">O pedido será movido para o Histórico de Entregas.</p>

            {/* Resumo do pedido */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Paciente</span>
                <span className="font-semibold text-slate-900">{modalConfirmar.nome_paciente}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Dentista</span>
                <span className="font-semibold text-slate-900">{modalConfirmar.dentista_nome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Serviço</span>
                <span className="font-semibold text-slate-900">{modalConfirmar.tipo_servico}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                <span className="text-slate-500">Valor</span>
                <span className="font-semibold text-slate-900">{formatarMoeda(modalConfirmar.valor)}</span>
              </div>
            </div>

            {/* Confirmar pagamento */}
            <button
              type="button"
              onClick={() => setPagoNoModal(!pagoNoModal)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border mb-6 transition-colors ${pagoNoModal ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}
            >
              <span className={`text-sm font-medium ${pagoNoModal ? 'text-emerald-700' : 'text-slate-600'}`}>
                Pagamento já recebido?
              </span>
              <div className="relative">
                <div className={`block w-10 h-6 rounded-full transition-colors ${pagoNoModal ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${pagoNoModal ? 'translate-x-4' : ''}`}></div>
              </div>
            </button>

            {/* Botões */}
            <div className="flex gap-3">
              <button
                onClick={() => setModalConfirmar(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPronto}
                disabled={salvando}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm disabled:opacity-60"
              >
                {salvando ? 'Salvando...' : 'Confirmar ✓'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}