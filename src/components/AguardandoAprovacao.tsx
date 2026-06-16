import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

interface Props {
  nome?: string;
}

export function AguardandoAprovacao({ nome }: Props) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm p-8 rounded-2xl shadow-2xl text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-5">
          <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-2">
            {nome ? `Olá, ${nome}!` : 'Conta criada!'}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
            Sua conta foi criada com sucesso. Agora é só esperar o responsável pelo laboratório aprovar seu acesso ao sistema.
        </p>

        <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500 mb-6">
            Avise o dono do laboratório para acessar a aba <strong>"Equipe"</strong> e liberar sua conta.
        </div>

        <button
            onClick={() => signOut(auth)}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
            Sair
        </button>
      </div>
    </div>
  );
}