package com.example.messenger.chat;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.Set;
import java.util.UUID;

public record AddGroupMembersRequest(
        @NotEmpty
        @Size(max = 50)
        Set<UUID> memberIds
) {
}