package com.example.messenger.security;

import java.util.UUID;

public record AuthenticatedUser(
        UUID id,
        String username,
        String email
) {
}