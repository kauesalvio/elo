'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { Slider } from '@/components/ui/slider';
import {
  ArrowUpRight,
  Check,
  Copy,
  Link,
  LoaderCircle,
  LockKeyhole,
  MonitorUp,
  MonitorOff,
  Plus,
  Settings2,
  ShieldCheck,
  Signal,
  Users,
  Maximize,
  LogOut,
  TriangleAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Shiba } from '@/components/shiba';
import { LivekitLimits } from '@/components/livekit-limits';
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

function Audio({
  track,
  muted,
  volume,
}: {
  track: RemoteAudioTrack;
  muted: boolean;
  volume: number;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);
  useEffect(() => {
    track.setVolume(volume / 100);
  }, [track, volume]);
  return <audio ref={ref} autoPlay muted={muted} />;
}
function ScreenView({
  screen,
  focused,
  onFocus,
  volume,
  onVolume,
}: {
  screen: Screen;
  focused: boolean;
  onFocus: () => void;
  volume: number;
  onVolume: (value: number) => void;
}) {
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
    <section className={`screen-view ${focused ? 'focused' : ''}`}>
      <button className="screen-focus" onClick={onFocus}>
        {focused ? 'Voltar à grade' : 'Destacar tela'}
      </button>
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
      {!screen.local && (
        <Volume
          label={`Som da live de ${screen.name}`}
          value={volume}
          onChange={onVolume}
        />
      )}
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
function Volume({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="volume-control">
      <label>
        {label} <output>{value}%</output>
      </label>
      <Slider
        aria-label={label}
        value={[value]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </div>
  );
}
export default function RapaziadahoraApp() {
  const call = useCall();
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const volume = (id: string) => volumes[id] ?? 100;
  const changeVolume = (id: string, value: number) =>
    setVolumes((v) => ({ ...v, [id]: value }));
  const [muted, setMuted] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [tileSize, setTileSize] = useState(420);
  const focusExists = call.screens.some((s) => s.id === focused);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [admin, setAdmin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roomName, setRoomName] = useState('Sala da galera');
  const [hostKey, setHostKey] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const createLock = useRef(false);
  const [dialog, setDialog] = useState<
    'invite' | 'join' | 'settings' | 'close' | null
  >(null);
  const [paste, setPaste] = useState('');
  const [copied, setCopied] = useState(false);
  const [quality, setQuality] = useState<Quality>('1080-30');
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
          'Não foi possível verificar o serviço de tela. Atualize a página.',
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
            'Abre as configurações de tela do rapaziadahora; não inicia compartilhamento.',
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
      await call.join(next, displayName.trim());
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
    await call.join(invite, displayName.trim());
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
      call.setError('Cole um convite completo do rapaziadahora.');
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
          aria-label="rapaziadahora, início"
          onClick={(e) => {
            if (call.active) e.preventDefault();
          }}
        >
          <Shiba />
          <span>
            rapaziada<span className="brand-accent">hora</span>
            <small>SCREEN SHARING CLUB</small>
          </span>
        </a>
        <div className="space-label">NOSSO CANTINHO NA INTERNET</div>
        <div className="space-card">
          <span className="space-icon">
            <Users size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>A rapaziada</strong>
            <small>Juntos na mesma tela.</small>
          </div>
        </div>
        <div className="rail-divider" />
        <div className="rail-label">
          SALAS <LockKeyhole size={14} aria-hidden="true" />
        </div>
        <div className="room-choice">
          <MonitorUp size={18} aria-hidden="true" />
          <span>{call.active ? call.name : 'Sala de transmissão'}</span>
          <span className="status-dot" />
        </div>
        <p className="rail-note">
          {call.active
            ? `${call.people.length}/12 pessoas conectadas`
            : 'Crie uma sala. Mande o link. Dê o play.'}
        </p>
        {call.active && (
          <button className="rail-action" onClick={() => setDialog('invite')}>
            <Plus size={16} aria-hidden="true" /> Convidar a turma
          </button>
        )}
        <div className="rail-sticker" aria-hidden="true">
          <Shiba />
          <span>
            good screens.
            <br />
            good company.
          </span>
        </div>
        <div className="rail-bottom">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Só quem tem o link.</strong>
            <p>Tela criptografada de ponta a ponta.</p>
          </div>
        </div>
        <div className="rail-version">
          rapaziadahora.online <span>v.02</span>
        </div>
      </aside>
      <main className="main-space">
        <header className="topbar">
          <div>
            <span className="crumb">A rapaziada</span>
            <span className="slash">/</span>
            <span>Compartilhar tela</span>
          </div>
          <div className="header-actions">
            <span className="quiet-tag">
              <span className="status-dot" />
              {call.active ? 'SALA CONECTADA' : 'SÓ POR CONVITE'}
            </span>
            <button
              className="icon-button"
              aria-label="Configurações de tela"
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
                  ? 'VOCÊS ESTÃO NO AR'
                  : 'SEU PONTO DE ENCONTRO, EM PIXELS'}
              </p>
              <h1>
                {call.active ? (
                  call.name
                ) : (
                  <>
                    Dá o play.
                    <br />A turma tá <em>em casa.</em>
                  </>
                )}
              </h1>
              <p className="intro">
                {call.active
                  ? 'Uma tela, várias companhias. Compartilhe o que está rolando.'
                  : 'Um filme, uma partida ou qualquer coisa na sua tela. Junta a rapaziada e compartilha.'}
              </p>
            </div>
            {call.active ? (
              <button
                className="outline-button"
                onClick={() => setDialog('invite')}
              >
                <Plus size={17} aria-hidden="true" /> Convidar
              </button>
            ) : (
              <span className="edition-tag">
                EST. 2026
                <br />
                <strong>NO MIC. JUST PLAY.</strong>
              </span>
            )}
          </div>
          {configured === false && (
            <div className="setup-note">
              <TriangleAlert size={18} aria-hidden="true" />
              <div>
                <strong>Serviço de tela indisponível</strong>
                <p>
                  Não foi possível conectar o serviço. Atualize a página ou
                  tente mais tarde.
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
                    ? 'Na sala'
                    : call.state === 'connecting'
                      ? 'Conectando...'
                      : 'Reconectando...'}
                </span>
                <span>
                  <Users size={15} aria-hidden="true" />
                  {call.people.length}/12
                </span>
                <span>
                  <ShieldCheck size={15} aria-hidden="true" />
                  Ponta a ponta
                </span>
              </div>
              {call.needsAudio && (
                <button
                  className="audio-unlock"
                  onClick={() => void call.startAudio()}
                >
                  <Volume2 size={18} aria-hidden="true" />
                  Clique para ouvir o áudio das telas
                </button>
              )}
              {call.screens.length > 0 ? (
                <>
                  <div className="screen-toolbar">
                    <span>
                      {call.screens.length}{' '}
                      {call.screens.length === 1 ? 'tela no ar' : 'telas no ar'}
                    </span>
                    <Volume
                      label="Tamanho das telas"
                      value={Math.round((tileSize - 280) / 5)}
                      onChange={(v) => setTileSize(280 + v * 5)}
                    />
                  </div>
                  <div
                    className={`screens-grid ${focusExists ? 'has-focus' : ''}`}
                    style={{
                      gridTemplateColumns: focusExists
                        ? '1fr'
                        : `repeat(auto-fit, minmax(min(100%, ${tileSize}px), 1fr))`,
                    }}
                  >
                    {call.screens.map((screen) => (
                      <ScreenView
                        key={screen.id}
                        screen={screen}
                        focused={screen.id === focused}
                        onFocus={() =>
                          setFocused(screen.id === focused ? null : screen.id)
                        }
                        volume={volume('screen:' + screen.owner)}
                        onVolume={(v) =>
                          changeVolume('screen:' + screen.owner, v)
                        }
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-screen">
                  <Shiba />
                  <p className="eyebrow">ESPERANDO O PLAY</p>
                  <h2>A tela é de vocês.</h2>
                  <p>
                    Use “Compartilhar tela” para começar. O navegador vai pedir
                    que você escolha o que mostrar.
                  </p>
                  <button
                    className="outline-button"
                    disabled={call.controlBusy || call.state !== 'connected'}
                    onClick={() => void call.toggleScreen(quality)}
                  >
                    <MonitorUp size={18} aria-hidden="true" />
                    Compartilhar tela
                  </button>
                </div>
              )}
              <div className="participants">
                {call.people.map((person) => (
                  <article key={person.id} className="participant">
                    <span className="person-avatar">
                      {person.name.slice(0, 2).toLocaleUpperCase('pt-BR')}
                    </span>
                    <div className="participant-name">
                      <strong>{person.name}</strong>
                      <small>{person.local ? 'Você' : 'Na sala'}</small>
                    </div>
                    <span
                      className={
                        person.quality === 'poor'
                          ? 'poor-quality'
                          : 'connection-quality'
                      }
                      title={`Conexão: ${person.quality === 'excellent' ? 'ótima' : person.quality === 'good' ? 'boa' : person.quality === 'poor' ? 'fraca' : 'verificando'}`}
                    >
                      <Signal size={16} />
                    </span>
                  </article>
                ))}
              </div>
              <div className="call-controls">
                <button
                  className={`control share-control ${call.sharing ? 'selected' : ''}`}
                  disabled={call.controlBusy || call.state !== 'connected'}
                  aria-pressed={call.sharing}
                  onClick={() => void call.toggleScreen(quality)}
                >
                  {call.sharing ? <MonitorOff /> : <MonitorUp />}
                  <span>
                    {call.sharing ? 'Parar tela' : 'Compartilhar tela'}
                  </span>
                </button>
                <button
                  className={`control ${muted ? 'off' : ''}`}
                  aria-pressed={muted}
                  onClick={() => setMuted(!muted)}
                >
                  {muted ? <VolumeX /> : <Volume2 />}
                  <span>{muted ? 'Telas silenciadas' : 'Som das telas'}</span>
                </button>
                {call.sharing && (
                  <button
                    className={`control ${call.screenAudio ? '' : 'off'}`}
                    disabled={!call.hasScreenAudio || call.controlBusy}
                    aria-pressed={!call.screenAudio}
                    onClick={() => void call.toggleScreenAudio()}
                  >
                    <Volume2 />
                    <span>
                      {!call.hasScreenAudio
                        ? 'Sua tela sem áudio'
                        : call.screenAudio
                          ? 'Mutar sua transmissão'
                          : 'Ativar sua transmissão'}
                    </span>
                  </button>
                )}
                <button
                  className="control leave"
                  onClick={() => void call.leave()}
                >
                  <LogOut />
                  <span>Sair da sala</span>
                </button>
              </div>
              {admin && (
                <div className="host-actions">
                  <button onClick={() => setDialog('close')}>
                    Encerrar sala para todos
                  </button>
                  <span>
                    Convite até{' '}
                    {new Date(call.expiresAt).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              )}
              {call.audio.map(({ track, owner }) => (
                <Audio
                  key={track.sid}
                  track={track}
                  muted={muted}
                  volume={volume('screen:' + owner)}
                />
              ))}
            </>
          ) : (
            <section className="lobby-grid">
              <div className="stage">
                <div className="stage-top">
                  <span>
                    <span className="status-dot" />
                    SHIBA TV
                  </span>
                  <span>CH. 01 / PRIVADO</span>
                </div>
                <div className="stage-center">
                  <div className="pixel-spark spark-one" aria-hidden="true">
                    +
                  </div>
                  <div className="pixel-spark spark-two" aria-hidden="true">
                    +
                  </div>
                  <Shiba className="hero-shiba" />
                  <span className="stage-chip">
                    A MELHOR TELA É A COMPARTILHADA
                  </span>
                  <h2>
                    {invite
                      ? 'Seu lugar tá guardado.'
                      : 'Pode chegar, rapaziada.'}
                  </h2>
                  <p>
                    {invite
                      ? 'Escolha um apelido e entre na sala.'
                      : 'Sua sala privada para assistir junto.'}
                  </p>
                </div>
                <div className="stage-bottom">
                  <span>
                    <MonitorUp size={16} aria-hidden="true" />
                    Até 1080p / 60 fps
                  </span>
                  <span>
                    <LockKeyhole size={16} aria-hidden="true" />
                    Criptografado
                  </span>
                </div>
              </div>
              <form className="entry-panel" onSubmit={invite ? join : create}>
                <div className="panel-kicker">
                  <span className="panel-icon">
                    {invite ? <Link size={18} /> : <Plus size={18} />}
                  </span>{' '}
                  {invite ? 'CONVITE RECEBIDO' : 'COMECE POR AQUI'}
                </div>
                <h2>{invite ? 'Bora entrar?' : 'Abre a sala.'}</h2>
                <p>
                  {invite
                    ? 'A rapaziada está esperando você.'
                    : 'Crie o espaço. O convite é por sua conta.'}
                </p>
                <label htmlFor="name">Seu apelido</label>
                <input
                  id="name"
                  placeholder="Como a turma te chama?"
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
                        <label htmlFor="host">Senha para criar sala</label>
                        <input
                          id="host"
                          type="password"
                          placeholder="Senha do anfitrião"
                          value={hostKey}
                          onChange={(e) => setHostKey(e.target.value)}
                          autoComplete="current-password"
                          maxLength={256}
                          required
                          disabled={busy}
                        />
                      </>
                    )}
                  </>
                )}
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
                    ? 'Preparando a sala...'
                    : invite
                      ? 'Entrar na sala'
                      : 'Criar sala privada'}
                  {busy ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <ArrowUpRight size={18} aria-hidden="true" />
                  )}
                </button>
                <small className="privacy-note">
                  <LockKeyhole size={13} aria-hidden="true" />
                  Sua tela só aparece quando você compartilhar.
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
                    Já tenho um convite{' '}
                    <ArrowUpRight size={14} aria-hidden="true" />
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
          <LivekitLimits participants={call.active ? call.people.length : 0} />
          <footer className="workspace-footer">
            <span>FEITO PRA ASSISTIR JUNTO.</span>
            <span>
              rapaziadahora{' '}
              <span className="footer-pixel" aria-hidden="true">
                ✦
              </span>{' '}
              online
            </span>
          </footer>
        </div>
      </main>
      <Dialog
        open={dialog !== null && dialog !== 'close'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="rapaziada-dialog sm:max-w-lg">
          {dialog === 'invite' && (
            <>
              <DialogTitle>Chama a rapaziada.</DialogTitle>
              <DialogDescription>
                Quem tem o link pode entrar e assistir. Envie só para quem você
                quer na sala. O convite vale por até 24 horas.
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
              <DialogTitle>Bora pra sala.</DialogTitle>
              <DialogDescription>
                Cole o link completo que seu amigo compartilhou.
              </DialogDescription>
              <label htmlFor="paste-invite">Link do convite</label>
              <input
                id="paste-invite"
                type="url"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="https://rapaziadahora.online/#r=..."
                required
              />
              <button className="primary-button">
                Abrir convite <ArrowUpRight size={18} aria-hidden="true" />
              </button>
            </form>
          )}
          {dialog === 'settings' && (
            <>
              <DialogTitle>Ajuste a transmissão.</DialogTitle>
              <DialogDescription>
                Escolha a qualidade da sua tela. O som da aba pode acompanhar a
                transmissão.
              </DialogDescription>
              <label htmlFor="quality">Qualidade do compartilhamento</label>
              <Select
                value={quality}
                onValueChange={(value) => {
                  if (
                    value === '1080-60' ||
                    value === '1080-30' ||
                    value === '720-30'
                  )
                    setQuality(value);
                }}
                disabled={call.sharing}
              >
                <SelectTrigger id="quality" className="setting-select">
                  <SelectValue>
                    {quality === '1080-60'
                      ? '1080p / 60 fps · movimento'
                      : quality === '1080-30'
                        ? '1080p / 30 fps · detalhes'
                        : '720p / 30 fps · economia'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1080-60">
                    1080p / 60 fps · movimento
                  </SelectItem>
                  <SelectItem value="1080-30">
                    1080p / 30 fps · detalhes
                  </SelectItem>
                  <SelectItem value="720-30">
                    720p / 30 fps · economia
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="settings-help">
                Resolução e fluidez dependem da tela, rede e computador.{' '}
                {call.sharing
                  ? 'Pare a transmissão para alterar a qualidade.'
                  : '720p usa menos transferência da cota gratuita.'}
              </p>
              <div className="settings-tip">
                <ShieldCheck size={18} aria-hidden="true" />
                <p>
                  Tela e áudio da tela usam criptografia de ponta a ponta. O
                  aplicativo não grava. Participantes ainda podem gravar por
                  outros meios.
                </p>
              </div>
              <p className="settings-help">
                Para transmitir som, escolha uma aba e marque a opção de
                compartilhar áudio no navegador, quando disponível.
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
        <AlertDialogContent className="rapaziada-dialog">
          <AlertDialogTitle>Encerrar a sala?</AlertDialogTitle>
          <AlertDialogDescription>
            Todos serão desconectados e o convite será desativado. Para assistir
            juntos de novo, crie outra sala.
          </AlertDialogDescription>
          <button
            className="danger-button"
            disabled={closing}
            onClick={() => void close()}
          >
            {closing ? 'Encerrando...' : 'Encerrar sala para todos'}
            <LogOut size={18} aria-hidden="true" />
          </button>
          <button
            className="outline-button"
            disabled={closing}
            onClick={() => setDialog(null)}
          >
            Continuar na sala
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
