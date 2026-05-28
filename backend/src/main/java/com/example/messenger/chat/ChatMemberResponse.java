package com.example.messenger.chat;

import com.example.messenger.user.UserEntity;

import java.util.UUID;

public record ChatMemberResponse(
        UUID id,
        String username,
        String displayName,
        String avatarUrl
) {
    public static ChatMemberResponse fromUser(UserEntity user) {
        return new ChatMemberResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarUrl()
        );
    }
}