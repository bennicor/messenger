package com.example.messenger.common;

import java.time.Instant;
import java.util.Map;

public record ErrorResponse(
        String message,
        String code,
        Instant timestamp,
        Map<String, String> fields
) {
    public static ErrorResponse of(String message, String code) {
        return new ErrorResponse(message, code, Instant.now(), Map.of());
    }

    public static ErrorResponse withFields(String message, String code, Map<String, String> fields) {
        return new ErrorResponse(message, code, Instant.now(), fields);
    }
}