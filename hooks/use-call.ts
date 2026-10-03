'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioPresets,
  ConnectionState,
  ExternalE2EEKeyProvider,
  isE2EESupported,
  Room,
  RoomEvent,
  Track,
  type Participant,
  RemoteAudioTrack,
  RemoteVideoTrack,
  LocalVideoTrack,
} from 'livekit-client';
import e2eeWorkerUrl from 'livekit-client/e2ee-worker?url';
import { post, type Invite } from '@/lib/invite';

export type Person = {
  id: string;
  name: string;
  local: boolean;
  quality: string;
};
export type Screen = {
  id: string;
  owner: string;
  name: string;
  local: boolean;
  track: LocalVideoTrack | RemoteVideoTrack;
};
export type ReceivedAudio = { track: RemoteAudioTrack; owner: string };
export type Quality = '1080-60' | '1080-30' | '720-30';
export function useCall() {
  const roomRef = useRef<Room | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const generation = useRef(0);
  const joinLock = useRef(false);
  const controlLock = useRef(false);
  const [state, setState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [people, setPeople] = useState<Person[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [audio, setAudio] = useState<ReceivedAudio[]>([]);
  const [screenAudio, setScreenAudio] = useState(false);
  const [hasScreenAudio, setHasScreenAudio] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [controlBusy, setControlBusy] = useState(false);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [needsAudio, setNeedsAudio] = useState(false);
  const active = state !== ConnectionState.Disconnected;
  const leave = useCallback(async () => {
    generation.current++;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.removeAllListeners();
      await room.disconnect(true);
    }
    workerRef.current?.terminate();
    workerRef.current = null;
    setState(ConnectionState.Disconnected);
    setPeople([]);
    setScreens([]);
    setAudio([]);
    setSharing(false);
    setBusy(false);
    setNeedsAudio(false);
    setExpiresAt(0);
    setName('');
  }, []);
  useEffect(
    () => () => {
      generation.current++;
      roomRef.current?.removeAllListeners();
      void roomRef.current?.disconnect(true);
      workerRef.current?.terminate();
    },
    [],
  );
  useEffect(() => {
    if (!active || !expiresAt) return;
    const id = setTimeout(
      () => {
        void leave();
        setError('O convite expirou. Crie uma nova sala para continuar.');
      },
      Math.max(0, expiresAt - Date.now()),
    );
    return () => clearTimeout(id);
  }, [active, expiresAt, leave]);
  const join = useCallback(
    async (invite: Invite, displayName: string) => {
      if (roomRef.current || joinLock.current) return;
      joinLock.current = true;
      setError('');
      setBusy(true);
      const attempt = ++generation.current;
      let room: Room | undefined;
      let worker: Worker | undefined;
      try {
        if (!window.isSecureContext || !navigator.mediaDevices)
          throw new Error(
            'Abra o rapaziadahora em uma conexão HTTPS para compartilhar tela.',
          );
        if (!isE2EESupported())
          throw new Error(
            'Este navegador não oferece a criptografia necessária. Abra em uma versão atual do Chrome ou Edge.',
          );
        const result = await post<{
          token: string;
          url: string;
          name: string;
          expiresAt: number;
        }>('/api/join', {
          id: invite.id,
          invite: invite.invite,
          name: displayName,
        });
        if (attempt !== generation.current) return;
        const provider = new ExternalE2EEKeyProvider();
        // Keep the SDK worker unchanged: SSR defines such as `typeof window`
        // must not be applied inside the dedicated worker context.
        worker = new Worker(e2eeWorkerUrl);
        workerRef.current = worker;
        room = new Room({
          encryption: { keyProvider: provider, worker },
          adaptiveStream: true,
          dynacast: true,
          disconnectOnPageLeave: true,
          publishDefaults: {
            audioPreset: AudioPresets.musicHighQuality,
            videoCodec: 'vp8',
            dtx: true,
            red: true,
            simulcast: true,
          },
        });
        const currentRoom = room;
        roomRef.current = room;
        const sync = () => {
          if (roomRef.current !== currentRoom) return;
          const participants: Participant[] = [
            currentRoom.localParticipant,
            ...currentRoom.remoteParticipants.values(),
          ];
          setPeople(
            participants.map((p) => ({
              id: p.identity,
              name: p.name ?? 'Amigo',
              local: p === currentRoom.localParticipant,
              quality: p.connectionQuality,
            })),
          );
          const screenTracks: Screen[] = [];
          const audioTracks: ReceivedAudio[] = [];
          for (const p of participants)
            for (const pub of p.trackPublications.values()) {
              if (
                pub.source === Track.Source.ScreenShare &&
                pub.track &&
                (pub.track instanceof LocalVideoTrack ||
                  pub.track instanceof RemoteVideoTrack)
              )
                screenTracks.push({
                  id: pub.trackSid,
                  owner: p.identity,
                  name: p.name ?? 'Amigo',
                  local: p === currentRoom.localParticipant,
                  track: pub.track,
                });
              if (
                p !== currentRoom.localParticipant &&
                pub.source === Track.Source.ScreenShareAudio &&
                pub.track instanceof RemoteAudioTrack
              )
                audioTracks.push({ track: pub.track, owner: p.identity });
            }
          setScreens(screenTracks);
          setAudio(audioTracks);
          setSharing(currentRoom.localParticipant.isScreenShareEnabled);
          const liveAudio = currentRoom.localParticipant.getTrackPublication(
            Track.Source.ScreenShareAudio,
          );
          setHasScreenAudio(!!liveAudio?.track);
          setScreenAudio(!!liveAudio?.track && !liveAudio.isMuted);
        };
        for (const event of [
          RoomEvent.ParticipantConnected,
          RoomEvent.ParticipantDisconnected,
          RoomEvent.TrackSubscribed,
          RoomEvent.TrackUnsubscribed,
          RoomEvent.TrackMuted,
          RoomEvent.TrackUnmuted,
          RoomEvent.LocalTrackPublished,
          RoomEvent.LocalTrackUnpublished,
          RoomEvent.ConnectionQualityChanged,
        ])
          room.on(event, sync);
        room.on(RoomEvent.ConnectionStateChanged, (value) => {
          if (roomRef.current === currentRoom) setState(value);
        });
        room.on(RoomEvent.AudioPlaybackStatusChanged, () =>
          setNeedsAudio(!currentRoom.canPlaybackAudio),
        );
        room.on(RoomEvent.TrackSubscriptionFailed, () =>
          setError(
            'Não foi possível receber uma transmissão. Saia e entre novamente.',
          ),
        );
        room.on(RoomEvent.EncryptionError, () => {
          setError(
            'Falha de criptografia. A sala foi desconectada para proteger sua transmissão.',
          );
          void leave();
        });
        room.on(RoomEvent.Disconnected, () => {
          if (roomRef.current === currentRoom) {
            void leave();
            setError('Você saiu da sala ou a sala foi encerrada.');
          }
        });
        await provider.setKey(invite.key);
        await room.setE2EEEnabled(true);
        await room.connect(result.url, result.token);
        if (attempt !== generation.current) {
          await room.disconnect(true);
          worker.terminate();
          return;
        }
        setName(result.name);
        setExpiresAt(result.expiresAt);
        sync();
        try {
          await room.startAudio();
        } catch {
          setNeedsAudio(true);
        }
        sync();
      } catch (err) {
        if (room) {
          room.removeAllListeners();
          await room.disconnect(true);
        }
        worker?.terminate();
        if (attempt === generation.current) {
          roomRef.current = null;
          workerRef.current = null;
          setState(ConnectionState.Disconnected);
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível entrar na sala.',
          );
        }
      } finally {
        joinLock.current = false;
        if (attempt === generation.current) setBusy(false);
      }
    },
    [leave],
  );
  async function action(fn: (room: Room) => Promise<unknown>) {
    const room = roomRef.current;
    if (!room || controlLock.current) return;
    controlLock.current = true;
    setControlBusy(true);
    setError('');
    try {
      await fn(room);
      if (roomRef.current !== room) await room.disconnect(true);
    } catch (err) {
      if (roomRef.current === room)
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível alterar este controle.',
        );
    } finally {
      controlLock.current = false;
      setControlBusy(false);
    }
  }
  const toggleScreenAudio = () =>
    action(async (room) => {
      const track = room.localParticipant.getTrackPublication(
        Track.Source.ScreenShareAudio,
      )?.track;
      if (track) {
        if (track.isMuted) await track.unmute();
        else await track.mute();
        setScreenAudio(!track.isMuted);
      }
    });
  const toggleScreen = (quality: Quality) =>
    action(async (room) => {
      if (room.localParticipant.isScreenShareEnabled) {
        await room.localParticipant.setScreenShareEnabled(false);
        return;
      }
      if (!navigator.mediaDevices.getDisplayMedia)
        throw new Error(
          'Este navegador não permite compartilhar a tela. Use o Chrome ou Edge no computador.',
        );
      const width = quality === '720-30' ? 1280 : 1920,
        height = quality === '720-30' ? 720 : 1080,
        frameRate = quality === '1080-60' ? 60 : 30;
      try {
        await room.localParticipant.setScreenShareEnabled(
          true,
          {
            audio: true,
            resolution: { width, height, frameRate },
            contentHint: frameRate === 60 ? 'motion' : 'detail',
          },
          {
            screenShareEncoding: {
              maxBitrate:
                frameRate === 60
                  ? 8_000_000
                  : quality === '720-30'
                    ? 2_500_000
                    : 5_000_000,
              maxFramerate: frameRate,
            },
            videoCodec: 'vp8',
            simulcast: true,
          },
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'NotAllowedError')
          return;
        throw err;
      }
    });
  const startAudio = () =>
    action(async (room) => {
      await room.startAudio();
      setNeedsAudio(!room.canPlaybackAudio);
    });
  return {
    state,
    people,
    screens,
    audio,
    sharing,
    screenAudio,
    hasScreenAudio,
    toggleScreenAudio,
    error,
    setError,
    busy,
    controlBusy,
    active,
    name,
    expiresAt,
    needsAudio,
    join,
    leave,
    toggleScreen,
    startAudio,
  };
}
