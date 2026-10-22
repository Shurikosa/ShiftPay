import { getManagedShiftsPage } from "../shifts";
import type { ManagedShiftPageResponse } from "../../types/shifts";

jest.mock("../../config/env", () => ({
  config: { apiBaseUrl: "http://localhost:8080" }
}));

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: jest.fn().mockReturnValue(null) },
    text: async () => JSON.stringify(body)
  } as unknown as Response;
}

describe("managed shift page API", () => {
  const fetchMock = jest.fn();
  const page: ManagedShiftPageResponse = {
    items: [],
    nextCursor: "opaque+/=cursor",
    hasMore: true
  };

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it("requests the newest FOREMAN page with the fixed full-list limit", async () => {
    fetchMock.mockResolvedValueOnce(response(page));

    await expect(getManagedShiftsPage("foreman-token")).resolves.toEqual(page);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/me/managed-shifts/page?limit=20",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer foreman-token"
        },
        body: undefined
      }
    );
  });

  it("passes the backend cursor opaquely as an encoded query value", async () => {
    fetchMock.mockResolvedValueOnce(response({
      items: [],
      nextCursor: null,
      hasMore: false
    }));

    await getManagedShiftsPage("foreman-token", "opaque+/=cursor");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:8080/api/v1/me/managed-shifts/page?limit=20&cursor=opaque%2B%2F%3Dcursor"
    );
  });
});
