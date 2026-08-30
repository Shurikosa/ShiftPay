package com.shiftpay.mvp.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller integration tests for Springdoc OpenAPI and Swagger UI exposure.
 *
 * <p>The class verifies documentation endpoints are public, OpenAPI metadata and Bearer security are generated, and
 * business endpoints still require JWT authentication.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
class OpenApiControllerTests {

	@Autowired
	private MockMvc mockMvc;

	/**
	 * Reads {@code /v3/api-docs} without JWT and expects ShiftPay metadata plus the bearerAuth security scheme.
	 */
	@Test
	void apiDocsArePublicAndExposeMetadataAndBearerSecurityScheme() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.info.title").value("ShiftPay API"))
				.andExpect(jsonPath("$.info.version").value("v1"))
				.andExpect(jsonPath("$.info.description").value("OpenAPI documentation for the ShiftPay backend MVP: "
						+ "authentication, current user, shift sessions, shift cancellation, active-shift pause tracking, "
						+ "attendance, salary summary, personal shift history, and payroll requests."))
				.andExpect(jsonPath("$.components.securitySchemes.bearerAuth.type").value("http"))
				.andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"))
				.andExpect(jsonPath("$.components.securitySchemes.bearerAuth.bearerFormat").value("JWT"))
				.andExpect(jsonPath("$.security[0].bearerAuth").isArray());
	}

	/**
	 * Reads generated docs and expects cancel to be exposed as an implemented POST endpoint.
	 */
	@Test
	void apiDocsExposeImplementedShiftCancelEndpoint() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/v1/shifts/{shiftId}/cancel'].post").exists());
	}

	/**
	 * Reads generated docs and expects pause to be exposed as implemented POST endpoints.
	 */
	@Test
	void apiDocsExposeImplementedShiftPauseEndpoints() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/v1/shifts/{shiftId}/pauses/me/start'].post").exists())
				.andExpect(jsonPath("$.paths['/api/v1/shifts/{shiftId}/pauses/me/end'].post").exists())
				.andExpect(jsonPath("$.paths['/api/v1/shifts/{shiftId}/pauses/all/start'].post").exists())
				.andExpect(jsonPath("$.paths['/api/v1/shifts/{shiftId}/pauses/all/end'].post").exists());
	}

	/**
	 * Reads generated docs and expects payroll request endpoints to be exposed.
	 */
	@Test
	void apiDocsExposeImplementedPayrollEndpoints() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/v1/me/payable-attendances'].get").exists())
				.andExpect(jsonPath("$.paths['/api/v1/me/payout-requests/preview'].post").exists())
				.andExpect(jsonPath("$.paths['/api/v1/me/payout-requests'].post").exists())
				.andExpect(jsonPath("$.paths['/api/v1/me/payout-requests'].get").exists())
				.andExpect(jsonPath("$.paths['/api/v1/me/managed-payout-requests'].get").exists())
				.andExpect(jsonPath(
						"$.paths['/api/v1/me/managed-payout-requests/{requestId}/approve'].post"
				).exists());
	}

	/**
	 * Opens the Swagger UI entry page without JWT to confirm local API documentation is reachable.
	 */
	@Test
	void swaggerUiIndexIsPublic() throws Exception {
		mockMvc.perform(get("/swagger-ui/index.html"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));
	}

	/**
	 * Guards against accidentally making normal API routes public while exposing Swagger endpoints.
	 */
	@Test
	void businessEndpointsStillRequireAuthentication() throws Exception {
		mockMvc.perform(get("/api/v1/users/me"))
				.andExpect(status().isUnauthorized());
	}
}
