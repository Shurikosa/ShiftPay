package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.PayrollRoundingResult;
import com.shiftpay.mvp.exception.PayoutRequestConflictException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Owns payroll-specific minute and whole-money rounding rules.
 */
@Service
public class PayrollRoundingService {

	private static final int PAYOUT_MINUTE_INTERVAL = 5;
	private static final int HALF_UP_THRESHOLD_MINUTES = 3;
	private static final BigDecimal MINUTES_PER_HOUR = BigDecimal.valueOf(60);

	/**
	 * Calculates payroll rounding for one attendance row.
	 *
	 * @param rawPayableMinutes persisted worked minutes from shift close
	 * @param hourlyRate attendance hourly rate snapshot or override
	 * @return payroll rounding result
	 */
	public PayrollRoundingResult calculate(Integer rawPayableMinutes, BigDecimal hourlyRate) {
		if (rawPayableMinutes == null) {
			throw new PayoutRequestConflictException("Attendance is not payable");
		}
		if (rawPayableMinutes < 0) {
			throw new PayoutRequestConflictException("Attendance is not payable");
		}
		if (hourlyRate == null || hourlyRate.signum() < 0) {
			throw new PayoutRequestConflictException("Attendance is not payable");
		}

		int roundedMinutes = roundMinutes(rawPayableMinutes);
		BigDecimal roundedItemAmountExact = hourlyRate
				.multiply(BigDecimal.valueOf(roundedMinutes))
				.divide(MINUTES_PER_HOUR, 4, RoundingMode.HALF_UP);
		BigDecimal payoutAmount = roundedItemAmountExact.setScale(0, RoundingMode.CEILING);

		return new PayrollRoundingResult(
				rawPayableMinutes,
				roundedMinutes,
				roundedItemAmountExact,
				payoutAmount
		);
	}

	int roundMinutes(int rawPayableMinutes) {
		if (rawPayableMinutes == 0) {
			return 0;
		}
		int baseMinutes = Math.floorDiv(rawPayableMinutes, PAYOUT_MINUTE_INTERVAL) * PAYOUT_MINUTE_INTERVAL;
		int remainder = Math.floorMod(rawPayableMinutes, PAYOUT_MINUTE_INTERVAL);
		if (remainder >= HALF_UP_THRESHOLD_MINUTES) {
			return Math.addExact(baseMinutes, PAYOUT_MINUTE_INTERVAL);
		}
		return Math.max(PAYOUT_MINUTE_INTERVAL, baseMinutes);
	}
}
