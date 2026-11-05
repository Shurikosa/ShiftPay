package com.shiftpay.mvp.service;

import java.time.Instant;

/** Provider-neutral, transient delivery boundary. Implementations must never log the message. */
public interface PasswordResetDelivery {
	boolean deliver(Message message);

	record Message(String recipient, String code, Instant expiresAt) { }
}
