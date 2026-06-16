import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, Timestamp, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { ETAPAS } from '../config/etapas';
import { enviarFoto, excluirFoto } from '../services/supabase';
import imageCompression from 'browser-image-compression';

interface Props {
  ordem: {
    id: string;
    nome_paciente: string;
    dentista_nome: string;
    tipo_servico: string;
    data_entrega_prevista: string;
    valor?: number;
    pago?: boolean;
    etapa?: string;
    status: string;
    observacoes?: string;
    data_entrada?: string;
  };
  aoFechar: () => void;
  mostrarFinanceiro?: boolean;
}

interface Evento {
  id: string;
  tipo: 'etapa' | 'criacao' | 'foto';
  descricao: string;
  etapaId?: string;
  fotoUrl?: string;
  criadoEm: Timestamp;
}

export function DetalheOS({ ordem, aoFechar, mostrarFinanceiro = true }: Props) {
  const [historico, setHistorico] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "ordens_servico", ordem.id, "historico"),
      orderBy("criadoEm", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Evento[]);
      setCarregando(false);
    });
    return () => unsub();
  }, [ordem.id]);

  function formatarData(data: string) {
    if (!data) return '--';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  function formatarTimestamp(ts: Timestamp) {
    if (!ts) return '';
    const d = ts.toDate();
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatarMoeda(v?: number) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  async function handleSelecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setEnviando(true);
    try {
      // Comprime a imagem antes de enviar (importante para conexões fracas no celular)
      const comprimida = await imageCompression(arquivo, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: 'image/jpeg',
      });

      const url = await enviarFoto(ordem.id, comprimida as File);

      await addDoc(collection(db, "ordens_servico", ordem.id, "historico"), {
        tipo: 'foto',
        descricao: 'Foto adicionada',
        fotoUrl: url,
        criadoEm: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      alert("Não foi possível enviar a foto. Verifique sua conexão e tente novamente.");
    } finally {
      setEnviando(false);
      if (inputFotoRef.current) inputFotoRef.current.value = '';
    }
  }

  async function handleExcluirFoto(evento: Evento) {
    if (!evento.fotoUrl) return;
    if (!confirm("Excluir esta foto? Essa ação não pode ser desfeita.")) return;
    try {
      await excluirFoto(evento.fotoUrl);
    } catch (err) {
      console.error("Erro ao remover do storage (prosseguindo para remover o registro):", err);
    }
    await deleteDoc(doc(db, "ordens_servico", ordem.id, "historico", evento.id));
  }

  function corEtapa(etapaId?: string) {
    const e = ETAPAS.find(e => e.id === etapaId);
    return e?.cor || 'bg-slate-100 text-slate-600 border-slate-200';
  }

  function nomeEtapa(etapaId?: string) {
    return ETAPAS.find(e => e.id === etapaId)?.nome || etapaId || '';
  }

  const etapaAtual = ETAPAS.find(e => e.id === ordem.etapa) || ETAPAS[0];
  const idxAtual = ETAPAS.findIndex(e => e.id === etapaAtual.id);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={aoFechar} />

      {/* Painel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{ordem.nome_paciente}</h2>
            <p className="text-sm text-slate-500 mt-0.5">Dr(a). {ordem.dentista_nome} · {ordem.tipo_servico}</p>
          </div>
          <button onClick={aoFechar} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Resumo */}
          <div className={`grid gap-3 ${mostrarFinanceiro ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Entrega</span>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{formatarData(ordem.data_entrega_prevista)}</p>
            </div>
            {mostrarFinanceiro && (
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Valor</span>
              <p className={`text-sm font-bold mt-0.5 ${ordem.pago ? 'text-emerald-600' : 'text-slate-800'}`}>
                {formatarMoeda(ordem.valor)} {ordem.pago ? '✓ Pago' : '· Pendente'}
              </p>
            </div>
            )}
            {ordem.observacoes && (
              <div className="col-span-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Observações</span>
                <p className="text-sm text-slate-700 mt-0.5">{ordem.observacoes}</p>
              </div>
            )}
          </div>

          {/* Progresso das etapas */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Progresso</h3>
            <div className="flex items-center gap-1">
              {ETAPAS.map((etapa, idx) => {
                const concluida = idx < idxAtual;
                const atual = idx === idxAtual;
                return (
                  <div key={etapa.id} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full h-2 rounded-full transition-all ${
                      concluida ? 'bg-emerald-500' : atual ? 'bg-blue-500' : 'bg-slate-200'
                    }`} />
                    <span className={`text-[9px] font-medium text-center leading-tight ${
                      atual ? 'text-blue-600 font-bold' : concluida ? 'text-emerald-600' : 'text-slate-400'
                    }`}>{etapa.nome}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Adicionar foto */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Fotos</h3>
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleSelecionarFoto}
              className="hidden"
            />
            <button
              onClick={() => inputFotoRef.current?.click()}
              disabled={enviando}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors disabled:opacity-60"
            >
              {enviando ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Enviando foto...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Adicionar Foto
                </>
              )}
            </button>
          </div>

          {/* Linha do tempo */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Histórico</h3>

            {carregando && (
              <p className="text-sm text-slate-400 text-center py-4">Carregando...</p>
            )}

            {!carregando && historico.length === 0 && (
              <div className="text-center py-6 text-slate-400">
                <p className="text-sm">Nenhum evento registrado ainda.</p>
                <p className="text-xs mt-1">Os eventos aparecerão aqui quando a etapa for avançada.</p>
              </div>
            )}

            {!carregando && historico.length > 0 && (
              <div className="relative">
                {/* Linha vertical */}
                <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-200" />

                <div className="space-y-4">
                  {historico.map((evento, idx) => (
                    <div key={evento.id} className="flex gap-3 relative">
                      {/* Bolinha */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 border-white shadow-sm ${
                        evento.tipo === 'foto' ? 'bg-purple-500' : idx === 0 ? 'bg-blue-500' : 'bg-slate-300'
                      }`}>
                        {evento.tipo === 'criacao' ? (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        ) : evento.tipo === 'foto' ? (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-800">{evento.descricao}</p>
                          {evento.etapaId && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${corEtapa(evento.etapaId)}`}>
                              {nomeEtapa(evento.etapaId)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{formatarTimestamp(evento.criadoEm)}</p>

                        {evento.tipo === 'foto' && evento.fotoUrl && (
                          <div className="relative mt-2 inline-block group">
                            <img
                              src={evento.fotoUrl}
                              alt="Foto da O.S."
                              onClick={() => setFotoAmpliada(evento.fotoUrl!)}
                              className="w-28 h-28 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                            />
                            <button
                              onClick={() => handleExcluirFoto(evento)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:border-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Excluir foto"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Foto ampliada */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80"
          onClick={() => setFotoAmpliada(null)}
        >
          <img src={fotoAmpliada} alt="Foto ampliada" className="max-w-full max-h-full rounded-lg shadow-2xl" />
          <button
            onClick={() => setFotoAmpliada(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}