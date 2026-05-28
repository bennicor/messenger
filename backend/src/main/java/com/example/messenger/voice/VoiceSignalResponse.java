package com.example.messenger.voice;

import java.util.Map;
import java.util.UUID;

public record VoiceSignalResponse(
        UUID chatId,
        UUID fromUserId,
        String fromUsername,
        UUID toUserId,
        VoiceSignalType type,
        String sdp,
        Map<String, Object> candidate
) {
}