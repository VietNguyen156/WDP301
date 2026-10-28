import { useEffect, useId, useRef, useState } from "react";

// Address suggestions from Photon (OpenStreetMap data, free, no API key), limited to Vietnam.
// Only the typed text leaves the browser. Swap PHOTON_URL for another geocoder if needed.
const PHOTON_URL = "https://photon.komoot.io/api/";
const VIETNAM_BBOX = "102.14,8.18,109.47,23.39";
const MIN_CHARS = 3;
const DEBOUNCE_MS = 350;

// "Số 18 Ngõ 233 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội" from Photon's properties.
function formatAddress(p) {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const parts = [p.name, street, p.locality, p.district, p.city, p.county, p.state];
  return parts
    .filter(Boolean)
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(", ");
}

export function AddressAutocomplete({ label, value, onChange, hint, required, placeholder }) {
  const id = useId();
  const listId = `${id}-list`;
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const picked = useRef(null); // value chosen from the list: do not search it again

  useEffect(() => {
    const query = (value || "").trim();
    if (query.length < MIN_CHARS || query === picked.current) {
      setSuggestions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query, limit: "6", bbox: VIETNAM_BBOX });
        const res = await fetch(`${PHOTON_URL}?${params}`, { signal: controller.signal });
        const data = await res.json();
        const items = (data.features || [])
          .filter((f) => !f.properties?.countrycode || f.properties.countrycode === "VN")
          .map((f) => formatAddress(f.properties || {}))
          .filter((text, index, all) => text && all.indexOf(text) === index);
        setSuggestions(items);
        setActive(-1);
        setOpen(items.length > 0);
      } catch (err) {
        if (err.name !== "AbortError") setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  function choose(text) {
    picked.current = text;
    onChange(text);
    setOpen(false);
    setSuggestions([]);
  }

  function onKeyDown(e) {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault(); // pick the suggestion instead of submitting the form
      choose(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <label className="field address-autocomplete" htmlFor={id}>
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      <div className="address-autocomplete-box">
        <input
          id={id}
          value={value}
          required={required}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            picked.current = null;
            onChange(e.target.value);
          }}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {loading && <span className="address-autocomplete-status">Đang tìm…</span>}
        {open && (
          <ul id={listId} role="listbox" className="address-autocomplete-list">
            {suggestions.map((text, index) => (
              <li
                key={text}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? "is-active" : ""}
                // mousedown keeps focus on the input, so blur does not close the list first
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(text);
                }}
              >
                {text}
              </li>
            ))}
            <li className="address-autocomplete-credit" aria-hidden="true">
              Gợi ý địa chỉ: © OpenStreetMap contributors
            </li>
          </ul>
        )}
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}
