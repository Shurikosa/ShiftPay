package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.ApproveAttendanceRequest;
import com.shiftpay.mvp.dto.ApproveAttendanceResponse;
import com.shiftpay.mvp.dto.AttendanceResponse;
import com.shiftpay.mvp.dto.JoinShiftRequest;
import com.shiftpay.mvp.dto.JoinShiftResponse;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.AttendanceConflictException;
import com.shiftpay.mvp.exception.AttendanceNotFoundException;
import com.shiftpay.mvp.exception.ForbiddenException;
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
import java.util.List;
import java.util.Locale;
import java.util.Objects;

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
		ShiftSession shiftSession = shiftSessionRepository.findByJoinCodeForUpdate(normalizedJoinCode)
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

	@Transactional(readOnly = true)
	public List<AttendanceResponse> getShiftAttendance(
			Long shiftId,
			AuthenticatedUserPrincipal principal
	) {
		ShiftSession shiftSession = shiftSessionRepository.findById(shiftId)
				.orElseThrow(ShiftNotFoundException::new);
		validateAttendanceManagementAccess(shiftSession, principal);

		return shiftAttendanceRepository.findAllByShiftSessionIdWithWorker(shiftId).stream()
				.map(AttendanceResponse::from)
				.toList();
	}

	@Transactional
	public ApproveAttendanceResponse approveAttendance(
			Long shiftId,
			Long attendanceId,
			ApproveAttendanceRequest request,
			AuthenticatedUserPrincipal principal
	) {
		ShiftSession shiftSession = shiftSessionRepository.findByIdForUpdate(shiftId)
				.orElseThrow(ShiftNotFoundException::new);
		validateAttendanceManagementAccess(shiftSession, principal);

		ShiftAttendance attendance = shiftAttendanceRepository
				.findByIdAndShiftSessionIdForUpdate(attendanceId, shiftId)
				.orElseThrow(AttendanceNotFoundException::new);

		if (shiftSession.getStatus() != ShiftStatus.OPEN) {
			throw new ShiftStateConflictException("Attendance can only be approved while shift status is OPEN");
		}
		if (attendance.getStatus() != AttendanceStatus.JOINED) {
			throw new AttendanceConflictException("Attendance can only be approved when status is JOINED");
		}

		if (request != null && request.hourlyRate() != null) {
			attendance.setHourlyRate(request.hourlyRate());
		}
		attendance.setStatus(AttendanceStatus.APPROVED);
		attendance.setApprovedAt(OffsetDateTime.now(ZoneOffset.UTC));

		return ApproveAttendanceResponse.from(attendance);
	}

	private void validateAttendanceManagementAccess(
			ShiftSession shiftSession,
			AuthenticatedUserPrincipal principal
	) {
		if (principal.role() == Role.ADMIN) {
			return;
		}
		if (principal.role() == Role.FOREMAN
				&& Objects.equals(shiftSession.getCreatedBy().getId(), principal.id())) {
			return;
		}
		throw new ForbiddenException();
	}
}
