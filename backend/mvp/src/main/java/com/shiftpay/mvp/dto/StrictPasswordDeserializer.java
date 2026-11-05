package com.shiftpay.mvp.dto;

import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

/** Password syntax must be validated as a JSON string before code attempts. */
public class StrictPasswordDeserializer extends ValueDeserializer<String> {
	@Override
	public String deserialize(JsonParser parser, DeserializationContext context) throws JacksonException {
		if (parser.currentToken() != JsonToken.VALUE_STRING) {
			return context.reportInputMismatch(String.class, "newPassword must be a string");
		}
		return parser.getText();
	}
}
