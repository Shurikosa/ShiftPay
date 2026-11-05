package com.shiftpay.mvp.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "shiftpay.email.smtp.enabled", havingValue = "true")
public class SmtpPasswordResetDelivery implements PasswordResetDelivery {
	private final JavaMailSender sender;
	private final String from;

	public SmtpPasswordResetDelivery(JavaMailSender sender, @Value("${shiftpay.email.from}") String from) {
		this.sender = sender;
		this.from = from;
	}

	@Override
	public boolean deliver(Message message) {
		SimpleMailMessage mail = new SimpleMailMessage();
		mail.setFrom(from);
		mail.setTo(message.recipient());
		mail.setSubject("ShiftPay password reset code");
		mail.setText("Your ShiftPay password reset code is " + message.code()
				+ ". It expires at " + message.expiresAt() + ".");
		try {
			sender.send(mail);
			return true;
		}
		catch (MailException exception) {
			return false;
		}
	}
}
