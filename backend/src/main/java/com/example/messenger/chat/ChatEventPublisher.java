package com.example.messenger.chat;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class ChatEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public ChatEventPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishChatUpdated(UUID userId, ChatResponse chat) {
        messagingTemplate.convertAndSend(
                "/topic/users/" + userId + "/chats/events",
                new ChatListEventResponse(ChatListEventType.UPDATED, chat)
        );
    }
}