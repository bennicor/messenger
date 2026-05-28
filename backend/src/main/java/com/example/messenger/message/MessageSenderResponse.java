package com.example.messenger.message;

import com.example.messenger.user.UserEntity;

import java.util.UUID;

public record MessageSenderResponse(
        UUID id,
        String username,
        String displayName,
        String avatarUrl
) {
    public static MessageSenderResponse fromUser(UserEntity user) {
        if (user == null) {
            return null;
        }

        return new MessageSenderResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarUrl()
        );
    }
}