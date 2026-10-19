package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PendingEmailChange;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

public record PendingEmailChangeResponse(
		@Schema(allowableValues = "PENDING", requiredMode = Schema.RequiredMode.REQUIRED)
		String status,
		@Schema(format = "email", requiredMode = Schema.RequiredMode.REQUIRED)
		String newEmail,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED)
		Instant expiresAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED)
		Instant codeExpiresAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED)
		Instant resendAvailableAt,
		@Schema(minimum = "0", maximum = "3", requiredMode = Schema.RequiredMode.REQUIRED)
		int resendsRemaining,
		@Schema(minimum = "0", maximum = "5", requiredMode = Schema.RequiredMode.REQUIRED)
		int attemptsRemaining
) {
	public static PendingEmailChangeResponse from(PendingEmailChange change) {
		return new PendingEmailChangeResponse(
				"PENDING",
				change.getNormalizedNewEmail(),
				change.getExpiresAt(),
				change.getCodeExpiresAt(),
				change.getResendAvailableAt(),
				Math.max(0, 3 - change.getResendCount()),
				Math.max(0, 5 - change.getFailedAttemptCount())
		);
	}
}
