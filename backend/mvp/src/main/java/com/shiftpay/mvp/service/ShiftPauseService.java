package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.PauseResponse;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.PauseScope;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftPauseInterval;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.ForbiddenException;
import com.shiftpay.mvp.exception.ShiftNotFoundException;
import com.shiftpay.mvp.exception.ShiftStateConflictException;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.ShiftPauseIntervalRepository;
import com.shiftpay.mvp.repository.ShiftSessionRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;

/**
 * Business service for shift pause lifecycle operations.
 */
@Service
public class ShiftPauseService {

	private final ShiftAttendanceRepository shiftAttendanceRepository;
	private final ShiftPauseIntervalRepository shiftPauseIntervalRepository;
	private final ShiftSessionRepository shiftSessionRepository;
	private final UserRepository userRepository;

	/**
	 * Creates the pause service with repositories used for state, authorization, and persistence.
	 *
	 * @param shiftAttendanceRepository attendance repository for worker participation checks
	 * @param shiftPauseIntervalRepository pause interval repository
	 * @param shiftSessionRepository shift repository for lifecycle locks
	 * @param userRepository user repository for current user/company lookup
	 */
	public ShiftPauseService(
			ShiftAttendanceRepository shiftAttendanceRepository,
			ShiftPauseIntervalRepository shiftPauseIntervalRepository,
			ShiftSessionRepository shiftSessionRepository,
			UserRepository userRepository
	) {
		this.shiftAttendanceRepository = shiftAttendanceRepository;
		this.shiftPauseIntervalRepository = shiftPauseIntervalRepository;
		this.shiftSessionRepository = shiftSessionRepository;
		this.userRepository = userRepository;
	}

	/**
	 * Starts a personal pause for the current worker or owner foreman.
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated worker or foreman principal
	 * @return created active pause interval response
	 */
	@Transactional
	public PauseResponse startMyPause(Long shiftId, AuthenticatedUserPrincipal principal) {
		ShiftSession shiftSession = findShiftForPause(shiftId);
		validateActiveShiftForPause(shiftSession);
		User targetUser = validatePersonalPauseAccess(shiftSession, principal);

		if (shiftPauseIntervalRepository.findActivePersonalForUpdate(shiftId, targetUser.getId()).isPresent()) {
			throw new ShiftStateConflictException("Personal pause is already active");
		}

		ShiftPauseInterval pauseInterval = new ShiftPauseInterval();
		pauseInterval.setShiftSession(shiftSession);
		pauseInterval.setScope(PauseScope.PERSONAL);
		pauseInterval.setUser(targetUser);
		pauseInterval.setStartedAt(OffsetDateTime.now(ZoneOffset.UTC));
		return PauseResponse.from(shiftPauseIntervalRepository.saveAndFlush(pauseInterval));
	}

	/**
	 * Ends a personal pause for the current worker or owner foreman.
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated worker or foreman principal
	 * @return ended pause interval response
	 */
	@Transactional
	public PauseResponse endMyPause(Long shiftId, AuthenticatedUserPrincipal principal) {
		ShiftSession shiftSession = findShiftForPause(shiftId);
		validateActiveShiftForPause(shiftSession);
		User targetUser = validatePersonalPauseAccess(shiftSession, principal);

		ShiftPauseInterval pauseInterval = shiftPauseIntervalRepository
				.findActivePersonalForUpdate(shiftId, targetUser.getId())
				.orElseThrow(() -> new ShiftStateConflictException("No active personal pause to end"));
		pauseInterval.setEndedAt(OffsetDateTime.now(ZoneOffset.UTC));
		return PauseResponse.from(pauseInterval);
	}

