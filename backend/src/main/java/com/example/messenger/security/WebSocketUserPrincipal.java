package com.example.messenger.security;

import java.security.Principal;
import java.util.UUID;

public class WebSocketUserPrincipal implements Principal {

    private final UserPrincipal userPrincipal;

    public WebSocketUserPrincipal(UserPrincipal userPrincipal) {
        this.userPrincipal = userPrincipal;
    }

    @Override
    public String getName() {
        return userPrincipal.getEmail();
    }

    public UUID getId() {
        return userPrincipal.getId();
    }

    public UserPrincipal getUserPrincipal() {
        return userPrincipal;
    }
}