'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { Switch } from '@/components/ui/switch';
import {
  AudioLines,
  ArrowUpRight,
  Check,
  Copy,
  Headphones,
  HeadphoneOff,
  Link,
  LoaderCircle,
  LockKeyhole,
  Mic,
  MicOff,
  MonitorUp,
  MonitorOff,
  Plus,
  Settings2,
  ShieldCheck,
  Signal,
  Users,
  PhoneOff,
  Maximize,
  LogOut,
  TriangleAlert,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useCall, type Screen, type Quality } from '@/hooks/use-call';
import { inviteFragment, parseInvite, post, type Invite } from '@/lib/invite';
import { randomSecret } from '@/lib/security';
import type { RemoteAudioTrack } from 'livekit-client';

function Audio({ track, muted }: { track: RemoteAudioTrack; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);
  return <audio ref={ref} autoPlay muted={muted} />;
}
function ScreenView({ screen }: { screen: Screen }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [size, setSize] = useState('');
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    screen.track.attach(element);
    return () => {
      screen.track.detach(element);
    };
  }, [screen.track]);
  return (
    <section className="screen-view">
      <video
        ref={ref}
        autoPlay
        muted
        playsInline
        onResize={() => {
          if (ref.current)
            setSize(`${ref.current.videoWidth} × ${ref.current.videoHeight}`);
        }}
      />
      <div className="screen-caption">
        <span>
          <MonitorUp size={15} />
          {screen.local ? 'Sua tela' : `Tela de ${screen.name}`}{' '}
          <small>{size}</small>
        </span>
        <button
          className="icon-button"
          aria-label="Ver tela em tamanho inteiro"
          onClick={() => {
            void ref.current?.requestFullscreen().catch(() => {});
          }}
        >
          <Maximize size={17} />
        </button>
      </div>
    </section>
  );
}
export default function EloApp() {
  const call = useCall();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [admin, setAdmin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roomName, setRoomName] = useState('Sala da galera');
  const [hostKey, setHostKey] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [startMicrophone, setStartMicrophone] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const createLock = useRef(false);
  const [dialog, setDialog] = useState<
    'invite' | 'join' | 'settings' | 'close' | null
  >(null);
  const [paste, setPaste] = useState('');
  const [copied, setCopied] = useState(false);
  const [quality, setQuality] = useState<Quality>('1080-60');
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const load = () => {
      const parsed = parseInvite(location.hash);
      setInvite(parsed);
      if (location.hash && !parsed)
        call.setError(
          'Este convite está incompleto. Peça o link completo ao anfitrião.',
        );
      try {
        setAdmin(
          parsed ? (sessionStorage.getItem(`elo-host-${parsed.id}`) ?? '') : '',
        );
      } catch {
        setAdmin('');
      }
    };
    load();
    window.addEventListener('hashchange', load);
    fetch('/api/status', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json() as Promise<{
          configured: boolean;
          hostAuthorized: boolean;
        }>;
      })
      .then((data) => {
        setConfigured(data.configured);
        setIsHost(data.hostAuthorized);
      })
      .catch(() => {
        setConfigured(false);
        call.setError(
          'Não foi possível verificar o serviço de chamadas. Atualize a página.',
        );
      });
    try {
      setDisplayName(localStorage.getItem('elo-name') ?? '');
    } catch {
      /* Saving a nickname is optional. */
    }
    return () => window.removeEventListener('hashchange', load);
  }, []);
  useEffect(() => {
    // Media capture stays behind an explicit user gesture. This tool only stages settings.
    type Context = {
      registerTool: (
        tool: {
          name: string;
          description: string;
          inputSchema: object;
          annotations: object;
          execute: (input: unknown) => unknown;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool(
        {
          name: 'open_call_settings',
          description:
            'Abre as configurações de áudio e tela do Elo; não liga o microfone nem compartilha a tela.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            if (
              !input ||
              typeof input !== 'object' ||
              Array.isArray(input) ||
              Object.keys(input).length
            )
              throw new Error('Envie um objeto vazio.');
            flushSync(() => setDialog('settings'));
            return { opened: 'settings' };
          },
        },
        { signal: lifecycle.signal },
      );
    };
    void register().catch(() => {});
    return () => lifecycle.abort();
  }, []);
  function rememberName() {
    try {
      localStorage.setItem('elo-name', displayName.trim());
    } catch {
      /* Optional preference. */
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (createLock.current) return;
    createLock.current = true;
    setCreating(true);
    call.setError('');
    setNotice('');
    try {
      const result = await post<{
        id: string;
        name: string;
        invite: string;
        admin: string;
      }>('/api/rooms', { name: roomName, hostKey });
      const next = {
        id: result.id,
        invite: result.invite,
        key: randomSecret(),
      };
      setInvite(next);
      setAdmin(result.admin);
      setHostKey('');
      setIsHost(true);
      history.replaceState(null, '', location.pathname + inviteFragment(next));
      try {
        sessionStorage.setItem(`elo-host-${result.id}`, result.admin);
      } catch {
        /* Host control remains available for this session in memory. */
      }
      rememberName();
      await call.join(next, displayName.trim(), startMicrophone);
    } catch (error) {
      call.setError(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar a sala.',
      );
    } finally {
      createLock.current = false;
      setCreating(false);
    }
  }
  async function join(event: FormEvent) {
    event.preventDefault();
    if (!invite) return;
    rememberName();
    setNotice('');
    await call.join(invite, displayName.trim(), startMicrophone);
  }
  function reset() {
    setInvite(null);
    setAdmin('');
    history.replaceState(null, '', location.pathname);
    call.setError('');
    setNotice('');
  }
  function importInvite(event: FormEvent) {
    event.preventDefault();
    try {
      const url = new URL(paste);
      const value = parseInvite(url.hash);
      if (url.origin !== location.origin || !value) throw Error();
      setInvite(value);
      setAdmin('');
      history.replaceState(null, '', location.pathname + inviteFragment(value));
      setDialog(null);
      setPaste('');
      call.setError('');
    } catch {
      call.setError('Cole um convite completo deste Elo.');
    }
  }
  function link() {
    return invite
      ? location.origin + location.pathname + inviteFragment(invite)
      : '';
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      call.setError(
        'Não foi possível copiar automaticamente. Selecione o link e copie.',
      );
    }
  }
  async function close() {
    if (!invite || !admin) return;
    setClosing(true);
    try {
      await post('/api/close', { id: invite.id, admin });
      try {
        sessionStorage.removeItem(`elo-host-${invite.id}`);
      } catch {}
      await call.leave();
      reset();
      setDialog(null);
      setNotice('Sala encerrada. O convite foi desativado.');
    } catch (error) {
      call.setError(
        error instanceof Error
          ? error.message
          : 'Não foi possível encerrar. Tente novamente.',
      );
    } finally {
      setClosing(false);
    }
  }
  const busy = creating || call.busy;
  return (
    <div className="app-shell">
      <aside className="rail">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            if (call.active) e.preventDefault();
          }}
          aria-label="Elo, início"
        >
          <AudioLines />
          <span>
            elo<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="space-label">SEU ESPAÇO</div>
        <div className="space-card">
          <span className="space-icon">
            <Users size={21} />
          </span>
          <div>
            <strong>Entre amigos</strong>
            <small>Um lugar só de vocês</small>
          </div>
        </div>
        <div className="rail-divider" />
        <div className="rail-label">
          SALA PRIVADA <LockKeyhole size={14} />
        </div>
        <div className="room-choice">
          <Headphones size={19} />
          <span>{call.active ? call.name : 'Sua próxima conversa'}</span>
          <span className="status-dot" />
        </div>
        <p className="rail-note">
          {call.active
            ? `${call.people.length} ${call.people.length === 1 ? 'pessoa conectada' : 'pessoas conectadas'}`
            : 'Crie uma sala e envie o convite para quem você quer por perto.'}
        </p>
        {call.active && (
          <button className="rail-action" onClick={() => setDialog('invite')}>
            <Link size={16} />
            Convidar amigos
          </button>
        )}
        <div className="rail-bottom">
          <ShieldCheck size={22} />
          <div>
            <strong>Privacidade por padrão</strong>
            <p>
              Sem salas públicas.
              <br />
              Sem gravação no aplicativo.
            </p>
          </div>
        </div>
      </aside>
      <main className="main-space">
        <header className="topbar">
          <div>
            <span className="crumb">Entre amigos</span>
            <span className="slash">/</span>
            <span>Sala de voz</span>
          </div>
          <div className="header-actions">
            <span className="quiet-tag">
              <LockKeyhole size={14} />
              {call.active ? 'Ponta a ponta' : 'Só por convite'}
            </span>
            <button
              className="icon-button"
              aria-label="Configurações de áudio e tela"
              onClick={() => setDialog('settings')}
            >
              <Settings2 size={19} />
            </button>
          </div>
        </header>
        <div className="workspace">
          <div className="title-row">
            <div>
              <p className="eyebrow">
                {call.active
                  ? 'BOM TER VOCÊS AQUI.'
                  : 'BOM PAPO. ZERO DISTÂNCIA.'}
              </p>
              <h1>
                {call.active ? call.name : 'Sua turma, por perto'}
                <span>.</span>
              </h1>
              <p className="intro">
                {call.active
                  ? 'O espaço é de vocês. A conversa também.'
                  : 'Entre, puxe uma cadeira e fique à vontade.'}
              </p>
            </div>
            {call.active ? (
              <button
                className="outline-button"
                onClick={() => setDialog('invite')}
              >
                <Plus size={17} />
                Convidar
              </button>
            ) : (
              <div className="wordmark-symbol">
                <AudioLines size={34} />
              </div>
            )}
          </div>
          {configured === false && (
            <div className="setup-note">
              <TriangleAlert size={18} />
              <div>
                <strong>Falta conectar o serviço de chamadas</strong>
                <p>
                  O responsável pelo Elo precisa concluir essa configuração
                  antes da primeira conversa.
                </p>
              </div>
            </div>
          )}
          {call.error && (
            <div className="error-note" role="alert">
              {call.error}
              <button
                aria-label="Fechar aviso"
                onClick={() => call.setError('')}
              >
                ×
              </button>
            </div>
          )}
          {notice && (
            <p className="success-note" role="status">
              {notice}
            </p>
          )}
          {call.active ? (
            <>
              <div className="connection-strip" role="status">
                <span>
                  <span className="status-dot" />
                  {call.state === 'connected'
                    ? 'Na conversa'
                    : call.state === 'connecting'
                      ? 'Conectando…'
                      : 'Reconectando…'}
                </span>
                <span>
                  <Users size={15} />
                  {call.people.length}/12
                </span>
                <span>
                  <ShieldCheck size={15} />
                  Mídia criptografada
                </span>
              </div>
              {call.needsAudio && (
                <button
                  className="audio-unlock"
                  onClick={() => void call.startAudio()}
                >
                  <Headphones size={18} />
                  Clique para ouvir a conversa
                </button>
              )}
              {call.screens.length > 0 && (
                <div className="screens-grid">
                  {call.screens.map((screen) => (
                    <ScreenView key={screen.id} screen={screen} />
                  ))}
                </div>
              )}
              <div
                className={`participants ${call.screens.length ? 'compact' : ''}`}
              >
                {call.people.map((person) => (
                  <article
                    key={person.id}
                    className={`participant ${person.speaking ? 'speaking' : ''}`}
                  >
                    <div className="participant-top">
                      <span>
                        {person.local
                          ? 'VOCÊ'
                          : person.speaking
                            ? 'FALANDO'
                            : 'NA SALA'}
                      </span>
                      <span
                        title={`Conexão: ${person.quality === 'excellent' ? 'ótima' : person.quality === 'good' ? 'boa' : person.quality === 'poor' ? 'fraca' : 'verificando'}`}
                        className={
                          person.quality === 'poor' ? 'poor-quality' : ''
                        }
                      >
                        <Signal size={16} />
                      </span>
                    </div>
                    <div className="person-avatar">
                      {person.name.slice(0, 2).toLocaleUpperCase('pt-BR')}
                    </div>
                    <div className="participant-name">
                      <span>{person.name}</span>
                      {person.mic ? <Mic size={16} /> : <MicOff size={16} />}
                    </div>
                  </article>
                ))}
              </div>
              {call.people.length === 1 && (
                <div className="waiting-note">
                  <Users size={19} />
                  <span>O lugar da turma está reservado.</span>
                  <button onClick={() => setDialog('invite')}>
                    Compartilhar convite <ArrowUpRight size={15} />
                  </button>
                </div>
              )}
              <div className="call-controls">
                <button
                  className={`control ${call.mic ? '' : 'off'}`}
                  disabled={call.controlBusy || call.state !== 'connected'}
                  onClick={() => void call.toggleMic()}
                  aria-pressed={!call.mic}
                  aria-label={
                    call.mic ? 'Desligar microfone' : 'Ligar microfone'
                  }
                >
                  {call.mic ? <Mic /> : <MicOff />}
                  <span>{call.mic ? 'Microfone' : 'Sem microfone'}</span>
                </button>
                <button
                  className={`control ${call.deafened ? 'off' : ''}`}
                  aria-pressed={call.deafened}
                  aria-label={
                    call.deafened
                      ? 'Ouvir conversa'
                      : 'Silenciar áudio recebido'
                  }
                  onClick={() => call.setDeafened(!call.deafened)}
                >
                  {call.deafened ? <HeadphoneOff /> : <Headphones />}
                  <span>{call.deafened ? 'Som desligado' : 'Áudio'}</span>
                </button>
                <span className="control-divider" />
                <button
                  className={`control ${call.sharing ? 'selected' : ''}`}
                  disabled={call.controlBusy || call.state !== 'connected'}
                  aria-pressed={call.sharing}
                  onClick={() => void call.toggleScreen(quality)}
                >
                  {call.sharing ? <MonitorOff /> : <MonitorUp />}
                  <span>{call.sharing ? 'Parar tela' : 'Compartilhar'}</span>
                </button>
                <button
                  className="control leave"
                  onClick={() => void call.leave()}
                >
                  <PhoneOff />
                  <span>Sair</span>
                </button>
              </div>
              {admin && (
                <div className="host-actions">
                  <button onClick={() => setDialog('close')}>
                    Encerrar sala para todos
                  </button>
                  <span>
                    Convite válido até{' '}
                    {new Date(call.expiresAt).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              )}
              {call.audio.map((track) => (
                <Audio key={track.sid} track={track} muted={call.deafened} />
              ))}
            </>
          ) : (
            <section className="lobby-grid">
              <div className="stage">
                <div className="stage-top">
                  <span>
                    <span className="status-dot" />
                    ANTES DE ENTRAR
                  </span>
                  <span>
                    <Headphones size={15} />
                    Sala de voz
                  </span>
                </div>
                <div className="stage-center">
                  <div className="avatar-orbit">
                    <div className="big-avatar">
                      <Headphones size={48} strokeWidth={1.4} />
                    </div>
                  </div>
                  <h2>
                    {invite
                      ? 'Tem um lugar para você.'
                      : 'O papo começa com você.'}
                  </h2>
                  <p>Seu microfone só será ligado quando você entrar.</p>
                </div>
                <div className="stage-bottom">
                  <span>
                    <Mic size={16} />
                    Voz nítida
                  </span>
                  <span>
                    <MonitorUp size={16} />
                    Tela em alta definição
                  </span>
                </div>
              </div>
              <form className="entry-panel" onSubmit={invite ? join : create}>
                <div className="panel-icon">
                  {invite ? <Link size={23} /> : <Plus size={23} />}
                </div>
                <h2>
                  {invite ? 'Você foi convidado.' : 'Vamos reunir a turma?'}
                </h2>
                <p>
                  {invite
                    ? 'Escolha seu apelido e entre na conversa.'
                    : 'Crie uma sala privada e compartilhe o link com seus amigos.'}
                </p>
                <label htmlFor="name">Como podemos te chamar?</label>
                <input
                  id="name"
                  placeholder="Seu nome ou apelido"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={32}
                  required
                  autoComplete="nickname"
                  disabled={busy}
                />
                {!invite && (
                  <>
                    <label htmlFor="room">Nome da sala</label>
                    <input
                      id="room"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      maxLength={48}
                      required
                      disabled={busy}
                    />
                    {!isHost && (
                      <>
                        <label htmlFor="host">Chave do anfitrião</label>
                        <input
                          id="host"
                          type="password"
                          placeholder="Chave para criar salas"
                          value={hostKey}
                          onChange={(e) => setHostKey(e.target.value)}
                          autoComplete="off"
                          maxLength={256}
                          required
                          disabled={busy}
                        />
                      </>
                    )}
                  </>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    marginTop: 20,
                  }}
                >
                  <label htmlFor="start-microphone" style={{ margin: 0 }}>
                    Entrar com microfone
                  </label>
                  <Switch
                    id="start-microphone"
                    checked={startMicrophone}
                    onCheckedChange={setStartMicrophone}
                    disabled={busy}
                  />
                </div>
                <button
                  className="primary-button"
                  disabled={
                    busy ||
                    configured !== true ||
                    !displayName.trim() ||
                    (!invite && (!roomName.trim() || (!isHost && !hostKey)))
                  }
                >
                  {busy
                    ? 'Preparando sua sala…'
                    : invite
                      ? 'Entrar na conversa'
                      : 'Criar sala privada'}{' '}
                  {busy ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}
                </button>
                <small className="privacy-note">
                  <LockKeyhole size={14} />
                  Quem tem o convite pode entrar.
                </small>
                {invite ? (
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={reset}
                  >
                    Criar outra sala
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setDialog('join')}
                  >
                    Já tenho um convite
                  </button>
                )}
                {invite && admin && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => setDialog('close')}
                  >
                    Encerrar esta sala
                  </button>
                )}
              </form>
            </section>
          )}
          {!call.active && (
            <div className="details-row">
              <div>
                <ShieldCheck />
                <span>
                  <strong>Conversas protegidas</strong>
                  <small>Criptografia de ponta a ponta</small>
                </span>
              </div>
              <div>
                <AudioLines />
                <span>
                  <strong>Mais voz, menos ruído</strong>
                  <small>Cancelamento de eco e redução de ruído</small>
                </span>
              </div>
              <div>
                <MonitorUp />
                <span>
                  <strong>Mostre o que está rolando</strong>
                  <small>Tela até 1080p · 60 fps</small>
                </span>
              </div>
            </div>
          )}
          <footer className="workspace-footer">
            <span>MENOS DISTRAÇÃO. MAIS CONEXÃO.</span>
            <span>Feito para estar junto.</span>
          </footer>
        </div>
      </main>
      <Dialog
        open={dialog !== null && dialog !== 'close'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="elo-dialog sm:max-w-lg">
          {dialog === 'invite' && (
            <>
              <DialogTitle>Chame quem faz parte.</DialogTitle>
              <DialogDescription>
                O convite dá acesso à sala e à chave da conversa. Envie apenas
                para seus amigos. Válido por até 24 horas.
              </DialogDescription>
              <label htmlFor="invite-link">Convite privado</label>
              <input
                id="invite-link"
                readOnly
                value={invite ? link() : ''}
                onFocus={(e) => e.target.select()}
              />
              <button className="primary-button" onClick={() => void copy()}>
                {copied ? 'Convite copiado' : 'Copiar convite'}
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </>
          )}
          {dialog === 'join' && (
            <form onSubmit={importInvite}>
              <DialogTitle>Seu lugar na conversa.</DialogTitle>
              <DialogDescription>
                Cole o convite que seu amigo compartilhou com você.
              </DialogDescription>
              <label htmlFor="paste-invite">Link do convite</label>
              <input
                id="paste-invite"
                type="url"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="https://…/#r=…"
                required
              />
              <button className="primary-button">
                Abrir convite <ArrowUpRight size={18} />
              </button>
            </form>
          )}
          {dialog === 'settings' && (
            <>
              <DialogTitle>Do seu jeito.</DialogTitle>
              <DialogDescription>
                Ajuste o som e a qualidade da tela.
              </DialogDescription>
              <label htmlFor="quality">Qualidade do compartilhamento</label>
              <Select
                value={quality}
                onValueChange={(value) => {
                  if (value) setQuality(value as Quality);
                }}
                disabled={call.sharing}
              >
                <SelectTrigger id="quality" className="setting-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1080-60">
                    1080p · 60 fps — movimento
                  </SelectItem>
                  <SelectItem value="1080-30">
                    1080p · 30 fps — detalhes
                  </SelectItem>
                  <SelectItem value="720-30">
                    720p · 30 fps — conexão limitada
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="settings-help">
                A resolução e a fluidez dependem da tela escolhida, da conexão e
                do computador.{' '}
                {call.sharing
                  ? 'Pare o compartilhamento para alterar a qualidade.'
                  : ''}
              </p>
              <label htmlFor="microphone-device">Microfone</label>
              {call.devices.length ? (
                <Select
                  value={call.deviceId}
                  onValueChange={(value) => {
                    if (value) void call.changeDevice(value);
                  }}
                  disabled={call.controlBusy}
                >
                  <SelectTrigger
                    id="microphone-device"
                    className="setting-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {!call.devices.some((d) => d.deviceId === 'default') && (
                      <SelectItem value="default">Padrão do sistema</SelectItem>
                    )}
                    {call.devices.map((device, index) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microfone ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="settings-help">
                  Os microfones aparecem depois de você permitir o acesso ao
                  entrar na sala.
                </p>
              )}
              <div className="settings-tip">
                <ShieldCheck size={18} />
                <p>
                  Voz e tela usam criptografia de ponta a ponta. Não há gravação
                  no Elo. Uma pessoa ainda pode gravar por outros meios.
                </p>
              </div>
              <p className="settings-help">
                Para transmitir áudio da tela, escolha uma aba e marque a opção
                de compartilhar áudio, quando disponível.
              </p>
            </>
          )}
          {call.error && (
            <p className="dialog-error" role="alert">
              {call.error}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={dialog === 'close'}
        onOpenChange={(open) => {
          if (!open && !closing) setDialog(null);
        }}
      >
        <AlertDialogContent className="elo-dialog">
          <AlertDialogTitle>Encerrar a conversa?</AlertDialogTitle>
          <AlertDialogDescription>
            Todos serão desconectados e este convite será desativado. Para
            conversar de novo, crie outra sala.
          </AlertDialogDescription>
          <button
            className="danger-button"
            disabled={closing}
            onClick={() => void close()}
          >
            {closing ? 'Encerrando…' : 'Encerrar sala para todos'}
            <LogOut size={18} />
          </button>
          <button
            className="outline-button"
            disabled={closing}
            onClick={() => setDialog(null)}
          >
            Continuar a conversa
          </button>
          {call.error && (
            <p className="dialog-error" role="alert">
              {call.error}
            </p>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
