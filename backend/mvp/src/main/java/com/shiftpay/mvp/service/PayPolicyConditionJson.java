package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.HolidayDateCondition;
import com.shiftpay.mvp.dto.PayPolicyRuleCondition;
import com.shiftpay.mvp.exception.BadRequestException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Converts pay policy rule condition DTOs to canonical JSON and back.
 */
public final class PayPolicyConditionJson {

	private static final JsonMapper JSON_MAPPER = JsonMapper.shared();

	private PayPolicyConditionJson() {
	}

	/**
	 * Serializes a validated condition into canonical JSON text.
	 *
	 * @param condition validated rule condition
	 * @return JSON text for database storage
	 */
	public static String write(PayPolicyRuleCondition condition) {
		try {
			ObjectNode node = JSON_MAPPER.createObjectNode();
			if (condition.startTime() != null) {
				node.put("startTime", condition.startTime().toString());
			}
			if (condition.endTime() != null) {
				node.put("endTime", condition.endTime().toString());
			}
			if (condition.thresholdMinutes() != null) {
				node.put("thresholdMinutes", condition.thresholdMinutes());
			}
			if (condition.weekdays() != null) {
				ArrayNode weekdays = node.putArray("weekdays");
				for (DayOfWeek weekday : condition.weekdays()) {
					weekdays.add(weekday.name());
				}
			}
			if (condition.dates() != null) {
				ArrayNode dates = node.putArray("dates");
				for (HolidayDateCondition date : condition.dates()) {
					ObjectNode dateNode = dates.addObject();
					dateNode.put("date", date.date().toString());
					if (date.label() != null) {
						dateNode.put("label", date.label());
					}
				}
			}
			return JSON_MAPPER.writeValueAsString(node);
		}
		catch (JacksonException exception) {
			throw new IllegalStateException("Failed to serialize pay policy rule condition", exception);
		}
	}

	/**
	 * Reads persisted condition JSON.
	 *
	 * @param conditionConfig JSON text from a PayPolicyRule
	 * @return structured condition DTO
	 */
	public static PayPolicyRuleCondition read(String conditionConfig) {
		if (conditionConfig == null || conditionConfig.isBlank()) {
			throw new BadRequestException("condition: is required");
		}
		try {
			JsonNode node = JSON_MAPPER.readTree(conditionConfig);
			if (node == null || !node.isObject()) {
				throw new BadRequestException("condition: must be an object");
			}
			return new PayPolicyRuleCondition(
					readLocalTime(node, "startTime"),
					readLocalTime(node, "endTime"),
					readInteger(node, "thresholdMinutes"),
					readWeekdays(node.get("weekdays")),
					readHolidayDates(node.get("dates"))
			);
		}
		catch (JacksonException exception) {
			throw new BadRequestException("condition: must be valid JSON");
		}
	}

	/**
	 * Builds a canonical condition containing only fields relevant to the rule type.
	 *
	 * @param startTime time-of-day start
	 * @param endTime time-of-day end
	 * @return condition DTO
	 */
	public static PayPolicyRuleCondition timeOfDay(LocalTime startTime, LocalTime endTime) {
		return new PayPolicyRuleCondition(startTime, endTime, null, null, null);
	}

	/**
	 * Builds an overtime condition.
	 *
	 * @param thresholdMinutes threshold minutes
	 * @return condition DTO
	 */
	public static PayPolicyRuleCondition overtime(int thresholdMinutes) {
		return new PayPolicyRuleCondition(null, null, thresholdMinutes, null, null);
	}

	/**
	 * Builds a day-of-week condition.
	 *
	 * @param weekdays weekday set
	 * @return condition DTO
	 */
	public static PayPolicyRuleCondition dayOfWeek(List<DayOfWeek> weekdays) {
		return new PayPolicyRuleCondition(null, null, null, weekdays, null);
	}

	/**
	 * Builds a manual holiday condition.
	 *
	 * @param dates holiday local dates with optional labels
	 * @return condition DTO
	 */
	public static PayPolicyRuleCondition holiday(List<HolidayDateCondition> dates) {
		return new PayPolicyRuleCondition(null, null, null, null, dates);
	}

	private static LocalTime readLocalTime(JsonNode node, String fieldName) {
		JsonNode field = node.get(fieldName);
		if (field == null || field.isNull()) {
			return null;
		}
		if (!field.isTextual()) {
			throw new BadRequestException("condition." + fieldName + ": must be a local time");
		}
		try {
			return LocalTime.parse(field.asString());
		}
		catch (DateTimeParseException exception) {
			throw new BadRequestException("condition." + fieldName + ": must be a valid local time");
		}
	}

	private static Integer readInteger(JsonNode node, String fieldName) {
		JsonNode field = node.get(fieldName);
		if (field == null || field.isNull()) {
			return null;
		}
		if (!field.isIntegralNumber()) {
			throw new BadRequestException("condition." + fieldName + ": must be an integer");
		}
		return field.intValue();
	}

	private static List<DayOfWeek> readWeekdays(JsonNode node) {
		if (node == null || node.isNull()) {
			return null;
		}
		if (!node.isArray()) {
			throw new BadRequestException("condition.weekdays: must be an array");
		}
		List<DayOfWeek> weekdays = new ArrayList<>();
		for (JsonNode weekdayNode : node.asArray()) {
			if (!weekdayNode.isTextual()) {
				throw new BadRequestException("condition.weekdays: must contain weekday names");
			}
			try {
				weekdays.add(DayOfWeek.valueOf(weekdayNode.asString()));
			}
			catch (IllegalArgumentException exception) {
				throw new BadRequestException("condition.weekdays: contains invalid weekday");
			}
		}
		return weekdays;
	}

	private static List<HolidayDateCondition> readHolidayDates(JsonNode node) {
		if (node == null || node.isNull()) {
			return null;
		}
		if (!node.isArray()) {
			throw new BadRequestException("condition.dates: must be an array");
		}
		List<HolidayDateCondition> dates = new ArrayList<>();
		for (JsonNode dateNode : node.asArray()) {
			if (!dateNode.isObject()) {
				throw new BadRequestException("condition.dates: must contain objects");
			}
			JsonNode valueNode = dateNode.get("date");
			if (valueNode == null || !valueNode.isTextual()) {
				throw new BadRequestException("condition.dates.date: is required");
			}
			LocalDate date;
			try {
				date = LocalDate.parse(valueNode.asString());
			}
			catch (DateTimeParseException exception) {
				throw new BadRequestException("condition.dates.date: must be a valid local date");
			}
			JsonNode labelNode = dateNode.get("label");
			String label = labelNode == null || labelNode.isNull() ? null : labelNode.asString();
			dates.add(new HolidayDateCondition(date, label));
		}
		return dates;
	}
}
