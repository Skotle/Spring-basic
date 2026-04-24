(() => {
  const h = React.createElement;
  const { useEffect, useRef, useState } = React;

  const api = async (url, options = {}) => {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      ...options
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(payload?.message || `Request failed (${response.status})`);
    }
    return payload;
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  };

  const authorLabel = (item) => {
    if (!item) return "익명";
    if (item.writer_uid) return item.name || item.writer_uid;
    return item.name || "익명";
  };

  function matchRoute(pathname) {
    if (pathname === "/") return { name: "home", params: {} };
    if (pathname === "/signin") return { name: "login", params: {} };
    if (pathname === "/nid") return { name: "signup", params: {} };
    if (pathname === "/alarms") return { name: "alarms", params: {} };
    if (pathname === "/boards" || pathname === "/board_main") return { name: "boards", params: {} };
    let match = pathname.match(/^\/board\/([^/]+)\/write$/);
    if (match) return { name: "write", params: { gid: decodeURIComponent(match[1]) } };
    match = pathname.match(/^\/board\/([^/]+)\/([^/]+)$/);
    if (match) return { name: "post", params: { gid: decodeURIComponent(match[1]), postNo: decodeURIComponent(match[2]) } };
    match = pathname.match(/^\/board\/([^/]+)$/);
    if (match) return { name: "board", params: { gid: decodeURIComponent(match[1]) } };
    return { name: "notFound", params: {} };
  }

  function navigate(path, replace = false) {
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    window.dispatchEvent(new Event("app:navigate"));
  }

  function Link({ href, className, children }) {
    return h("a", {
      href,
      className,
      onClick(event) {
        if (!href.startsWith("/")) return;
        event.preventDefault();
        navigate(href);
      }
    }, children);
  }

  function Feedback({ feedback }) {
    if (!feedback) return null;
    return h("div", { className: feedback.type === "error" ? "error-box" : "success-box" }, feedback.message);
  }

  function Topbar({ session, onLogout, alarmCount = 0 }) {
    return h("header", { className: "topbar" },
      h("div", { className: "frame" },
        h("div", { className: "topbar-inner" },
          h(Link, { href: "/", className: "brand" },
            h("span", { className: "brand-mark" }),
            h("span", null, "irisen web")
          ),
          h("div", { className: "nav-actions" },
            h(Link, { href: "/", className: "btn btn-ghost" }, "홈"),
            h(Link, { href: "/boards", className: "btn btn-ghost" }, "보드"),
            session?.loggedIn
              ? [
                  h(Link, { href: "/alarms", className: "btn btn-ghost", key: "alarms" }, alarmCount > 0 ? `알림 ${alarmCount}` : "알림"),
                  h("span", { className: "chip", key: "nick" }, session.nick || session.uid),
                  h("button", { type: "button", className: "btn btn-secondary", key: "logout", onClick: onLogout }, "로그아웃")
                ]
              : [
                  h(Link, { href: "/signin", className: "btn btn-ghost", key: "login" }, "로그인"),
                  h(Link, { href: "/nid", className: "btn btn-primary", key: "signup" }, "회원가입")
                ]
          )
        )
      )
    );
  }

  function SectionHead({ eyebrow, title, action }) {
    return h("div", { className: "section-head" },
      h("div", null,
        h("span", { className: "eyebrow" }, eyebrow),
        h("h2", { className: "section-title" }, title)
      ),
      action || null
    );
  }

  function GuestFields({ name, password, setName, setPassword, prefix }) {
    return h("div", { className: "stack" },
      h("div", { className: "field" },
        h("label", { htmlFor: `${prefix}-guest-name` }, "비회원 이름"),
        h("input", {
          id: `${prefix}-guest-name`,
          type: "text",
          value: name,
          onChange: (event) => setName(event.target.value)
        })
      ),
      h("div", { className: "field" },
        h("label", { htmlFor: `${prefix}-guest-password` }, "비밀번호"),
        h("input", {
          id: `${prefix}-guest-password`,
          type: "password",
          value: password,
          onChange: (event) => setPassword(event.target.value)
        })
      )
    );
  }

  function EditorToolbar() {
    const tools = [
      { label: "굵게", command: "bold" },
      { label: "기울임", command: "italic" },
      { label: "밑줄", command: "underline" },
      { label: "제목", command: "formatBlock", value: "h2" },
      { label: "본문", command: "formatBlock", value: "p" },
      { label: "인용", command: "formatBlock", value: "blockquote" }
    ];
    return h("div", { className: "editor-toolbar" },
      tools.map((tool) =>
        h("button", {
          key: tool.label,
          type: "button",
          className: "tool-btn",
          onClick() {
            document.execCommand(tool.command, false, tool.value || null);
          }
        }, tool.label)
      )
    );
  }

  function HtmlEditor({ id, value, onChange, placeholder }) {
    const editorRef = useRef(null);
    useEffect(() => {
      if (editorRef.current && editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }, [value]);
    return h("div", { className: "editor-shell" },
      h(EditorToolbar),
      h("div", {
        id,
        ref: editorRef,
        className: "html-editor",
        contentEditable: true,
        suppressContentEditableWarning: true,
        "data-placeholder": placeholder,
        onInput(event) {
          onChange(event.currentTarget.innerHTML);
        }
      })
    );
  }

  function HomeView({ session, boards, feed, onLogout, alarmCount }) {
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "hero card" },
            h("span", { className: "eyebrow" }, "Home"),
            h("h1", { className: "section-title" }, "irisen25.com"),
            h("p", { className: "hero-copy" }, "sunggall archive"),
            h("div", { className: "inline-actions" },
              h(Link, { href: "/boards", className: "btn btn-primary" }, "보드 보기"),
              h(Link, { href: "/signin", className: "btn btn-ghost" }, "로그인")
            )
          ),
          h("section", { className: "section-stack" },
            h(SectionHead, { eyebrow: "Feed", title: "추천 글" }),
            feed.length
              ? h("div", { className: "stack" },
                  feed.map((post) =>
                    h(Link, { href: `/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`, className: "card quick-card", key: `${post.gall_id}-${post.post_no}` },
                      h("div", { className: "board-title" }, post.title || "제목 없음"),
                      h("div", { className: "muted" }, `${post.gall_name || post.gall_id} · ${authorLabel(post)}`)
                    )
                  )
                )
              : h("div", { className: "empty-box" }, "추천 글이 없습니다."),
            h("div", { className: "muted" }, `전체 보드 ${boards.length}개`)
          )
        )
      )
    );
  }

  function BoardsView({ session, boards, query, onQueryChange, onLogout, alarmCount }) {
    const filtered = boards.filter((board) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return String(board.gall_id || "").toLowerCase().includes(q) || String(board.gall_name || "").toLowerCase().includes(q);
    });
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section-stack" },
            h(SectionHead, { eyebrow: "Boards", title: "보드 목록" }),
            h("div", { className: "field" },
              h("label", { htmlFor: "board-search" }, "검색"),
              h("input", { id: "board-search", type: "text", value: query, onChange: (event) => onQueryChange(event.target.value) })
            ),
            filtered.length
              ? h("div", { className: "stack" },
                  filtered.map((board) =>
                    h(Link, { href: `/board/${encodeURIComponent(board.gall_id)}`, className: "card quick-card", key: board.gall_id },
                      h("div", { className: "board-title" }, board.gall_name || board.gall_id),
                      h("div", { className: "muted" }, `${board.gall_id} · ${board.post_count ?? 0} posts`)
                    )
                  )
                )
              : h("div", { className: "empty-box" }, "검색 결과가 없습니다.")
          )
        )
      )
    );
  }

  function BoardView({ session, gid, board, posts, page, onPrevPage, onNextPage, onLogout, alarmCount }) {
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section-stack" },
            h(SectionHead, {
              eyebrow: "Board",
              title: board?.gall_name || gid,
              action: h(Link, { href: `/board/${encodeURIComponent(gid)}/write`, className: "btn btn-primary" }, "글쓰기")
            }),
            posts.length
              ? h("div", { className: "stack" },
                  posts.map((post) =>
                    h(Link, { href: `/board/${encodeURIComponent(gid)}/${post.post_no}`, className: "card quick-card", key: `${gid}-${post.post_no}` },
                      h("div", { className: "board-title" }, post.title || "제목 없음"),
                      h("div", { className: "muted" }, `#${post.post_no} · ${authorLabel(post)} · ${formatDate(post.writed_at || post.created_at)}`)
                    )
                  )
                )
              : h("div", { className: "empty-box" }, "게시글이 없습니다."),
            h("div", { className: "inline-actions" },
              h("button", { type: "button", className: "btn btn-ghost", onClick: onPrevPage }, "이전"),
              h("span", { className: "chip" }, `page ${page}`),
              h("button", { type: "button", className: "btn btn-ghost", onClick: onNextPage }, "다음")
            )
          )
        )
      )
    );
  }

  function PostView({ session, gid, post, comments, feedback, onSubmitComment, onLogout, alarmCount }) {
    const [content, setContent] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");
    if (!post) {
      return h(React.Fragment, null,
        h(Topbar, { session, onLogout, alarmCount }),
        h("main", { className: "shell" }, h("div", { className: "frame" }, h("div", { className: "error-box" }, "게시글을 찾을 수 없습니다.")))
      );
    }
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("article", { className: "card post-card" },
            h("div", { className: "muted" }, `${post.gall_name || gid} · ${authorLabel(post)} · ${formatDate(post.writed_at || post.created_at)}`),
            h("h1", { className: "post-heading" }, post.title || "제목 없음"),
            h("div", { className: "preview", dangerouslySetInnerHTML: { __html: post.content || "" } })
          ),
          h("section", { className: "section-stack" },
            h(SectionHead, { eyebrow: "Comments", title: "댓글" }),
            comments.length
              ? h("div", { className: "stack" },
                  comments.map((comment) =>
                    h("article", { className: "card", key: comment.id || comment.comment_id || `${comment.created_at}-${comment.name}` },
                      h("div", { className: "muted" }, `${authorLabel(comment)} · ${formatDate(comment.writed_at || comment.created_at)}`),
                      h("div", { className: "preview", dangerouslySetInnerHTML: { __html: comment.content || "" } })
                    )
                  )
                )
              : h("div", { className: "empty-box" }, "댓글이 없습니다."),
            h("article", { className: "card" },
              h("div", { className: "field" },
                h("label", { htmlFor: "comment-content" }, "댓글 내용"),
                h("textarea", { id: "comment-content", rows: 5, value: content, onChange: (event) => setContent(event.target.value) })
              ),
              session?.loggedIn ? null : h(GuestFields, { name: guestName, password: guestPassword, setName: setGuestName, setPassword: setGuestPassword, prefix: "comment" }),
              h(Feedback, { feedback }),
              h("div", { className: "inline-actions" },
                h("button", {
                  type: "button",
                  className: "btn btn-primary",
                  onClick() {
                    onSubmitComment({
                      gid,
                      postNo: post.post_no,
                      content,
                      name: guestName.trim(),
                      password: guestPassword
                    }, () => {
                      setContent("");
                      setGuestName("");
                      setGuestPassword("");
                    });
                  }
                }, "댓글 등록")
              )
            )
          )
        )
      )
    );
  }

  function WriteView({ session, gid, feedback, onSubmitPost, onLogout, alarmCount }) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "write-grid" },
            h("article", { className: "card" },
              h(SectionHead, { eyebrow: "Write", title: `${gid} 글쓰기` }),
              h("div", { className: "field" },
                h("label", { htmlFor: "write-title" }, "제목"),
                h("input", { id: "write-title", type: "text", value: title, onChange: (event) => setTitle(event.target.value) })
              ),
              h("div", { className: "field" },
                h("label", { htmlFor: "write-content" }, "본문"),
                h(HtmlEditor, { id: "write-content", value: content, onChange: setContent, placeholder: "글 내용을 입력해 주세요." })
              ),
              session?.loggedIn ? null : h(GuestFields, { name: guestName, password: guestPassword, setName: setGuestName, setPassword: setGuestPassword, prefix: "write" }),
              h(Feedback, { feedback }),
              h("div", { className: "inline-actions" },
                h("button", {
                  type: "button",
                  className: "btn btn-primary",
                  onClick() {
                    onSubmitPost({
                      gid,
                      title: title.trim(),
                      content,
                      name: guestName.trim(),
                      password: guestPassword
                    }, () => {
                      setTitle("");
                      setContent("");
                      setGuestName("");
                      setGuestPassword("");
                    });
                  }
                }, "작성 완료"),
                h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-ghost" }, "취소")
              )
            ),
            h("aside", { className: "preview-card card" },
              h("span", { className: "eyebrow" }, "Preview"),
              h("h3", { className: "section-title", style: { fontSize: "1.8rem" } }, "미리보기"),
              h("div", { className: "preview", dangerouslySetInnerHTML: { __html: content || "<p>아직 작성한 내용이 없습니다.</p>" } })
            )
          )
        )
      )
    );
  }

  function AuthView({ mode, feedback, onSubmitAuth, session, onLogout, alarmCount }) {
    const [uid, setUid] = useState("");
    const [nick, setNick] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [verificationSent, setVerificationSent] = useState(false);
    const [signupStep, setSignupStep] = useState(0);
    const [stepFeedback, setStepFeedback] = useState(null);
    const isLogin = mode === "login";

    const signupSteps = [
      {
        eyebrow: "Step 1",
        title: "아이디 입력",
        field: "uid",
        value: uid,
        canNext: uid.trim().length > 0,
        render: h("div", { className: "field" },
          h("label", { htmlFor: "auth-uid" }, "아이디"),
          h("input", { id: "auth-uid", type: "text", value: uid, onChange: (event) => setUid(event.target.value), placeholder: "4-20자 영문, 숫자, 밑줄" })
        )
      },
      {
        eyebrow: "Step 2",
        title: "닉네임 입력",
        field: "nick",
        value: nick,
        canNext: nick.trim().length > 0,
        render: h("div", { className: "field" },
          h("label", { htmlFor: "auth-nick" }, "닉네임"),
          h("input", { id: "auth-nick", type: "text", value: nick, onChange: (event) => setNick(event.target.value), placeholder: "2-20자 문자/숫자" })
        )
      },
      {
        eyebrow: "Step 3",
        title: "이메일 입력",
        field: "email",
        value: email,
        canNext: email.trim().length > 0,
        render: h("div", { className: "field" },
          h("label", { htmlFor: "auth-email" }, "이메일"),
          h("input", { id: "auth-email", type: "email", value: email, onChange: (event) => setEmail(event.target.value), placeholder: "인증 메일을 받을 주소" })
        )
      },
      {
        eyebrow: "Step 4",
        title: "비밀번호 입력",
        field: "password",
        value: password,
        canNext: password.length >= 8,
        render: h("div", { className: "stack" },
          h("div", { className: "field" },
            h("label", { htmlFor: "auth-pw" }, "비밀번호"),
            h("input", { id: "auth-pw", type: "password", value: password, onChange: (event) => setPassword(event.target.value), placeholder: "8자 이상 강한 비밀번호" })
          ),
          h("div", { className: "muted" }, "대문자, 소문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.")
        )
      },
      {
        eyebrow: "Step 5",
        title: verificationSent ? "인증 코드 입력" : "이메일 인증",
        canNext: verificationSent ? code.trim().length > 0 : true,
        render: verificationSent
          ? h("div", { className: "field" },
              h("label", { htmlFor: "auth-code" }, "인증 코드"),
              h("input", { id: "auth-code", type: "text", value: code, onChange: (event) => setCode(event.target.value), placeholder: "메일로 받은 6자리 코드" })
            )
          : h("div", { className: "muted" }, `${email || "입력한 이메일"} 주소로 인증 메일을 보냅니다.`)
      }
    ];

    const currentSignupStep = signupSteps[Math.min(signupStep, signupSteps.length - 1)];

    async function validateCurrentStep() {
      if (!currentSignupStep.field) return true;
      const result = await api(`/api/signup/validate?field=${encodeURIComponent(currentSignupStep.field)}&value=${encodeURIComponent(currentSignupStep.value || "")}`);
      if (!result?.success || !result?.data?.valid) {
        setStepFeedback({ type: "error", message: result?.data?.message || "입력값을 확인해 주세요." });
        return false;
      }
      setStepFeedback({ type: "success", message: "사용 가능한 값입니다." });
      return true;
    }

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "auth-wrap" },
            h("article", { className: "auth-card card" },
              h("span", { className: "eyebrow" }, isLogin ? "Access" : currentSignupStep.eyebrow),
              h("h1", { className: "section-title" }, isLogin ? "로그인" : currentSignupStep.title),
              h("div", { className: "stack", style: { marginTop: "16px" } },
                isLogin
                  ? h("div", { className: "stack" },
                      h("div", { className: "field" },
                        h("label", { htmlFor: "auth-login-id" }, "아이디 또는 이메일"),
                        h("input", { id: "auth-login-id", type: "text", value: uid, onChange: (event) => setUid(event.target.value) })
                      ),
                      h("div", { className: "field" },
                        h("label", { htmlFor: "auth-login-pw" }, "비밀번호"),
                        h("input", { id: "auth-login-pw", type: "password", value: password, onChange: (event) => setPassword(event.target.value) })
                      )
                    )
                  : h("div", { className: "stack" },
                      h("div", { className: "chip" }, `${signupStep + 1} / ${signupSteps.length}`),
                      currentSignupStep.render,
                      verificationSent && signupStep === signupSteps.length - 1
                        ? h("div", { className: "success-box" }, "인증 메일을 보냈습니다. 코드를 입력해 가입을 완료해 주세요.")
                        : null
                    ),
                h(Feedback, { feedback }),
                isLogin ? null : h(Feedback, { feedback: stepFeedback }),
                h("div", { className: "inline-actions" },
                  isLogin
                    ? h("button", { type: "button", className: "btn btn-primary", onClick: () => onSubmitAuth({ mode, uid, password }) }, "로그인")
                    : signupStep < signupSteps.length - 1
                      ? [
                          signupStep > 0 ? h("button", { type: "button", className: "btn btn-ghost", key: "prev", onClick: () => setSignupStep((v) => Math.max(0, v - 1)) }, "이전") : null,
                          h("button", {
                            type: "button",
                            className: "btn btn-primary",
                            key: "next",
                            disabled: !currentSignupStep.canNext,
                            async onClick() {
                              const valid = await validateCurrentStep();
                              if (!valid) return;
                              setSignupStep((v) => Math.min(signupSteps.length - 1, v + 1));
                            }
                          }, "다음")
                        ]
                      : [
                          h("button", { type: "button", className: "btn btn-ghost", key: "prev", onClick: () => setSignupStep((v) => Math.max(0, v - 1)) }, "이전"),
                          h("button", {
                            type: "button",
                            className: "btn btn-secondary",
                            key: "send",
                            onClick: () => onSubmitAuth({ mode, uid, nick, email, password, resendOnly: true, setVerificationSent })
                          }, verificationSent ? "인증 메일 다시 보내기" : "인증 메일 보내기"),
                          verificationSent
                            ? h("button", {
                                type: "button",
                                className: "btn btn-primary",
                                key: "verify",
                                disabled: !currentSignupStep.canNext,
                                onClick: () => onSubmitAuth({ mode, uid, nick, email, password, code, verificationSent, setVerificationSent })
                              }, "인증 완료하고 가입")
                            : null
                        ],
                  h(Link, { href: isLogin ? "/nid" : "/signin", className: "btn btn-secondary" }, isLogin ? "회원가입" : "로그인으로")
                )
              )
            )
          )
        )
      )
    );
  }

  function AlarmsView({ session, alarms, feedback, onAcceptAlarm, onRejectAlarm, onLogout, alarmCount }) {
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section-stack" },
            h(SectionHead, { eyebrow: "Inbox", title: "알림" }),
            !session?.loggedIn
              ? h("article", { className: "card auth-card" }, h("p", { className: "muted" }, "로그인 후 알림을 확인할 수 있습니다."))
              : h("div", { className: "stack" },
                  h(Feedback, { feedback }),
                  alarms.length
                    ? alarms.map((alarm) =>
                        h("article", { className: "card", key: alarm.alarm_id },
                          h("div", { className: "section-head" },
                            h("div", null,
                              h("span", { className: "eyebrow" }, alarm.alarm_type || "alarm"),
                              h("h2", { className: "section-title", style: { fontSize: "1.4rem" } }, alarm.title || "알림")
                            ),
                            h("span", { className: "chip" }, formatDate(alarm.created_at))
                          ),
                          h("p", { className: "muted" }, alarm.content || ""),
                          alarm.actionable
                            ? h("div", { className: "inline-actions" },
                                h("button", { type: "button", className: "btn btn-primary", onClick: () => onAcceptAlarm(alarm.alarm_id) }, "수락"),
                                h("button", { type: "button", className: "btn btn-ghost", onClick: () => onRejectAlarm(alarm.alarm_id) }, "거절")
                              )
                            : null
                        )
                      )
                    : h("div", { className: "empty-box" }, "도착한 알림이 없습니다.")
                )
          )
        )
      )
    );
  }

  function NotFoundView({ session, onLogout, alarmCount }) {
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "auth-wrap" },
            h("article", { className: "auth-card card" },
              h("span", { className: "eyebrow" }, "404"),
              h("h1", { className: "section-title" }, "페이지를 찾을 수 없습니다."),
              h(Link, { href: "/", className: "btn btn-primary" }, "홈으로")
            )
          )
        )
      )
    );
  }

  function App() {
    const [route, setRoute] = useState(matchRoute(window.location.pathname));
    const [session, setSession] = useState({ loggedIn: false });
    const [boards, setBoards] = useState([]);
    const [feed, setFeed] = useState([]);
    const [alarms, setAlarms] = useState([]);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [boardPosts, setBoardPosts] = useState([]);
    const [postData, setPostData] = useState({ post: null, comments: [] });
    const [authFeedback, setAuthFeedback] = useState(null);
    const [writeFeedback, setWriteFeedback] = useState(null);
    const [commentFeedback, setCommentFeedback] = useState(null);
    const [alarmFeedback, setAlarmFeedback] = useState(null);

    const currentBoard = boards.find((board) => board.gall_id === route.params.gid) || null;
    const alarmCount = alarms.filter((alarm) => alarm?.actionable).length;

    useEffect(() => {
      const syncRoute = () => setRoute(matchRoute(window.location.pathname));
      window.addEventListener("popstate", syncRoute);
      window.addEventListener("app:navigate", syncRoute);
      return () => {
        window.removeEventListener("popstate", syncRoute);
        window.removeEventListener("app:navigate", syncRoute);
      };
    }, []);

    function refreshSession() {
      return api("/api/check-login").then((data) => setSession(data || { loggedIn: false })).catch(() => setSession({ loggedIn: false }));
    }

    function refreshBoards() {
      return api("/api/board/list").then((data) => setBoards(Array.isArray(data) ? data : [])).catch(() => setBoards([]));
    }

    function refreshFeed() {
      return api("/api/posts/recommend").then((data) => setFeed(Array.isArray(data) ? data : [])).catch(() => setFeed([]));
    }

    function refreshAlarms() {
      if (!session?.loggedIn) {
        setAlarms([]);
        return Promise.resolve();
      }
      return api("/api/alarms/my").then((result) => setAlarms(result?.success && Array.isArray(result.alarms) ? result.alarms : [])).catch(() => setAlarms([]));
    }

    function refreshBoardPosts(gid, nextPage) {
      return api(`/api/board/posts/${encodeURIComponent(gid)}?page=${nextPage}`).then((data) => setBoardPosts(Array.isArray(data) ? data : [])).catch(() => setBoardPosts([]));
    }

    function refreshPostDetail(gid, postNo) {
      return api(`/api/posts/get/${encodeURIComponent(gid)}/${encodeURIComponent(postNo)}`)
        .then((result) => setPostData({ post: result?.success ? result.post : null, comments: result?.success && Array.isArray(result.comments) ? result.comments : [] }))
        .catch(() => setPostData({ post: null, comments: [] }));
    }

    useEffect(() => {
      refreshSession();
      refreshBoards();
      refreshFeed();
    }, []);

    useEffect(() => {
      if (session?.loggedIn) refreshAlarms();
      else setAlarms([]);
    }, [session?.loggedIn]);

    useEffect(() => {
      if (route.name === "board") refreshBoardPosts(route.params.gid, page);
      if (route.name === "post") refreshPostDetail(route.params.gid, route.params.postNo);
      if (route.name === "alarms") refreshAlarms();
    }, [route, page]);

    function handleLogout() {
      fetch("/logout", { method: "POST", credentials: "include" }).finally(() => {
        setSession({ loggedIn: false });
        navigate("/", true);
      });
    }

    function submitAuth(payload) {
      if (payload.mode === "login") {
        if (!payload.uid?.trim() || !payload.password) {
          setAuthFeedback({ type: "error", message: "아이디와 비밀번호를 입력해 주세요." });
          return;
        }
        api("/login", {
          method: "POST",
          body: JSON.stringify({ userID: payload.uid.trim(), password: payload.password })
        }).then((result) => {
          if (!result.success) {
            setAuthFeedback({ type: "error", message: result.message || "로그인에 실패했습니다." });
            return;
          }
          refreshSession().then(() => navigate("/", true));
        }).catch((error) => setAuthFeedback({ type: "error", message: error.message || "로그인 요청 중 오류가 발생했습니다." }));
        return;
      }

      if (!payload.uid?.trim() || !payload.nick?.trim() || !payload.email?.trim() || (payload.password || "").length < 8) {
        setAuthFeedback({ type: "error", message: "가입 정보를 다시 확인해 주세요." });
        return;
      }

      if (!payload.verificationSent || payload.resendOnly) {
        api("/api/signup/request", {
          method: "POST",
          body: JSON.stringify({
            userID: payload.uid.trim(),
            username: payload.nick.trim(),
            email: payload.email.trim(),
            password: payload.password
          })
        }).then((result) => {
          if (!result.success) {
            setAuthFeedback({ type: "error", message: result.message || "인증 메일 발송에 실패했습니다." });
            return;
          }
          payload.setVerificationSent?.(true);
          setAuthFeedback({ type: "success", message: result.message || "인증 메일을 보냈습니다." });
        }).catch((error) => setAuthFeedback({ type: "error", message: error.message || "인증 메일 발송 중 오류가 발생했습니다." }));
        return;
      }

      if (!payload.code?.trim()) {
        setAuthFeedback({ type: "error", message: "인증 코드를 입력해 주세요." });
        return;
      }

      api("/api/signup/verify", {
        method: "POST",
        body: JSON.stringify({
          userID: payload.uid.trim(),
          email: payload.email.trim(),
          code: payload.code.trim()
        })
      }).then((result) => {
        if (!result.success) {
          setAuthFeedback({ type: "error", message: result.message || "이메일 인증 확인에 실패했습니다." });
          return;
        }
        setAuthFeedback({ type: "success", message: result.message || "회원가입이 완료되었습니다." });
        setTimeout(() => navigate("/signin"), 500);
      }).catch((error) => setAuthFeedback({ type: "error", message: error.message || "이메일 인증 확인 중 오류가 발생했습니다." }));
    }

    function submitPost(payload, reset) {
      api("/api/posts/write", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result.success) {
            setWriteFeedback({ type: "error", message: result.message || "글 작성에 실패했습니다." });
            return;
          }
          reset?.();
          setWriteFeedback({ type: "success", message: "글을 등록했습니다." });
          refreshBoards();
          refreshFeed();
          navigate(`/board/${encodeURIComponent(payload.gid)}`, true);
        })
        .catch((error) => setWriteFeedback({ type: "error", message: error.message || "글 작성 중 오류가 발생했습니다." }));
    }

    function submitComment(payload, reset) {
      api("/api/posts/comment", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result.success) {
            setCommentFeedback({ type: "error", message: result.message || "댓글 등록에 실패했습니다." });
            return;
          }
          reset?.();
          setCommentFeedback({ type: "success", message: "댓글을 등록했습니다." });
          refreshPostDetail(payload.gid, payload.postNo);
        })
        .catch((error) => setCommentFeedback({ type: "error", message: error.message || "댓글 등록 중 오류가 발생했습니다." }));
    }

    function acceptAlarm(alarmId) {
      api(`/api/alarms/${encodeURIComponent(alarmId)}/accept`, { method: "POST" })
        .then((result) => {
          if (!result.success) {
            setAlarmFeedback({ type: "error", message: result.message || "알림 수락에 실패했습니다." });
            return;
          }
          setAlarmFeedback({ type: "success", message: "알림을 수락했습니다." });
          refreshAlarms();
          refreshBoards();
        })
        .catch((error) => setAlarmFeedback({ type: "error", message: error.message || "알림 수락 중 오류가 발생했습니다." }));
    }

    function rejectAlarm(alarmId) {
      api(`/api/alarms/${encodeURIComponent(alarmId)}/reject`, { method: "POST" })
        .then((result) => {
          if (!result.success) {
            setAlarmFeedback({ type: "error", message: result.message || "알림 거절에 실패했습니다." });
            return;
          }
          setAlarmFeedback({ type: "success", message: "알림을 거절했습니다." });
          refreshAlarms();
        })
        .catch((error) => setAlarmFeedback({ type: "error", message: error.message || "알림 거절 중 오류가 발생했습니다." }));
    }

    if (route.name === "home") return h(HomeView, { session, boards, feed, onLogout: handleLogout, alarmCount });
    if (route.name === "boards") return h(BoardsView, { session, boards, query, onQueryChange: setQuery, onLogout: handleLogout, alarmCount });
    if (route.name === "board") return h(BoardView, { session, gid: route.params.gid, board: currentBoard, posts: boardPosts, page, onPrevPage: () => setPage((v) => Math.max(1, v - 1)), onNextPage: () => setPage((v) => v + 1), onLogout: handleLogout, alarmCount });
    if (route.name === "post") return h(PostView, { session, gid: route.params.gid, post: postData.post, comments: postData.comments, feedback: commentFeedback, onSubmitComment: submitComment, onLogout: handleLogout, alarmCount });
    if (route.name === "write") return h(WriteView, { session, gid: route.params.gid, feedback: writeFeedback, onSubmitPost: submitPost, onLogout: handleLogout, alarmCount });
    if (route.name === "login") return h(AuthView, { mode: "login", feedback: authFeedback, onSubmitAuth: submitAuth, session, onLogout: handleLogout, alarmCount });
    if (route.name === "signup") return h(AuthView, { mode: "signup", feedback: authFeedback, onSubmitAuth: submitAuth, session, onLogout: handleLogout, alarmCount });
    if (route.name === "alarms") return h(AlarmsView, { session, alarms, feedback: alarmFeedback, onAcceptAlarm: acceptAlarm, onRejectAlarm: rejectAlarm, onLogout: handleLogout, alarmCount });
    return h(NotFoundView, { session, onLogout: handleLogout, alarmCount });
  }

  ReactDOM.createRoot(document.getElementById("app")).render(h(App));
})();
