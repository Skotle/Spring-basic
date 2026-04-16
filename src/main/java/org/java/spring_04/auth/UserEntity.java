package org.java.spring_04.auth;

public class UserEntity {
    private String uid;
    private String nick;
    private String passwordHash;
    private String email;
    private String nickIconType;
    private String memberDivision;

    // Getter, Setter 생략 (Lombok 사용 권장)
    public String getUid() { return uid; }
    public void setUid(String uid) { this.uid = uid; }
    public String getNick() { return nick; }
    public void setNick(String nick) { this.nick = nick; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getNickIconType() { return nickIconType; }
    public void setNickIconType(String nickIconType) { this.nickIconType = nickIconType; }
    public String getMemberDivision() { return memberDivision; }
    public void setMemberDivision(String memberDivision) { this.memberDivision = memberDivision; }
}