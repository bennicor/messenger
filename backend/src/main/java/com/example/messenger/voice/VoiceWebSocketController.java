package com.example.messenger.voice;

import com.example.messenger.chat.ChatMemberRepository;
import com.example.messenger.security.UserPrincipal;
import com.example.messenger.security.WebSocketUserPrincipal;
import com.example.messenger.user.UserRepository;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

@Controller
public class VoiceWebSocketController {

    private final ChatMemberRepository chatMemberRepository;
    private final UserRepository userRepository;
    private final VoiceEventPublisher voiceEventPublisher;

    public VoiceWebSocketController(
            ChatMemberRepository chatMemberRepository,
            UserRepository userRepository,
            VoiceEventPublisher voiceEventPublisher
    ) {
        this.chatMemberRepository = chatMemberRepository;
        this.userRepository = userRepository;
        this.voiceEventPublisher = voiceEventPublisher;
    }

    @MessageMapping("/chats/{chatId}/voice")
    public void voiceSignal(
            @DestinationVariable UUID chatId,
            VoiceSignalRequest request,
            Principal principal
    ) {
        UserPrincipal currentUser = extractUserPrincipal(principal);

        boolean isMember = chatMemberRepository.existsByChatIdAndUserId(
                chatId,
                currentUser.getId()
        );

        if (!isMember) {
            throw new IllegalArgumentException("Chat not found");
        }

        String username = userRepository.findById(currentUser.getId())
                .map(user -> user.getUsername())
                .orElse(currentUser.getPublicUsername());

        voiceEventPublisher.publishVoiceSignal(
                chatId,
                new VoiceSignalResponse(
                        chatId,
                        currentUser.getId(),
                        username,
                        request.toUserId(),
                        request.type(),
                        request.sdp(),
                        request.candidate()
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