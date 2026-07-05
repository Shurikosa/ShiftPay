package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.JoinShiftRequest;
import com.shiftpay.mvp.dto.JoinShiftResponse;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.AttendanceConflictException;
import com.shiftpay.mvp.exception.ShiftNotFoundException;
import com.shiftpay.mvp.exception.ShiftStateConflictException;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.ShiftSessionRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;

@Service
public class AttendanceService {

	private final ShiftAttendanceRepository shiftAttendanceRepository;
	private final ShiftSessionRepository shiftSessionRepository;
	private final UserRepository userRepository;

	public AttendanceService(
			ShiftAttendanceRepository shiftAttendanceRepository,
			ShiftSessionRepository shiftSessionRepository,
			UserRepository userRepository
	) {
		this.shiftAttendanceRepository = shiftAttendanceRepository;
		this.shiftSessionRepository = shiftSessionRepository;
		this.userRepository = userRepository;
	}

	@Transactional
	public JoinShiftResponse joinShift(JoinShiftRequest request, AuthenticatedUserPrincipal principal) {
		String normalizedJoinCode = request.joinCode().trim().toUpperCase(Locale.ROOT);
		ShiftSession shiftSession = shiftSessionRepository.findByJoinCode(normalizedJoinCode)
				.orElseThrow(ShiftNotFoundException::new);

		if (shiftSession.getStatus() != ShiftStatus.OPEN) {
			throw new ShiftStateConflictException("Workers can only join shifts with status OPEN");
		}

		User worker = userRepository.findById(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
		if (shiftAttendanceRepository.existsByShiftSessionIdAndWorkerId(shiftSession.getId(), worker.getId())) {
			throw new AttendanceConflictException("Worker has already joined this shift");
		}

		ShiftAttendance attendance = new ShiftAttendance();
		attendance.setShiftSession(shiftSession);
		attendance.setWorker(worker);
		attendance.setStatus(AttendanceStatus.JOINED);
		attendance.setHourlyRate(shiftSession.getDefaultHourlyRate());
		attendance.setBreakMinutes(shiftSession.getDefaultBreakMinutes());
		attendance.setJoinedAt(OffsetDateTime.now(ZoneOffset.UTC));

		try {
			return JoinShiftResponse.from(shiftAttendanceRepository.saveAndFlush(attendance));
		}
		catch (DataIntegrityViolationException exception) {
			throw new AttendanceConflictException("Worker has already joined this shift");
		}
	}
}
