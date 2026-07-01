package com.shiftpay.mvp.security;

import com.shiftpay.mvp.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

@Service
public class JwtService {

	private static final String HMAC_ALGORITHM = "HmacSHA256";
	private static final Base64.Encoder BASE64_URL_ENCODER = Base64.getUrlEncoder().withoutPadding();

	private final String secret;
	private final long expirationSeconds;

	public JwtService(
			@Value("${security.jwt.secret:shiftpay-dev-secret-change-me}") String secret,
			@Value("${security.jwt.expiration-seconds:3600}") long expirationSeconds
	) {
		this.secret = secret;
		this.expirationSeconds = expirationSeconds;
	}

	public String generateAccessToken(User user) {
		Instant now = Instant.now();
		Instant expiresAt = now.plusSeconds(expirationSeconds);

		String header = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
		String payload = "{\"sub\":\"%s\",\"email\":\"%s\",\"role\":\"%s\",\"iat\":%d,\"exp\":%d}"
				.formatted(
						user.getId(),
						escapeJson(user.getEmail()),
						user.getRole().name(),
						now.getEpochSecond(),
						expiresAt.getEpochSecond()
				);

		String encodedHeader = encode(header);
		String encodedPayload = encode(payload);
		String signingInput = encodedHeader + "." + encodedPayload;
		return signingInput + "." + sign(signingInput);
	}

	private String encode(String value) {
		return BASE64_URL_ENCODER.encodeToString(value.getBytes(StandardCharsets.UTF_8));
	}

	private String sign(String signingInput) {
		try {
			Mac mac = Mac.getInstance(HMAC_ALGORITHM);
			SecretKeySpec key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
			mac.init(key);
			return BASE64_URL_ENCODER.encodeToString(mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8)));
		}
		catch (Exception exception) {
			throw new IllegalStateException("Failed to sign JWT", exception);
		}
	}

	private String escapeJson(String value) {
		return value
				.replace("\\", "\\\\")
				.replace("\"", "\\\"");
	}
}
