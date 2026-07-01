package com.shiftpay.mvp.security;

import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

@Service
public class JwtService {

	private static final String HMAC_ALGORITHM = "HmacSHA256";
	private static final Base64.Encoder BASE64_URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
	private static final Base64.Decoder BASE64_URL_DECODER = Base64.getUrlDecoder();
	private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
	};

	private final String secret;
	private final long expirationSeconds;
	private final JsonMapper jsonMapper;

	public JwtService(
			@Value("${security.jwt.secret:shiftpay-dev-secret-change-me}") String secret,
			@Value("${security.jwt.expiration-seconds:3600}") long expirationSeconds
	) {
		this.secret = secret;
		this.expirationSeconds = expirationSeconds;
		this.jsonMapper = JsonMapper.shared();
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

	public JwtClaims validateAccessToken(String token) {
		String[] parts = splitToken(token);
		String signingInput = parts[0] + "." + parts[1];
		if (!signatureMatches(signingInput, parts[2])) {
			throw new JwtAuthenticationException("Invalid token signature");
		}

		Map<String, Object> header = decodeJson(parts[0]);
		if (!"HS256".equals(header.get("alg")) || !"JWT".equals(header.get("typ"))) {
			throw new JwtAuthenticationException("Invalid token header");
		}

		Map<String, Object> payload = decodeJson(parts[1]);
		long expiresAt = readLongClaim(payload, "exp");
		if (Instant.now().getEpochSecond() >= expiresAt) {
			throw new JwtAuthenticationException("Token expired");
		}

		Long userId = readLongClaim(payload, "sub");
		String email = readStringClaim(payload, "email");
		Role role = readRoleClaim(payload);
		return new JwtClaims(userId, email, role);
	}

	private String[] splitToken(String token) {
		if (token == null || token.isBlank()) {
			throw new JwtAuthenticationException("Missing token");
		}

		String[] parts = token.split("\\.", -1);
		if (parts.length != 3 || parts[0].isBlank() || parts[1].isBlank() || parts[2].isBlank()) {
			throw new JwtAuthenticationException("Malformed token");
		}
		return parts;
	}

	private Map<String, Object> decodeJson(String encodedPart) {
		try {
			String json = new String(BASE64_URL_DECODER.decode(encodedPart), StandardCharsets.UTF_8);
			return jsonMapper.readValue(json, MAP_TYPE);
		}
		catch (IllegalArgumentException | JacksonException exception) {
			throw new JwtAuthenticationException("Invalid token payload");
		}
	}

	private boolean signatureMatches(String signingInput, String signature) {
		String expectedSignature = sign(signingInput);
		return MessageDigest.isEqual(
				expectedSignature.getBytes(StandardCharsets.UTF_8),
				signature.getBytes(StandardCharsets.UTF_8)
		);
	}

	private String readStringClaim(Map<String, Object> claims, String name) {
		Object value = claims.get(name);
		if (value instanceof String stringValue && !stringValue.isBlank()) {
			return stringValue;
		}
		throw new JwtAuthenticationException("Missing token claim: " + name);
	}

	private long readLongClaim(Map<String, Object> claims, String name) {
		Object value = claims.get(name);
		if (value instanceof Number numberValue) {
			return numberValue.longValue();
		}
		if (value instanceof String stringValue && !stringValue.isBlank()) {
			try {
				return Long.parseLong(stringValue);
			}
			catch (NumberFormatException exception) {
				throw new JwtAuthenticationException("Invalid token claim: " + name);
			}
		}
		throw new JwtAuthenticationException("Missing token claim: " + name);
	}

	private Role readRoleClaim(Map<String, Object> claims) {
		try {
			return Role.valueOf(readStringClaim(claims, "role"));
		}
		catch (IllegalArgumentException exception) {
			throw new JwtAuthenticationException("Invalid token claim: role");
		}
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
