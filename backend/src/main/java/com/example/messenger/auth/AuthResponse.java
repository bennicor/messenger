package com.example.messenger.auth;

import com.example.messenger.user.UserResponse;

public record AuthResponse(
        String accessToken,
        String tokenType,
        UserResponse user
) {
}