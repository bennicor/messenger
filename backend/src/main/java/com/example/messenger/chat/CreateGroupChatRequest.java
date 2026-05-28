package com.example.messenger.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.Set;
import java.util.UUID;

public record CreateGroupChatRequest(
        @NotBlank
        @Size(max = 80)
        String title,

        @NotEmpty
        @Size(max = 50)
        Set<UUID> memberIds
) {
}