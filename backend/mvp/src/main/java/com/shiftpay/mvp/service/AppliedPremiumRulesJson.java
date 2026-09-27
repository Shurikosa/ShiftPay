package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.AppliedPremiumRuleResponse;
import com.shiftpay.mvp.dto.SnapshotStatus;
import com.shiftpay.mvp.entity.PayPolicyRuleType;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Serializes and deserializes applied premium rule snapshots.
 */
public final class AppliedPremiumRulesJson {

	private static final JsonMapper JSON_MAPPER = JsonMapper.shared();
	private static final Logger LOGGER = LoggerFactory.getLogger(AppliedPremiumRulesJson.class);

	private AppliedPremiumRulesJson() {
	}

	/**
	 * Serializes applied rules into stable JSON text.
	 *
	 * @param appliedRules calculation-service applied rule snapshots
	 * @return JSON array text
	 */
	public static String write(List<AppliedPremiumRule> appliedRules) {
		try {
			ArrayNode rules = JSON_MAPPER.createArrayNode();
			for (AppliedPremiumRule rule : appliedRules) {
				ObjectNode node = rules.addObject();
				if (rule.id() != null) {
					node.put("id", rule.id());
				}
				node.put("name", rule.name());
				node.put("type", rule.type().name());
				node.put("premiumPercent", rule.premiumPercent());
			}
			return JSON_MAPPER.writeValueAsString(rules);
		}
		catch (JacksonException exception) {
			throw new IllegalArgumentException("Could not write applied premium rule snapshot", exception);
		}
	}

	/**
	 * Reads applied rule snapshots from persisted JSON text.
	 *
	 * @param appliedRulesSnapshot JSON array text
	 * @param paySegmentId persisted segment identifier used only for corruption observability
	 * @return response DTO snapshots and their availability status
	 */
	public static ReadResult read(String appliedRulesSnapshot, Long paySegmentId) {
		try {
			JsonNode root = JSON_MAPPER.readTree(appliedRulesSnapshot);
			if (root == null || !root.isArray()) {
				return unavailable(paySegmentId);
			}
			List<AppliedPremiumRuleResponse> rules = new ArrayList<>();
			for (JsonNode node : root) {
				if (!node.isObject()) {
					return unavailable(paySegmentId);
				}
				JsonNode id = node.get("id");
				JsonNode name = node.get("name");
				JsonNode type = node.get("type");
				JsonNode premiumPercent = node.get("premiumPercent");
				if (name == null || !name.isTextual()
						|| type == null || !type.isTextual()
						|| premiumPercent == null || !premiumPercent.isNumber()
						|| (id != null && !id.isNull() && !id.canConvertToLong())) {
					return unavailable(paySegmentId);
				}
				rules.add(new AppliedPremiumRuleResponse(
						id == null || id.isNull() ? null : id.longValue(),
						name.textValue(),
						PayPolicyRuleType.valueOf(type.textValue()),
						premiumPercent.decimalValue()
				));
			}
			return new ReadResult(SnapshotStatus.COMPLETE, List.copyOf(rules));
		}
		catch (JacksonException | IllegalArgumentException | NullPointerException exception) {
			return unavailable(paySegmentId);
		}
	}

	private static ReadResult unavailable(Long paySegmentId) {
		LOGGER.warn("event=PAY_CALCULATION_SNAPSHOT_UNAVAILABLE snapshot_type=applied_rules_snapshot pay_segment_id={}",
				paySegmentId);
		return new ReadResult(SnapshotStatus.UNAVAILABLE, null);
	}

	/** Result of reading one persisted applied-rule snapshot. */
	public record ReadResult(SnapshotStatus snapshotStatus, List<AppliedPremiumRuleResponse> appliedRules) {
	}
}
