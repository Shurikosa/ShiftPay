package com.shiftpay.mvp.dto;

import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

/** Preserve a non-string code as malformed so an active request spends an attempt. */
public class ResetCodeDeserializer extends ValueDeserializer<String> {
	@Override
	public String deserialize(JsonParser parser, DeserializationContext context) throws JacksonException {
		if (parser.currentToken() == JsonToken.VALUE_STRING) return parser.getText();
		parser.skipChildren();
		return "";
	}
}
