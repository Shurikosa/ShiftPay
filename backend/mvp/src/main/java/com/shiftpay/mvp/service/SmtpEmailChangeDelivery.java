package com.shiftpay.mvp.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "shiftpay.email.smtp.enabled", havingValue = "true")
public class SmtpEmailChangeDelivery implements EmailChangeDelivery {

	private final JavaMailSender mailSender;
	private final String from;

	public SmtpEmailChangeDelivery(
			JavaMailSender mailSender,
			@Value("${shiftpay.email.from}") String from
	) {
		this.mailSender = mailSender;
		this.from = from;
	}

	@Override
	public boolean deliver(VerificationMessage message) {
		SimpleMailMessage mail = new SimpleMailMessage();
		mail.setFrom(from);
		mail.setTo(message.recipient());
		mail.setSubject("ShiftPay email verification code");
		mail.setText("Your ShiftPay verification code is " + message.code()
				+ ". It expires at " + message.codeExpiresAt() + ".");
		try {
			mailSender.send(mail);
			return true;
		}
		catch (MailException exception) {
			return false;
		}
	}
}
