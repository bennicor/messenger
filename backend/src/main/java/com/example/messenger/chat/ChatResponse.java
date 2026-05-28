package com.example.messenger.chat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ChatResponse(
        UUID id,
        ChatType type,
        String title,
        List<ChatMemberResponse> members,
        Instant createdAt,
        Instant updatedAt
) {
}