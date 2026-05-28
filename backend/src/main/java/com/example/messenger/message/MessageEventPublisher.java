package com.example.messenger.message;

import com.example.messenger.chat.ChatEntity;
import com.example.messenger.chat.ChatEventPublisher;
import com.example.messenger.chat.ChatMemberEntity;
import com.example.messenger.chat.ChatMemberRepository;
import com.example.messenger.chat.ChatService;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class MessageEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatMemberRepository chatMemberRepository;
    private final ChatService chatService;
    private final ChatEventPublisher chatEventPublisher;

    public MessageEventPublisher(
            SimpMessagingTemplate messagingTemplate,
            ChatMemberRepository chatMemberRepository,
            ChatService chatService,
            ChatEventPublisher chatEventPublisher
    ) {
        this.messagingTemplate = messagingTemplate;
        this.chatMemberRepository = chatMemberRepository;
        this.chatService = chatService;
        this.chatEventPublisher = chatEventPublisher;
    }

    public void publishMessageCreated(UUID chatId, MessageResponse message) {
        publishMessageEvent(chatId, ChatMessageEventType.CREATED, message);
        publishChatListUpdates(chatId);
    }

    public void publishMessageUpdated(UUID chatId, MessageResponse message) {
        publishMessageEvent(chatId, ChatMessageEventType.UPDATED, message);
        publishChatListUpdates(chatId);
    }

    public void publishMessageDeleted(UUID chatId, MessageResponse message) {
        publishMessageEvent(chatId, ChatMessageEventType.DELETED, message);
        publishChatListUpdates(chatId);
    }

    public void publishTyping(UUID chatId, TypingResponse typingResponse) {
        messagingTemplate.convertAndSend(
                "/topic/chats/" + chatId + "/typing",
                typingResponse
        );
    }

    private void publishMessageEvent(
            UUID chatId,
            ChatMessageEventType type,
            MessageResponse message
    ) {
        messagingTemplate.convertAndSend(
                "/topic/chats/" + chatId + "/messages/events",
                new ChatMessageEventResponse(type, message)
        );
    }

    private void publishChatListUpdates(UUID chatId) {
        ChatEntity chat = null;

        for (ChatMemberEntity member : chatMemberRepository.findAllByChatId(chatId)) {
            if (chat == null) {
                chat = member.getChat();
            }

            UUID userId = member.getUser().getId();

            chatEventPublisher.publishChatUpdated(
                    userId,
                    chatService.toResponse(chat, userId)
            );
        }
    }
}