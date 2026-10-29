import { Building2, ChevronRight, ArrowLeft, Lock, Loader2 } from "lucide-react";
import { FormError } from "../ui";

// Shown after login when the same CCCD / phone + password has an account with several landlords:
// each choice says whose account it is and which branch / room it covers.
export default function AccountChooser({ form }) {
  const { choices, chooseAccount, cancelChoice, busy, error } = form;
  return (
    <div className="account-chooser">
      <h2>Chọn tài khoản</h2>
      <p className="account-chooser-lead">
        Thông tin đăng nhập này dùng cho nhiều chủ trọ. Chọn nơi bạn muốn vào:
      </p>
      <ul>
        {choices.map((a) => {
          const locked = a.status === "INACTIVE";
          return (
            <li key={a.id}>
              <button
                type="button"
                className={`account-choice ${locked ? "is-locked" : ""}`}
                onClick={() => chooseAccount(a.id)}
                disabled={busy}
              >
                <span className="account-choice-icon">
                  <Building2 size={18} />
                </span>
                <span className="account-choice-text">
                  <strong>{a.landlordName}</strong>
                  <small>
                    {a.roleName}
                    {a.places?.length ? ` · ${a.places.join(", ")}` : a.role === "TENANT" ? " · không còn hợp đồng hiệu lực" : ""}
                  </small>
                  {locked && (
                    <small className="account-choice-locked">
                      <Lock size={11} /> Tạm khóa (hết hợp đồng)
                    </small>
                  )}
                </span>
                {busy ? <Loader2 size={16} className="spin" /> : <ChevronRight size={16} />}
              </button>
            </li>
          );
        })}
      </ul>
      <FormError error={error} />
      <button type="button" className="account-chooser-back" onClick={cancelChoice} disabled={busy}>
        <ArrowLeft size={14} /> Đăng nhập bằng tài khoản khác
      </button>
    </div>
  );
}
