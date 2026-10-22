import {
  cancelEmailChange,
  confirmEmailChange,
  getPendingEmailChange,
  resendEmailChange,
  startEmailChange,
  updateMyName,
  updateMyPassword
} from "../auth";

jest.mock("../../config/env", () => ({
  config: { apiBaseUrl: "http://localhost:8080" }
}));

function response(status: number, body?: unknown, retryAfter?: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => name === "Retry-After" ? retryAfter ?? null : null },
    text: async () => body === undefined ? "" : JSON.stringify(body)
  } as Response;
}

describe("own settings API", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it("uses the exact typed name, email, and password endpoints", async () => {
    const user = { id: 1, email: "old@example.com", firstName: "Jane", lastName: "Worker", role: "WORKER", company: null };
    const pending = { status: "PENDING", newEmail: "new@example.com", expiresAt: "2026-10-20T10:30:00Z", codeExpiresAt: "2026-10-20T10:10:00Z", resendAvailableAt: "2026-10-20T10:01:00Z", resendsRemaining: 3, attemptsRemaining: 5 };
    const replacement = { accessToken: "replacement", tokenType: "Bearer", user: { ...user, email: "new@example.com" } };
    fetchMock
      .mockResolvedValueOnce(response(200, user))
      .mockResolvedValueOnce(response(200, pending))
      .mockResolvedValueOnce(response(202, pending))
      .mockResolvedValueOnce(response(200, replacement))
      .mockResolvedValueOnce(response(200, pending))
      .mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(response(200, replacement));

    await updateMyName("token", { firstName: "Jane", lastName: "Worker" });
    await getPendingEmailChange("token");
    await startEmailChange("token", { currentPassword: "current", newEmail: "new@example.com" });
    await confirmEmailChange("token", { code: "483921" });
    await resendEmailChange("token");
    await cancelEmailChange("token");
    await updateMyPassword("token", { currentPassword: "current", newPassword: "new-password" });

    expect(fetchMock.mock.calls.map(([url, options]) => [url, options.method, options.body])).toEqual([
      ["http://localhost:8080/api/v1/users/me", "PUT", JSON.stringify({ firstName: "Jane", lastName: "Worker" })],
      ["http://localhost:8080/api/v1/users/me/email-change", "GET", undefined],
      ["http://localhost:8080/api/v1/users/me/email-change", "POST", JSON.stringify({ currentPassword: "current", newEmail: "new@example.com" })],
      ["http://localhost:8080/api/v1/users/me/email-change/confirm", "POST", JSON.stringify({ code: "483921" })],
      ["http://localhost:8080/api/v1/users/me/email-change/resend", "POST", undefined],
      ["http://localhost:8080/api/v1/users/me/email-change", "DELETE", undefined],
      ["http://localhost:8080/api/v1/users/me/password", "PUT", JSON.stringify({ currentPassword: "current", newPassword: "new-password" })]
    ]);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.headers.Authorization).toBe("Bearer token");
    }
  });

  it("preserves machine-readable error fields and whole-second Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(response(429, {
      status: 429,
      error: "Too Many Requests",
      message: "Rate limited",
      code: "EMAIL_CHANGE_RATE_LIMITED",
      attemptsRemaining: 3
    }, "47"));

    await expect(resendEmailChange("token")).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 47,
      details: {
        code: "EMAIL_CHANGE_RATE_LIMITED",
        attemptsRemaining: 3
      }
    });
  });

  it("maps a 204 pending read to undefined", async () => {
    fetchMock.mockResolvedValueOnce(response(204));
    await expect(getPendingEmailChange("token")).resolves.toBeUndefined();
  });
});
