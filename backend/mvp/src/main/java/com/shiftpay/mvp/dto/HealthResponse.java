package com.shiftpay.mvp.dto;

/**
 * Response DTO for the public health endpoint.
 *
 * @param status static health status value returned by the backend
 */
public record HealthResponse(String status) {
}
