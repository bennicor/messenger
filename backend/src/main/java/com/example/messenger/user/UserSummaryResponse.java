package com.example.messenger.user;

import java.util.UUID;

public record UserSummaryResponse(
        UUID id,
        String username,
        String displayName,
        String avatarUrl
) {
    public static UserSummaryResponse fromEntity(UserEntity user) {
        return new UserSummaryResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarUrl()
        );
    }
}