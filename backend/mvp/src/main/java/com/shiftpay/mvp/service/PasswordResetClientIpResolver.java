package com.shiftpay.mvp.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/** Resolves forwarding headers only when the immediate peer is explicitly trusted. */
@Component
public class PasswordResetClientIpResolver {
	private final Set<String> trustedProxies;

	public PasswordResetClientIpResolver(@Value("${shiftpay.password-reset.trusted-proxies:}") String proxies) {
		this.trustedProxies = Arrays.stream(proxies.split(","))
				.map(String::trim).filter(value -> !value.isEmpty()).map(this::canonical)
				.collect(Collectors.toUnmodifiableSet());
	}

	public String resolve(HttpServletRequest request) {
		String peer = canonical(request.getRemoteAddr());
		if (!trustedProxies.contains(peer)) {
			return peer;
		}
		String forwarded = request.getHeader("X-Forwarded-For");
		if (forwarded == null || forwarded.isBlank()) {
			return peer;
		}
		String[] hops = forwarded.split(",");
		for (int index = hops.length - 1; index >= 0; index--) {
			String hop = canonical(hops[index].trim());
			if (!trustedProxies.contains(hop)) {
				return hop;
			}
		}
		return peer;
	}

	private String canonical(String address) {
		if (address == null) {
			return "invalid-address";
		}
		if (address.contains(":")) {
			if (!address.matches("[0-9a-fA-F:]+")) return "invalid-address";
		}
		else {
			String[] octets = address.split("\\.", -1);
			if (octets.length != 4) return "invalid-address";
			for (String octet : octets) {
				if (!octet.matches("[0-9]{1,3}") || Integer.parseInt(octet) > 255) {
					return "invalid-address";
				}
			}
		}
		try {
			return InetAddress.getByName(address).getHostAddress();
		}
		catch (UnknownHostException exception) {
			return "invalid-address";
		}
	}
}
