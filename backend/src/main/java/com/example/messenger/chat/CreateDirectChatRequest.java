package com.example.messenger.chat;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateDirectChatRequest(
        @NotNull
        UUID userId
) {
}