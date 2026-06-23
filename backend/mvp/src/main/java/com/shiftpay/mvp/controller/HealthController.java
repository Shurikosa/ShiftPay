package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.HealthResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

	@GetMapping("/api/v1/health")
	public HealthResponse health() {
		return new HealthResponse("UP");
	}

}
