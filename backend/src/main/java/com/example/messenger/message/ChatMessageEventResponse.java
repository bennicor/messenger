package com.example.messenger.message;

public record ChatMessageEventResponse(
        ChatMessageEventType type,
        MessageResponse message
) {
}