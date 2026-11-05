package com.shiftpay.mvp.dto;

import java.util.UUID;

public record RequestPasswordResetResponse(UUID requestId, String message) { }
