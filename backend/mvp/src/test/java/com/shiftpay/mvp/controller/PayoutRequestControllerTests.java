package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.Company;
import com.shiftpay.mvp.entity.PaymentStatus;
import com.shiftpay.mvp.entity.PayoutRequest;
import com.shiftpay.mvp.entity.PayoutRequestItem;
import com.shiftpay.mvp.entity.PayoutRequestStatus;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.CompanyRepository;
import com.shiftpay.mvp.repository.PayoutRequestItemRepository;
import com.shiftpay.mvp.repository.PayoutRequestRepository;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.ShiftSessionRepository;
import com.shiftpay.mvp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller integration tests for Payroll Requests MVP endpoints.
 */
@SpringBootTest
@AutoConfigureMockMvc
class PayoutRequestControllerTests {

	private static final String REGISTER_URL = "/api/v1/auth/register";
	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String CREATE_COMPANY_URL = "/api/v1/companies";
	private static final String JOIN_COMPANY_URL = "/api/v1/companies/join";
	private static final String CREATE_SHIFT_URL = "/api/v1/shifts";
	private static final String JOIN_SHIFT_URL = "/api/v1/shifts/join";
	private static final String PAYABLE_ATTENDANCES_URL = "/api/v1/me/payable-attendances";
	private static final String PAYOUT_PREVIEW_URL = "/api/v1/me/payout-requests/preview";
	private static final String PAYOUT_REQUESTS_URL = "/api/v1/me/payout-requests";
	private static final String MANAGED_PAYOUT_REQUESTS_URL = "/api/v1/me/managed-payout-requests";
	private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\":\"([^\"]+)\"");
	private static final Pattern COMPANY_ID_PATTERN = Pattern.compile("\"id\":(\\d+)");
	private static final Pattern JOIN_CODE_PATTERN = Pattern.compile("\"joinCode\":\"([^\"]+)\"");
	private static final Pattern SHIFT_ID_PATTERN = Pattern.compile("\"id\":(\\d+)");
	private static final Pattern ATTENDANCE_ID_PATTERN = Pattern.compile("\"attendanceId\":(\\d+)");
	private static final Pattern PAYOUT_REQUEST_ID_PATTERN = Pattern.compile("\"id\":(\\d+)");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private CompanyRepository companyRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private PayoutRequestItemRepository payoutRequestItemRepository;

	@Autowired
	private PayoutRequestRepository payoutRequestRepository;

	@Autowired
	private ShiftAttendanceRepository shiftAttendanceRepository;

	@Autowired
	private ShiftSessionRepository shiftSessionRepository;

	@Autowired
	private UserRepository userRepository;

	/**
	 * Clears data before each payroll scenario.
	 */
	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

	/**
	 * Lists only CLOSED, APPROVED, UNPAID attendance for the current worker and includes backend payout rounding.
	 */
	@Test
	void workerListsPayableAttendancesWithFiltersAndRounding() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long payableAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Payable shift",
				467,
				"15.00",
				"116.75"
		);
		long paidAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Paid shift",
				60,
				"15.00",
				"15.00"
		);
		setPaymentStatus(paidAttendanceId, PaymentStatus.PAID);
		long requestedAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Requested shift",
				60,
				"15.00",
				"15.00"
		);
		setPaymentStatus(requestedAttendanceId, PaymentStatus.PAYMENT_REQUESTED);
		long unapprovedAttendanceId = createAttendance(
				foremanToken,
				workerToken,
				"Unapproved shift",
				ShiftStatus.CLOSED,
				AttendanceStatus.JOINED,
				30,
				"15.00",
				"7.50"
		);
		String otherWorkerToken = registerAndLogin("other.worker@example.com", "WORKER");
		long otherWorkerAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				otherWorkerToken,
				"Other worker shift",
				45,
				"15.00",
				"11.25"
		);

		getPayableAttendances(workerToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].attendanceId").value(payableAttendanceId))
				.andExpect(jsonPath("$[0].paymentStatus").value("UNPAID"))
				.andExpect(jsonPath("$[0].rawPayableMinutes").value(467))
				.andExpect(jsonPath("$[0].payoutRoundedMinutes").value(465))
				.andExpect(jsonPath("$[0].hourlyRate").value(15.00))
				.andExpect(jsonPath("$[0].calculatedSalary").value(116.75))
				.andExpect(jsonPath("$[0].payoutAmount").value(117))
				.andExpect(jsonPath("$[0].title").value(containsString("Acme Construction")))
				.andExpect(jsonPath("$[0].foremanHourlyRate").doesNotExist())
				.andExpect(jsonPath("$[0].foremanSalary").doesNotExist())
				.andExpect(jsonPath("$[?(@.attendanceId == %d)]".formatted(paidAttendanceId)).isEmpty())
				.andExpect(jsonPath("$[?(@.attendanceId == %d)]".formatted(requestedAttendanceId)).isEmpty())
				.andExpect(jsonPath("$[?(@.attendanceId == %d)]".formatted(unapprovedAttendanceId)).isEmpty())
				.andExpect(jsonPath("$[?(@.attendanceId == %d)]".formatted(otherWorkerAttendanceId)).isEmpty());
	}

	/**
	 * Previews selected attendance and verifies no request rows or attendance state changes are persisted.
	 */
	@Test
	void previewPayoutRequestCalculatesTotalsWithoutMutation() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Preview shift",
				467,
				"15.00",
				"116.75"
		);

		previewPayoutRequest(workerToken, attendanceId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.rawPayableMinutes").value(467))
				.andExpect(jsonPath("$.payoutRoundedMinutes").value(465))
				.andExpect(jsonPath("$.exactCalculatedAmount").value(116.75))
				.andExpect(jsonPath("$.payoutAmount").value(117))
				.andExpect(jsonPath("$.items", hasSize(1)))
				.andExpect(jsonPath("$.items[0].attendanceId").value(attendanceId))
				.andExpect(jsonPath("$.items[0].paymentStatus").value("UNPAID"))
				.andExpect(jsonPath("$.items[0].payoutRoundedMinutes").value(465))
				.andExpect(jsonPath("$.items[0].payoutAmount").value(117));

		assertThat(payoutRequestRepository.count()).isZero();
		assertThat(payoutRequestItemRepository.count()).isZero();
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		assertThat(attendance.getPaymentStatus()).isEqualTo(PaymentStatus.UNPAID);
		assertThat(attendance.getPaidAt()).isNull();
	}

	/**
	 * Creates a pending payout request, snapshots item values, and marks selected attendance as PAYMENT_REQUESTED.
	 */
	@Test
	void workerCreatesPayoutRequestAndSelectedAttendanceBecomesPaymentRequested() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long firstAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"First payout shift",
				467,
				"15.00",
				"116.75"
		);
		long secondAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Zero payout shift",
				0,
				"15.00",
				"0.00"
		);

		MvcResult result = createPayoutRequest(workerToken, firstAttendanceId, secondAttendanceId)
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value("PENDING"))
				.andExpect(jsonPath("$.rawPayableMinutes").value(467))
				.andExpect(jsonPath("$.payoutRoundedMinutes").value(465))
				.andExpect(jsonPath("$.exactCalculatedAmount").value(116.75))
				.andExpect(jsonPath("$.payoutAmount").value(117))
				.andExpect(jsonPath("$.requestedAt").isString())
				.andExpect(jsonPath("$.approvedAt").value((Object) null))
				.andExpect(jsonPath("$.paidAt").value((Object) null))
				.andExpect(jsonPath("$.items", hasSize(2)))
				.andExpect(jsonPath("$.items[0].paymentStatus").value("PAYMENT_REQUESTED"))
				.andExpect(jsonPath("$.items[1].rawPayableMinutes").value(0))
				.andExpect(jsonPath("$.items[1].payoutRoundedMinutes").value(0))
				.andExpect(jsonPath("$.items[1].payoutAmount").value(0))
				.andReturn();

		long requestId = extractLong(result, PAYOUT_REQUEST_ID_PATTERN);
		PayoutRequest payoutRequest = payoutRequestRepository.findById(requestId).orElseThrow();
		assertThat(payoutRequest.getStatus()).isEqualTo(PayoutRequestStatus.PENDING);
		assertThat(payoutRequest.getRawPayableMinutesTotal()).isEqualTo(467);
		assertThat(payoutRequest.getPayoutRoundedMinutesTotal()).isEqualTo(465);
		assertThat(payoutRequest.getExactCalculatedAmountTotal()).isEqualByComparingTo("116.75");
		assertThat(payoutRequest.getPayoutAmount()).isEqualByComparingTo("117");
		assertThat(payoutRequestItemRepository.findAll()).hasSize(2);
		assertThat(shiftAttendanceRepository.findById(firstAttendanceId).orElseThrow().getPaymentStatus())
				.isEqualTo(PaymentStatus.PAYMENT_REQUESTED);
		assertThat(shiftAttendanceRepository.findById(secondAttendanceId).orElseThrow().getPaymentStatus())
				.isEqualTo(PaymentStatus.PAYMENT_REQUESTED);
	}

	/**
	 * Keeps pending item responses tied to the payout request state instead of mutable live attendance state.
	 */
	@Test
	void pendingPayoutItemResponseDoesNotReadLiveAttendancePaymentStatus() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Pending snapshot shift",
				60,
				"15.00",
				"15.00"
		);
		long requestId = createPayoutRequestAndGetId(workerToken, attendanceId);
		setPaymentStatus(attendanceId, PaymentStatus.UNPAID);

		getPayoutRequests(workerToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].id").value(requestId))
				.andExpect(jsonPath("$[0].status").value("PENDING"))
				.andExpect(jsonPath("$[0].items[0].attendanceId").value(attendanceId))
				.andExpect(jsonPath("$[0].items[0].paymentStatus").value("PAYMENT_REQUESTED"));
	}

	/**
	 * Rejects duplicate attendance ids with 400 for both preview and create.
	 */
	@Test
	void duplicateAttendanceIdsReturnBadRequestForPreviewAndCreate() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Duplicate shift",
				60,
				"15.00",
				"15.00"
		);

		previewPayoutRequest(workerToken, attendanceId, attendanceId)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("attendanceIds: must not contain duplicates"))
				.andExpect(jsonPath("$.path").value(PAYOUT_PREVIEW_URL));

		createPayoutRequest(workerToken, attendanceId, attendanceId)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("attendanceIds: must not contain duplicates"))
				.andExpect(jsonPath("$.path").value(PAYOUT_REQUESTS_URL));

		assertThat(payoutRequestRepository.count()).isZero();
		assertThat(shiftAttendanceRepository.findById(attendanceId).orElseThrow().getPaymentStatus())
				.isEqualTo(PaymentStatus.UNPAID);
	}

	/**
	 * Rejects empty selections with 400 for both preview and create.
	 */
	@Test
	void emptyAttendanceIdsReturnBadRequestForPreviewAndCreate() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		createClosedApprovedAttendance(foremanToken, workerToken, "Empty selection shift", 60, "15.00", "15.00");

		previewPayoutRequestWithBody(workerToken, "{\"attendanceIds\":[]}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("attendanceIds: must not be empty"))
				.andExpect(jsonPath("$.path").value(PAYOUT_PREVIEW_URL));

		createPayoutRequestWithBody(workerToken, "{\"attendanceIds\":[]}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("attendanceIds: must not be empty"))
				.andExpect(jsonPath("$.path").value(PAYOUT_REQUESTS_URL));
	}

	/**
	 * Rejects non-payable attendance states and payment states with the documented 409 errors.
	 */
	@Test
	void cannotRequestNonPayablePaidOrAlreadyRequestedAttendance() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long openAttendanceId = createAttendance(
				foremanToken,
				workerToken,
				"Open shift",
				ShiftStatus.OPEN,
				AttendanceStatus.APPROVED,
				60,
				"15.00",
				"15.00"
		);
		long unapprovedAttendanceId = createAttendance(
				foremanToken,
				workerToken,
				"Unapproved shift",
				ShiftStatus.CLOSED,
				AttendanceStatus.JOINED,
				60,
				"15.00",
				"15.00"
		);
		long paidAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Paid shift",
				60,
				"15.00",
				"15.00"
		);
		setPaymentStatus(paidAttendanceId, PaymentStatus.PAID);
		long requestedAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Requested shift",
				60,
				"15.00",
				"15.00"
		);
		setPaymentStatus(requestedAttendanceId, PaymentStatus.PAYMENT_REQUESTED);
		long discardedAttendanceId = createAttendance(
				foremanToken,
				workerToken,
				"Discarded shift",
				ShiftStatus.DISCARDED,
				AttendanceStatus.APPROVED,
				null,
				"15.00",
				null
		);

		createPayoutRequest(workerToken, openAttendanceId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("Attendance is not payable"));
		createPayoutRequest(workerToken, unapprovedAttendanceId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("Attendance is not payable"));
		createPayoutRequest(workerToken, paidAttendanceId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("Attendance is already paid"));
		createPayoutRequest(workerToken, requestedAttendanceId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message")
						.value("Attendance is already included in a pending payout request"));
		previewPayoutRequest(workerToken, discardedAttendanceId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("Attendance is not payable"));
		createPayoutRequest(workerToken, discardedAttendanceId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("Attendance is not payable"));
	}

	/**
	 * Hides other workers' attendance by returning the existing attendance not-found pattern.
	 */
	@Test
	void workerCannotRequestAnotherWorkersAttendance() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		String otherWorkerToken = registerAndLogin("other.worker@example.com", "WORKER");
		long otherAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				otherWorkerToken,
				"Other worker shift",
				60,
				"15.00",
				"15.00"
		);

		createPayoutRequest(workerToken, otherAttendanceId)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("Attendance not found"));
	}

	/**
	 * Rejects selected attendance managed by more than one foreman in the MVP.
	 */
	@Test
	void workerCannotCreatePayoutRequestAcrossMultipleForemen() throws Exception {
		String firstForemanToken = registerAndLogin("first.foreman@example.com", "FOREMAN");
		String secondForemanToken = registerAndLoginWithoutCompany("second.foreman@example.com", "FOREMAN");
		assignUserToFirstCompany("second.foreman@example.com");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long firstAttendanceId = createClosedApprovedAttendance(
				firstForemanToken,
				workerToken,
				"First foreman shift",
				60,
				"15.00",
				"15.00"
		);
		long secondAttendanceId = createClosedApprovedAttendance(
				secondForemanToken,
				workerToken,
				"Second foreman shift",
				60,
				"15.00",
				"15.00"
		);

		createPayoutRequest(workerToken, firstAttendanceId, secondAttendanceId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message")
						.value("Payout request items must belong to shifts managed by the same foreman"));
	}

	/**
	 * Lists payout requests for the current worker only.
	 */
	@Test
	void workerListsOwnPayoutRequestsOnly() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		String otherWorkerToken = registerAndLogin("other.worker@example.com", "WORKER");
		long attendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Worker request shift",
				60,
				"15.00",
				"15.00"
		);
		long otherAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				otherWorkerToken,
				"Other request shift",
				60,
				"15.00",
				"15.00"
		);
		long requestId = createPayoutRequestAndGetId(workerToken, attendanceId);
		long otherRequestId = createPayoutRequestAndGetId(otherWorkerToken, otherAttendanceId);

		getPayoutRequests(workerToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].id").value(requestId))
				.andExpect(jsonPath("$[0].workerFirstName").value("Test"))
				.andExpect(jsonPath("$[0].workerLastName").value("User"))
				.andExpect(jsonPath("$[0].items", hasSize(1)))
				.andExpect(jsonPath("$[0].items[0].attendanceId").value(attendanceId))
				.andExpect(jsonPath("$[0].foremanHourlyRate").doesNotExist())
				.andExpect(jsonPath("$[?(@.id == %d)]".formatted(otherRequestId)).isEmpty());
	}

	/**
	 * Lists only pending managed payout requests for the current foreman by default.
	 */
	@Test
	void foremanListsManagedPayoutRequestsOnly() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String otherForemanToken = registerAndLoginWithoutCompany("other.foreman@example.com", "FOREMAN");
		assignUserToFirstCompany("other.foreman@example.com");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long managedAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Managed request shift",
				60,
				"15.00",
				"15.00"
		);
		long otherManagedAttendanceId = createClosedApprovedAttendance(
				otherForemanToken,
				workerToken,
				"Other managed request shift",
				60,
				"15.00",
				"15.00"
		);
		long managedRequestId = createPayoutRequestAndGetId(workerToken, managedAttendanceId);
		long otherManagedRequestId = createPayoutRequestAndGetId(workerToken, otherManagedAttendanceId);

		getManagedPayoutRequests(foremanToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].id").value(managedRequestId))
				.andExpect(jsonPath("$[0].items[0].attendanceId").value(managedAttendanceId))
				.andExpect(jsonPath("$[0].items[0].hourlyRate").value(15.00))
				.andExpect(jsonPath("$[0].foremanHourlyRate").doesNotExist())
				.andExpect(jsonPath("$[?(@.id == %d)]".formatted(otherManagedRequestId)).isEmpty());
	}

	/**
	 * Approves a managed pending payout request and marks request, items, and attendance paid at the same time.
	 */
	@Test
	void foremanApprovesManagedPayoutRequestAndMarksAttendancePaid() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Approval shift",
				467,
				"15.00",
				"116.75"
		);
		long requestId = createPayoutRequestAndGetId(workerToken, attendanceId);

		approveManagedPayoutRequest(foremanToken, requestId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(requestId))
				.andExpect(jsonPath("$.status").value("APPROVED"))
				.andExpect(jsonPath("$.approvedAt").isString())
				.andExpect(jsonPath("$.paidAt").isString())
				.andExpect(jsonPath("$.items[0].paymentStatus").value("PAID"));

		PayoutRequest payoutRequest = payoutRequestRepository.findById(requestId).orElseThrow();
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		PayoutRequestItem item = payoutRequestItemRepository.findAll().getFirst();
		assertThat(payoutRequest.getStatus()).isEqualTo(PayoutRequestStatus.APPROVED);
		assertThat(payoutRequest.getApprovedAt()).isNotNull();
		assertThat(payoutRequest.getPaidAt()).isEqualTo(payoutRequest.getApprovedAt());
		assertThat(attendance.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
		assertThat(attendance.getPaidAt()).isEqualTo(payoutRequest.getApprovedAt());
		assertThat(item.getPaidAt()).isEqualTo(payoutRequest.getApprovedAt());
	}

	/**
	 * Keeps approved item responses tied to the payout request state instead of mutable live attendance state.
	 */
	@Test
	void approvedPayoutItemResponseDoesNotReadLiveAttendancePaymentStatus() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Approved snapshot shift",
				60,
				"15.00",
				"15.00"
		);
		long requestId = createPayoutRequestAndGetId(workerToken, attendanceId);
		approveManagedPayoutRequest(foremanToken, requestId).andExpect(status().isOk());
		setPaymentStatus(attendanceId, PaymentStatus.UNPAID);

		getPayoutRequests(workerToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].id").value(requestId))
				.andExpect(jsonPath("$[0].status").value("APPROVED"))
				.andExpect(jsonPath("$[0].items[0].attendanceId").value(attendanceId))
				.andExpect(jsonPath("$[0].items[0].paymentStatus").value("PAID"));
	}

	/**
	 * Rejects approving an already approved payout request.
	 */
	@Test
	void approveNonPendingPayoutRequestReturnsConflict() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Repeated approval shift",
				60,
				"15.00",
				"15.00"
		);
		long requestId = createPayoutRequestAndGetId(workerToken, attendanceId);
		approveManagedPayoutRequest(foremanToken, requestId).andExpect(status().isOk());

		approveManagedPayoutRequest(foremanToken, requestId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message")
						.value("Payout request can only be approved when status is PENDING"));
	}

	/**
	 * Blocks another foreman from approving a request they do not manage.
	 */
	@Test
	void otherForemanCannotApproveManagedPayoutRequest() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Owned approval shift",
				60,
				"15.00",
				"15.00"
		);
		long requestId = createPayoutRequestAndGetId(workerToken, attendanceId);
		String otherForemanToken = registerAndLogin("other.foreman@example.com", "FOREMAN");

		approveManagedPayoutRequest(otherForemanToken, requestId)
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.message").value("Forbidden"));
	}

	/**
	 * Verifies nearest-5 half-up rounding boundaries and whole-money CEILING per item with request totals as item sums.
	 */
	@Test
	void payoutRoundingUsesNearestFiveHalfUpAndWholeMoneyCeilingPerItem() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long zeroMinuteAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Zero minute shift",
				0,
				"12.00",
				"0.00"
		);
		long oneMinuteAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"One minute shift",
				1,
				"12.00",
				"0.20"
		);
		long fourMinuteAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Four minute shift",
				4,
				"12.00",
				"0.80"
		);
		long fiveMinuteAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Five minute shift",
				5,
				"12.00",
				"1.00"
		);
		long sevenMinuteAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Seven minute shift",
				7,
				"12.00",
				"1.40"
		);
		long eightMinuteAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Eight minute shift",
				8,
				"12.00",
				"1.60"
		);
		long elevenMinuteAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Eleven minute shift",
				11,
				"12.00",
				"2.20"
		);
		long thirteenMinuteAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Thirteen minute shift",
				13,
				"12.00",
				"2.60"
		);
		long twentyFiveMinuteAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Twenty five minute shift",
				25,
				"12.00",
				"5.00"
		);
		long twentyEightMinuteAttendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Twenty eight minute shift",
				28,
				"12.00",
				"5.60"
		);

		previewPayoutRequest(
						workerToken,
						zeroMinuteAttendanceId,
						oneMinuteAttendanceId,
						fourMinuteAttendanceId,
						fiveMinuteAttendanceId,
						sevenMinuteAttendanceId,
						eightMinuteAttendanceId,
						elevenMinuteAttendanceId,
						thirteenMinuteAttendanceId,
						twentyFiveMinuteAttendanceId,
						twentyEightMinuteAttendanceId
				)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.rawPayableMinutes").value(102))
				.andExpect(jsonPath("$.payoutRoundedMinutes").value(110))
				.andExpect(jsonPath("$.exactCalculatedAmount").value(20.40))
				.andExpect(jsonPath("$.payoutAmount").value(22))
				.andExpect(jsonPath("$.items[0].rawPayableMinutes").value(0))
				.andExpect(jsonPath("$.items[0].payoutRoundedMinutes").value(0))
				.andExpect(jsonPath("$.items[0].payoutAmount").value(0))
				.andExpect(jsonPath("$.items[1].rawPayableMinutes").value(1))
				.andExpect(jsonPath("$.items[1].payoutRoundedMinutes").value(5))
				.andExpect(jsonPath("$.items[1].payoutAmount").value(1))
				.andExpect(jsonPath("$.items[2].rawPayableMinutes").value(4))
				.andExpect(jsonPath("$.items[2].payoutRoundedMinutes").value(5))
				.andExpect(jsonPath("$.items[2].payoutAmount").value(1))
				.andExpect(jsonPath("$.items[3].rawPayableMinutes").value(5))
				.andExpect(jsonPath("$.items[3].payoutRoundedMinutes").value(5))
				.andExpect(jsonPath("$.items[3].payoutAmount").value(1))
				.andExpect(jsonPath("$.items[4].rawPayableMinutes").value(7))
				.andExpect(jsonPath("$.items[4].payoutRoundedMinutes").value(5))
				.andExpect(jsonPath("$.items[4].payoutAmount").value(1))
				.andExpect(jsonPath("$.items[5].rawPayableMinutes").value(8))
				.andExpect(jsonPath("$.items[5].payoutRoundedMinutes").value(10))
				.andExpect(jsonPath("$.items[5].payoutAmount").value(2))
				.andExpect(jsonPath("$.items[6].rawPayableMinutes").value(11))
				.andExpect(jsonPath("$.items[6].payoutRoundedMinutes").value(10))
				.andExpect(jsonPath("$.items[6].payoutAmount").value(2))
				.andExpect(jsonPath("$.items[7].rawPayableMinutes").value(13))
				.andExpect(jsonPath("$.items[7].payoutRoundedMinutes").value(15))
				.andExpect(jsonPath("$.items[7].payoutAmount").value(3))
				.andExpect(jsonPath("$.items[8].rawPayableMinutes").value(25))
				.andExpect(jsonPath("$.items[8].payoutRoundedMinutes").value(25))
				.andExpect(jsonPath("$.items[8].payoutAmount").value(5))
				.andExpect(jsonPath("$.items[9].rawPayableMinutes").value(28))
				.andExpect(jsonPath("$.items[9].payoutRoundedMinutes").value(30))
				.andExpect(jsonPath("$.items[9].payoutAmount").value(6));
	}

	/**
	 * Allows zero worked minutes and zero salary when the attendance otherwise satisfies payable rules.
	 */
	@Test
	void zeroWorkedMinutesAndSalaryRemainPayableAndRequestable() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Zero shift",
				0,
				"15.00",
				"0.00"
		);

		getPayableAttendances(workerToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].attendanceId").value(attendanceId))
				.andExpect(jsonPath("$[0].rawPayableMinutes").value(0))
				.andExpect(jsonPath("$[0].payoutAmount").value(0));

		createPayoutRequest(workerToken, attendanceId)
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.rawPayableMinutes").value(0))
				.andExpect(jsonPath("$.payoutRoundedMinutes").value(0))
				.andExpect(jsonPath("$.exactCalculatedAmount").value(0.00))
				.andExpect(jsonPath("$.payoutAmount").value(0));
	}

	/**
	 * Verifies worker payroll responses do not expose private foreman salary/rate fields.
	 */
	@Test
	void workerPayrollResponsesDoNotExposeForemanPrivateSalaryFields() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = createClosedApprovedAttendance(
				foremanToken,
				workerToken,
				"Private fields shift",
				60,
				"15.00",
				"15.00"
		);

		getPayableAttendances(workerToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].foremanHourlyRate").doesNotExist())
				.andExpect(jsonPath("$[0].foremanWorkedMinutes").doesNotExist())
				.andExpect(jsonPath("$[0].foremanPauseMinutes").doesNotExist())
				.andExpect(jsonPath("$[0].foremanSalary").doesNotExist());

		previewPayoutRequest(workerToken, attendanceId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.foremanHourlyRate").doesNotExist())
				.andExpect(jsonPath("$.items[0].foremanHourlyRate").doesNotExist())
				.andExpect(jsonPath("$.items[0].foremanSalary").doesNotExist());
	}

	/**
	 * Enforces payroll endpoint role authorization.
	 */
	@Test
	void payrollEndpointsUseDocumentedRoles() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		String adminToken = createAdminAndLogin();

		getPayableAttendances(foremanToken).andExpect(status().isForbidden());
		getPayableAttendances(adminToken).andExpect(status().isForbidden());
		getManagedPayoutRequests(workerToken).andExpect(status().isForbidden());
		getManagedPayoutRequests(adminToken).andExpect(status().isForbidden());
	}

	private String registerAndLogin(String email, String role) throws Exception {
		String accessToken = registerAndLoginWithoutCompany(email, role);
		if ("FOREMAN".equals(role)) {
			createCompany(accessToken, "Acme Construction");
		}
		else if ("WORKER".equals(role)) {
			joinFirstCompany(accessToken);
		}
		return accessToken;
	}

	private String registerAndLoginWithoutCompany(String email, String role) throws Exception {
		mockMvc.perform(post(REGISTER_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "password123",
								  "firstName": "Test",
								  "lastName": "User",
								  "role": "%s"
								}
								""".formatted(email, role)))
				.andExpect(status().isCreated());
		return login(email);
	}

	private String createAdminAndLogin() throws Exception {
		User admin = new User();
		admin.setEmail("admin@example.com");
		admin.setPasswordHash(passwordEncoder.encode("password123"));
		admin.setFirstName("System");
		admin.setLastName("Admin");
		admin.setRole(Role.ADMIN);
		userRepository.save(admin);

		return login(admin.getEmail());
	}

	private String login(String email) throws Exception {
		MvcResult result = mockMvc.perform(post(LOGIN_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "password123"
								}
								""".formatted(email)))
				.andExpect(status().isOk())
				.andReturn();
		return extractString(result, ACCESS_TOKEN_PATTERN);
	}

	private String createCompany(String accessToken, String companyName) throws Exception {
		MvcResult result = mockMvc.perform(post(CREATE_COMPANY_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "name": "%s"
								}
								""".formatted(companyName)))
				.andExpect(status().isCreated())
				.andReturn();
		return extractString(result, JOIN_CODE_PATTERN);
	}

	private String firstCompanyJoinCode() {
		return companyRepository.findAll().stream()
				.findFirst()
				.map(Company::getJoinCode)
				.orElseThrow();
	}

	private void joinFirstCompany(String accessToken) throws Exception {
		if (companyRepository.count() == 0) {
			return;
		}
		joinCompany(accessToken, firstCompanyJoinCode());
	}

	private void assignUserToFirstCompany(String email) {
		User user = userRepository.findWithCompanyByEmail(email).orElseThrow();
		user.setCompany(companyRepository.findAll().getFirst());
		userRepository.saveAndFlush(user);
	}

	private void joinCompany(String accessToken, String joinCode) throws Exception {
		mockMvc.perform(post(JOIN_COMPANY_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "joinCode": "%s"
								}
								""".formatted(joinCode)))
				.andExpect(status().isOk());
	}

	private long createClosedApprovedAttendance(
			String foremanToken,
			String workerToken,
			String title,
			int workedMinutes,
			String hourlyRate,
			String calculatedSalary
	) throws Exception {
		return createAttendance(
				foremanToken,
				workerToken,
				title,
				ShiftStatus.CLOSED,
				AttendanceStatus.APPROVED,
				workedMinutes,
				hourlyRate,
				calculatedSalary
		);
	}

	private long createAttendance(
			String foremanToken,
			String workerToken,
			String title,
			ShiftStatus shiftStatus,
			AttendanceStatus attendanceStatus,
			Integer workedMinutes,
			String hourlyRate,
			String calculatedSalary
	) throws Exception {
		long shiftId = createShift(foremanToken, title, hourlyRate);
		long attendanceId = joinAndGetAttendanceId(workerToken, shiftId);
		ShiftSession shiftSession = shiftSessionRepository.findById(shiftId).orElseThrow();
		shiftSession.setStatus(shiftStatus);
		shiftSession.setActualStartTime(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(120));
		if (shiftStatus == ShiftStatus.CLOSED) {
			shiftSession.setActualEndTime(OffsetDateTime.now(ZoneOffset.UTC));
		}
		else if (shiftStatus == ShiftStatus.DISCARDED) {
			OffsetDateTime discardedAt = OffsetDateTime.now(ZoneOffset.UTC);
			shiftSession.setActualEndTime(discardedAt);
			shiftSession.setDiscardedAt(discardedAt);
			shiftSession.setDiscardedBy(shiftSession.getCreatedBy());
			shiftSession.setDiscardReason("SHORT_SHIFT_NOT_SAVED");
		}
		shiftSessionRepository.saveAndFlush(shiftSession);

		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		attendance.setStatus(attendanceStatus);
		attendance.setApprovedAt(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(110));
		attendance.setPayableStartTime(shiftSession.getActualStartTime());
		attendance.setHourlyRate(new BigDecimal(hourlyRate));
		attendance.setBreakMinutes(0);
		attendance.setWorkedMinutes(workedMinutes);
		attendance.setPauseMinutes(0);
		attendance.setCalculatedSalary(calculatedSalary == null ? null : new BigDecimal(calculatedSalary));
		attendance.setPaymentStatus(PaymentStatus.UNPAID);
		attendance.setPaidAt(null);
		shiftAttendanceRepository.saveAndFlush(attendance);
		return attendanceId;
	}

	private long createShift(String accessToken, String title, String defaultHourlyRate) throws Exception {
		MvcResult result = mockMvc.perform(post(CREATE_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "location": "Cologne",
								  "defaultBreakMinutes": 0,
								  "defaultHourlyRate": %s,
								  "foremanHourlyRate": 25.00
								}
								""".formatted(defaultHourlyRate)))
				.andExpect(status().isCreated())
				.andReturn();
		return extractLong(result, SHIFT_ID_PATTERN);
	}

	private long joinAndGetAttendanceId(String accessToken, long shiftId) throws Exception {
		String joinCode = shiftSessionRepository.findById(shiftId).orElseThrow().getJoinCode();
		MvcResult result = mockMvc.perform(post(JOIN_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "joinCode": "%s"
								}
								""".formatted(joinCode)))
				.andExpect(status().isOk())
				.andReturn();
		return extractLong(result, ATTENDANCE_ID_PATTERN);
	}

	private void setPaymentStatus(long attendanceId, PaymentStatus paymentStatus) {
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		attendance.setPaymentStatus(paymentStatus);
		if (paymentStatus == PaymentStatus.PAID) {
			attendance.setPaidAt(OffsetDateTime.now(ZoneOffset.UTC));
		}
		shiftAttendanceRepository.saveAndFlush(attendance);
	}

	private ResultActions getPayableAttendances(String accessToken) throws Exception {
		return mockMvc.perform(get(PAYABLE_ATTENDANCES_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private ResultActions previewPayoutRequest(String accessToken, long... attendanceIds) throws Exception {
		return previewPayoutRequestWithBody(accessToken, selectionPayload(attendanceIds));
	}

	private ResultActions previewPayoutRequestWithBody(String accessToken, String body) throws Exception {
		return mockMvc.perform(post(PAYOUT_PREVIEW_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body));
	}

	private ResultActions createPayoutRequest(String accessToken, long... attendanceIds) throws Exception {
		return createPayoutRequestWithBody(accessToken, selectionPayload(attendanceIds));
	}

	private ResultActions createPayoutRequestWithBody(String accessToken, String body) throws Exception {
		return mockMvc.perform(post(PAYOUT_REQUESTS_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body));
	}

	private long createPayoutRequestAndGetId(String accessToken, long... attendanceIds) throws Exception {
		MvcResult result = createPayoutRequest(accessToken, attendanceIds)
				.andExpect(status().isCreated())
				.andReturn();
		return extractLong(result, PAYOUT_REQUEST_ID_PATTERN);
	}

	private ResultActions getPayoutRequests(String accessToken) throws Exception {
		return mockMvc.perform(get(PAYOUT_REQUESTS_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private ResultActions getManagedPayoutRequests(String accessToken) throws Exception {
		return mockMvc.perform(get(MANAGED_PAYOUT_REQUESTS_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private ResultActions approveManagedPayoutRequest(String accessToken, long requestId) throws Exception {
		return mockMvc.perform(post(MANAGED_PAYOUT_REQUESTS_URL + "/" + requestId + "/approve")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private String selectionPayload(long... attendanceIds) {
		StringBuilder builder = new StringBuilder();
		builder.append("{\"attendanceIds\":[");
		for (int index = 0; index < attendanceIds.length; index++) {
			if (index > 0) {
				builder.append(',');
			}
			builder.append(attendanceIds[index]);
		}
		builder.append("]}");
		return builder.toString();
	}

	private long extractLong(MvcResult result, Pattern pattern) throws Exception {
		return Long.parseLong(extractString(result, pattern));
	}

	private String extractString(MvcResult result, Pattern pattern) throws Exception {
		Matcher matcher = pattern.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}
}
