package com.example.messenger.voice;

import com.example.messenger.chat.ChatMemberRepository;
import com.example.messenger.security.UserPrincipal;
import com.example.messenger.security.WebSocketUserPrincipal;
import com.example.messenger.user.UserRepository;
import com.example.messenger.chat.ChatMemberEntity;
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

        VoiceSignalResponse response = new VoiceSignalResponse(
                chatId,
                currentUser.getId(),
                username,
                request.toUserId(),
                request.type(),
                request.sdp(),
                request.candidate()
        );

        voiceEventPublisher.publishVoiceSignal(chatId, response);

        if (
                request.type() == VoiceSignalType.CALL_INVITE ||
                request.type() == VoiceSignalType.CALL_DECLINE ||
                request.type() == VoiceSignalType.CALL_ENDED
        ) {
            publishUserLevelCallSignals(chatId, currentUser.getId(), request, response);
        }
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

    private void publishUserLevelCallSignals(
            UUID chatId,
            UUID currentUserId,
            VoiceSignalRequest request,
            VoiceSignalResponse response
    ) {
        if (request.toUserId() != null) {
            if (!request.toUserId().equals(currentUserId)) {
                voiceEventPublisher.publishUserCallSignal(
                        request.toUserId(),
                        response
                );
            }

            return;
        }

        for (ChatMemberEntity member : chatMemberRepository.findAllByChatId(chatId)) {
            UUID memberUserId = member.getUser().getId();

            if (!memberUserId.equals(currentUserId)) {
                voiceEventPublisher.publishUserCallSignal(
                        memberUserId,
                        response
                );
            }
        }
    }
}