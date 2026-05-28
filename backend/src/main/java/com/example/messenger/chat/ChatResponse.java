package com.example.messenger.chat;

import com.example.messenger.message.MessageResponse;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ChatResponse(
        UUID id,
        ChatType type,
        String title,
        List<ChatMemberResponse> members,
        MessageResponse lastMessage,
        UUID firstUnreadMessageId,
        long unreadCount,
        Instant createdAt,
        Instant updatedAt
) {
}