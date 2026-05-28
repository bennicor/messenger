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
        messagingTemplate.convertAndSend(
                "/topic/chats/" + chatId + "/messages",
                message
        );
    }
}