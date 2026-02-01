import { useState, useEffect } from 'react';
import { FormularioOS } from './components/FormularioOS';
import { ListaOrdens } from './components/ListaOrdens';
import { ListaDentistas } from './components/ListaDentistas';
import { Login } from './components/Login';
import { auth } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

export interface Ordem {
  id: string;
  dentista_nome: string;
  nome_paciente: string;
  tipo_servico: string;
  data_entrega_prevista: string;
  valor: number;
  observacoes: string;
  status: string;
  data_entrada?: string;
  pago?: boolean;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [pedidoParaEditar, setPedidoParaEditar] = useState<Ordem | null>(null);
  const [paginaAtual, setPaginaAtual] = useState<'dashboard' | 'historico' | 'dentistas'>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usuarioFirebase) => {
      setUser(usuarioFirebase);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  function cancelarEdicao() {
    setPedidoParaEditar(null);
  }

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Carregando...</div>;
  if (!user) return <Login />;

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-700">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="w-full px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setPaginaAtual('dashboard')}>
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm shadow-blue-600/20">L</div>
                <div>
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
            </nav>
          </div>

          <div className="flex items-center gap-4">
             <span className="hidden md:block text-xs text-slate-400">{user.email}</span>
             <button onClick={() => signOut(auth)} className="text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">Sair</button>
          </div>
        </div>
      </header>
      
      <main className="w-full px-6 py-8">
        
        {/* TELA: DASHBOARD (ATIVOS) */}
        {paginaAtual === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-4 xl:col-span-3 space-y-4 sticky top-24">
                    <div className={`rounded-xl shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] border overflow-hidden transition-colors duration-300 ${pedidoParaEditar ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                        <FormularioOS pedidoEdicao={pedidoParaEditar} aoCancelar={cancelarEdicao} />
                    </div>
                </div>
                <div className="lg:col-span-8 xl:col-span-9">
                    <ListaOrdens aoClicarEditar={setPedidoParaEditar} filtro="ativos" />
                </div>
            </div>
        )}

        {/* TELA: HISTÓRICO (CONCLUÍDOS) - AGORA COM FORMULÁRIO! */}
        {paginaAtual === 'historico' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                 {/* Adicionamos a coluna do formulário aqui também */}
                <div className="lg:col-span-4 xl:col-span-3 space-y-4 sticky top-24">
                    <div className={`rounded-xl shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] border overflow-hidden transition-colors duration-300 ${pedidoParaEditar ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                        <FormularioOS pedidoEdicao={pedidoParaEditar} aoCancelar={cancelarEdicao} />
                    </div>
                </div>
                <div className="lg:col-span-8 xl:col-span-9">
                    <ListaOrdens aoClicarEditar={setPedidoParaEditar} filtro="concluidos" />
                </div>
            </div>
        )}

        {/* TELA: DENTISTAS */}
        {paginaAtual === 'dentistas' && (
            <ListaDentistas />
        )}

      </main>
    </div>
  );
}

export default App;