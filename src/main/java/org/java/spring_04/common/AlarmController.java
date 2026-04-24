package org.java.spring_04.common;

import org.java.spring_04.board.BoardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/alarms")
public class AlarmController {

    @Autowired
    private BoardService boardService;

    @GetMapping("/my")
    public Map<String, Object> getMyAlarms(@SessionAttribute(name = "uid", required = false) String uid) {
        try {
            List<Map<String, Object>> alarms = boardService.getMyAlarms(uid);
            return Map.of("success", true, "alarms", alarms);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage(), "alarms", List.of());
        }
    }

    @PostMapping("/{alarmId}/accept")
    public Map<String, Object> acceptAlarm(@PathVariable("alarmId") Long alarmId,
                                           @SessionAttribute(name = "uid", required = false) String uid) {
        try {
            boardService.acceptAlarm(alarmId, uid);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/{alarmId}/reject")
    public Map<String, Object> rejectAlarm(@PathVariable("alarmId") Long alarmId,
                                           @SessionAttribute(name = "uid", required = false) String uid) {
        try {
            boardService.rejectAlarm(alarmId, uid);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }
}
