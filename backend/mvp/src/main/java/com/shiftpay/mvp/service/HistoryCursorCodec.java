package com.shiftpay.mvp.service;

import com.shiftpay.mvp.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;

@Component
public class HistoryCursorCodec {

	public static final String PERSONAL = "personal-shifts";
	public static final String MANAGED = "managed-shifts";
	private static final String HMAC = "HmacSHA256";
	private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
	private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

	private final byte[] secret;

	public HistoryCursorCodec(@Value("${shiftpay.cursor.secret:shiftpay-dev-cursor-secret-change-me}") String secret) {
		this.secret = secret.getBytes(StandardCharsets.UTF_8);
	}

	public String encode(String endpoint, long userId, Instant timestamp, long id) {
		String payload = "v2|" + endpoint + "|" + userId + "|" + timestamp.getEpochSecond()
				+ "|" + timestamp.getNano() + "|" + id;
		byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
		return ENCODER.encodeToString(bytes) + "." + ENCODER.encodeToString(sign(bytes));
	}

	public Cursor decode(String cursor, String expectedEndpoint, long expectedUserId) {
		try {
			String[] token = cursor.split("\\.", -1);
			if (token.length != 2) {
				throw invalid();
			}
			byte[] payloadBytes = DECODER.decode(token[0]);
			byte[] signature = DECODER.decode(token[1]);
			if (!MessageDigest.isEqual(signature, sign(payloadBytes))) {
				throw invalid();
			}
			String[] fields = new String(payloadBytes, StandardCharsets.UTF_8).split("\\|", -1);
			if (fields.length != 6 || !"v2".equals(fields[0]) || !expectedEndpoint.equals(fields[1])) {
				throw invalid();
			}
			long userId = Long.parseLong(fields[2]);
			long seconds = Long.parseLong(fields[3]);
			int nanos = Integer.parseInt(fields[4]);
			long id = Long.parseLong(fields[5]);
			if (userId <= 0 || userId != expectedUserId || id <= 0 || nanos < 0 || nanos > 999_999_999) {
				throw invalid();
			}
			return new Cursor(Instant.ofEpochSecond(seconds, nanos), id);
		}
		catch (BadRequestException exception) {
			throw exception;
		}
		catch (RuntimeException exception) {
			throw invalid();
		}
	}

	public int validateLimit(Integer limit) {
		int value = limit == null ? 20 : limit;
		if (value < 1 || value > 20) {
			throw new BadRequestException("limit: must be between 1 and 20");
		}
		return value;
	}

	private byte[] sign(byte[] payload) {
		try {
			Mac mac = Mac.getInstance(HMAC);
			mac.init(new SecretKeySpec(secret, HMAC));
			return mac.doFinal(payload);
		}
		catch (Exception exception) {
			throw new IllegalStateException("Failed to sign pagination cursor", exception);
		}
	}

	private BadRequestException invalid() {
		return new BadRequestException("cursor: invalid pagination cursor");
	}

	public record Cursor(Instant timestamp, long id) { }
}
