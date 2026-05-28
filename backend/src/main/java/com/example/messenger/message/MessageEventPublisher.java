package com.example.messenger.message;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class MessageEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public MessageEventPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishMessageCreated(UUID chatId, MessageResponse message) {
        publishMessageEvent(chatId, ChatMessageEventType.CREATED, message);
    }

    public void publishMessageUpdated(UUID chatId, MessageResponse message) {
        publishMessageEvent(chatId, ChatMessageEventType.UPDATED, message);
    }

    public void publishMessageDeleted(UUID chatId, MessageResponse message) {
        publishMessageEvent(chatId, ChatMessageEventType.DELETED, message);
    }

    public void publishTyping(UUID chatId, TypingResponse typingResponse) {
        messagingTemplate.convertAndSend(
                "/topic/chats/" + chatId + "/typing",
                typingResponse
        );
    }

    private void publishMessageEvent(
            UUID chatId,
            ChatMessageEventType type,
            MessageResponse message
    ) {
        messagingTemplate.convertAndSend(
                "/topic/chats/" + chatId + "/messages/events",
                new ChatMessageEventResponse(type, message)
        );
    }
}