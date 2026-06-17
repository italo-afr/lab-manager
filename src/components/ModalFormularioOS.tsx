import { createPortal } from 'react-dom';
import { FormularioOS } from './FormularioOS';

interface Props {
  aberto: boolean;
  pedidoEdicao: any;
  aoFechar: () => void;
}

/**
 * Envolve o FormularioOS num modal centralizado, reaproveitando o mesmo padrão visual
 * usado no modal de "Marcar como Pronto" (createPortal direto no body, fundo desfocado).
 */
export function ModalFormularioOS({ aberto, pedidoEdicao, aoFechar }: Props) {
  if (!aberto) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={aoFechar} />

      {/* Painel */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <button
            onClick={aoFechar}
            className="absolute top-4 right-4 z-10 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <FormularioOS pedidoEdicao={pedidoEdicao} aoCancelar={aoFechar} />
        </div>
      </div>
    </div>,
    document.body
  );
}