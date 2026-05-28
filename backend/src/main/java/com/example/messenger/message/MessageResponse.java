package com.example.messenger.message;

import java.time.Instant;
import java.util.UUID;

public record MessageResponse(
        UUID id,
        UUID chatId,
        MessageSenderResponse sender,
        String content,
        Instant createdAt,
        Instant editedAt,
        Instant deletedAt
) {
    public static MessageResponse fromEntity(MessageEntity message) {
        return new MessageResponse(
                message.getId(),
                message.getChat().getId(),
                MessageSenderResponse.fromUser(message.getSender()),
                message.getContent(),
                message.getCreatedAt(),
                message.getEditedAt(),
                message.getDeletedAt()
        );
    }
}