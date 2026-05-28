package com.example.messenger.message;

import com.example.messenger.security.UserPrincipal;
import com.example.messenger.security.WebSocketUserPrincipal;
import com.example.messenger.user.UserRepository;
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
    private final UserRepository userRepository;

    public MessageWebSocketController(
            MessageService messageService,
            MessageEventPublisher messageEventPublisher,
            UserRepository userRepository
    ) {
        this.messageService = messageService;
        this.messageEventPublisher = messageEventPublisher;
        this.userRepository = userRepository;
    }

    @MessageMapping("/chats/{chatId}/messages")
    public void createMessage(
            @DestinationVariable UUID chatId,
            @Valid CreateMessageRequest request,
            Principal principal
    ) {
        UserPrincipal currentUser = extractUserPrincipal(principal);

        MessageResponse message = messageService.createMessage(
                chatId,
                currentUser.getId(),
                request
        );

        messageEventPublisher.publishMessageCreated(chatId, message);
    }

    @MessageMapping("/chats/{chatId}/typing")
    public void typing(
            @DestinationVariable UUID chatId,
            TypingRequest request,
            Principal principal
    ) {
        UserPrincipal currentUser = extractUserPrincipal(principal);

        messageService.ensureCanPublishTyping(chatId, currentUser.getId());

        String username = userRepository.findById(currentUser.getId())
                .map(user -> user.getUsername())
                .orElse(currentUser.getPublicUsername());

        messageEventPublisher.publishTyping(
                chatId,
                new TypingResponse(
                        chatId,
                        currentUser.getId(),
                        username,
                        request.typing()
                )
        );
    }

    private UserPrincipal extractUserPrincipal(Principal principal) {
        if (principal instanceof WebSocketUserPrincipal webSocketUserPrincipal) {
            return webSocketUserPrincipal.getUserPrincipal();
        }

        if (principal instanceof Authentication authentication
                && authentication.getPrincipal() instanceof UserPrincipal userPrincipal) {
            return userPrincipal;
        }

        throw new IllegalArgumentException("User is not authenticated");
    }
}