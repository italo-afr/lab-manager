import { useState } from 'react';
import { auth, db } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export function Login() {
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);

  function limparMensagens() {
    setErro('');
    setSucesso('');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    limparMensagens();
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

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    limparMensagens();

    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setCarregando(true);
    try {
      const credencial = await createUserWithEmailAndPassword(auth, email, senha);

      // Cria o registro com status "pendente" — só o dono pode aprovar e liberar o acesso de fato
      await setDoc(doc(db, "usuarios", credencial.user.uid), {
        nome: nome.trim(),
        email: email.trim(),
        papel: 'pendente',
        solicitadoEm: new Date().toISOString(),
      });

      // O App.tsx vai detectar o login e mostrar a tela de "aguardando aprovação"
    } catch (error: any) {
      console.error(error);
      setCarregando(false);
      if (error.code === 'auth/email-already-in-use') {
        setErro("Já existe uma conta com este e-mail. Tente entrar.");
      } else if (error.code === 'auth/weak-password') {
        setErro("Senha muito fraca. Use pelo menos 6 caracteres.");
      } else if (error.code === 'auth/invalid-email') {
        setErro("E-mail inválido.");
      } else {
        setErro("Erro ao criar conta. Tente novamente.");
      }
    }
  }

  function alternarModo(novoModo: 'entrar' | 'cadastrar') {
    limparMensagens();
    setModo(novoModo);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm p-8 rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-xl shadow-lg mb-4">
                L
            </div>
            <h1 className="text-2xl font-bold text-slate-900">LabManager</h1>
            <p className="text-slate-500 text-sm mt-1">
                {modo === 'entrar' ? 'Acesso Restrito' : 'Solicitar Acesso'}
            </p>
        </div>

        {/* Abas */}
        <div className="flex bg-slate-100 rounded-lg p-1 mb-6">
            <button
                onClick={() => alternarModo('entrar')}
                className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${modo === 'entrar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
                Entrar
            </button>
            <button
                onClick={() => alternarModo('cadastrar')}
                className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${modo === 'cadastrar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
                Criar Conta
            </button>
        </div>

        {erro && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-lg border border-red-100 text-center mb-5">
                {erro}
            </div>
        )}
        {sucesso && (
            <div className="p-3 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg border border-emerald-100 text-center mb-5">
                {sucesso}
            </div>
        )}

        {modo === 'entrar' ? (
            <form onSubmit={handleLogin} className="space-y-5">
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
        ) : (
            <form onSubmit={handleCadastro} className="space-y-5">
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Seu nome</label>
                    <input
                        type="text"
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                        placeholder="Ex: Maria"
                        required
                    />
                </div>

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
                        placeholder="Mínimo 6 caracteres"
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={carregando}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:bg-slate-400"
                >
                    {carregando ? 'Criando conta...' : 'Solicitar Acesso'}
                </button>

                <p className="text-xs text-slate-400 text-center">
                    Depois de criar a conta, o responsável pelo laboratório precisa aprovar seu acesso.
                </p>
            </form>
        )}
      </div>
    </div>
  );
}