import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, doc, updateDoc, query, getDocs, orderBy } from 'firebase/firestore';
import { ETAPAS, PRIMEIRA_ETAPA, ULTIMA_ETAPA, resolverEtapa } from '../config/etapas';
import type { Servico } from './ListaServicos';

interface Props {
  pedidoEdicao: any;
  aoCancelar: () => void;
}

interface DentistaSelect {
    id: string;
    nome: string;
}

export function FormularioOS({ pedidoEdicao, aoCancelar }: Props) {
  const [dentista, setDentista] = useState('');
  const [paciente, setPaciente] = useState('');

  const [servico, setServico] = useState('');
  const [usarServicoManual, setUsarServicoManual] = useState(false);

  const [prazo, setPrazo] = useState('');
  const [prazoEditadoManualmente, setPrazoEditadoManualmente] = useState(false);
  const [valor, setValor] = useState('');
  const [obs, setObs] = useState('');
  const [etapa, setEtapa] = useState(PRIMEIRA_ETAPA.id);
  const [pago, setPago] = useState(false);

  const [carregando, setCarregando] = useState(false);
  const [listaDentistas, setListaDentistas] = useState<DentistaSelect[]>([]);
  const [listaServicos, setListaServicos] = useState<Servico[]>([]);

  useEffect(() => {
    async function carregarDentistas() {
        const q = query(collection(db, "dentistas"), orderBy("nome", "asc"));
        const snapshot = await getDocs(q);
        setListaDentistas(snapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome })));
    }
    async function carregarServicos() {
        const q = query(collection(db, "servicos"), orderBy("nome", "asc"));
        const snapshot = await getDocs(q);
        setListaServicos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Servico[]);
    }
    carregarDentistas();
    carregarServicos();
  }, []);

  useEffect(() => {
    if (pedidoEdicao) {
      setDentista(pedidoEdicao.dentista_nome);
      setPaciente(pedidoEdicao.nome_paciente);

      const servicoSalvo = pedidoEdicao.tipo_servico;
      const existeNoCatalogo = listaServicos.some(s => s.nome === servicoSalvo);
      setServico(servicoSalvo);
      setUsarServicoManual(!existeNoCatalogo && listaServicos.length > 0);

      setPrazo(pedidoEdicao.data_entrega_prevista);
      setPrazoEditadoManualmente(true); // ao editar, não recalcula sozinho
      setValor(pedidoEdicao.valor ? pedidoEdicao.valor.toString() : '');
      setObs(pedidoEdicao.observacoes || '');
      setEtapa(resolverEtapa(pedidoEdicao).id);
      setPago(pedidoEdicao.pago || false);
    } else {
      limparCampos();
    }
  }, [pedidoEdicao, listaServicos]);

  function limparCampos() {
    setDentista('');
    setPaciente('');
    setServico('');
    setUsarServicoManual(false);
    setObs('');
    setPrazo('');
    setPrazoEditadoManualmente(false);
    setValor('');
    setEtapa(PRIMEIRA_ETAPA.id);
    setPago(false);
  }

  // Calcula data de entrega = hoje + prazo padrão do serviço (formato YYYY-MM-DD)
  function calcularPrazo(dias: number): string {
    const data = new Date();
    data.setDate(data.getDate() + dias);
    return data.toISOString().split('T')[0];
  }

  function handleChangeSelectServico(valorSelecionado: string) {
      if (valorSelecionado === 'OUTRO') {
          setUsarServicoManual(true);
          setServico('');
          return;
      }

      setUsarServicoManual(false);
      setServico(valorSelecionado);

      // Preenche prazo e valor automaticamente, mas só se o usuário não tiver editado o prazo na mão
      const servicoEncontrado = listaServicos.find(s => s.nome === valorSelecionado);
      if (servicoEncontrado && !prazoEditadoManualmente) {
          setPrazo(calcularPrazo(servicoEncontrado.prazoPadraoDias));
          if (servicoEncontrado.valorPadrao && !valor) {
              setValor(servicoEncontrado.valorPadrao.toString());
          }
      }
  }

  async function salvarOrdem(e: React.FormEvent) {
    e.preventDefault();
    if (!servico.trim()) { alert("Informe o serviço."); return; }

    setCarregando(true);

    try {
      const dados = {
        dentista_nome: dentista,
        nome_paciente: paciente,
        tipo_servico: servico,
        data_entrega_prevista: prazo,
        valor: parseFloat(valor) || 0,
        observacoes: obs,
        status: etapa === ULTIMA_ETAPA.id ? 'pronto' : 'em_producao',
        etapa: etapa,
        pago: pago,
        data_entrada: pedidoEdicao ? pedidoEdicao.data_entrada : new Date().toISOString()
      };

      if (pedidoEdicao) {
        await updateDoc(doc(db, "ordens_servico", pedidoEdicao.id), dados);
        alert("✅ Atualizado!");
        aoCancelar();
      } else {
        await addDoc(collection(db, "ordens_servico"), dados);
        limparCampos();
      }
    } catch (erro) {
      console.error(erro);
      alert("Erro ao salvar.");
    } finally {
      setCarregando(false);
    }
  }

  const labelStyle = "block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide";
  const inputStyle = "w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 block p-2.5 transition-all outline-none shadow-sm placeholder:text-slate-400";

  return (
    <div className="p-6">
      <div className="mb-6">
            <h2 className={`text-lg font-semibold flex items-center gap-2 ${pedidoEdicao ? 'text-amber-700' : 'text-slate-900'}`}>
                {pedidoEdicao ? (<><span>✏️</span> Editando Ordem</>) : ('Nova Ordem')}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
                {pedidoEdicao ? 'Ajuste os dados abaixo.' : 'Preencha os dados do serviço.'}
            </p>
      </div>

      <form onSubmit={salvarOrdem} className="space-y-5">

        {pedidoEdicao && (
            <div className="p-3 bg-white border border-amber-200 rounded-lg mb-4 shadow-sm">
                <label className="block text-xs font-bold text-amber-700 mb-1.5 uppercase tracking-wide">Etapa Atual</label>
                <select value={etapa} onChange={e => setEtapa(e.target.value)} className={`w-full bg-white border border-slate-300 text-sm rounded-lg p-2.5 outline-none font-semibold ${etapa === ULTIMA_ETAPA.id ? 'text-emerald-600 ring-1 ring-emerald-500 border-emerald-500' : 'text-blue-600'}`}>
                    {ETAPAS.map(et => (<option key={et.id} value={et.id}>{et.nome}</option>))}
                </select>
            </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelStyle}>Dentista</label>
            <select value={dentista} onChange={e => setDentista(e.target.value)} className={inputStyle} required>
                <option value="" disabled>Selecione...</option>
                {listaDentistas.map(d => (<option key={d.id} value={d.nome}>{d.nome}</option>))}
            </select>
          </div>

          <div className="col-span-2">
            <label className={labelStyle}>Paciente</label>
            <input type="text" placeholder="Nome do paciente" value={paciente} onChange={e => setPaciente(e.target.value)} className={inputStyle} required />
          </div>

          <div>
            <label className={labelStyle}>Serviço</label>
            {!usarServicoManual ? (
                <select value={servico} onChange={e => handleChangeSelectServico(e.target.value)} className={inputStyle} required>
                    <option value="" disabled>Selecione...</option>
                    {listaServicos.map(s => (<option key={s.id} value={s.nome}>{s.nome}</option>))}
                    <option value="OUTRO" className="font-bold bg-slate-100">✨ Outro...</option>
                </select>
            ) : (
                <div className="flex gap-2">
                    <input type="text" placeholder="Digite..." value={servico} onChange={e => setServico(e.target.value)} className={inputStyle} autoFocus required />
                    <button type="button" onClick={() => { setUsarServicoManual(false); setServico(''); }} className="p-2 text-slate-400 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">✕</button>
                </div>
            )}
          </div>

          <div>
            <label className={labelStyle}>
                Entrega
                {!prazoEditadoManualmente && prazo && <span className="text-blue-500 font-normal ml-1 normal-case">(automático)</span>}
            </label>
            <input
                type="date"
                value={prazo}
                onChange={e => { setPrazo(e.target.value); setPrazoEditadoManualmente(true); }}
                className={`${inputStyle} tabular-nums`}
                required
            />
          </div>

          <div className="col-span-2 grid grid-cols-2 gap-4 items-end bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
                <label className={labelStyle}>Valor (R$)</label>
                <input type="number" step="0.01" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} className={inputStyle} required />
            </div>

            <div className="flex items-center h-10">
                <label className="flex items-center cursor-pointer select-none">
                    <div className="relative">
                        <input type="checkbox" className="sr-only" checked={pago} onChange={e => setPago(e.target.checked)} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${pago ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${pago ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <div className="ml-3 text-sm font-medium text-slate-700">
                        {pago ? <span className="text-emerald-600 font-bold">PAGO ✅</span> : <span className="text-slate-500">Pendente</span>}
                    </div>
                </label>
            </div>
          </div>
        </div>

        <div>
          <label className={labelStyle}>Observações</label>
          <textarea placeholder="..." value={obs} onChange={e => setObs(e.target.value)} className={`${inputStyle} h-20 resize-none`} />
        </div>

        <div className="pt-2">
            <button type="submit" disabled={carregando} className={`w-full py-2.5 px-4 rounded-lg shadow-sm text-sm font-medium text-white transition-all active:scale-[0.98] ${carregando ? 'bg-slate-400' : pedidoEdicao ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {carregando ? "..." : pedidoEdicao ? "Salvar Alterações" : "Criar Ordem"}
            </button>
        </div>
      </form>
    </div>
  );
}