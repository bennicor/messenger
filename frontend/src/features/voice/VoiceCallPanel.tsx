import { useEffect, useRef, useState } from 'react';
import type { IMessage, Client } from '@stomp/stompjs';
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react';
import { createRealtimeClient } from '@/features/chats/api/realtimeClient';
import type { Chat } from '@/features/chats/api/chatTypes';
import type { User } from '@/features/auth/authTypes';
import type { VoiceSignalRequest, VoiceSignalResponse } from './voiceTypes';
import { useAuthStore } from '@/stores/authStore';

type VoiceCallPanelProps = {
  chat: Chat;
  currentUser: User;
  autoStart?: boolean;
  onAutoStartConsumed?: () => void;
};

const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302'
    }
  ]
};

export function VoiceCallPanel({
  chat,
  currentUser,
  autoStart = false,
  onAutoStartConsumed
}: VoiceCallPanelProps) {
  const stompClientRef = useRef<Client | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});

  const soloLeaveTimerRef = useRef<number | null>(null);
  const incomingCallTimeoutRef = useRef<number | null>(null);

  const activeCallUsersRef = useRef<Record<string, string>>({});
  const participantsRef = useRef<Record<string, string>>({});

  const [isInCall, setIsInCall] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [participants, setParticipants] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);


  const [isRemoteCallActive, setIsRemoteCallActive] = useState(false);
  const [activeCallUsers, setActiveCallUsers] = useState<Record<string, string>>({});

  useEffect(() => {
    activeCallUsersRef.current = activeCallUsers;
  }, [activeCallUsers]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    setIsRemoteCallActive(false);
    setActiveCallUsers({});
    setParticipants({});
    setRemoteStreams({});
    setError(null);
    clearSoloLeaveTimer();
  }, [chat.id]);

  useEffect(() => {
    return () => {
      void leaveCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);

  useEffect(() => {
    if (!autoStart || isInCall || isConnecting) {
      return;
    }

    onAutoStartConsumed?.();
    void startCall(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, isInCall, isConnecting]);

  useEffect(() => {
    const accessToken = useAuthStore.getState().accessToken;

    if (!accessToken) {
      return;
    }

    const client = createRealtimeClient(accessToken);
    stompClientRef.current = client;

    client.onConnect = () => {
      client.subscribe(`/topic/chats/${chat.id}/voice`, (frame: IMessage) => {
        const signal = JSON.parse(frame.body) as VoiceSignalResponse;
        void handleVoiceSignal(signal);
      });

      publishSignal({
        type: 'CALL_STATE_REQUEST'
      });
    };

    client.onStompError = () => {
      setError('Не удалось подключиться к голосовому чату.');
    };

    client.activate();

    return () => {
      clearSoloLeaveTimer();
      void leaveCall(false);
      void client.deactivate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);

  function clearSoloLeaveTimer() {
    if (soloLeaveTimerRef.current) {
      window.clearTimeout(soloLeaveTimerRef.current);
      soloLeaveTimerRef.current = null;
    }
  }

  function clearIncomingCallTimeout() {
    if (incomingCallTimeoutRef.current) {
      window.clearTimeout(incomingCallTimeoutRef.current);
      incomingCallTimeoutRef.current = null;
    }
  }

  function scheduleSoloLeaveIfNeeded(nextParticipants?: Record<string, string>) {
    const participantsToCheck = nextParticipants ?? participants;
    const remoteCount = Object.keys(participantsToCheck).length;

    clearSoloLeaveTimer();

    if (!isInCall) {
      return;
    }

    if (remoteCount > 0) {
      return;
    }

    soloLeaveTimerRef.current = window.setTimeout(() => {
      publishSignal({
        type: 'CALL_ENDED'
      });

      void leaveCall(false);
    }, 8000);
  }

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

  async function startCall(shouldInvite = true) {
    if (isInCall || isConnecting) {
      return;
    }

    setError(null);
    setIsConnecting(true);

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      localStreamRef.current = localStream;

      setIsInCall(true);
      setIsConnecting(false);

      setIsRemoteCallActive(true);
      setActiveCallUsers((current) => ({
        ...current,
        [currentUser.id]: currentUser.username
      }));

      publishSignal({
        type: 'JOIN'
      });

      if (shouldInvite) {
        publishSignal({
          type: 'CALL_INVITE'
        });
      }

      scheduleSoloLeaveIfNeeded({});
    } catch {
      setError('Не удалось получить доступ к микрофону.');
      setIsConnecting(false);
      stopLocalStream();
    }
  }

  async function leaveCall(
    shouldNotifyCallEnded = true,
    preserveRemoteGroupCall = false
  ) {
    clearSoloLeaveTimer();

    const knownActiveUsers = {
      ...activeCallUsersRef.current,
      ...participantsRef.current
    };

    delete knownActiveUsers[currentUser.id];

    if (stompClientRef.current?.connected) {
      publishSignal({
        type: 'LEAVE'
      });

      if (shouldNotifyCallEnded && chat.type === 'DIRECT') {
        publishSignal({
          type: 'CALL_ENDED'
        });
      }
    }

    Object.values(peersRef.current).forEach((peer) => peer.close());
    peersRef.current = {};
    pendingCandidatesRef.current = {};

    stopLocalStream();

    setIsInCall(false);
    setIsConnecting(false);
    setIsMuted(false);
    setRemoteStreams({});
    setParticipants({});

    if (
      preserveRemoteGroupCall &&
      chat.type === 'GROUP' &&
      Object.keys(knownActiveUsers).length > 0
    ) {
      setActiveCallUsers(knownActiveUsers);
      setIsRemoteCallActive(true);
    } else {
      setActiveCallUsers({});
      setIsRemoteCallActive(false);
    }
  }

  function stopLocalStream() {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }

  async function handleVoiceSignal(signal: VoiceSignalResponse) {
    if (signal.fromUserId === currentUser.id) {
      return;
    }

    if (signal.chatId !== chat.id) {
      return;
    }

    if (signal.toUserId && signal.toUserId !== currentUser.id) {
      return;
    }

    if (signal.type === 'CALL_STATE_REQUEST') {
      if (!isInCall) {
        return;
      }

      publishSignal({
        type: 'CALL_STATE_RESPONSE',
        toUserId: signal.fromUserId
      });

      return;
    }

    if (signal.type === 'CALL_STATE_RESPONSE') {
      setIsRemoteCallActive(true);

      setActiveCallUsers((current) => ({
        ...current,
        [signal.fromUserId]: signal.fromUsername
      }));

      return;
    }

    if (signal.type === 'CALL_DECLINE') {
      if (signal.toUserId && signal.toUserId !== currentUser.id) {
        return;
      }

      setError(`${signal.fromUsername} отклонил звонок.`);
      void leaveCall(false);
      return;
    }

    if (signal.type === 'CALL_ENDED') {
      setIsRemoteCallActive(false);
      setActiveCallUsers({});
      void leaveCall(false);
      return;
    }

    if (signal.type === 'JOIN') {
      setIsRemoteCallActive(true);

      setActiveCallUsers((current) => ({
        ...current,
        [signal.fromUserId]: signal.fromUsername
      }));

      setParticipants((current) => {
        const next = {
          ...current,
          [signal.fromUserId]: signal.fromUsername
        };

        scheduleSoloLeaveIfNeeded(next);

        return next;
      });

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

      setActiveCallUsers((current) => {
        const next = { ...current };
        delete next[signal.fromUserId];

        if (Object.keys(next).length === 0 && !isInCall) {
          setIsRemoteCallActive(false);
        }

        return next;
      });

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

      scheduleSoloLeaveIfNeeded(next);

      return next;
    });

    setActiveCallUsers((current) => {
      const next = { ...current };
      delete next[userId];

      if (Object.keys(next).length === 0 && !isInCall) {
        setIsRemoteCallActive(false);
      }

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
              : isRemoteCallActive
                ? `Звонок активен: ${Object.values(activeCallUsers).join(', ')}`
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
              onClick={() => void leaveCall(true, chat.type === 'GROUP')}
              title="Выйти из звонка"
            >
              <PhoneOff size={17} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className={isRemoteCallActive ? 'voice-start-button join' : 'voice-start-button'}
            disabled={isConnecting}
            onClick={() => void startCall(!isRemoteCallActive)}
          >
            <Phone size={17} />
            {isConnecting
              ? 'Подключаемся...'
              : isRemoteCallActive
                ? 'Подключиться'
                : 'Начать звонок'}
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