export type ShiftStatus = "OPEN" | "ACTIVE" | "CLOSED";

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
  title: string;
  location: string;
  status: ShiftStatus;
  plannedStartTime: string;
  plannedEndTime: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  attendanceStatus: AttendanceStatus;
  hourlyRate: number;
  breakMinutes: number;
  workedMinutes: number | null;
  calculatedSalary: number | null;
}
