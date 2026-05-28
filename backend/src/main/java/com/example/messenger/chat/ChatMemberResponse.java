package com.example.messenger.chat;

import com.example.messenger.user.UserEntity;

import java.util.UUID;

public record ChatMemberResponse(
        UUID id,
        String username,
        String displayName,
        String avatarUrl,
        ChatMemberRole role
) {
    public static ChatMemberResponse fromMember(ChatMemberEntity member) {
        UserEntity user = member.getUser();

        return new ChatMemberResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                member.getRole()
        );
    }

    public static ChatMemberResponse fromUser(UserEntity user) {
        return new ChatMemberResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                ChatMemberRole.MEMBER
        );
    }
}