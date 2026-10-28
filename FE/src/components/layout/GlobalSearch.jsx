import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, DoorOpen, FileText, Receipt, LoaderCircle } from "lucide-react";
import { searchApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

// Top bar search across branches, rooms, contracts and invoices (GET /search).
const GROUPS = {
  branch: { label: "Cơ sở", icon: Building2 },
  room: { label: "Phòng", icon: DoorOpen },
  contract: { label: "Hợp đồng / Khách thuê", icon: FileText },
  invoice: { label: "Hóa đơn", icon: Receipt },
};
const MIN_CHARS = 2;

export function GlobalSearch() {
  const navigate = useNavigate();
  const { setSelectedBranchId } = useAuth();
  const listId = useId();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Ctrl+K / ⌘K focuses the search from anywhere.
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setItems([]);
      setSearched(false);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchApi.search(q);
        if (cancelled) return;
        setItems(res?.items || []);
        setActive(-1);
        setSearched(true);
        setOpen(true);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function go(item) {
    if (item.branchId) setSelectedBranchId(item.branchId);
    const q = encodeURIComponent(item.query || "");
    if (item.type === "branch") navigate("/rooms");
    else if (item.type === "room") navigate(`/rooms?search=${q}`);
    else if (item.type === "contract") navigate(`/contracts?search=${q}`);
    else if (item.type === "invoice") navigate(`/invoices?search=${q}`);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active >= 0 ? active : 0]);
    }
  }

  // Items arrive ordered by kind; print a heading whenever the kind changes.
  let lastType = null;

  return (
    <div className="stitch-search-container global-search">
      <Search size={16} className="stitch-search-icon" />
      <input
        ref={inputRef}
        type="text"
        className="stitch-search-input"
        placeholder="Tìm cơ sở, phòng, khách thuê (tên, SĐT, CCCD), mã hợp đồng, mã hóa đơn..."
        value={query}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => searched && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {loading ? (
        <LoaderCircle size={14} className="spin global-search-loading" />
      ) : (
        <span
          className="stitch-search-shortcut"
          onMouseDown={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          style={{ cursor: "pointer" }}
          title="Phím tắt: Ctrl+K hoặc ⌘K"
        >
          ⌘K
        </span>
      )}

      {open && (
        <ul id={listId} role="listbox" className="global-search-results">
          {items.length === 0 ? (
            <li className="global-search-empty">Không tìm thấy kết quả cho “{query.trim()}”.</li>
          ) : (
            items.map((item, index) => {
              const group = GROUPS[item.type];
              const Icon = group?.icon || Search;
              const heading = item.type !== lastType ? group?.label : null;
              lastType = item.type;
              return (
                <li key={`${item.type}-${item.id}`} role="presentation">
                  {heading && <div className="global-search-heading">{heading}</div>}
                  <div
                    role="option"
                    aria-selected={index === active}
                    className={`global-search-item ${index === active ? "is-active" : ""}`}
                    // mousedown keeps the input focused, so blur does not close the list first
                    onMouseDown={(e) => {
                      e.preventDefault();
                      go(item);
                    }}
                  >
                    <Icon size={15} className="global-search-item-icon" />
                    <span className="global-search-item-text">
                      <strong>{item.title}</strong>
                      {item.subtitle && <small>{item.subtitle}</small>}
                    </span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
