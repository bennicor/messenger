export type VoiceSignalType =
  | 'JOIN'
  | 'LEAVE'
  | 'OFFER'
  | 'ANSWER'
  | 'ICE_CANDIDATE'
  | 'CALL_INVITE'
  | 'CALL_DECLINE'
  | 'CALL_ENDED'
  | 'CALL_STATE_REQUEST'
  | 'CALL_STATE_RESPONSE';
    
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