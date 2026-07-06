package com.shiftpay.mvp.service;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.dto.ApproveAttendanceRequest;
import com.shiftpay.mvp.dto.JoinShiftRequest;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.Company;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.AttendanceConflictException;
import com.shiftpay.mvp.exception.ShiftStateConflictException;
import com.shiftpay.mvp.repository.CompanyRepository;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.ShiftSessionRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class AttendanceConcurrencyTests {

	private static final long WAIT_SECONDS = 5;

	@Autowired
	private AttendanceService attendanceService;

	@Autowired
	private ShiftSessionService shiftSessionService;

	@Autowired
	private CompanyRepository companyRepository;

	@Autowired
	private ShiftAttendanceRepository shiftAttendanceRepository;

	@Autowired
	private ShiftSessionRepository shiftSessionRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private TransactionTemplate transactionTemplate;

	@Autowired
	void setTransactionManager(PlatformTransactionManager transactionManager) {
		transactionTemplate = new TransactionTemplate(transactionManager);
	}

	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

	@Test
	void concurrentApprovalsProduceOneSuccessAndOneConflict() throws Exception {
		Scenario scenario = createScenario(ShiftStatus.OPEN);

		ConcurrentResults<?, ?> results = runWithFirstTransactionHeld(
				() -> attendanceService.approveAttendance(
						scenario.shift().getId(),
						scenario.attendance().getId(),
						new ApproveAttendanceRequest(null),
						scenario.foremanPrincipal()
				),
				() -> attendanceService.approveAttendance(
						scenario.shift().getId(),
						scenario.attendance().getId(),
						new ApproveAttendanceRequest(new BigDecimal("18.50")),
						scenario.foremanPrincipal()
				)
		);

		assertThat(results.first().error()).isNull();
		assertThat(results.second().error()).isInstanceOf(AttendanceConflictException.class);

		ShiftAttendance attendance = shiftAttendanceRepository.findById(scenario.attendance().getId()).orElseThrow();
		assertThat(attendance.getStatus()).isEqualTo(AttendanceStatus.APPROVED);
		assertThat(attendance.getHourlyRate()).isEqualByComparingTo("15.00");
	}

	@Test
	void approvalWaitsForConcurrentStartAndThenReturnsConflict() throws Exception {
		Scenario scenario = createScenario(ShiftStatus.OPEN);

		ConcurrentResults<?, ?> results = runWithFirstTransactionHeld(
				() -> shiftSessionService.startShift(
						scenario.shift().getId(),
						scenario.foremanPrincipal()
				),
				() -> attendanceService.approveAttendance(
						scenario.shift().getId(),
						scenario.attendance().getId(),
						new ApproveAttendanceRequest(null),
						scenario.foremanPrincipal()
				)
		);

		assertThat(results.first().error()).isNull();
		assertThat(results.second().error()).isInstanceOf(ShiftStateConflictException.class);
		assertThat(shiftAttendanceRepository.findById(scenario.attendance().getId()).orElseThrow().getStatus())
				.isEqualTo(AttendanceStatus.JOINED);
	}

	@Test
	void joinWaitsForConcurrentStartAndThenReturnsConflict() throws Exception {
		Scenario scenario = createScenario(ShiftStatus.OPEN);
		User secondWorker = createUser("second.worker@example.com", Role.WORKER);
		AuthenticatedUserPrincipal secondWorkerPrincipal = principal(secondWorker);

		ConcurrentResults<?, ?> results = runWithFirstTransactionHeld(
				() -> shiftSessionService.startShift(
						scenario.shift().getId(),
						scenario.foremanPrincipal()
				),
				() -> attendanceService.joinShift(
						new JoinShiftRequest(scenario.shift().getJoinCode()),
						secondWorkerPrincipal
				)
		);

		assertThat(results.first().error()).isNull();
		assertThat(results.second().error()).isInstanceOf(ShiftStateConflictException.class);
		assertThat(shiftAttendanceRepository.existsByShiftSessionIdAndWorkerId(
				scenario.shift().getId(),
				secondWorker.getId()
		)).isFalse();
	}

	@Test
	void concurrentCloseProducesOneSuccessAndOneConflict() throws Exception {
		Scenario scenario = createScenario(ShiftStatus.ACTIVE);

		ConcurrentResults<?, ?> results = runWithFirstTransactionHeld(
				() -> shiftSessionService.closeShift(
						scenario.shift().getId(),
						scenario.foremanPrincipal()
				),
				() -> shiftSessionService.closeShift(
						scenario.shift().getId(),
						scenario.foremanPrincipal()
				)
		);

		assertThat(results.first().error()).isNull();
		assertThat(results.second().error()).isInstanceOf(ShiftStateConflictException.class);
		assertThat(shiftSessionRepository.findById(scenario.shift().getId()).orElseThrow().getStatus())
				.isEqualTo(ShiftStatus.CLOSED);
	}

	private ConcurrentResults<?, ?> runWithFirstTransactionHeld(
			Supplier<?> firstOperation,
			Supplier<?> secondOperation
	) throws Exception {
		CountDownLatch firstOperationFinished = new CountDownLatch(1);
		CountDownLatch allowFirstCommit = new CountDownLatch(1);
		CountDownLatch secondOperationStarted = new CountDownLatch(1);
		ExecutorService executor = Executors.newFixedThreadPool(2);

		try {
			Future<OperationResult<?>> firstFuture = executor.submit(() -> capture(() ->
					transactionTemplate.execute((status) -> {
						Object result = firstOperation.get();
						firstOperationFinished.countDown();
						await(allowFirstCommit);
						return result;
					})
			));
			assertThat(firstOperationFinished.await(WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();

			Future<OperationResult<?>> secondFuture = executor.submit(() -> {
				secondOperationStarted.countDown();
				return capture(secondOperation);
			});
			assertThat(secondOperationStarted.await(WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();

			boolean secondWasBlocked;
			try {
				secondFuture.get(200, TimeUnit.MILLISECONDS);
				secondWasBlocked = false;
			}
			catch (TimeoutException exception) {
				secondWasBlocked = true;
			}
			finally {
				allowFirstCommit.countDown();
			}

			OperationResult<?> firstResult = firstFuture.get(WAIT_SECONDS, TimeUnit.SECONDS);
			OperationResult<?> secondResult = secondFuture.get(WAIT_SECONDS, TimeUnit.SECONDS);
			assertThat(secondWasBlocked).isTrue();
			return new ConcurrentResults<>(firstResult, secondResult);
		}
		finally {
			allowFirstCommit.countDown();
			executor.shutdownNow();
			assertThat(executor.awaitTermination(WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
		}
	}

	private OperationResult<?> capture(Supplier<?> operation) {
		try {
			return new OperationResult<>(operation.get(), null);
		}
		catch (Throwable throwable) {
			return new OperationResult<>(null, throwable);
		}
	}

	private void await(CountDownLatch latch) {
		try {
			if (!latch.await(WAIT_SECONDS, TimeUnit.SECONDS)) {
				throw new IllegalStateException("Timed out waiting for concurrent operation");
			}
		}
		catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException("Interrupted while waiting for concurrent operation", exception);
		}
	}

	private Scenario createScenario(ShiftStatus shiftStatus) {
		Company company = new Company();
		company.setName("Default Company");
		company = companyRepository.save(company);

		User foreman = createUser("foreman@example.com", Role.FOREMAN);
		User worker = createUser("worker@example.com", Role.WORKER);

		ShiftSession shift = new ShiftSession();
		shift.setCompany(company);
		shift.setTitle("Concurrent shift");
		shift.setJoinCode("LOCK01");
		shift.setStatus(shiftStatus);
		shift.setDefaultBreakMinutes(60);
		shift.setDefaultHourlyRate(new BigDecimal("15.00"));
		shift.setCreatedBy(foreman);
		if (shiftStatus == ShiftStatus.ACTIVE) {
			shift.setActualStartTime(OffsetDateTime.now(ZoneOffset.UTC).minusHours(1));
		}
		shift = shiftSessionRepository.save(shift);

		ShiftAttendance attendance = new ShiftAttendance();
		attendance.setShiftSession(shift);
		attendance.setWorker(worker);
		attendance.setStatus(AttendanceStatus.JOINED);
		attendance.setHourlyRate(new BigDecimal("15.00"));
		attendance.setBreakMinutes(60);
		attendance.setJoinedAt(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(30));
		attendance = shiftAttendanceRepository.save(attendance);

		return new Scenario(shift, attendance, principal(foreman));
	}

	private User createUser(String email, Role role) {
		User user = new User();
		user.setEmail(email);
		user.setPasswordHash("not-used-in-concurrency-tests");
		user.setFirstName("Test");
		user.setLastName("User");
		user.setRole(role);
		return userRepository.save(user);
	}

	private AuthenticatedUserPrincipal principal(User user) {
		return new AuthenticatedUserPrincipal(user.getId(), user.getEmail(), user.getRole());
	}

	private record Scenario(
			ShiftSession shift,
			ShiftAttendance attendance,
			AuthenticatedUserPrincipal foremanPrincipal
	) {
	}

	private record OperationResult<T>(T value, Throwable error) {
	}

	private record ConcurrentResults<T, U>(
			OperationResult<T> first,
			OperationResult<U> second
	) {
	}
}
