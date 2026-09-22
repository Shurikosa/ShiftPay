import { getMyCompany, updateMyCompany } from "../companies";
import type { CompanySettingsResponse, UpdateCompanySettingsRequest } from "../../types/company";

jest.mock("../../config/env", () => ({
  config: { apiBaseUrl: "http://localhost:8080" }
}));

const settings: CompanySettingsResponse = {
  id: 10,
  name: "Acme Construction",
  joinCode: "CMP123",
  currencyLabel: "EUR",
  defaultWorkerHourlyRate: 20,
  defaultForemanHourlyRate: null,
  timeZone: "Europe/Berlin"
};

function response(body: unknown): Response {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) } as Response;
}

describe("company settings API", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it("loads FOREMAN company settings with the bearer token", async () => {
    fetchMock.mockResolvedValueOnce(response(settings));
    await expect(getMyCompany("settings-token")).resolves.toEqual(settings);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/me/company", {
      method: "GET",
      headers: { Accept: "application/json", Authorization: "Bearer settings-token" },
      body: undefined
    });
  });

  it("sends nullable default rates in the complete PUT settings payload", async () => {
    const payload: UpdateCompanySettingsRequest = {
      name: "Acme Construction GmbH",
      currencyLabel: "грн",
      defaultWorkerHourlyRate: 0,
      defaultForemanHourlyRate: null
    };
    fetchMock.mockResolvedValueOnce(response({ ...settings, ...payload }));
    await updateMyCompany("settings-token", payload);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/me/company", {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer settings-token"
      },
      body: JSON.stringify(payload)
    });
  });
});
