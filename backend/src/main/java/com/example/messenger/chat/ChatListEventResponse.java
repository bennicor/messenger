package com.example.messenger.chat;

public record ChatListEventResponse(
        ChatListEventType type,
        ChatResponse chat
) {
}