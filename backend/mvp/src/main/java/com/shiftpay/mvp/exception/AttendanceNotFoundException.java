package com.shiftpay.mvp.exception;

public class AttendanceNotFoundException extends RuntimeException {

	public AttendanceNotFoundException() {
		super("Attendance not found");
	}
}
