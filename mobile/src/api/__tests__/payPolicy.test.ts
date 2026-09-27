import {
  getMyPayPolicy,
  getMyPayPolicyVersions,
  updateMyPayPolicy
} from "../payPolicy";
import type {
  PayPolicy,
  PayPolicyVersionSummary,
  UpdatePayPolicyRequest
} from "../../types/payPolicy";

jest.mock("../../config/env", () => ({
  config: {
    apiBaseUrl: "http://localhost:8080"
  }
}));

const policy: PayPolicy = {
  id: 2000,
  companyId: 10,
  version: 3,
  active: true,
  timeZone: "Europe/Berlin",
  weekStartsOn: "SUNDAY",
  stackingStrategy: "ADD",
  rules: [],
  createdAt: "2026-07-01T10:00:00Z"
};

const versions: PayPolicyVersionSummary[] = [
  {
    id: 2000,
    companyId: 10,
    version: 3,
    active: true,
    timeZone: "Europe/Berlin",
    weekStartsOn: "SUNDAY",
    stackingStrategy: "ADD",
    ruleCount: 0,
    createdAt: "2026-07-01T10:00:00Z"
  }
];

function successfulResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body)
  } as Response;
}

describe("pay policy API", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it("loads the current policy with the bearer token", async () => {
    fetchMock.mockResolvedValueOnce(successfulResponse(policy));

    await expect(getMyPayPolicy("current-token")).resolves.toEqual(policy);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/me/pay-policy",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer current-token"
        },
        body: undefined
      }
    );
  });

  it("updates the current policy with PUT, token, and serialized body", async () => {
    const payload: UpdatePayPolicyRequest = {
      weekStartsOn: "THURSDAY",
      stackingStrategy: "HIGHEST_ONLY",
      rules: [
        {
          name: "Night",
          type: "TIME_OF_DAY",
          enabled: true,
          premiumPercent: 37.5,
          condition: {
            startTime: "22:00",
            endTime: "06:00"
          }
        }
      ]
    };
    fetchMock.mockResolvedValueOnce(successfulResponse({ ...policy, version: 4 }));

    await updateMyPayPolicy("update-token", payload);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/me/pay-policy",
      {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: "Bearer update-token"
        },
        body: JSON.stringify(payload)
      }
    );
  });

  it("loads version summaries from the versions path", async () => {
    fetchMock.mockResolvedValueOnce(successfulResponse(versions));

    await expect(getMyPayPolicyVersions("versions-token")).resolves.toEqual(versions);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/me/pay-policy/versions",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer versions-token"
        })
      })
    );
  });
});
