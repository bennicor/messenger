package com.example.messenger.message;

import com.example.messenger.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chats/{chatId}/messages")
public class MessageController {

    private final MessageService messageService;
    private final MessageEventPublisher messageEventPublisher;

    public MessageController(
            MessageService messageService,
            MessageEventPublisher messageEventPublisher
    ) {
        this.messageService = messageService;
        this.messageEventPublisher = messageEventPublisher;
    }

    @GetMapping
    public List<MessageResponse> getMessages(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID chatId,
            @RequestParam(defaultValue = "50") int limit
    ) {
        return messageService.getMessages(chatId, principal.getId(), limit);
    }

    @PostMapping
    public MessageResponse createMessage(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID chatId,
            @Valid @RequestBody CreateMessageRequest request
    ) {
        MessageResponse message = messageService.createMessage(
                chatId,
                principal.getId(),
                request
        );

        messageEventPublisher.publishMessageCreated(chatId, message);

        return message;
    }
}