package com.shiftpay.mvp.service;

import java.time.Instant;

public interface EmailChangeDelivery {

	boolean deliver(VerificationMessage message);

	record VerificationMessage(String recipient, String code, Instant codeExpiresAt) { }
}
