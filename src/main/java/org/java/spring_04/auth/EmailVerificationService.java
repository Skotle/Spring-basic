package org.java.spring_04.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailVerificationService {

    @Autowired
    private JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromAddress;

    public void sendSignupCode(String email, String uid, String code) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(email);
            message.setSubject("[Spring_04] 이메일 인증 코드");
            message.setText("""
                    안녕하세요.

                    %s 계정의 회원가입 인증 코드입니다.

                    인증 코드: %s

                    이 코드는 10분 동안만 유효합니다.
                    본인이 요청하지 않았다면 이 메일을 무시해 주세요.
                    """.formatted(uid, code));
            mailSender.send(message);
        } catch (MailException e) {
            throw new RuntimeException("인증 메일 발송에 실패했습니다. Gmail 설정이나 앱 비밀번호를 확인해 주세요.");
        }
    }
}
