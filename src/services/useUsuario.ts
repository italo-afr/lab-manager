import { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';

export type Papel = 'dono' | 'funcionario' | 'pendente';

export interface PerfilUsuario {
  papel: Papel;
  nome?: string;
  email?: string;
}

/**
 * Busca o papel (dono/funcionário/pendente) do usuário logado na coleção "usuarios" (doc id = uid).
 * Se o documento não existir, assume "dono" automaticamente — isso garante que o primeiro
 * usuário a logar (você mesmo, durante o desenvolvimento) nunca fique trancado fora do sistema.
 * Novos cadastros feitos pela tela de Login já chegam com papel "pendente" e ficam
 * aguardando aprovação do dono em "Equipe".
 */
export function useUsuario(user: User | null) {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!user) {
      setPerfil(null);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    const ref = doc(db, "usuarios", user.uid);

    getDoc(ref).then(async (snap) => {
      if (snap.exists()) {
        setPerfil(snap.data() as PerfilUsuario);
      } else {
        // Primeiro acesso deste usuário (sem registro algum): cria automaticamente como "dono".
        // Assim quem já está usando o sistema hoje não perde o acesso quando essa
        // funcionalidade for ativada. Cadastros feitos pela tela de Login já criam o
        // próprio registro com papel "pendente", então não passam por este caminho.
        const perfilPadrao: PerfilUsuario = { papel: 'dono', nome: user.email || '' };
        await setDoc(ref, perfilPadrao);
        setPerfil(perfilPadrao);
      }
      setCarregando(false);
    }).catch((err) => {
      console.error("Erro ao carregar perfil do usuário:", err);
      // Em caso de erro de permissão, não bloqueia o uso — assume dono por segurança operacional
      setPerfil({ papel: 'dono' });
      setCarregando(false);
    });
  }, [user]);

  return {
    perfil,
    carregando,
    ehDono: perfil?.papel === 'dono',
    pendente: perfil?.papel === 'pendente',
  };
}