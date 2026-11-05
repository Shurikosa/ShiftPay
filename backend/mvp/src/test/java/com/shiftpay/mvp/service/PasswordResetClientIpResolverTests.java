package com.shiftpay.mvp.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordResetClientIpResolverTests {
	@Test
	void ignoresForwardingHeaderFromUntrustedPeer() {
		PasswordResetClientIpResolver resolver = new PasswordResetClientIpResolver("192.0.2.10");
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setRemoteAddr("203.0.113.8");
		request.addHeader("X-Forwarded-For", "198.51.100.1");
		assertThat(resolver.resolve(request)).isEqualTo("203.0.113.8");
	}

	@Test
	void takesNearestUntrustedHopFromConfiguredProxyChain() {
		PasswordResetClientIpResolver resolver = new PasswordResetClientIpResolver("192.0.2.10, 192.0.2.11");
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setRemoteAddr("192.0.2.10");
		request.addHeader("X-Forwarded-For", "198.51.100.99, 203.0.113.8, 192.0.2.11");
		assertThat(resolver.resolve(request)).isEqualTo("203.0.113.8");
	}

	@Test
	void doesNotResolveHostnameLikeForwardedValue() {
		PasswordResetClientIpResolver resolver = new PasswordResetClientIpResolver("192.0.2.10");
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setRemoteAddr("192.0.2.10");
		request.addHeader("X-Forwarded-For", "face.beef");
		assertThat(resolver.resolve(request)).isEqualTo("invalid-address");
	}
}
