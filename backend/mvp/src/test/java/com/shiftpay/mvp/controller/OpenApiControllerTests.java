package com.shiftpay.mvp.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Arrays;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.hasItem;
import static org.assertj.core.api.Assertions.assertThat;

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
						+ "authentication, current user, shift sessions, shift cancellation/discard, active-shift pause "
						+ "tracking, attendance, salary summary, personal shift history, payroll requests, and company pay policies."))
				.andExpect(jsonPath("$.paths['/api/v1/me/pay-policy'].get").exists())
				.andExpect(jsonPath("$.paths['/api/v1/me/pay-policy'].put").exists())
				.andExpect(jsonPath("$.paths['/api/v1/me/pay-policy/versions'].get").exists())
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
	 * Reads generated docs and expects discard to be exposed as an implemented POST endpoint.
	 */
	@Test
	void apiDocsExposeImplementedShiftDiscardEndpoint() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/v1/shifts/{shiftId}/discard'].post").exists());
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

	@Test
	void apiDocsExposeOwnSettingsAndPagedHistoryEndpoints() throws Exception {
		MvcResult result = mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andReturn();
		JsonNode docs = JsonMapper.shared().readTree(result.getResponse().getContentAsString());

		assertResponses(docs, "/api/v1/users/me", "put", "200", "400", "401", "403");
		assertResponses(docs, "/api/v1/users/me/email-change", "post",
				"202", "400", "401", "403", "409", "429", "503");
		assertResponses(docs, "/api/v1/users/me/email-change", "get", "200", "204", "401", "403");
		assertResponses(docs, "/api/v1/users/me/email-change", "delete", "204", "401", "403");
		assertResponses(docs, "/api/v1/users/me/email-change/confirm", "post",
				"200", "400", "401", "403", "409", "410");
		assertResponses(docs, "/api/v1/users/me/email-change/resend", "post",
				"200", "401", "403", "409", "410", "429", "503");
		assertResponses(docs, "/api/v1/users/me/password", "put",
				"200", "400", "401", "403", "409", "429");
		assertResponses(docs, "/api/v1/me/shifts/page", "get", "200", "400", "401");
		assertResponses(docs, "/api/v1/me/managed-shifts/page", "get", "200", "400", "401", "403");

		assertRequestBody(docs, "/api/v1/users/me", "put", "UpdateMyNameRequest");
		assertRequestBody(docs, "/api/v1/users/me/email-change", "post", "StartMyEmailChangeRequest");
		assertRequestBody(docs, "/api/v1/users/me/email-change/confirm", "post", "ConfirmMyEmailChangeRequest");
		assertRequestBody(docs, "/api/v1/users/me/password", "put", "UpdateMyPasswordRequest");

		assertResponseSchema(docs, "/api/v1/users/me", "put", "200", "UserResponse");
		assertResponseSchema(docs, "/api/v1/users/me/email-change", "post", "202",
				"PendingEmailChangeResponse");
		assertResponseSchema(docs, "/api/v1/users/me/email-change", "get", "200",
				"PendingEmailChangeResponse");
		assertResponseSchema(docs, "/api/v1/users/me/email-change/confirm", "post", "200", "LoginResponse");
		assertResponseSchema(docs, "/api/v1/users/me/email-change/resend", "post", "200",
				"PendingEmailChangeResponse");
		assertResponseSchema(docs, "/api/v1/users/me/password", "put", "200", "LoginResponse");
		assertResponseSchema(docs, "/api/v1/me/shifts/page", "get", "200",
				"MyShiftHistoryPageResponse");
		assertResponseSchema(docs, "/api/v1/me/managed-shifts/page", "get", "200",
				"ManagedShiftPageResponse");

		assertErrorSchemas(docs, "/api/v1/users/me", "put", "400", "401", "403");
		assertErrorSchemas(docs, "/api/v1/users/me/email-change", "post",
				"400", "401", "403", "409", "429", "503");
		assertErrorSchemas(docs, "/api/v1/users/me/email-change", "get", "401", "403");
		assertErrorSchemas(docs, "/api/v1/users/me/email-change", "delete", "401", "403");
		assertErrorSchemas(docs, "/api/v1/users/me/email-change/confirm", "post",
				"400", "401", "403", "409", "410");
		assertErrorSchemas(docs, "/api/v1/users/me/email-change/resend", "post",
				"401", "403", "409", "410", "429", "503");
		assertErrorSchemas(docs, "/api/v1/users/me/password", "put", "400", "401", "403", "409", "429");
		assertErrorSchemas(docs, "/api/v1/me/shifts/page", "get", "400", "401");
		assertErrorSchemas(docs, "/api/v1/me/managed-shifts/page", "get", "400", "401", "403");

		assertRetryAfter(docs, "/api/v1/users/me/email-change", "post");
		assertRetryAfter(docs, "/api/v1/users/me/email-change/resend", "post");
		assertRetryAfter(docs, "/api/v1/users/me/password", "put");

		JsonNode errorSchema = docs.path("components").path("schemas").path("ApiErrorResponse");
		assertThat(errorSchema.path("properties").path("code").path("enum").toString())
				.contains("INVALID_EMAIL_VERIFICATION_CODE", "EMAIL_VERIFICATION_ATTEMPTS_EXHAUSTED",
						"CREDENTIAL_VERSION_CONFLICT", "SESSION_REVOKED");
		assertThat(errorSchema.path("properties").path("attemptsRemaining").path("minimum").asInt()).isZero();
		assertThat(errorSchema.path("properties").path("attemptsRemaining").path("maximum").asInt()).isEqualTo(4);

		assertPageContract(docs, "/api/v1/me/shifts/page", "MyShiftHistoryPageResponse",
				"MyShiftHistoryResponse");
		assertPageContract(docs, "/api/v1/me/managed-shifts/page", "ManagedShiftPageResponse", "ShiftResponse");
	}

	private void assertResponses(JsonNode docs, String path, String method, String... expectedStatuses) {
		JsonNode responses = operation(docs, path, method).path("responses");
		assertThat(responses.propertyNames()).containsAll(Arrays.asList(expectedStatuses));
	}

	private void assertRequestBody(JsonNode docs, String path, String method, String schema) {
		JsonNode requestBody = operation(docs, path, method).path("requestBody");
		assertThat(requestBody.path("required").asBoolean()).isTrue();
		assertThat(requestBody.path("content").path("application/json").path("schema").path("$ref").asString())
				.isEqualTo("#/components/schemas/" + schema);
	}

	private void assertResponseSchema(
			JsonNode docs,
			String path,
			String method,
			String status,
			String schema
	) {
		JsonNode response = operation(docs, path, method).path("responses").path(status);
		JsonNode content = response.path("content");
		JsonNode mediaType = content.path("application/json");
		if (mediaType.isMissingNode()) {
			mediaType = content.path("*/*");
		}
		assertThat(mediaType.path("schema").path("$ref").asString())
				.isEqualTo("#/components/schemas/" + schema);
	}

	private void assertErrorSchemas(JsonNode docs, String path, String method, String... statuses) {
		for (String status : statuses) {
			assertResponseSchema(docs, path, method, status, "ApiErrorResponse");
		}
	}

	private void assertRetryAfter(JsonNode docs, String path, String method) {
		JsonNode headerSchema = operation(docs, path, method)
				.path("responses").path("429").path("headers").path("Retry-After").path("schema");
		assertThat(headerSchema.path("type").asString()).isEqualTo("integer");
		assertThat(headerSchema.path("minimum").asInt()).isEqualTo(1);
	}

	private void assertPageContract(JsonNode docs, String path, String envelopeSchema, String itemSchema) {
		JsonNode operation = operation(docs, path, "get");
		JsonNode limit = null;
		for (JsonNode parameter : operation.path("parameters")) {
			if ("limit".equals(parameter.path("name").asString())) {
				limit = parameter.path("schema");
			}
		}
		assertThat(limit).isNotNull();
		assertThat(limit.path("minimum").asInt()).isEqualTo(1);
		assertThat(limit.path("maximum").asInt()).isEqualTo(20);
		assertThat(limit.path("default").asInt()).isEqualTo(20);

		JsonNode envelope = docs.path("components").path("schemas").path(envelopeSchema);
		assertThat(envelope.path("required").valueStream().map(JsonNode::asString).toList())
				.containsExactlyInAnyOrder("items", "nextCursor", "hasMore");
		assertThat(envelope.path("properties").path("items").path("type").asString()).isEqualTo("array");
		assertThat(envelope.path("properties").path("items").path("items").path("$ref").asString())
				.isEqualTo("#/components/schemas/" + itemSchema);
		JsonNode nextCursorType = envelope.path("properties").path("nextCursor").path("type");
		assertThat(nextCursorType.isArray()).isTrue();
		assertThat(nextCursorType.valueStream().map(JsonNode::asString).collect(java.util.stream.Collectors.toSet()))
				.isEqualTo(Set.of("string", "null"));
		assertThat(envelope.path("properties").path("hasMore").path("type").asString()).isEqualTo("boolean");
	}

	private JsonNode operation(JsonNode docs, String path, String method) {
		JsonNode operation = docs.path("paths").path(path).path(method);
		assertThat(operation.isMissingNode()).isFalse();
		return operation;
	}

	/**
	 * Company Settings and the nullable historical currency fields remain visible in generated OpenAPI schemas.
	 */
	@Test
	void apiDocsExposeCompanySettingsAndCurrencyLabelContract() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/v1/me/company'].get").exists())
				.andExpect(jsonPath("$.paths['/api/v1/me/company'].put").exists())
				.andExpect(jsonPath("$.components.schemas.CreateCompanyRequest.required", hasItem("currencyLabel")))
				.andExpect(jsonPath("$.components.schemas.UpdateCompanySettingsRequest.required", hasItem("currencyLabel")))
				.andExpect(jsonPath("$.components.schemas.CompanySettingsResponse.properties.currencyLabel").exists())
				.andExpect(jsonPath("$.components.schemas.CompanySettingsResponse.properties.defaultWorkerHourlyRate").exists())
				.andExpect(jsonPath("$.components.schemas.CompanySettingsResponse.properties.defaultForemanHourlyRate").exists())
				.andExpect(jsonPath("$.components.schemas.ShiftResponse.properties.currencyLabel").exists())
				.andExpect(jsonPath("$.components.schemas.AttendanceResponse.properties.currencyLabel").exists())
				.andExpect(jsonPath("$.components.schemas.MyShiftHistoryResponse.properties.currencyLabel").exists())
				.andExpect(jsonPath("$.components.schemas.PayoutRequestResponse.properties.currencyLabel").exists());
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
