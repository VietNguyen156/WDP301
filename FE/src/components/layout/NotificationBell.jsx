import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, AlertOctagon, AlertTriangle, Info, CheckCircle2, RefreshCw, Activity } from "lucide-react";
import { notificationApi } from "../../services/api";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { useToast } from "../../context/ToastContext";

// Two parts:
//   "Việc cần xử lý"    work waiting for the user (GET /notifications), recounted on every change;
//   "Hoạt động gần đây" who did what, in which room, as it happens ("activity" Socket.io events).
// The red badge counts what is new since the panel was last opened; that is remembered per user
// in this browser.
const REFRESH_MS = 60000;
const MAX_ACTIVITY = 30;
const ICONS = { danger: AlertOctagon, warning: AlertTriangle, info: Info };

const storageKey = (kind, userId) => `notifications-${kind}:${userId}`;
function read(kind, userId, fallback) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(kind, userId)) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function write(kind, userId, value) {
  try {
    localStorage.setItem(storageKey(kind, userId), JSON.stringify(value));
  } catch {
    // storage blocked: the badge just resets on the next visit
  }
}

const timeAgo = (iso) => {
  const minutes = Math.round((Date.now() - new Date(iso)) / 60000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} giờ trước` : new Date(iso).toLocaleDateString("vi-VN");
};

export function NotificationBell({ userId }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [activities, setActivities] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seen, setSeen] = useState(() => read("seen", userId, {}));
  const [seenAt, setSeenAt] = useState(() => read("seen-at", userId, 0));
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list();
      setItems(res?.items || []);
      setError(null);
    } catch {
      setError("Không tải được thông báo");
    } finally {
      setLoading(false);
    }
  }, []);

  // History from the audit log once; live "activity" events are added on top.
  useEffect(() => {
    notificationApi
      .activity()
      .then((res) =>
        setActivities((current) => {
          const ids = new Set(current.map((a) => a.id));
          return [...current, ...(res?.items || []).filter((a) => !ids.has(a.id))].slice(0, MAX_ACTIVITY);
        }),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // Counts change with almost every write anywhere in the chain.
  useLiveRefresh(["notifications"], load);

  // Someone else did something this user may see: keep it in the feed and announce it.
  useSocketEvent("activity", (event) => {
    if (!event?.id) return;
    setActivities((current) => {
      if (current.some((a) => a.id === event.id)) return current;
      return [event, ...current].slice(0, MAX_ACTIVITY);
    });
    if (event.actor?.id && event.actor.id === String(userId)) return; // own actions: no toast
    toast.info(event.details ? `${event.message} — ${event.details}` : event.message, 6000);
  });

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const newWork = items.reduce((sum, i) => sum + Math.max(0, i.count - (seen[i.key] || 0)), 0);
  const newActivity = activities.filter(
    (a) => new Date(a.at).getTime() > seenAt && a.actor?.id !== String(userId),
  ).length;
  const unseen = newWork + newActivity;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const counts = Object.fromEntries(items.map((i) => [i.key, i.count]));
      const now = Date.now();
      write("seen", userId, counts);
      write("seen-at", userId, now);
      setSeen(counts);
      setSeenAt(now);
    }
  }

  function go(link) {
    setOpen(false);
    if (link) navigate(link);
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="stitch-icon-btn"
        title="Thông báo"
        aria-label={unseen ? `Thông báo, ${unseen} mục mới` : "Thông báo"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={toggle}
      >
        <Bell size={17} />
        {unseen > 0 && <span className="notif-badge">{unseen > 99 ? "99+" : unseen}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Thông báo">
          <div className="notif-panel-head">
            <strong>Việc cần xử lý</strong>
            <button type="button" className="notif-refresh" onClick={load} disabled={loading} aria-label="Tải lại thông báo">
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
          </div>
          {error ? (
            <p className="notif-empty">{error}</p>
          ) : items.length === 0 ? (
            <div className="notif-empty">
              <CheckCircle2 size={22} />
              <p>Không có việc nào đang chờ bạn.</p>
            </div>
          ) : (
            <div className="notif-groups">
              {items.map((g) => {
                const Icon = ICONS[g.severity] || Info;
                const more = g.count - (g.entries?.length || 0);
                return (
                  <section key={g.key} className={`notif-group sev-${g.severity}`}>
                    <button type="button" className="notif-group-head" onClick={() => go(g.link)}>
                      <Icon size={15} className="notif-item-icon" />
                      <strong>{g.title}</strong>
                      <span className="notif-item-count">{g.count}</span>
                    </button>
                    <ul className="notif-list">
                      {(g.entries || []).map((e) => (
                        <li key={e.id}>
                          <button type="button" className="notif-entry" onClick={() => go(e.link)}>
                            <span className="notif-item-text">
                              <strong>{e.text}</strong>
                              {e.sub && <small>{e.sub}</small>}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {more > 0 && (
                      <button type="button" className="notif-more" onClick={() => go(g.link)}>
                        Xem thêm {more} mục khác
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          <div className="notif-panel-head notif-section">
            <strong>Hoạt động gần đây</strong>
          </div>
          {activities.length === 0 ? (
            <p className="notif-empty small">Chưa có hoạt động nào gần đây.</p>
          ) : (
            <ul className="notif-list">
              {activities.map((a) => (
                <li key={a.id}>
                  <button type="button" className="notif-item sev-activity" onClick={() => go(a.link)}>
                    <Activity size={15} className="notif-item-icon" />
                    <span className="notif-item-text">
                      <strong>{a.message}</strong>
                      {a.details && <small>{a.details}</small>}
                      <small className="notif-time">{timeAgo(a.at)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
