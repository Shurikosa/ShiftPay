package com.shiftpay.mvp.dto;

import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Writes audit monetary values as plain JSON numbers with the fixed scale used for persisted audit amounts.
 */
public final class ScaleEightBigDecimalSerializer extends ValueSerializer<BigDecimal> {

	@Override
	public void serialize(BigDecimal value, JsonGenerator generator, SerializationContext context) throws JacksonException {
		generator.writeNumber(value.setScale(8, RoundingMode.UNNECESSARY).toPlainString());
	}
}
