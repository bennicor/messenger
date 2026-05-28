export type VoiceSignalType =
  | 'JOIN'
  | 'LEAVE'
  | 'OFFER'
  | 'ANSWER'
  | 'ICE_CANDIDATE';

export type VoiceSignalRequest = {
  type: VoiceSignalType;
  toUserId?: string | null;
  sdp?: string | null;
  candidate?: RTCIceCandidateInit | null;
};

export type VoiceSignalResponse = {
  chatId: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string | null;
  type: VoiceSignalType;
  sdp: string | null;
  candidate: RTCIceCandidateInit | null;
};