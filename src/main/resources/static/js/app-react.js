(() => {
  const h = React.createElement;
  const { useEffect, useMemo, useRef, useState } = React;

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

  const maskIp = (value) => {
    if (!value || value === "unknown") return "unknown";
    if (value.includes(":")) {
      const parts = value.split(":").filter(Boolean);
      if (parts.length <= 2) return value;
      return `${parts.slice(0, 2).join(":")}:*`;
    }

    const parts = value.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
    }

    return value;
  };

  const authorLabel = (item) => {
    if (!item) return "익명";
    if (item.writer_uid) return item.name || item.writer_uid;
    if (item.name && item.ip) return `${item.name} (${maskIp(item.ip)})`;
    return item.name || "익명";
  };

  const boardLabel = (item) => item?.gall_name || item?.gall_id || "-";

  const canDeleteItem = (item, session) => {
    if (!item) return false;
    if (item.writer_uid) {
      return !!session?.loggedIn && String(session.uid || "") === String(item.writer_uid);
    }
    return true;
  };

  function matchRoute(pathname) {
    if (pathname === "/") return { name: "home", params: {} };
    if (pathname === "/signin") return { name: "login", params: {} };
    if (pathname === "/nid") return { name: "signup", params: {} };
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
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
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

  function SectionHead({ eyebrow, title, action }) {
    return h("div", { className: "section-head" },
      h("div", null,
        h("span", { className: "eyebrow" }, eyebrow),
        h("h2", { className: "section-title" }, title)
      ),
      action || null
    );
  }

  function Topbar({ session, onLogout }) {
    return h("header", { className: "topbar" },
      h("div", { className: "frame" },
        h("div", { className: "topbar-inner" },
          h(Link, { href: "/", className: "brand" },
            h("span", { className: "brand-mark" }),
            h("span", null, "irisen archive")
          ),
          h("div", { className: "nav-actions" },
            h(Link, { href: "/", className: "btn btn-ghost" }, "홈"),
            h(Link, { href: "/boards", className: "btn btn-ghost" }, "보드"),
            session?.loggedIn
              ? [
                  h("span", { className: "chip", key: "nick" },
                    h("span", { className: "chip-dot" }),
                    session.nick || session.uid
                  ),
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

  function GuestFields({ name, password, setName, setPassword, prefix }) {
    return [
      h("div", { className: "field", key: `${prefix}-name` },
        h("label", { htmlFor: `${prefix}-guest-name` }, "비회원 이름"),
        h("input", {
          id: `${prefix}-guest-name`,
          type: "text",
          value: name,
          onChange: (event) => setName(event.target.value)
        })
      ),
      h("div", { className: "field", key: `${prefix}-password` },
        h("label", { htmlFor: `${prefix}-guest-password` }, "비밀번호"),
        h("input", {
          id: `${prefix}-guest-password`,
          type: "password",
          value: password,
          onChange: (event) => setPassword(event.target.value)
        })
      )
    ];
  }

  function EditorToolbar({ compact = false }) {
    const tools = [
      { label: "굵게", command: "bold" },
      { label: "기울임", command: "italic" },
      { label: "밑줄", command: "underline" },
      { label: "제목", command: "formatBlock", value: "h2" },
      { label: "본문", command: "formatBlock", value: "p" },
      { label: "인용", command: "formatBlock", value: "blockquote" },
      { label: "목록", command: "insertUnorderedList" },
      { label: "번호", command: "insertOrderedList" }
    ];

    return h("div", { className: compact ? "editor-toolbar editor-toolbar-compact" : "editor-toolbar" },
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

  function HtmlEditor({ id, value, onChange, placeholder, compact = false }) {
    const editorRef = useRef(null);

    useEffect(() => {
      if (!editorRef.current) return;
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }, [value]);

    return h("div", { className: compact ? "editor-shell editor-shell-compact" : "editor-shell" },
      h(EditorToolbar, { compact }),
      h("div", {
        id,
        ref: editorRef,
        className: compact ? "html-editor html-editor-compact" : "html-editor",
        contentEditable: true,
        suppressContentEditableWarning: true,
        "data-placeholder": placeholder,
        onInput(event) {
          onChange(event.currentTarget.innerHTML);
        }
      }),
      h("div", { className: "html-hint" }, "작성한 서식은 그대로 HTML로 저장됩니다.")
    );
  }

  function HomeView({ session, boards, feed, onLogout }) {
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "hero" },
            h("article", { className: "hero-card card" },
              h("span", { className: "eyebrow" }, "React Board"),
              h("h1", { className: "hero-title" }, "보고", h("br"), h("span", null, "읽고 쓰는"), h("br"), "보드"),
              h("p", { className: "hero-copy" }, "회원은 바로 작성할 수 있고, 비회원도 이름과 비밀번호를 입력하면 글과 댓글을 남길 수 있습니다."),
              h("div", { className: "inline-actions", style: { marginTop: "24px" } },
                h(Link, { href: "/boards", className: "btn btn-primary" }, "보드 보기"),
                h(Link, { href: "/signin", className: "btn btn-ghost" }, "로그인")
              ),
              h("div", { className: "hero-metrics" },
                h("div", { className: "metric" }, h("strong", null, boards.length), h("span", null, "boards")),
                h("div", { className: "metric" }, h("strong", null, feed.length), h("span", null, "recent posts")),
                h("div", { className: "metric" }, h("strong", null, session?.loggedIn ? "MEMBER" : "GUEST"), h("span", null, "write mode"))
              )
            ),
            h("aside", { className: "session-card card" },
              h("span", { className: "eyebrow" }, session?.loggedIn ? "Session" : "Guest"),
              h("h2", { className: "section-title" }, session?.loggedIn ? (session.nick || session.uid) : "비회원도 참여 가능"),
              h("p", { className: "hero-copy" }, session?.loggedIn
                ? "로그인 상태에서는 본인 글과 댓글만 삭제할 수 있습니다."
                : "비회원은 이름, 비밀번호와 함께 IP 앞자리 표시로 구분됩니다.")
            )
          ),
          h("section", { className: "section" },
            h(SectionHead, {
              eyebrow: "Live Feed",
              title: "최근 글",
              action: h(Link, { href: "/boards", className: "btn btn-secondary" }, "전체 보드")
            }),
            h("section", { className: "feed-layout" },
              h("div", { className: "panel list" },
                feed.length
                  ? feed.map((post) =>
                      h(Link, {
                        href: `/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`,
                        className: "feed-card",
                        key: `${post.gall_id}-${post.post_no}`
                      },
                      h("div", { className: "meta-row muted" }, h("span", null, boardLabel(post)), h("span", null, formatDate(post.writed_at))),
                      h("div", { className: "feed-title" }, post.title || "제목 없음"),
                      h("div", { className: "meta-row muted" }, h("span", null, authorLabel(post)), h("span", null, `#${post.post_no}`)))
                    )
                  : h("div", { className: "empty-box" }, "최근 글이 없습니다.")
              ),
              h("aside", { className: "panel list" },
                h(Link, { href: "/boards", className: "quick-card" }, h("div", { className: "board-title" }, "보드 목록"), h("div", { className: "muted" }, "전체 보드를 빠르게 둘러봅니다.")),
                h(Link, { href: "/signin", className: "quick-card" }, h("div", { className: "board-title" }, "로그인"), h("div", { className: "muted" }, "로그인하면 본인 글과 댓글을 바로 관리할 수 있습니다.")),
                h(Link, { href: "/nid", className: "quick-card" }, h("div", { className: "board-title" }, "회원가입"), h("div", { className: "muted" }, "새 계정을 만들고 닉네임으로 활동해 보세요.")))
            )
          )
        )
      )
    );
  }

  function BoardsView({ session, boards, query, onQueryChange, onLogout }) {
    const filtered = useMemo(() => {
      const normalized = query.trim().toLowerCase();
      return boards.filter((board) =>
        !normalized ||
        String(board.gall_id).toLowerCase().includes(normalized) ||
        String(board.gall_name).toLowerCase().includes(normalized)
      );
    }, [boards, query]);

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section" },
            h(SectionHead, {
              eyebrow: "Boards",
              title: "보드 목록",
              action: h(Link, { href: "/", className: "btn btn-secondary" }, "홈으로")
            }),
            h("div", { className: "panel" },
              h("input", {
                className: "searchbar",
                type: "text",
                value: query,
                placeholder: "보드 이름 또는 ID",
                onChange: (event) => onQueryChange(event.target.value)
              })
            ),
            h("section", { className: "board-grid", style: { marginTop: "18px" } },
              filtered.length
                ? filtered.map((board) =>
                    h(Link, {
                      href: `/board/${encodeURIComponent(board.gall_id)}`,
                      className: "board-card",
                      key: board.gall_id
                    },
                    h("span", { className: "eyebrow" }, "gallery"),
                    h("div", { className: "board-title" }, board.gall_name),
                    h("p", { className: "muted" }, `ID ${board.gall_id}`),
                    h("div", { className: "post-stats", style: { marginTop: "18px" } }, h("span", { className: "chip" }, `${board.post_count ?? 0} posts`)))
                  )
                : h("div", { className: "empty-box" }, "검색 결과가 없습니다.")
            )
          )
        )
      )
    );
  }

  function BoardView({ session, gid, board, posts, page, onPrevPage, onNextPage, onLogout }) {
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section" },
            h(SectionHead, {
              eyebrow: "Board",
              title: board ? board.gall_name : gid,
              action: h("div", { className: "board-tools" },
                h("span", { className: "chip mono" }, gid),
                h("span", { className: "chip" }, `${board?.post_count ?? posts.length} posts`)
              )
            }),
            h("section", { className: "board-layout" },
              h("div", { className: "panel board-main" },
                posts.length
                  ? posts.map((post) =>
                      h(Link, {
                        href: `/board/${encodeURIComponent(gid)}/${post.post_no}`,
                        className: "post-row",
                        key: `${gid}-${post.post_no}`
                      },
                      h("div", { className: "post-row-top muted" }, h("span", { className: "mono" }, `#${post.post_no}`), h("span", null, formatDate(post.writed_at || post.created_at || post.reg_date))),
                      h("div", { className: "post-title" }, post.title || "제목 없음"),
                      h("div", { className: "post-row-bottom muted" }, h("span", null, authorLabel(post)), h("span", null, `${post.comment_count ?? 0} comments`)))
                    )
                  : h("div", { className: "empty-box" }, "게시글이 없습니다."),
                h("div", { className: "pagination" },
                  h("button", { type: "button", className: "btn btn-ghost", onClick: onPrevPage }, "이전"),
                  h("span", { className: "chip" }, `page ${page}`),
                  h("button", { type: "button", className: "btn btn-ghost", onClick: onNextPage }, "다음")
                )
              ),
              h("aside", { className: "panel board-side" },
                h("span", { className: "eyebrow" }, "Write"),
                h("h3", { className: "section-title", style: { fontSize: "1.8rem" } }, "글쓰기"),
                h("p", { className: "muted" }, session?.loggedIn
                  ? "회원은 바로 작성할 수 있고, 삭제는 본인 글만 가능합니다."
                  : "비회원 글은 이름, 비밀번호와 함께 IP 앞자리 정보가 같이 표시됩니다."),
                h(Link, { href: `/board/${encodeURIComponent(gid)}/write`, className: "btn btn-primary" }, "작성 페이지 열기")
              )
            )
          )
        )
      )
    );
  }

  function PostView({
    session,
    gid,
    postNo,
    post,
    comments,
    feedback,
    postFeedback,
    onSubmitComment,
    onDeletePost,
    onDeleteComment,
    onLogout
  }) {
    const [content, setContent] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");
    const [postDeletePassword, setPostDeletePassword] = useState("");
    const [commentPasswords, setCommentPasswords] = useState({});

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "post-detail" },
            h("article", { className: "post-card" },
              post
                ? [
                    h("div", { className: "meta-row muted", key: "meta" },
                      h("span", { className: "chip mono" }, `${gid}/${postNo}`),
                      h("span", null, formatDate(post.writed_at || post.created_at || post.reg_date))
                    ),
                    h("h1", { className: "post-heading", key: "title" }, post.title || "제목 없음"),
                    h("div", { className: "post-stats muted", key: "stats" },
                      h("span", null, authorLabel(post)),
                      h("span", null, `${post.comment_count ?? comments.length} comments`)
                    ),
                    h("div", { className: "post-body", key: "body", dangerouslySetInnerHTML: { __html: post.content || "" } }),
                    h("div", { className: "inline-actions", style: { marginTop: "24px" }, key: "actions" },
                      h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-secondary" }, "목록으로"),
                      h(Link, { href: `/board/${encodeURIComponent(gid)}/write`, className: "btn btn-primary" }, "이 보드에 글쓰기")
                    ),
                    canDeleteItem(post, session)
                      ? h("section", { className: "section", key: "post-delete" },
                          h("div", { className: "panel stack" },
                            h("div", { className: "field" },
                              h("label", { htmlFor: "post-delete-password" }, post.writer_uid ? "글 삭제" : "비밀번호 확인"),
                              post.writer_uid
                                ? h("div", { className: "muted" }, "로그인 회원 글은 작성자 본인만 삭제할 수 있습니다.")
                                : h("input", {
                                    id: "post-delete-password",
                                    type: "password",
                                    value: postDeletePassword,
                                    onChange: (event) => setPostDeletePassword(event.target.value),
                                    placeholder: "글 작성 비밀번호"
                                  })
                            ),
                            h(Feedback, { feedback: postFeedback }),
                            h("div", { className: "inline-actions" },
                              h("button", {
                                type: "button",
                                className: "btn btn-ghost",
                                onClick() {
                                  onDeletePost({
                                    gid,
                                    postNo,
                                    password: post.writer_uid ? "" : postDeletePassword
                                  }, () => setPostDeletePassword(""));
                                }
                              }, "글 삭제")
                            )
                          )
                        )
                      : null,
                    h("section", { className: "section", key: "comments" },
                      h(SectionHead, { eyebrow: "Comments", title: "댓글" }),
                      h("div", { className: "panel list" },
                        comments.length
                          ? comments.map((comment) =>
                              h("div", { className: "post-row", key: comment.id },
                                h("div", { className: "post-row-top muted" },
                                  h("span", null, authorLabel(comment)),
                                  h("span", null, formatDate(comment.writed_at))
                                ),
                                h("div", { className: "post-title", style: { fontSize: "1rem" } }, comment.content || ""),
                                canDeleteItem(comment, session)
                                  ? h("div", { className: "stack", style: { marginTop: "12px" } },
                                      comment.writer_uid
                                        ? h("div", { className: "muted" }, "본인 댓글만 삭제할 수 있습니다.")
                                        : h("div", { className: "field" },
                                            h("label", { htmlFor: `comment-delete-${comment.id}` }, "비밀번호"),
                                            h("input", {
                                              id: `comment-delete-${comment.id}`,
                                              type: "password",
                                              value: commentPasswords[comment.id] || "",
                                              onChange: (event) => setCommentPasswords((current) => ({
                                                ...current,
                                                [comment.id]: event.target.value
                                              })),
                                              placeholder: "댓글 비밀번호"
                                            })
                                          ),
                                      h("div", { className: "inline-actions" },
                                        h("button", {
                                          type: "button",
                                          className: "btn btn-ghost",
                                          onClick() {
                                            onDeleteComment({
                                              gid,
                                              postNo,
                                              commentId: comment.id,
                                              password: comment.writer_uid ? "" : (commentPasswords[comment.id] || "")
                                            }, () => {
                                              setCommentPasswords((current) => {
                                                const next = { ...current };
                                                delete next[comment.id];
                                                return next;
                                              });
                                            });
                                          }
                                        }, "댓글 삭제")
                                      )
                                    )
                                  : null
                              )
                            )
                          : h("div", { className: "empty-box" }, "아직 댓글이 없습니다.")
                      ),
                      h("div", { className: "panel", style: { marginTop: "16px" } },
                        h("div", { className: "stack" },
                          h("div", { className: session?.loggedIn ? "success-box" : "error-box" },
                            session?.loggedIn
                              ? "로그인 상태로 댓글을 작성합니다."
                              : "비회원 댓글은 이름, 비밀번호와 함께 IP 앞자리 정보가 같이 표시됩니다."
                          ),
                          session?.loggedIn ? null : h(GuestFields, {
                            name: guestName,
                            password: guestPassword,
                            setName: setGuestName,
                            setPassword: setGuestPassword,
                            prefix: "comment"
                          }),
                          h("div", { className: "field" },
                            h("label", { htmlFor: "comment-content" }, "댓글 내용"),
                            h("textarea", {
                              id: "comment-content",
                              value: content,
                              onChange: (event) => setContent(event.target.value),
                              placeholder: "댓글을 입력하세요"
                            })
                          ),
                          h(Feedback, { feedback }),
                          h("div", { className: "inline-actions" },
                            h("button", {
                              type: "button",
                              className: "btn btn-primary",
                              onClick() {
                                onSubmitComment({
                                  gid,
                                  postNo,
                                  content: content.trim(),
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
                  ]
                : h("div", { className: "error-box" }, "게시글을 불러오지 못했습니다.")
            )
          )
        )
      )
    );
  }

  function WriteView({ session, gid, feedback, onSubmitPost, onLogout }) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section" },
            h(SectionHead, {
              eyebrow: "Compose",
              title: `${gid} 글쓰기`,
              action: h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-secondary" }, "보드로 돌아가기")
            }),
            h("section", { className: "write-shell" },
              h("article", { className: "compose-card card" },
                h("div", { className: session?.loggedIn ? "success-box" : "error-box" },
                  session?.loggedIn
                    ? `${session.nick || session.uid} 계정으로 작성합니다.`
                    : "비회원 글은 이름, 비밀번호와 함께 IP 앞자리 정보가 표시됩니다."
                ),
                h("div", { className: "composer", style: { marginTop: "16px" } },
                  session?.loggedIn ? null : h(GuestFields, {
                    name: guestName,
                    password: guestPassword,
                    setName: setGuestName,
                    setPassword: setGuestPassword,
                    prefix: "post"
                  }),
                  h("div", { className: "field" },
                    h("label", { htmlFor: "write-title" }, "제목"),
                    h("input", {
                      id: "write-title",
                      type: "text",
                      value: title,
                      onChange: (event) => setTitle(event.target.value),
                      placeholder: "글 제목을 입력하세요"
                    })
                  ),
                  h("div", { className: "field" },
                    h("label", { htmlFor: "write-content" }, "본문"),
                    h(HtmlEditor, {
                      id: "write-content",
                      value: content,
                      onChange: setContent,
                      placeholder: "여기에 바로 글을 작성하세요. 서식은 HTML로 저장됩니다."
                    })
                  ),
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
                    }, "게시하기"),
                    h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-ghost" }, "취소")
                  )
                )
              ),
              h("aside", { className: "preview-card card" },
                h("span", { className: "eyebrow" }, "Saved HTML"),
                h("h3", { className: "section-title", style: { fontSize: "1.8rem" } }, "저장 모습 미리보기"),
                h("div", { className: "preview", dangerouslySetInnerHTML: { __html: content || "<p>아직 작성된 내용이 없습니다.</p>" } })
              )
            )
          )
        )
      )
    );
  }

  function AuthView({ mode, feedback, onSubmitAuth, session, onLogout }) {
    const [uid, setUid] = useState("");
    const [nick, setNick] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const isLogin = mode === "login";

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "auth-wrap" },
            h("article", { className: "auth-card card" },
              h("span", { className: "eyebrow" }, isLogin ? "Access" : "Join"),
              h("h1", { className: "section-title" }, isLogin ? "로그인" : "회원가입"),
              h("p", { className: "muted" }, "회원은 닉네임으로 활동하고, 비회원도 이름과 비밀번호로 참여할 수 있습니다."),
              h("div", { className: "stack", style: { marginTop: "16px" } },
                h("div", { className: "field" },
                  h("label", { htmlFor: "auth-uid" }, isLogin ? "아이디 또는 이메일" : "아이디"),
                  h("input", { id: "auth-uid", type: "text", value: uid, onChange: (event) => setUid(event.target.value) })
                ),
                isLogin ? null : h("div", { className: "field" },
                  h("label", { htmlFor: "auth-nick" }, "닉네임"),
                  h("input", { id: "auth-nick", type: "text", value: nick, onChange: (event) => setNick(event.target.value) })
                ),
                isLogin ? null : h("div", { className: "field" },
                  h("label", { htmlFor: "auth-email" }, "이메일"),
                  h("input", { id: "auth-email", type: "email", value: email, onChange: (event) => setEmail(event.target.value) })
                ),
                h("div", { className: "field" },
                  h("label", { htmlFor: "auth-pw" }, "비밀번호"),
                  h("input", { id: "auth-pw", type: "password", value: password, onChange: (event) => setPassword(event.target.value) })
                ),
                h(Feedback, { feedback }),
                h("div", { className: "inline-actions" },
                  h("button", { type: "button", className: "btn btn-primary", onClick: () => onSubmitAuth({ uid, nick, email, password }) }, isLogin ? "로그인" : "회원가입"),
                  h(Link, { href: isLogin ? "/nid" : "/signin", className: "btn btn-secondary" }, isLogin ? "회원가입" : "로그인으로")
                )
              )
            )
          )
        )
      )
    );
  }

  function NotFoundView({ session, onLogout }) {
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout }),
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
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [boardPosts, setBoardPosts] = useState([]);
    const [postData, setPostData] = useState({ post: null, comments: [] });
    const [authFeedback, setAuthFeedback] = useState(null);
    const [writeFeedback, setWriteFeedback] = useState(null);
    const [commentFeedback, setCommentFeedback] = useState(null);
    const [postFeedback, setPostFeedback] = useState(null);

    const currentBoard = boards.find((board) => board.gall_id === route.params.gid) || null;

    useEffect(() => {
      const syncRoute = () => setRoute(matchRoute(window.location.pathname));
      window.addEventListener("popstate", syncRoute);
      window.addEventListener("app:navigate", syncRoute);
      return () => {
        window.removeEventListener("popstate", syncRoute);
        window.removeEventListener("app:navigate", syncRoute);
      };
    }, []);

    useEffect(() => {
      document.title = `${route.name} | irisen`;
    }, [route]);

    function refreshSession() {
      return api("/api/check-login")
        .then((data) => setSession(data || { loggedIn: false }))
        .catch(() => setSession({ loggedIn: false }));
    }

    function refreshBoards() {
      return api("/api/board/list")
        .then((data) => setBoards(Array.isArray(data) ? data : []))
        .catch(() => setBoards([]));
    }

    function refreshFeed() {
      return api("/api/posts/recommend")
        .then((data) => setFeed(Array.isArray(data) ? data : []))
        .catch(() => setFeed([]));
    }

    function refreshBoardPosts(gid, nextPage) {
      return api(`/api/board/posts/${encodeURIComponent(gid)}?page=${nextPage}`)
        .then((data) => setBoardPosts(Array.isArray(data) ? data : []))
        .catch(() => setBoardPosts([]));
    }

    function refreshPostDetail(gid, postNo) {
      return api(`/api/posts/get/${encodeURIComponent(gid)}/${encodeURIComponent(postNo)}`)
        .then((result) => {
          setPostData({
            post: result?.success ? result.post : null,
            comments: result?.success && Array.isArray(result.comments) ? result.comments : []
          });
        })
        .catch(() => setPostData({ post: null, comments: [] }));
    }

    useEffect(() => {
      refreshSession();
      refreshBoards();
    }, []);

    useEffect(() => {
      if (route.name === "home") {
        refreshFeed();
      }
      if (route.name === "board") {
        refreshBoardPosts(route.params.gid, page);
      }
      if (route.name === "post") {
        refreshPostDetail(route.params.gid, route.params.postNo);
      }
    }, [route, page]);

    useEffect(() => {
      if (route.name !== "board") setPage(1);
      if (route.name !== "login" && route.name !== "signup") setAuthFeedback(null);
      if (route.name !== "write") setWriteFeedback(null);
      if (route.name !== "post") {
        setCommentFeedback(null);
        setPostFeedback(null);
      }
      window.scrollTo({ top: 0, behavior: "auto" });
    }, [route]);

    function handleLogout() {
      fetch("/logout", { method: "POST", credentials: "include" }).finally(() => {
        setSession({ loggedIn: false });
        navigate("/", true);
      });
    }

    function submitAuth(payload) {
      if (route.name === "login") {
        if (!payload.uid.trim() || !payload.password) {
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

      if (!payload.uid.trim() || !payload.nick.trim() || payload.password.length < 4) {
        setAuthFeedback({ type: "error", message: "아이디, 닉네임, 4자 이상 비밀번호를 입력해 주세요." });
        return;
      }

      api("/api/signup", {
        method: "POST",
        body: JSON.stringify({
          userID: payload.uid.trim(),
          username: payload.nick.trim(),
          email: payload.email.trim(),
          password: payload.password
        })
      }).then((result) => {
        if (!result.success) {
          setAuthFeedback({ type: "error", message: result.message || "회원가입에 실패했습니다." });
          return;
        }
        setAuthFeedback({ type: "success", message: "가입이 완료되었습니다. 로그인 화면으로 이동합니다." });
        setTimeout(() => navigate("/signin"), 450);
      }).catch((error) => setAuthFeedback({ type: "error", message: error.message || "회원가입 요청 중 오류가 발생했습니다." }));
    }

    function submitPost(payload, reset) {
      const plainText = payload.content.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
      if (!payload.title || !plainText) {
        setWriteFeedback({ type: "error", message: "제목과 본문을 모두 입력해 주세요." });
        return;
      }

      if (!session?.loggedIn && (!payload.name || !payload.password)) {
        setWriteFeedback({ type: "error", message: "비회원은 이름과 비밀번호를 입력해야 합니다." });
        return;
      }

      api("/api/posts/write", {
        method: "POST",
        body: JSON.stringify(payload)
      }).then((result) => {
        if (!result.success) {
          setWriteFeedback({ type: "error", message: result.message || "게시글 작성에 실패했습니다." });
          return;
        }

        setWriteFeedback({ type: "success", message: "게시글이 등록되었습니다." });
        if (typeof reset === "function") reset();
        refreshBoards();
        refreshFeed();
        setTimeout(() => navigate(`/board/${encodeURIComponent(payload.gid)}`), 400);
      }).catch((error) => setWriteFeedback({ type: "error", message: error.message || "게시글 작성 중 오류가 발생했습니다." }));
    }

    function submitComment(payload, reset) {
      if (!payload.content) {
        setCommentFeedback({ type: "error", message: "댓글 내용을 입력해 주세요." });
        return;
      }

      if (!session?.loggedIn && (!payload.name || !payload.password)) {
        setCommentFeedback({ type: "error", message: "비회원은 이름과 비밀번호를 입력해야 합니다." });
        return;
      }

      api("/api/posts/comment", {
        method: "POST",
        body: JSON.stringify(payload)
      }).then((result) => {
        if (!result.success) {
          setCommentFeedback({ type: "error", message: result.message || "댓글 등록에 실패했습니다." });
          return;
        }

        setCommentFeedback({ type: "success", message: "댓글이 등록되었습니다." });
        if (typeof reset === "function") reset();
        refreshPostDetail(payload.gid, payload.postNo);
      }).catch((error) => setCommentFeedback({ type: "error", message: error.message || "댓글 등록 중 오류가 발생했습니다." }));
    }

    function deletePost(payload, reset) {
      if (!session?.loggedIn && !payload.password) {
        setPostFeedback({ type: "error", message: "비회원 글은 삭제 비밀번호가 필요합니다." });
        return;
      }

      api("/api/posts/delete", {
        method: "POST",
        body: JSON.stringify(payload)
      }).then((result) => {
        if (!result.success) {
          setPostFeedback({ type: "error", message: result.message || "게시글 삭제에 실패했습니다." });
          return;
        }

        if (typeof reset === "function") reset();
        refreshBoards();
        refreshFeed();
        navigate(`/board/${encodeURIComponent(payload.gid)}`, true);
      }).catch((error) => setPostFeedback({ type: "error", message: error.message || "게시글 삭제 중 오류가 발생했습니다." }));
    }

    function deleteComment(payload, reset) {
      if (!session?.loggedIn && !payload.password) {
        setCommentFeedback({ type: "error", message: "비회원 댓글은 삭제 비밀번호가 필요합니다." });
        return;
      }

      api("/api/posts/comment/delete", {
        method: "POST",
        body: JSON.stringify(payload)
      }).then((result) => {
        if (!result.success) {
          setCommentFeedback({ type: "error", message: result.message || "댓글 삭제에 실패했습니다." });
          return;
        }

        if (typeof reset === "function") reset();
        setCommentFeedback({ type: "success", message: "댓글이 삭제되었습니다." });
        refreshPostDetail(payload.gid, payload.postNo);
      }).catch((error) => setCommentFeedback({ type: "error", message: error.message || "댓글 삭제 중 오류가 발생했습니다." }));
    }

    if (route.name === "home") {
      return h(HomeView, { session, boards, feed, onLogout: handleLogout });
    }

    if (route.name === "boards") {
      return h(BoardsView, { session, boards, query, onQueryChange: setQuery, onLogout: handleLogout });
    }

    if (route.name === "board") {
      return h(BoardView, {
        session,
        gid: route.params.gid,
        board: currentBoard,
        posts: boardPosts,
        page,
        onPrevPage: () => setPage((value) => Math.max(1, value - 1)),
        onNextPage: () => setPage((value) => value + 1),
        onLogout: handleLogout
      });
    }

    if (route.name === "post") {
      return h(PostView, {
        session,
        gid: route.params.gid,
        postNo: route.params.postNo,
        post: postData.post,
        comments: postData.comments,
        feedback: commentFeedback,
        postFeedback,
        onSubmitComment: submitComment,
        onDeletePost: deletePost,
        onDeleteComment: deleteComment,
        onLogout: handleLogout
      });
    }

    if (route.name === "write") {
      return h(WriteView, {
        session,
        gid: route.params.gid,
        feedback: writeFeedback,
        onSubmitPost: submitPost,
        onLogout: handleLogout
      });
    }

    if (route.name === "login") {
      return h(AuthView, {
        mode: "login",
        feedback: authFeedback,
        onSubmitAuth: submitAuth,
        session,
        onLogout: handleLogout
      });
    }

    if (route.name === "signup") {
      return h(AuthView, {
        mode: "signup",
        feedback: authFeedback,
        onSubmitAuth: submitAuth,
        session,
        onLogout: handleLogout
      });
    }

    return h(NotFoundView, { session, onLogout: handleLogout });
  }

  const root = document.getElementById("app");
  if (root) {
    ReactDOM.createRoot(root).render(h(App));
  }
})();
