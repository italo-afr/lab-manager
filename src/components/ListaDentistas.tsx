import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';

interface Dentista {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  endereco?: string;
  cidade?: string;
}

export function ListaDentistas() {
  const [dentistas, setDentistas] = useState<Dentista[]>([]);
  
  // Estados do Formulário
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoEndereco, setNovoEndereco] = useState('');
  const [novaCidade, setNovaCidade] = useState('');

  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "dentistas"), orderBy("nome", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dados = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Dentista[];
      setDentistas(dados);
    });
    return () => unsubscribe();
  }, []);

  function limparFormulario() {
    setNovoNome('');
    setNovoTelefone('');
    setNovoEmail('');
    setNovoEndereco('');
    setNovaCidade('');
    setIdEdicao(null);
  }

  function iniciarEdicao(dentista: Dentista) {
    setNovoNome(dentista.nome);
    setNovoTelefone(dentista.telefone);
    setNovoEmail(dentista.email || '');
    setNovoEndereco(dentista.endereco || '');
    setNovaCidade(dentista.cidade || '');
    setIdEdicao(dentista.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- NOVA FUNÇÃO DE MÁSCARA ---
  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value;

    // Remove tudo que não é número (Letras, símbolos)
    valor = valor.replace(/\D/g, "");

    if (valor.length > 11) {
        valor = valor.slice(0, 11);
    }

    // Aplica a formatação
    // Coloca parênteses em volta dos dois primeiros dígitos
    valor = valor.replace(/^(\d{2})(\d)/g, "($1) $2");
    // Coloca hífen entre o quinto e o sexto dígito
    valor = valor.replace(/(\d)(\d{4})$/, "$1-$2");

    setNovoTelefone(valor);
  };

  async function salvarDentista(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setCarregando(true);

    try {
      const dados = {
        nome: novoNome,
        telefone: novoTelefone,
        email: novoEmail,
        endereco: novoEndereco,
        cidade: novaCidade,
        data_atualizacao: new Date().toISOString()
      };

      if (idEdicao) {
        await updateDoc(doc(db, "dentistas", idEdicao), dados);
        alert("✅ Dados do dentista atualizados!");
      } else {
        await addDoc(collection(db, "dentistas"), {
            ...dados,
            data_cadastro: new Date().toISOString()
        });
        alert("✅ Dentista cadastrado com sucesso!");
      }
      limparFormulario();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar dados.");
    } finally {
      setCarregando(false);
    }
  }

  async function excluirDentista(id: string) {
    if (confirm("Tem certeza? Isso remove o cadastro do dentista.")) {
      await deleteDoc(doc(db, "dentistas", id));
    }
  }

  const labelStyle = "block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wide";
  const inputStyle = "w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all";

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      
      <div className={`p-6 rounded-xl border shadow-sm transition-colors duration-300 ${idEdicao ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
        <div className="flex justify-between items-start mb-6">
            <div>
                <h2 className={`text-lg font-semibold ${idEdicao ? 'text-amber-700' : 'text-slate-900'}`}>
                    {idEdicao ? '✏️ Editar Parceiro' : 'Novo Parceiro'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                    {idEdicao ? 'Altere os dados abaixo e salve.' : 'Preencha os dados completos para contato e entrega.'}
                </p>
            </div>
            {idEdicao && (
                <button 
                    onClick={limparFormulario}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                    ✕ Cancelar Edição
                </button>
            )}
        </div>
        
        <form onSubmit={salvarDentista}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                
                <div className="md:col-span-8">
                    <label className={labelStyle}>Nome do Dentista</label>
                    <input type="text" value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: Dr. Carlos Silva" className={inputStyle} required />
                </div>
                
                {/* CAMPO TELEFONE ATUALIZADO */}
                <div className="md:col-span-4">
                    <label className={labelStyle}>Telefone / WhatsApp</label>
                    <input 
                        type="tel" // Ajuda no teclado do celular
                        value={novoTelefone} 
                        onChange={handleTelefoneChange} // Usa a máscara
                        placeholder="(00) 00000-0000" 
                        className={inputStyle} 
                        maxLength={15} // Segurança extra visual
                    />
                </div>

                <div className="md:col-span-8">
                    <label className={labelStyle}>E-mail (Opcional)</label>
                    <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="doutor@clinica.com" className={inputStyle} />
                </div>
                <div className="md:col-span-4">
                    <label className={labelStyle}>Cidade</label>
                    <input type="text" value={novaCidade} onChange={e => setNovaCidade(e.target.value)} placeholder="Ex: São Paulo" className={inputStyle} />
                </div>

                <div className="md:col-span-12">
                    <label className={labelStyle}>Endereço (Rua, Número, Bairro)</label>
                    <input type="text" value={novoEndereco} onChange={e => setNovoEndereco(e.target.value)} placeholder="Rua das Flores, 123 - Centro" className={inputStyle} />
                </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
                {idEdicao && (
                    <button type="button" onClick={limparFormulario} className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
                )}
                <button type="submit" disabled={carregando} className={`text-white font-medium rounded-lg text-sm px-6 py-2.5 transition-colors shadow-sm hover:shadow ${idEdicao ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {carregando ? 'Processando...' : idEdicao ? 'Salvar Alterações' : 'Adicionar Dentista'}
                </button>
            </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Parceiros Cadastrados</h3>
            <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{dentistas.length}</span>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-3">Dentista</th>
                        <th className="px-6 py-3">Contato</th>
                        <th className="px-6 py-3">Localização</th>
                        <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {dentistas.map((dentista) => (
                        <tr key={dentista.id} className={`border-b border-slate-100 transition-colors ${idEdicao === dentista.id ? 'bg-amber-50' : 'bg-white hover:bg-slate-50'}`}>
                            <td className="px-6 py-4">
                                <p className="font-bold text-slate-900">{dentista.nome}</p>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-mono text-slate-700">{dentista.telefone || '-'}</span>
                                    <span className="text-xs text-slate-400">{dentista.email}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="text-slate-700 font-medium">{dentista.cidade}</span>
                                    <span className="text-xs text-slate-400 max-w-xs truncate" title={dentista.endereco}>
                                        {dentista.endereco || 'Endereço não informado'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => iniciarEdicao(dentista)} className="text-slate-400 hover:text-amber-600 transition-colors p-2 hover:bg-amber-50 rounded-lg" title="Editar">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg>
                                    </button>
                                    <button onClick={() => excluirDentista(dentista.id)} className="text-slate-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg" title="Excluir">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {dentistas.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                <p>Nenhum dentista cadastrado ainda.</p>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}