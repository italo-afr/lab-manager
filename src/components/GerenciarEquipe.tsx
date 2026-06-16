import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Papel } from '../services/useUsuario';

interface UsuarioRow {
  id: string; // uid do Firebase Auth
  nome?: string;
  email?: string;
  papel: Papel;
}

export function GerenciarEquipe() {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "usuarios"));
    const unsub = onSnapshot(q, (snap) => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })) as UsuarioRow[]);
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  const pendentes = usuarios.filter(u => u.papel === 'pendente');
  const aprovados = usuarios.filter(u => u.papel !== 'pendente');

  async function aprovar(usuario: UsuarioRow, papel: 'dono' | 'funcionario') {
    await setDoc(doc(db, "usuarios", usuario.id), {
      nome: usuario.nome || '',
      email: usuario.email || '',
      papel,
    });
  }

  async function rejeitar(usuario: UsuarioRow) {
    if (confirm(`Rejeitar a solicitação de ${usuario.nome || usuario.email}? A pessoa não vai conseguir acessar o sistema.`)) {
      await deleteDoc(doc(db, "usuarios", usuario.id));
    }
  }

  async function alterarPapel(usuario: UsuarioRow, novoPapel: Papel) {
    await setDoc(doc(db, "usuarios", usuario.id), { nome: usuario.nome || '', email: usuario.email || '', papel: novoPapel });
  }

  async function remover(usuario: UsuarioRow) {
    if (confirm(`Remover ${usuario.nome || usuario.email} da equipe? Essa pessoa não vai mais conseguir acessar o sistema.`)) {
      await deleteDoc(doc(db, "usuarios", usuario.id));
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Solicitações pendentes — destaque no topo */}
      {pendentes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-200 bg-amber-100/50 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-semibold text-amber-800">Solicitações de Acesso Pendentes</h3>
            <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full ml-auto">{pendentes.length}</span>
          </div>
          <div className="divide-y divide-amber-100">
            {pendentes.map(u => (
              <div key={u.id} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-slate-900">{u.nome || 'Sem nome'}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => aprovar(u, 'funcionario')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    ✓ Aprovar como Funcionário
                  </button>
                  <button
                    onClick={() => aprovar(u, 'dono')}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-colors"
                  >
                    Aprovar como Dono
                  </button>
                  <button
                    onClick={() => rejeitar(u)}
                    className="px-3 py-1.5 text-slate-400 hover:text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipe atual */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Equipe</h3>
          <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{aprovados.length}</span>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3">Nome</th>
              <th className="px-6 py-3">E-mail</th>
              <th className="px-6 py-3">Função</th>
              <th className="px-6 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {aprovados.map(u => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-6 py-4 font-semibold text-slate-900">{u.nome || '—'}</td>
                <td className="px-6 py-4 text-slate-500 text-xs">{u.email || '—'}</td>
                <td className="px-6 py-4">
                  <select value={u.papel} onChange={e => alterarPapel(u, e.target.value as Papel)} className={`text-xs font-bold px-2 py-1 rounded border outline-none ${u.papel === 'dono' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    <option value="funcionario">Funcionário</option>
                    <option value="dono">Dono</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => remover(u)} className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors" title="Remover">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </td>
              </tr>
            ))}
            {aprovados.length === 0 && !carregando && (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">Nenhum membro cadastrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}