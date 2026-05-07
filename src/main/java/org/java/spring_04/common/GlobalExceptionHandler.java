package org.java.spring_04.common;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Arrays;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final RequestIpResolver requestIpResolver;

    public GlobalExceptionHandler(RequestIpResolver requestIpResolver) {
        this.requestIpResolver = requestIpResolver;
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> methodNotSupported(HttpRequestMethodNotSupportedException exception,
                                                                  HttpServletRequest request) {
        log.warn("SERVICE_METHOD_NOT_SUPPORTED id={} method={} path={} ip={} supported={}",
                requestId(request),
                request.getMethod(),
                request.getRequestURI(),
                requestIpResolver.resolve(request),
                Arrays.toString(exception.getSupportedMethods()));
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(Map.of(
                "success", false,
                "message", "Request method is not supported.",
                "path", request.getRequestURI()
        ));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> missingParameter(MissingServletRequestParameterException exception,
                                                               HttpServletRequest request) {
        log.warn("SERVICE_BAD_REQUEST id={} method={} path={} ip={} missingParameter={}",
                requestId(request),
                request.getMethod(),
                request.getRequestURI(),
                requestIpResolver.resolve(request),
                exception.getParameterName());
        return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "Required parameter is missing.",
                "parameter", exception.getParameterName()
        ));
    }

    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, Object>> badRequest(Exception exception, HttpServletRequest request) {
        log.warn("SERVICE_BAD_REQUEST id={} method={} path={} ip={} message={}",
                requestId(request),
                request.getMethod(),
                request.getRequestURI(),
                requestIpResolver.resolve(request),
                safeMessage(exception));
        return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", safeMessage(exception)
        ));
    }

    @ExceptionHandler({NoHandlerFoundException.class, NoResourceFoundException.class})
    public ResponseEntity<Map<String, Object>> notFound(Exception exception, HttpServletRequest request) {
        log.warn("SERVICE_NOT_FOUND id={} method={} path={} ip={}",
                requestId(request),
                request.getMethod(),
                request.getRequestURI(),
                requestIpResolver.resolve(request));
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "success", false,
                "message", "Not found."
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> unhandled(Exception exception, HttpServletRequest request) {
        log.error("SERVICE_UNHANDLED_EXCEPTION id={} method={} path={} ip={} type={} message={}",
                requestId(request),
                request.getMethod(),
                request.getRequestURI(),
                requestIpResolver.resolve(request),
                exception.getClass().getName(),
                safeMessage(exception),
                exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "message", "Internal server error."
        ));
    }

    private String requestId(HttpServletRequest request) {
        Object requestId = request.getAttribute("serviceRequestId");
        return requestId == null ? "none" : String.valueOf(requestId);
    }

    private String safeMessage(Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        return message.replaceAll("(?i)(password|pass|token|code|secret)=\\S+", "$1=***");
    }
}
