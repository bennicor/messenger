package com.example.messenger.voice;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class VoiceEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public VoiceEventPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishVoiceSignal(UUID chatId, VoiceSignalResponse response) {
        messagingTemplate.convertAndSend(
                "/topic/chats/" + chatId + "/voice",
                response
        );
    }
}