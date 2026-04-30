(function () {
  const nativeFetch = window.fetch.bind(window);
  const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

  function sameOrigin(input) {
    try {
      const url = new URL(typeof input === "string" ? input : input.url, window.location.origin);
      return url.origin === window.location.origin;
    } catch (error) {
      return false;
    }
  }

  function requestMethod(input, options) {
    return String(options?.method || (typeof input === "string" ? "GET" : input.method || "GET")).toUpperCase();
  }

  function requestPath() {
    return `${window.location.pathname}${window.location.search}`;
  }

  function requestId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  }

  async function sha256Hex(text) {
    if (window.crypto?.subtle && window.TextEncoder) {
      const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }
    return sha256HexFallback(text);
  }

  function sha256HexFallback(text) {
    if (!window.TextEncoder) {
      throw new Error("Secure request hashing is unavailable in this browser.");
    }
    const bytes = Array.from(new TextEncoder().encode(text));
    const bitLength = bytes.length * 8;
    const words = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const rotate = (value, bits) => (value >>> bits) | (value << (32 - bits));

    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    bytes.push((high >>> 24) & 255, (high >>> 16) & 255, (high >>> 8) & 255, high & 255);
    bytes.push((low >>> 24) & 255, (low >>> 16) & 255, (low >>> 8) & 255, low & 255);

    for (let chunk = 0; chunk < bytes.length; chunk += 64) {
      const schedule = new Array(64);
      for (let i = 0; i < 16; i += 1) {
        const j = chunk + i * 4;
        schedule[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
      }
      for (let i = 16; i < 64; i += 1) {
        const s0 = rotate(schedule[i - 15], 7) ^ rotate(schedule[i - 15], 18) ^ (schedule[i - 15] >>> 3);
        const s1 = rotate(schedule[i - 2], 17) ^ rotate(schedule[i - 2], 19) ^ (schedule[i - 2] >>> 10);
        schedule[i] = (schedule[i - 16] + s0 + schedule[i - 7] + s1) >>> 0;
      }

      let [a, b, c, d, e, f, g, h] = words;
      for (let i = 0; i < 64; i += 1) {
        const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + ch + constants[i] + schedule[i]) >>> 0;
        const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + maj) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      words[0] = (words[0] + a) >>> 0;
      words[1] = (words[1] + b) >>> 0;
      words[2] = (words[2] + c) >>> 0;
      words[3] = (words[3] + d) >>> 0;
      words[4] = (words[4] + e) >>> 0;
      words[5] = (words[5] + f) >>> 0;
      words[6] = (words[6] + g) >>> 0;
      words[7] = (words[7] + h) >>> 0;
    }

    return words.map((word) => word.toString(16).padStart(8, "0")).join("");
  }

  function parseJsonBody(body) {
    if (body == null || body === "") {
      return {};
    }
    if (typeof body !== "string") {
      return null;
    }
    try {
      const parsed = JSON.parse(body);
      return parsed && !Array.isArray(parsed) && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  async function secureOptions(input, options = {}) {
    const method = requestMethod(input, options);
    if (!unsafeMethods.has(method) || !sameOrigin(input)) {
      return options;
    }

    const headers = new Headers(options.headers || {});
    if (headers.get("X-Security-Request") === "1") {
      return options;
    }

    const id = requestId();
    const timestamp = String(Date.now());
    const path = requestPath();
    const origin = window.location.origin;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const language = navigator.language || "";

    headers.set("X-Security-Request", "1");
    headers.set("X-Requested-With", "XMLHttpRequest");
    headers.set("X-Request-Id", id);
    headers.set("X-Request-Timestamp", timestamp);
    headers.set("X-Client-Path", path);
    headers.set("X-Client-Origin", origin);
    headers.set("X-Client-Timezone", timezone);
    headers.set("X-Client-Language", language);

    if (options.body instanceof FormData) {
      return {
        ...options,
        method,
        headers
      };
    }

    const payload = parseJsonBody(options.body);
    if (!payload) {
      return options;
    }

    Object.assign(payload, {
      __security_request_id: id,
      __security_timestamp: timestamp,
      __security_path: path,
      __security_method: method,
      __security_origin: origin,
      __security_timezone: timezone,
      __security_language: language,
      __security_platform: navigator.platform || ""
    });

    const body = JSON.stringify(payload);
    headers.set("Content-Type", "application/json");
    headers.set("X-Payload-Hash", await sha256Hex(body));

    return {
      ...options,
      method,
      headers,
      body
    };
  }

  window.secureFetch = async function secureFetch(input, options = {}) {
    return nativeFetch(input, await secureOptions(input, options));
  };

  window.fetch = window.secureFetch;
})();
