import { useState, useEffect } from 'react';
import { ModalFormularioOS } from './components/ModalFormularioOS';
import { ListaOrdens } from './components/ListaOrdens';
import { ListaDentistas } from './components/ListaDentistas';
import { ListaServicos } from './components/ListaServicos';
import { GerenciarEquipe } from './components/GerenciarEquipe';
import { PaginaFinanceiro } from './components/PaginaFinanceiro';
import { PaginaRelatorios } from './components/PaginaRelatorios';
import { Login } from './components/Login';
import { AguardandoAprovacao } from './components/AguardandoAprovacao';
import { auth } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { useUsuario } from './services/useUsuario';
import { collection, query, where, onSnapshot as onSnap } from 'firebase/firestore';
import { db } from './services/firebase';

export interface Ordem {
  id: string;
  dentista_nome: string;
  nome_paciente: string;
  tipo_servico: string;
  data_entrega_prevista: string;
  valor: number;
  observacoes: string;
  status: string;
  etapa?: string;
  data_entrada?: string;
  pago?: boolean;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [pedidoParaEditar, setPedidoParaEditar] = useState<Ordem | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState<'dashboard' | 'historico' | 'dentistas' | 'servicos' | 'equipe' | 'financeiro' | 'relatorios'>('dashboard');
  const { perfil, ehDono, pendente, carregando: carregandoPerfil } = useUsuario(user);
  const [qtdPendentes, setQtdPendentes] = useState(0);

  useEffect(() => {
    if (!ehDono) { setQtdPendentes(0); return; }
    const q = query(collection(db, "usuarios"), where("papel", "==", "pendente"));
    const unsub = onSnap(q, snap => setQtdPendentes(snap.size));
    return () => unsub();
  }, [ehDono]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usuarioFirebase) => {
      setUser(usuarioFirebase);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  function cancelarEdicao() {
    setPedidoParaEditar(null);
    setModalAberto(false);
  }

  function abrirNovaOrdem() {
    setPedidoParaEditar(null);
    setModalAberto(true);
  }

  function abrirEdicao(ordem: Ordem) {
    setPedidoParaEditar(ordem);
    setModalAberto(true);
  }

  if (authLoading || (user && carregandoPerfil)) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Carregando...</div>;
  if (!user) return <Login />;
  if (pendente) return <AguardandoAprovacao nome={perfil?.nome} />;

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-700">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="w-full px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-8">
            {/* Botão hambúrguer - só aparece no celular */}
            <button
                onClick={() => setMenuMobileAberto(true)}
                className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>

            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setPaginaAtual('dashboard')}>
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm shadow-blue-600/20 flex-shrink-0">L</div>
                <div className="hidden sm:block">
                <h1 className="text-sm font-semibold text-slate-900 tracking-tight">LabManager</h1>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Área de Trabalho</p>
                </div>
            </div>

            <nav className="hidden md:flex gap-1">
                <button onClick={() => setPaginaAtual('dashboard')} className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${paginaAtual === 'dashboard' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                    Pedidos
                </button>
                <button onClick={() => setPaginaAtual('historico')} className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${paginaAtual === 'historico' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                    Histórico
                </button>
                <button onClick={() => setPaginaAtual('dentistas')} className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${paginaAtual === 'dentistas' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                    Dentistas
                </button>
                <button onClick={() => setPaginaAtual('servicos')} className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${paginaAtual === 'servicos' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                    Serviços
                </button>
                {ehDono && (
                    <button onClick={() => setPaginaAtual('relatorios')} className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${paginaAtual === 'relatorios' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                        Relatórios
                    </button>
                )}
                {ehDono && (
                    <button onClick={() => setPaginaAtual('equipe')} className={`relative px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${paginaAtual === 'equipe' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                        Equipe
                        {qtdPendentes > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {qtdPendentes}
                            </span>
                        )}
                    </button>
                )}
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
             {ehDono && (paginaAtual === 'dashboard' || paginaAtual === 'historico') && (
                <button onClick={() => setPaginaAtual('financeiro')} className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    <span className="hidden sm:inline">Financeiro</span>
                </button>
             )}
             {(paginaAtual === 'dashboard' || paginaAtual === 'historico') && (
                <button onClick={abrirNovaOrdem} className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    <span className="hidden sm:inline">Nova Ordem</span>
                </button>
             )}
             <span className="hidden lg:block text-xs text-slate-400">{user.email}</span>
             <button onClick={() => signOut(auth)} className="text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 md:px-3 py-1.5 rounded-lg transition-colors">Sair</button>
          </div>
        </div>
      </header>

      {/* Menu mobile (drawer) */}
      {menuMobileAberto && (
        <div className="md:hidden fixed inset-0 z-30">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuMobileAberto(false)} />
            <div className="absolute top-0 left-0 h-full w-72 bg-white shadow-xl flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">L</div>
                        <span className="font-semibold text-slate-900">LabManager</span>
                    </div>
                    <button onClick={() => setMenuMobileAberto(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <nav className="flex flex-col p-3 gap-1">
                    {[
                        { id: 'dashboard', label: 'Pedidos' },
                        { id: 'historico', label: 'Histórico' },
                        { id: 'dentistas', label: 'Dentistas' },
                        { id: 'servicos', label: 'Serviços' },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => { setPaginaAtual(item.id as any); setMenuMobileAberto(false); }}
                            className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${paginaAtual === item.id ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                    {ehDono && (
                        <button
                            onClick={() => { setPaginaAtual('relatorios'); setMenuMobileAberto(false); }}
                            className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${paginaAtual === 'relatorios' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Relatórios
                        </button>
                    )}
                    {ehDono && (
                        <button
                            onClick={() => { setPaginaAtual('equipe'); setMenuMobileAberto(false); }}
                            className={`relative text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${paginaAtual === 'equipe' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Equipe
                            {qtdPendentes > 0 && (
                                <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                    {qtdPendentes}
                                </span>
                            )}
                        </button>
                    )}
                </nav>
                <div className="mt-auto p-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>
            </div>
        </div>
      )}

      <main className="w-full px-4 md:px-6 py-6 md:py-8">

        {/* TELA: DASHBOARD (ATIVOS) */}
        {paginaAtual === 'dashboard' && (
            <ListaOrdens aoClicarEditar={abrirEdicao} filtro="ativos" mostrarFinanceiro={ehDono} />
        )}

        {/* TELA: HISTÓRICO (CONCLUÍDOS) */}
        {paginaAtual === 'historico' && (
            <ListaOrdens aoClicarEditar={abrirEdicao} filtro="concluidos" mostrarFinanceiro={ehDono} />
        )}

        {/* TELA: DENTISTAS */}
        {paginaAtual === 'dentistas' && (
            <ListaDentistas />
        )}

        {/* TELA: SERVIÇOS */}
        {paginaAtual === 'servicos' && (
            <ListaServicos />
        )}

        {/* TELA: EQUIPE (somente dono) */}
        {paginaAtual === 'equipe' && ehDono && (
            <GerenciarEquipe />
        )}

        {/* TELA: FINANCEIRO (somente dono) */}
        {paginaAtual === 'financeiro' && ehDono && (
            <PaginaFinanceiro />
        )}

        {/* TELA: RELATÓRIOS (somente dono) */}
        {paginaAtual === 'relatorios' && ehDono && (
            <PaginaRelatorios />
        )}

      </main>

      <ModalFormularioOS aberto={modalAberto} pedidoEdicao={pedidoParaEditar} aoFechar={cancelarEdicao} />
    </div>
  );
}

export default App;