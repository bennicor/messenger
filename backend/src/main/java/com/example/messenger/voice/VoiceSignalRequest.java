package com.example.messenger.voice;

import java.util.Map;
import java.util.UUID;

public record VoiceSignalRequest(
        VoiceSignalType type,
        UUID toUserId,
        String sdp,
        Map<String, Object> candidate
) {
}