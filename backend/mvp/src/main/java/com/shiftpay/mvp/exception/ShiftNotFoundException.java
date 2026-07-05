package com.shiftpay.mvp.exception;

public class ShiftNotFoundException extends RuntimeException {

	public ShiftNotFoundException() {
		super("Shift not found");
	}
}
