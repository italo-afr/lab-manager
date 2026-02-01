import { useState } from 'react';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      await signInWithEmailAndPassword(auth, email, senha);
      // O App.tsx vai detectar a mudança de usuário automaticamente
    } catch (error: any) {
      console.error(error);
      setCarregando(false);
      if (error.code === 'auth/invalid-credential') {
        setErro("E-mail ou senha incorretos.");
      } else if (error.code === 'auth/too-many-requests') {
        setErro("Muitas tentativas falhas. Tente mais tarde.");
      } else {
        setErro("Erro ao acessar. Verifique seus dados.");
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm p-8 rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-xl shadow-lg mb-4">
                L
            </div>
            <h1 className="text-2xl font-bold text-slate-900">LabManager</h1>
            <p className="text-slate-500 text-sm mt-1">Acesso Restrito</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
            {erro && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-lg border border-red-100 text-center">
                    {erro}
                </div>
            )}

            <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">E-mail</label>
                <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                    placeholder="seu@email.com"
                    required
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Senha</label>
                <input 
                    type="password" 
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                    placeholder="******"
                    required
                />
            </div>

            <button 
                type="submit"
                disabled={carregando}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:bg-slate-400"
            >
                {carregando ? 'Entrando...' : 'Acessar Sistema'}
            </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
                Esqueceu a senha? Contate o suporte.
            </p>
        </div>
      </div>
    </div>
  );
}