import type { Company } from "./auth";

export interface CreateCompanyRequest {
  name: string;
}

export type CreateCompanyResponse = Company & {
  joinCode: string;
};

export interface JoinCompanyRequest {
  joinCode: string;
}

export type JoinCompanyResponse = Omit<Company, "joinCode">;
