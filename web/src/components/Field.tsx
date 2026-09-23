
interface TextProps {
  label: string; value: string; onChange: (v: string) => void;
  optional?: boolean; error?: string; type?: string; textarea?: boolean; placeholder?: string;
}
export function TextField({ label, value, onChange, optional, error, type = "text", textarea, placeholder }: TextProps) {
  return (
    <div className="field">
      <label>{label}{optional ? <span className="optional"> (Optional)</span> : null}</label>
      {textarea ? (
        <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

interface SelectProps {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; optional?: boolean; error?: string; placeholder?: string;
}
export function SelectField({ label, value, onChange, options, optional, error, placeholder = "Select…" }: SelectProps) {
  return (
    <div className="field">
      <label>{label}{optional ? <span className="optional"> (Optional)</span> : null}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

export function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, marginBottom: 8, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
