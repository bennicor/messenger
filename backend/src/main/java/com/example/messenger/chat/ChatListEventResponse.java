package com.example.messenger.chat;

import java.util.UUID;

public record ChatListEventResponse(
        ChatListEventType type,
        ChatResponse chat,
        UUID chatId
) {
    public static ChatListEventResponse updated(ChatResponse chat) {
        return new ChatListEventResponse(
                ChatListEventType.UPDATED,
                chat,
                chat.id()
        );
    }

    public static ChatListEventResponse removed(UUID chatId) {
        return new ChatListEventResponse(
                ChatListEventType.REMOVED,
                null,
                chatId
        );
    }
}