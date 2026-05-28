import { useEffect, useRef, useState } from 'react';
import type { IMessage, Client } from '@stomp/stompjs';
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react';
import { createRealtimeClient } from '@/features/chats/api/realtimeClient';
import type { Chat } from '@/features/chats/api/chatTypes';
import type { AuthUser } from '@/features/auth/authTypes';
import type { VoiceSignalRequest, VoiceSignalResponse } from './voiceTypes';
import { useAuthStore } from '@/stores/authStore';

type VoiceCallPanelProps = {
  chat: Chat;
  currentUser: AuthUser;
};

const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302'
    }
  ]
};

export function VoiceCallPanel({ chat, currentUser }: VoiceCallPanelProps) {
  const stompClientRef = useRef<Client | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});

  const [isInCall, setIsInCall] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [participants, setParticipants] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      void leaveCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);

  function publishSignal(signal: VoiceSignalRequest) {
    const client = stompClientRef.current;

    if (!client?.connected) {
      return;
    }

    client.publish({
      destination: `/app/chats/${chat.id}/voice`,
      body: JSON.stringify(signal)
    });
  }

  async function startCall() {
    if (isInCall || isConnecting) {
      return;
    }

    setError(null);
    setIsConnecting(true);

    try {
      const accessToken = useAuthStore.getState().accessToken;

      if (!accessToken) {
        throw new Error('Нет access token');
      }

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      localStreamRef.current = localStream;

      const client = createRealtimeClient(accessToken);
      stompClientRef.current = client;

      client.onConnect = () => {
        client.subscribe(`/topic/chats/${chat.id}/voice`, (frame: IMessage) => {
          const signal = JSON.parse(frame.body) as VoiceSignalResponse;
          void handleVoiceSignal(signal);
        });

        setIsInCall(true);
        setIsConnecting(false);

        publishSignal({
          type: 'JOIN'
        });
      };

      client.onWebSocketClose = () => {
        setIsConnecting(false);
      };

      client.onStompError = () => {
        setError('Не удалось подключиться к голосовому чату.');
        setIsConnecting(false);
      };

      client.activate();
    } catch {
      setError('Не удалось получить доступ к микрофону.');
      setIsConnecting(false);
      stopLocalStream();
    }
  }

  async function leaveCall() {
    if (stompClientRef.current?.connected) {
      publishSignal({
        type: 'LEAVE'
      });
    }

    Object.values(peersRef.current).forEach((peer) => peer.close());
    peersRef.current = {};
    pendingCandidatesRef.current = {};

    stopLocalStream();

    const client = stompClientRef.current;
    stompClientRef.current = null;

    if (client) {
      await client.deactivate();
    }

    setIsInCall(false);
    setIsConnecting(false);
    setIsMuted(false);
    setRemoteStreams({});
    setParticipants({});
  }

  function stopLocalStream() {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }

  async function handleVoiceSignal(signal: VoiceSignalResponse) {
    if (signal.fromUserId === currentUser.id) {
      return;
    }

    if (signal.toUserId && signal.toUserId !== currentUser.id) {
      return;
    }

    if (signal.type === 'JOIN') {
      setParticipants((current) => ({
        ...current,
        [signal.fromUserId]: signal.fromUsername
      }));

      const peer = createPeerConnection(signal.fromUserId, signal.fromUsername);

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      publishSignal({
        type: 'OFFER',
        toUserId: signal.fromUserId,
        sdp: offer.sdp ?? null
      });

      return;
    }

    if (signal.type === 'LEAVE') {
      closePeer(signal.fromUserId);
      return;
    }

    if (signal.type === 'OFFER') {
      const peer = createPeerConnection(signal.fromUserId, signal.fromUsername);

      await peer.setRemoteDescription({
        type: 'offer',
        sdp: signal.sdp ?? ''
      });

      await flushPendingCandidates(signal.fromUserId);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      publishSignal({
        type: 'ANSWER',
        toUserId: signal.fromUserId,
        sdp: answer.sdp ?? null
      });

      return;
    }

    if (signal.type === 'ANSWER') {
      const peer = peersRef.current[signal.fromUserId];

      if (!peer) {
        return;
      }

      await peer.setRemoteDescription({
        type: 'answer',
        sdp: signal.sdp ?? ''
      });

      await flushPendingCandidates(signal.fromUserId);
      return;
    }

    if (signal.type === 'ICE_CANDIDATE' && signal.candidate) {
      await addOrQueueCandidate(signal.fromUserId, signal.candidate);
    }
  }

  function createPeerConnection(userId: string, username: string) {
    const existingPeer = peersRef.current[userId];

    if (existingPeer) {
      return existingPeer;
    }

    const peer = new RTCPeerConnection(rtcConfiguration);
    peersRef.current[userId] = peer;

    setParticipants((current) => ({
      ...current,
      [userId]: username
    }));

    localStreamRef.current?.getTracks().forEach((track) => {
      if (localStreamRef.current) {
        peer.addTrack(track, localStreamRef.current);
      }
    });

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      publishSignal({
        type: 'ICE_CANDIDATE',
        toUserId: userId,
        candidate: event.candidate.toJSON()
      });
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams;

      if (!stream) {
        return;
      }

      setRemoteStreams((current) => ({
        ...current,
        [userId]: stream
      }));
    };

    peer.onconnectionstatechange = () => {
      if (
        peer.connectionState === 'failed' ||
        peer.connectionState === 'closed' ||
        peer.connectionState === 'disconnected'
      ) {
        closePeer(userId);
      }
    };

    return peer;
  }

  async function addOrQueueCandidate(userId: string, candidate: RTCIceCandidateInit) {
    const peer = peersRef.current[userId];

    if (!peer || !peer.remoteDescription) {
      pendingCandidatesRef.current[userId] = [
        ...(pendingCandidatesRef.current[userId] ?? []),
        candidate
      ];
      return;
    }

    await peer.addIceCandidate(candidate);
  }

  async function flushPendingCandidates(userId: string) {
    const peer = peersRef.current[userId];

    if (!peer) {
      return;
    }

    const candidates = pendingCandidatesRef.current[userId] ?? [];

    for (const candidate of candidates) {
      await peer.addIceCandidate(candidate);
    }

    delete pendingCandidatesRef.current[userId];
  }

  function closePeer(userId: string) {
    peersRef.current[userId]?.close();
    delete peersRef.current[userId];
    delete pendingCandidatesRef.current[userId];

    setRemoteStreams((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });

    setParticipants((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
  }

  function toggleMute() {
    const nextMuted = !isMuted;

    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsMuted(nextMuted);
  }

  const participantNames = Object.values(participants);

  return (
    <section className={isInCall ? 'voice-panel active' : 'voice-panel'}>
      <div className="voice-panel-main">
        <div className="voice-icon">
          <Volume2 size={18} />
        </div>

        <div>
          <strong>Голосовой чат</strong>
          <span>
            {isInCall
              ? participantNames.length > 0
                ? `В звонке: ${participantNames.join(', ')}`
                : 'Ты в звонке. Ждём участников.'
              : 'Можно начать голосовой звонок в этом чате.'}
          </span>
        </div>
      </div>

      <div className="voice-actions">
        {isInCall ? (
          <>
            <button
              type="button"
              className={isMuted ? 'voice-button muted' : 'voice-button'}
              onClick={toggleMute}
              title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            >
              {isMuted ? <MicOff size={17} /> : <Mic size={17} />}
            </button>

            <button
              type="button"
              className="voice-button danger"
              onClick={() => void leaveCall()}
              title="Выйти из звонка"
            >
              <PhoneOff size={17} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="voice-start-button"
            disabled={isConnecting}
            onClick={() => void startCall()}
          >
            <Phone size={17} />
            {isConnecting ? 'Подключаемся...' : 'Начать звонок'}
          </button>
        )}
      </div>

      {Object.entries(remoteStreams).map(([userId, stream]) => (
        <RemoteAudio key={userId} stream={stream} />
      ))}

      {error ? <p className="error voice-error">{error}</p> : null}
    </section>
  );
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
}