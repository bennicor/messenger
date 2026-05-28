package com.example.messenger.websocket;

import com.example.messenger.security.CustomUserDetailsService;
import com.example.messenger.security.JwtService;
import com.example.messenger.security.UserPrincipal;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

@Component
public class WebSocketAuthenticationInterceptor implements ChannelInterceptor {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    public WebSocketAuthenticationInterceptor(
            JwtService jwtService,
            CustomUserDetailsService userDetailsService
    ) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(
                message,
                StompHeaderAccessor.class
        );

        if (accessor == null) {
            return message;
        }

        if (!StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message;
        }

        String authorizationHeader = accessor.getFirstNativeHeader(AUTHORIZATION_HEADER);

        if (authorizationHeader == null || !authorizationHeader.startsWith(BEARER_PREFIX)) {
            throw new AccessDeniedException("Missing WebSocket authorization token");
        }

        String token = authorizationHeader.substring(BEARER_PREFIX.length());

        try {
            String email = jwtService.extractEmail(token);
            UserDetails userDetails = userDetailsService.loadUserByUsername(email);

            if (!(userDetails instanceof UserPrincipal userPrincipal)
                    || !jwtService.isTokenValid(token, userPrincipal)) {
                throw new AccessDeniedException("Invalid WebSocket authorization token");
            }

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            userPrincipal,
                            null,
                            userPrincipal.getAuthorities()
                    );

            accessor.setUser(authentication);

            return message;
        } catch (RuntimeException exception) {
            throw new AccessDeniedException("Invalid WebSocket authorization token", exception);
        }
    }
}