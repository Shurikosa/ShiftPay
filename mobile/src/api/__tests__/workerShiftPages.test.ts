import { getMyShiftHistoryPage } from "../shifts";
import type { WorkerShiftHistoryPageResponse } from "../../types/shifts";

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

describe("worker shift page API", () => {
  const fetchMock = jest.fn();
  const page: WorkerShiftHistoryPageResponse = {
    items: [],
    nextCursor: "worker-opaque+/=cursor",
    hasMore: true
  };

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it("requests the newest personal history page with the full-list limit", async () => {
    fetchMock.mockResolvedValueOnce(response(page));

    await expect(getMyShiftHistoryPage("worker-token")).resolves.toEqual(page);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/me/shifts/page?limit=20",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer worker-token"
        },
        body: undefined
      }
    );
  });

  it("passes the personal-history cursor opaquely as an encoded query value", async () => {
    fetchMock.mockResolvedValueOnce(response({
      items: [],
      nextCursor: null,
      hasMore: false
    }));

    await getMyShiftHistoryPage("worker-token", "worker-opaque+/=cursor");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:8080/api/v1/me/shifts/page?limit=20&cursor=worker-opaque%2B%2F%3Dcursor"
    );
  });
});
