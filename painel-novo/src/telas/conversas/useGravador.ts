import { useEffect, useRef, useState } from 'react';
import type { Anexo } from '@/api/tipos';

const lerComoDataUrl = (b: Blob) => new Promise<string>((ok, erro) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => erro(r.error);
  r.readAsDataURL(b);
});

/** Grava áudio pelo microfone do computador/celular. O WhatsApp recebe como mensagem de voz. */
export function useGravador() {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const inicio = useRef(0);
  const relogio = useRef<number | undefined>(undefined);
  const fim = useRef<((a: Anexo | null) => void) | null>(null);

  const limpar = () => {
    clearInterval(relogio.current);
    rec.current?.stream.getTracks().forEach(t => t.stop());
    rec.current = null;
    setGravando(false); setSegundos(0);
  };
  useEffect(() => () => { fim.current = null; limpar(); }, []);

  async function comecar() {
    setErro(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErro('Este navegador não consegue gravar áudio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      pedacos.current = [];
      r.ondataavailable = e => e.data.size && pedacos.current.push(e.data);
      r.onstop = async () => {
        const mime = (r.mimeType || 'audio/webm').split(';')[0];
        const blob = new Blob(pedacos.current, { type: mime });
        const duracao = Math.max(1, Math.round((Date.now() - inicio.current) / 1000));
        const devolver = fim.current;
        fim.current = null;
        limpar();
        if (!devolver) return;
        devolver({ nome: `audio-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.${mime.split('/')[1]}`, mime, tamanho: blob.size, dados: await lerComoDataUrl(blob), duracaoSeg: duracao, voz: true });
      };
      rec.current = r;
      inicio.current = Date.now();
      r.start();
      setGravando(true);
      relogio.current = window.setInterval(() => setSegundos(Math.floor((Date.now() - inicio.current) / 1000)), 250);
    } catch (e) {
      const nome = (e as DOMException).name;
      setErro(nome === 'NotAllowedError' ? 'O navegador bloqueou o microfone. Libere o acesso no cadeado da barra de endereço.' : nome === 'NotFoundError' ? 'Nenhum microfone encontrado.' : 'Não foi possível usar o microfone.');
      limpar();
    }
  }

  /** para e devolve o áudio gravado */
  const parar = () => new Promise<Anexo | null>(ok => {
    if (!rec.current) return ok(null);
    fim.current = ok;
    rec.current.stop();
  });
  /** para e joga fora */
  const cancelar = () => { fim.current = null; rec.current?.stop(); limpar(); };

  return { gravando, segundos, erro, comecar, parar, cancelar, limparErro: () => setErro(null) };
}

export { lerComoDataUrl };
