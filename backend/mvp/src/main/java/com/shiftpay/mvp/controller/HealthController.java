package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.HealthResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Handles the public health endpoint used by local checks and deployment probes.
 */
@RestController
public class HealthController {

	/**
	 * Handles {@code GET /api/v1/health}.
	 *
	 * @return static health response showing the backend is reachable
	 */
	@GetMapping("/api/v1/health")
	public HealthResponse health() {
		return new HealthResponse("UP");
	}

}
