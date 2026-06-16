import { createClient } from '@supabase/supabase-js';

// Supabase é usado SOMENTE para armazenar as fotos das O.S. (Firebase Storage exigiria plano pago).
// Firestore e Auth continuam 100% no Firebase, sem nenhuma mudança.
const SUPABASE_URL = 'https://zzffsbakqcdxyjdjlnyk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zmaZlGzBcUJCvGTEvq9NUQ_9XOdbP4X';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const BUCKET_FOTOS = 'fotos-os';

/**
 * Envia uma foto (já comprimida) para o bucket do Supabase e retorna a URL pública.
 * O caminho do arquivo é organizado por O.S.: fotos-os/{ordemId}/{timestamp}.jpg
 */
export async function enviarFoto(ordemId: string, arquivo: File): Promise<string> {
  const nomeArquivo = `${ordemId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(nomeArquivo, arquivo, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
    });

  if (error) {
    throw new Error(`Falha ao enviar foto: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(nomeArquivo);
  return data.publicUrl;
}

/** Remove uma foto do bucket a partir da URL pública salva no histórico. */
export async function excluirFoto(urlPublica: string): Promise<void> {
  // Extrai o caminho relativo (ordemId/timestamp.jpg) a partir da URL pública
  const partes = urlPublica.split(`${BUCKET_FOTOS}/`);
  if (partes.length < 2) return;
  const caminho = partes[1];
  await supabase.storage.from(BUCKET_FOTOS).remove([caminho]);
}