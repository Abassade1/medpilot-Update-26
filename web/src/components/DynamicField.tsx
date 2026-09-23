import { TextField, SelectField, CheckField } from "./Field";
import type { FieldDef } from "../lib/types";

interface Props { def: FieldDef; value: unknown; onChange: (v: unknown) => void; error?: string }

export default function DynamicField({ def, value, onChange, error }: Props) {
  switch (def.input) {
    case "textarea":
      return <TextField label={def.label} optional={!def.required} value={typeof value === "string" ? value : ""} onChange={onChange} textarea error={error} />;
    case "number":
      return (
        <TextField label={def.label} optional={!def.required} value={value == null ? "" : String(value)}
          onChange={(v) => onChange(v.replace(/\D/g, ""))} error={error} />
      );
    case "select":
      return (
        <SelectField label={def.label} optional={!def.required} value={typeof value === "string" ? value : ""}
          options={def.options ?? []} onChange={onChange} error={error} />
      );
    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="field">
          <label>{def.label}{def.required ? "" : <span className="optional"> (Optional)</span>}</label>
          {(def.options ?? []).map((o) => (
            <CheckField key={o.value} label={o.label} checked={selected.includes(o.value)}
              onChange={(v) => onChange(v ? [...selected, o.value] : selected.filter((x) => x !== o.value))} />
          ))}
          {error ? <span className="field-error">{error}</span> : null}
        </div>
      );
    }
    case "toggle":
      return <CheckField label={def.label} checked={value === true} onChange={onChange} />;
    default:
      return <TextField label={def.label} optional={!def.required} value={typeof value === "string" ? value : ""} onChange={onChange} error={error} />;
  }
}