	/**
	 * Starts an all-participant pause for an owner foreman.
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated owner foreman principal
	 * @return created active pause interval response
	 */
	@Transactional
	public PauseResponse startAllPause(Long shiftId, AuthenticatedUserPrincipal principal) {
		ShiftSession shiftSession = findShiftForPause(shiftId);
		validateOwnerForemanAccess(shiftSession, principal);
		validateForemanCompanyConsistency(shiftSession, principal);
		validateActiveShiftForPause(shiftSession);

		if (shiftPauseIntervalRepository.findActiveAllForUpdate(shiftId).isPresent()) {
			throw new ShiftStateConflictException("All pause is already active");
		}

		ShiftPauseInterval pauseInterval = new ShiftPauseInterval();
		pauseInterval.setShiftSession(shiftSession);
		pauseInterval.setScope(PauseScope.ALL);
		pauseInterval.setStartedAt(OffsetDateTime.now(ZoneOffset.UTC));
		return PauseResponse.from(shiftPauseIntervalRepository.saveAndFlush(pauseInterval));
	}

	/**
	 * Ends an all-participant pause for an owner foreman.
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated owner foreman principal
	 * @return ended pause interval response
	 */
	@Transactional
	public PauseResponse endAllPause(Long shiftId, AuthenticatedUserPrincipal principal) {
		ShiftSession shiftSession = findShiftForPause(shiftId);
		validateOwnerForemanAccess(shiftSession, principal);
		validateForemanCompanyConsistency(shiftSession, principal);
		validateActiveShiftForPause(shiftSession);

		ShiftPauseInterval pauseInterval = shiftPauseIntervalRepository
				.findActiveAllForUpdate(shiftId)
				.orElseThrow(() -> new ShiftStateConflictException("No active all pause to end"));
		pauseInterval.setEndedAt(OffsetDateTime.now(ZoneOffset.UTC));
		return PauseResponse.from(pauseInterval);
	}

	private ShiftSession findShiftForPause(Long shiftId) {
		return shiftSessionRepository.findByIdForUpdate(shiftId)
				.orElseThrow(ShiftNotFoundException::new);
	}

	private void validateActiveShiftForPause(ShiftSession shiftSession) {
		if (shiftSession.getStatus() != ShiftStatus.ACTIVE) {
			throw new ShiftStateConflictException("Pause is available only while shift status is ACTIVE");
		}
	}

	private User validatePersonalPauseAccess(ShiftSession shiftSession, AuthenticatedUserPrincipal principal) {
		User currentUser = userRepository.findWithCompanyById(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
		if (principal.role() == Role.FOREMAN) {
			validateOwnerForemanAccess(shiftSession, principal);
			validateForemanCompanyConsistency(shiftSession, principal);
			return currentUser;
		}
		if (principal.role() != Role.WORKER) {
			throw new ForbiddenException();
		}
		if (currentUser.getCompany() == null
				|| !Objects.equals(currentUser.getCompany().getId(), shiftSession.getCompany().getId())) {
			throw new ForbiddenException("Worker must belong to the shift company before pausing");
		}
		ShiftAttendance attendance = shiftAttendanceRepository
				.findByShiftSessionIdAndWorkerId(shiftSession.getId(), currentUser.getId())
				.orElseThrow(() -> new ForbiddenException("Worker must join this shift before pausing"));
		if (!Objects.equals(attendance.getShiftSession().getCompany().getId(), currentUser.getCompany().getId())) {
			throw new ForbiddenException("Worker must belong to the shift company before pausing");
		}
		if (attendance.getStatus() != AttendanceStatus.APPROVED) {
			throw new ForbiddenException("Worker must be approved for this shift before pausing");
		}
		return currentUser;
	}

	private void validateOwnerForemanAccess(ShiftSession shiftSession, AuthenticatedUserPrincipal principal) {
		if (principal.role() == Role.FOREMAN
				&& Objects.equals(shiftSession.getCreatedBy().getId(), principal.id())) {
			return;
		}
		throw new ForbiddenException();
	}

	private void validateForemanCompanyConsistency(ShiftSession shiftSession, AuthenticatedUserPrincipal principal) {
		User foreman = userRepository.findWithCompanyById(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
		if (foreman.getCompany() == null
				|| !Objects.equals(foreman.getCompany().getId(), shiftSession.getCompany().getId())) {
			throw new ForbiddenException("Foreman must belong to the shift company");
		}
	}
}
