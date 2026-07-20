package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.ApproveAttendanceRequest;
import com.shiftpay.mvp.dto.ApproveAttendanceResponse;
import com.shiftpay.mvp.dto.AttendanceResponse;
import com.shiftpay.mvp.dto.JoinShiftRequest;
import com.shiftpay.mvp.dto.JoinShiftResponse;
import com.shiftpay.mvp.dto.MyShiftHistoryResponse;
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

/**
 * Business service for worker attendance workflows.
 *
 * <p>It owns join, personal history, attendance list, and approval rules. Write operations are transactional and use
 * repository locks where needed so join, approval, start, and close operations serialize around shift state.</p>
 */
@Service
public class AttendanceService {

	private final ShiftAttendanceRepository shiftAttendanceRepository;
	private final ShiftSessionRepository shiftSessionRepository;
	private final UserRepository userRepository;

	/**
	 * Creates the service with repositories required for attendance workflows.
	 *
	 * @param shiftAttendanceRepository attendance repository
	 * @param shiftSessionRepository shift repository used for state checks and locks
	 * @param userRepository user repository used to resolve the authenticated worker
	 */
	public AttendanceService(
			ShiftAttendanceRepository shiftAttendanceRepository,
			ShiftSessionRepository shiftSessionRepository,
			UserRepository userRepository
	) {
		this.shiftAttendanceRepository = shiftAttendanceRepository;
		this.shiftSessionRepository = shiftSessionRepository;
		this.userRepository = userRepository;
	}

	/**
	 * Joins the authenticated worker to an OPEN shift by join code.
	 *
	 * <p>The method trims and uppercases the join code, locks the target shift, rejects non-open shifts and duplicate
	 * joins, copies the shift default hourly rate and break minutes into attendance, and stores the join timestamp in
	 * UTC. Workers never provide their own hourly rate.</p>
	 *
	 * @param request join request containing the join code
	 * @param principal authenticated worker principal
	 * @return created attendance response
	 */
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

	/**
	 * Reads shift history for the authenticated user as a worker.
	 *
	 * <p>All roles are filtered the same way: only attendance rows where the current user is the worker are returned.
	 * The endpoint does not recalculate salary; it returns persisted worked minutes and salary values.</p>
	 *
	 * @param principal authenticated user principal
	 * @return personal shift history ordered newest first
	 */
	@Transactional(readOnly = true)
	public List<MyShiftHistoryResponse> getMyShiftHistory(AuthenticatedUserPrincipal principal) {
		return shiftAttendanceRepository.findMyShiftHistoryByWorkerId(principal.id()).stream()
				.map(MyShiftHistoryResponse::from)
				.toList();
	}

	/**
	 * Lists attendance for one shift for a foreman owner or admin.
	 *
	 * <p>The service verifies the shift exists and applies ownership rules before fetching attendance with worker
	 * data to avoid N+1 queries.</p>
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated foreman or admin principal
	 * @return attendance rows for the shift
	 */
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

	/**
	 * Approves a joined worker attendance record while the shift is OPEN.
	 *
	 * <p>The method locks the shift first and attendance second, enforces owner/admin access, allows only
	 * JOINED-to-APPROVED transition, optionally overrides the attendance hourly rate, and records approval time in UTC.
	 * The attendance-specific rate override does not change the shift default rate.</p>
	 *
	 * @param shiftId shift id from the URL
	 * @param attendanceId attendance id from the URL
	 * @param request optional request with an attendance-specific hourly-rate override
	 * @param principal authenticated foreman or admin principal
	 * @return approval response for the updated attendance
	 */
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

	/**
	 * Verifies that the current principal may manage attendance for the shift.
	 *
	 * @param shiftSession shift being managed
	 * @param principal authenticated foreman or admin principal
	 */
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
