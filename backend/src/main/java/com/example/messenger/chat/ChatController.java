package com.example.messenger.chat;

import com.example.messenger.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chats")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping
    public List<ChatResponse> getChats(@AuthenticationPrincipal UserPrincipal principal) {
        return chatService.getUserChats(principal.getId());
    }

    @GetMapping("/{chatId}")
    public ChatResponse getChat(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID chatId
    ) {
        return chatService.getChat(chatId, principal.getId());
    }

    @PostMapping("/direct")
    @ResponseStatus(HttpStatus.CREATED)
    public ChatResponse createDirectChat(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateDirectChatRequest request
    ) {
        return chatService.createOrGetDirectChat(
                principal.getId(),
                request.userId()
        );
    }
}