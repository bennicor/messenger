package com.example.messenger.message;

import java.util.UUID;

public record TypingResponse(
        UUID chatId,
        UUID userId,
        String username,
        boolean typing
) {
}