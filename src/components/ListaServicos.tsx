import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';

export interface Servico {
  id: string;
  nome: string;
  prazoPadraoDias: number;
  valorPadrao?: number;
}

// Lista original que existia fixa no código — usada para popular o catálogo na primeira vez
const SERVICOS_INICIAIS: Omit<Servico, 'id'>[] = [
  { nome: "Protese Total", prazoPadraoDias: 7 },
  { nome: "Protese Flexivel", prazoPadraoDias: 7 },
  { nome: "Ponte Movel", prazoPadraoDias: 5 },
  { nome: "Conserto", prazoPadraoDias: 2 },
  { nome: "Placa de Bruxismo", prazoPadraoDias: 5 },
  { nome: "Protocolo", prazoPadraoDias: 10 },
  { nome: "Coroa Porcelana", prazoPadraoDias: 7 },
];

export function ListaServicos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [verificouSeed, setVerificouSeed] = useState(false);

  const [nome, setNome] = useState('');
  const [prazo, setPrazo] = useState('');
  const [valor, setValor] = useState('');
  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "servicos"), orderBy("nome", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setServicos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Servico[]);
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  // Popula o catálogo com os serviços padrão na primeira vez que a coleção estiver vazia
  useEffect(() => {
    if (carregando || verificouSeed) return;
    setVerificouSeed(true);
    if (servicos.length === 0) {
      (async () => {
        const snap = await getDocs(collection(db, "servicos"));
        if (snap.empty) {
          for (const s of SERVICOS_INICIAIS) {
            await addDoc(collection(db, "servicos"), s);
          }
        }
      })();
    }
  }, [carregando, servicos, verificouSeed]);

  function limpar() {
    setNome('');
    setPrazo('');
    setValor('');
    setIdEdicao(null);
  }

  function iniciarEdicao(s: Servico) {
    setNome(s.nome);
    setPrazo(s.prazoPadraoDias.toString());
    setValor(s.valorPadrao ? s.valorPadrao.toString() : '');
    setIdEdicao(s.id);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !prazo) return;
    setSalvando(true);
    try {
      const dados = {
        nome: nome.trim(),
        prazoPadraoDias: parseInt(prazo) || 1,
        valorPadrao: valor ? parseFloat(valor) : null,
      };
      if (idEdicao) {
        await updateDoc(doc(db, "servicos", idEdicao), dados);
      } else {
        await addDoc(collection(db, "servicos"), dados);
      }
      limpar();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar serviço.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (confirm("Remover este serviço do catálogo? Pedidos já criados não serão afetados.")) {
      await deleteDoc(doc(db, "servicos", id));
    }
  }

  const labelStyle = "block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide";
  const inputStyle = "w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all";

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      <div className={`p-6 rounded-xl border shadow-sm ${idEdicao ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className={`text-lg font-semibold ${idEdicao ? 'text-amber-700' : 'text-slate-900'}`}>
              {idEdicao ? '✏️ Editar Serviço' : 'Novo Serviço'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">O prazo padrão é usado para calcular a data de entrega automaticamente.</p>
          </div>
          {idEdicao && (
            <button onClick={limpar} className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              ✕ Cancelar
            </button>
          )}
        </div>

        <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className={labelStyle}>Nome do serviço</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Coroa de Zircônia" className={inputStyle} required />
          </div>
          <div>
            <label className={labelStyle}>Prazo padrão (dias)</label>
            <input type="number" min="1" value={prazo} onChange={e => setPrazo(e.target.value)} placeholder="7" className={inputStyle} required />
          </div>
          <div>
            <label className={labelStyle}>Valor padrão (opcional)</label>
            <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className={inputStyle} />
          </div>
          <div className="md:col-span-3">
            <button type="submit" disabled={salvando} className={`w-full md:w-auto px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors shadow-sm ${idEdicao ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {salvando ? 'Salvando...' : idEdicao ? 'Salvar Alterações' : '+ Adicionar Serviço'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Catálogo de Serviços</h3>
          <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{servicos.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Serviço</th>
                <th className="px-6 py-3">Prazo Padrão</th>
                <th className="px-6 py-3">Valor Padrão</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map(s => (
                <tr key={s.id} className={`border-b border-slate-100 ${idEdicao === s.id ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                  <td className="px-6 py-4 font-semibold text-slate-900">{s.nome}</td>
                  <td className="px-6 py-4 text-slate-600">{s.prazoPadraoDias} {s.prazoPadraoDias === 1 ? 'dia' : 'dias'}</td>
                  <td className="px-6 py-4 text-slate-600">{s.valorPadrao ? s.valorPadrao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => iniciarEdicao(s)} className="text-slate-400 hover:text-amber-600 p-2 hover:bg-amber-50 rounded-lg transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={() => excluir(s.id)} className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {servicos.length === 0 && !carregando && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">Nenhum serviço cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}