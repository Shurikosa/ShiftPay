import type { Company } from "./auth";

export interface CreateCompanyRequest {
  name: string;
  currencyLabel: string;
  defaultWorkerHourlyRate?: number | null;
  defaultForemanHourlyRate?: number | null;
  timeZone?: string;
}

export interface CreateCompanyResponse extends Company {
  joinCode: string;
  currencyLabel: string;
  defaultWorkerHourlyRate: number | null;
  defaultForemanHourlyRate: number | null;
}

export interface JoinCompanyRequest {
  joinCode: string;
}

export type JoinCompanyResponse = Omit<Company, "joinCode">;

export interface CompanySettingsResponse extends Company {
  joinCode: string;
  defaultWorkerHourlyRate: number | null;
  defaultForemanHourlyRate: number | null;
}

export interface UpdateCompanySettingsRequest {
  name: string;
  currencyLabel: string;
  defaultWorkerHourlyRate: number | null;
  defaultForemanHourlyRate: number | null;
}
