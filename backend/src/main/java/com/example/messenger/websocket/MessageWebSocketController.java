package com.example.messenger.message;

import com.example.messenger.security.UserPrincipal;
import com.example.messenger.security.WebSocketUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

@Controller
public class MessageWebSocketController {

    private final MessageService messageService;
    private final MessageEventPublisher messageEventPublisher;

    public MessageWebSocketController(
            MessageService messageService,
            MessageEventPublisher messageEventPublisher
    ) {
        this.messageService = messageService;
        this.messageEventPublisher = messageEventPublisher;
    }

    @MessageMapping("/chats/{chatId}/messages")
    public void createMessage(
            @DestinationVariable UUID chatId,
            @Valid CreateMessageRequest request,
            Principal principal
    ) {
        UUID currentUserId = extractUserId(principal);

        MessageResponse message = messageService.createMessage(
                chatId,
                currentUserId,
                request
        );

        messageEventPublisher.publishMessageCreated(chatId, message);
    }

    private UUID extractUserId(Principal principal) {
        if (principal instanceof WebSocketUserPrincipal webSocketUserPrincipal) {
            return webSocketUserPrincipal.getId();
        }

        if (principal instanceof Authentication authentication
                && authentication.getPrincipal() instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getId();
        }

        throw new IllegalArgumentException("User is not authenticated");
    }
}