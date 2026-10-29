import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({
  label,
  hint,
  value,
  onChange,
  placeholder = "Nhập mật khẩu",
  autoComplete = "current-password",
  required = false,
  minLength,
  maxLength,
  disabled = false,
  strength = null,
}) {
  const inputId = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="field domus-field">
      <div className="field-label-row">
        <label htmlFor={inputId} className="domus-label">
          {label}
          {required && <b aria-hidden="true"> *</b>}
        </label>
        {hint && <small className="field-hint">{hint}</small>}
      </div>

      <div className="password-input">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          disabled={disabled}
        />
        <button
          type="button"
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          onClick={() => setVisible((prev) => !prev)}
          disabled={disabled}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {strength && value && (
        <div className="domus-pwd-strength" aria-live="polite">
          <div className="domus-pwd-bars">
            {[1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className={`domus-pwd-bar ${
                  strength.score >= level ? `is-filled tone-${strength.tone}` : ""
                }`}
              />
            ))}
          </div>
          <span className={`domus-pwd-strength-label tone-${strength.tone}`}>
            {strength.label}
          </span>
        </div>
      )}
    </div>
  );
}

export default PasswordField;
