import { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { ETAPAS } from '../config/etapas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

interface Ordem {
  id: string;
  dentista_nome: string;
  nome_paciente: string;
  tipo_servico: string;
  data_entrega_prevista: string;
  data_entrada?: string;
  status: string;
  etapa?: string;
  valor?: number;
  pago?: boolean;
}

type AtalhoPeriodo = 'este_mes' | 'mes_passado' | 'personalizado';

export function PaginaRelatorios() {
  const [ordens, setOrdens] = useState<Ordem[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [atalho, setAtalho] = useState<AtalhoPeriodo>('este_mes');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    const q = query(collection(db, "ordens_servico"));
    const unsub = onSnapshot(q, snap => {
      setOrdens(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Ordem[]);
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  // Calcula o intervalo de datas (YYYY-MM-DD) com base no atalho escolhido
  function calcularIntervalo(): { inicio: string; fim: string } {
    const hoje = new Date();

    if (atalho === 'personalizado') {
      return { inicio: dataInicio, fim: dataFim };
    }

    let ano = hoje.getFullYear();
    let mes = hoje.getMonth(); // 0-indexed

    if (atalho === 'mes_passado') {
      mes -= 1;
      if (mes < 0) { mes = 11; ano -= 1; }
    }

    const inicio = new Date(ano, mes, 1);
    const fim = new Date(ano, mes + 1, 0); // último dia do mês

    const toISO = (d: Date) => d.toISOString().split('T')[0];
    return { inicio: toISO(inicio), fim: toISO(fim) };
  }

  const { inicio, fim } = calcularIntervalo();

  // Filtra pela data de ENTRADA do pedido (quando o trabalho foi recebido no laboratório)
  // -- é a métrica mais fiel para "quanto trabalho entrou nesse período"
  const ordensNoPeriodo = ordens.filter(o => {
    const dataRef = (o.data_entrada || '').split('T')[0];
    if (!dataRef || !inicio || !fim) return false;
    return dataRef >= inicio && dataRef <= fim;
  });

  function formatarMoeda(v?: number) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarDataBR(iso: string) {
    if (!iso) return '--';
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  // --- Métricas financeiras ---
  const totalFaturado = ordensNoPeriodo.reduce((acc, o) => acc + (o.valor || 0), 0);
  const totalRecebido = ordensNoPeriodo.filter(o => o.pago).reduce((acc, o) => acc + (o.valor || 0), 0);
  const totalPendente = totalFaturado - totalRecebido;

  // --- Métricas de produção ---
  const totalPedidos = ordensNoPeriodo.length;
  const totalEntregues = ordensNoPeriodo.filter(o => o.status === 'pronto').length;

  const porEtapa = ETAPAS.map(etapa => ({
    nome: etapa.nome,
    cor: etapa.cor,
    quantidade: ordensNoPeriodo.filter(o => (o.etapa || ETAPAS[0].id) === etapa.id).length,
  }));

  const porServico = ordensNoPeriodo.reduce((acc, o) => {
    const nome = o.tipo_servico || 'Não informado';
    acc[nome] = (acc[nome] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const rankingServicos = Object.entries(porServico).sort((a, b) => b[1] - a[1]);

  const porDentista = ordensNoPeriodo.reduce((acc, o) => {
    const nome = o.dentista_nome || 'Sem dentista';
    acc[nome] = (acc[nome] || 0) + (o.valor || 0);
    return acc;
  }, {} as Record<string, number>);

  const rankingDentistas = Object.entries(porDentista).sort((a, b) => b[1] - a[1]).slice(0, 5);

  function rotuloPeriodo(): string {
    if (atalho === 'este_mes') return 'Este mês';
    if (atalho === 'mes_passado') return 'Mês passado';
    return `${formatarDataBR(inicio)} a ${formatarDataBR(fim)}`;
  }

  // --- Exportação PDF ---
  function exportarPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Relatório do Laboratório', 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${rotuloPeriodo()} (${formatarDataBR(inicio)} - ${formatarDataBR(fim)})`, 14, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Financeiro', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Faturamento total: ${formatarMoeda(totalFaturado)}`, 14, y); y += 5;
    doc.text(`Recebido: ${formatarMoeda(totalRecebido)}`, 14, y); y += 5;
    doc.text(`Pendente: ${formatarMoeda(totalPendente)}`, 14, y); y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Produção', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Total de pedidos: ${totalPedidos}`, 14, y); y += 5;
    doc.text(`Entregues: ${totalEntregues}`, 14, y); y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Pedidos por etapa atual', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    porEtapa.forEach(e => {
      doc.text(`${e.nome}: ${e.quantidade}`, 14, y);
      y += 5;
    });
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Serviços mais pedidos', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    rankingServicos.forEach(([nome, qtd]) => {
      doc.text(`${nome}: ${qtd}`, 14, y);
      y += 5;
    });
    y += 5;

    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Faturamento por dentista', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    rankingDentistas.forEach(([nome, valor]) => {
      doc.text(`${nome}: ${formatarMoeda(valor)}`, 14, y);
      y += 5;
    });

    doc.save(`Relatorio_${inicio}_a_${fim}.pdf`);
  }

  // --- Exportação Excel ---
  function exportarExcel() {
    const wb = XLSX.utils.book_new();

    const resumo = [
      ['Relatório do Laboratório'],
      [`Período: ${rotuloPeriodo()} (${formatarDataBR(inicio)} - ${formatarDataBR(fim)})`],
      [],
      ['Financeiro'],
      ['Faturamento total', totalFaturado],
      ['Recebido', totalRecebido],
      ['Pendente', totalPendente],
      [],
      ['Produção'],
      ['Total de pedidos', totalPedidos],
      ['Entregues', totalEntregues],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    const etapasSheet = [['Etapa', 'Quantidade'], ...porEtapa.map(e => [e.nome, e.quantidade])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(etapasSheet), 'Por Etapa');

    const servicosSheet = [['Serviço', 'Quantidade'], ...rankingServicos];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(servicosSheet), 'Por Serviço');

    const dentistasSheet = [['Dentista', 'Faturamento'], ...rankingDentistas];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dentistasSheet), 'Por Dentista');

    const detalhado = [
      ['Paciente', 'Dentista', 'Serviço', 'Entrada', 'Entrega', 'Valor', 'Pago', 'Status'],
      ...ordensNoPeriodo.map(o => [
        o.nome_paciente,
        o.dentista_nome,
        o.tipo_servico,
        (o.data_entrada || '').split('T')[0],
        o.data_entrega_prevista,
        o.valor || 0,
        o.pago ? 'Sim' : 'Não',
        o.status === 'pronto' ? 'Pronto' : 'Em produção',
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detalhado), 'Pedidos Detalhado');

    XLSX.writeFile(wb, `Relatorio_${inicio}_a_${fim}.xlsx`);
  }

  if (carregando) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">

      {/* Seletor de período */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAtalho('este_mes')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${atalho === 'este_mes' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Este mês
            </button>
            <button
              onClick={() => setAtalho('mes_passado')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${atalho === 'mes_passado' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Mês passado
            </button>
            <button
              onClick={() => setAtalho('personalizado')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${atalho === 'personalizado' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Personalizado
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={exportarPDF} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
              PDF
            </button>
            <button onClick={exportarExcel} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
              Planilha
            </button>
          </div>
        </div>

        {atalho === 'personalizado' && (
          <div className="flex flex-wrap items-end gap-4 mt-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">De</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Até</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400 mt-3">
          Exibindo dados de <strong className="text-slate-600">{formatarDataBR(inicio)}</strong> até <strong className="text-slate-600">{formatarDataBR(fim)}</strong> · {totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''} no período
        </p>
      </div>

      {/* Métricas financeiras */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Faturamento total</span>
          <p className="text-2xl font-bold text-blue-600 tracking-tight mt-2">{formatarMoeda(totalFaturado)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recebido</span>
          <p className="text-2xl font-bold text-emerald-600 tracking-tight mt-2">{formatarMoeda(totalRecebido)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pendente</span>
          <p className="text-2xl font-bold text-slate-800 tracking-tight mt-2">{formatarMoeda(totalPendente)}</p>
        </div>
      </div>

      {/* Métricas de produção */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de pedidos</span>
          <p className="text-2xl font-bold text-slate-800 tracking-tight mt-2">{totalPedidos}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Entregues no período</span>
          <p className="text-2xl font-bold text-emerald-600 tracking-tight mt-2">{totalEntregues}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Por etapa */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-800 text-sm">Pedidos por etapa atual</h3>
          </div>
          <div className="p-5 space-y-3">
            {porEtapa.map(e => {
              const max = Math.max(...porEtapa.map(x => x.quantidade), 1);
              const percentual = (e.quantidade / max) * 100;
              return (
                <div key={e.nome}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${e.cor}`}>{e.nome}</span>
                    <span className="text-sm font-bold text-slate-700">{e.quantidade}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percentual}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Por serviço */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-800 text-sm">Serviços mais pedidos</h3>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {rankingServicos.map(([nome, qtd]) => (
              <div key={nome} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{nome}</span>
                <span className="text-sm font-bold text-slate-800">{qtd}</span>
              </div>
            ))}
            {rankingServicos.length === 0 && (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">Sem dados no período.</div>
            )}
          </div>
        </div>
      </div>

      {/* Por dentista */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800 text-sm">Faturamento por dentista</h3>
        </div>
        <div className="p-5 space-y-3">
          {rankingDentistas.map(([nome, valor]) => {
            const percentual = totalFaturado > 0 ? (valor / totalFaturado) * 100 : 0;
            return (
              <div key={nome}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">{nome}</span>
                  <span className="text-sm font-bold text-slate-800">{formatarMoeda(valor)}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percentual}%` }} />
                </div>
              </div>
            );
          })}
          {rankingDentistas.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-8">Sem dados no período.</div>
          )}
        </div>
      </div>
    </div>
  );
}