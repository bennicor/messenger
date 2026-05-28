package com.example.messenger.message;

import com.example.messenger.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

import java.time.Instant;


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
            @RequestParam(defaultValue = "30") int limit,
            @RequestParam(required = false) Instant before,
            @RequestParam(required = false) Instant after,
            @RequestParam(required = false) UUID around
    ) {
        return messageService.getMessages(
                chatId,
                principal.getId(),
                limit,
                before,
                after,
                around
        );
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

    @PatchMapping("/{messageId}")
    public MessageResponse updateMessage(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID chatId,
            @PathVariable UUID messageId,
            @Valid @RequestBody UpdateMessageRequest request
    ) {
        MessageResponse message = messageService.updateMessage(
                chatId,
                messageId,
                principal.getId(),
                request
        );

        messageEventPublisher.publishMessageUpdated(chatId, message);

        return message;
    }

    @DeleteMapping("/{messageId}")
    public MessageResponse deleteMessage(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID chatId,
            @PathVariable UUID messageId
    ) {
        MessageResponse message = messageService.deleteMessage(
                chatId,
                messageId,
                principal.getId()
        );

        messageEventPublisher.publishMessageDeleted(chatId, message);

        return message;
    }
}