export type ShiftStatus = "CREATED" | "OPEN" | "ACTIVE" | "CLOSED" | "CANCELLED";

export type AttendanceStatus = "JOINED" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface JoinShiftRequest {
  joinCode: string;
}

export interface JoinShiftResponse {
  attendanceId: number;
  shiftId: number;
  workerId: number;
  status: AttendanceStatus;
  hourlyRate: number;
}

export interface WorkerShiftHistoryItem {
  shiftId: number;
  attendanceId: number;
  companyId: number;
  companyName: string;
  title: string;
  location: string | null;
  status: ShiftStatus;
  actualStartTime: string | null;
  actualEndTime: string | null;
  attendanceStatus: AttendanceStatus;
  hourlyRate: number;
  breakMinutes: number;
  workedMinutes: number | null;
  calculatedSalary: number | null;
}

export interface ManagedShift {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  location: string | null;
  status: ShiftStatus;
  joinCode: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  defaultBreakMinutes: number;
  defaultHourlyRate: number;
  foremanHourlyRate?: number;
  createdBy: number;
}

export interface CreateShiftRequest {
  location: string;
  defaultBreakMinutes?: number;
  defaultHourlyRate: number;
  foremanHourlyRate: number;
}

export interface CreateShiftResponse {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  location: string | null;
  joinCode: string;
  status: ShiftStatus;
  actualStartTime: string | null;
  actualEndTime: string | null;
  defaultBreakMinutes: number;
  defaultHourlyRate: number;
  foremanHourlyRate?: number;
  createdBy: number;
}

export interface ShiftAttendance {
  attendanceId: number;
  workerId: number;
  firstName: string;
  lastName: string;
  status: AttendanceStatus;
  hourlyRate: number;
  breakMinutes: number;
  workedMinutes: number | null;
  calculatedSalary: number | null;
  joinedAt: string;
  approvedAt: string | null;
}

export interface ApproveAttendanceRequest {
  hourlyRate?: number;
}

export interface ApproveAttendanceResponse {
  attendanceId: number;
  status: AttendanceStatus;
  hourlyRate: number;
  approvedAt: string;
}

export interface ShiftStartResponse {
  id: number;
  status: ShiftStatus;
  actualStartTime: string;
}

export interface ShiftCloseResponse {
  id: number;
  status: ShiftStatus;
  actualEndTime: string;
}

export interface ShiftSummaryWorker {
  attendanceId: number;
  workerId: number;
  firstName: string;
  lastName: string;
  workedMinutes: number;
  hourlyRate: number;
  salary: number;
}

export interface ShiftSummary {
  shiftId: number;
  status: ShiftStatus;
  totalWorkers: number;
  totalSalary: number;
  foremanWorkedMinutes?: number;
  foremanHourlyRate?: number;
  foremanSalary?: number;
  workers: ShiftSummaryWorker[];
}
