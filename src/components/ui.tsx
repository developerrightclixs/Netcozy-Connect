import type { WorkspaceData } from "@/features/core/ui-types";
export const field = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export const skills = (f: FormData) =>
  field(f, "skills")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
export function Select({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: readonly string[];
  defaultValue?: string;
}) {
  return (
    <label>
      {label}
      <select aria-label={label} name={name} defaultValue={defaultValue}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replaceAll("-", " ").replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span>✧</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function AuditTable({ events }: { events: WorkspaceData["audit"] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Record</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{e.action}</td>
              <td>{e.entity.replace("nc_", "")}</td>
              <td>{new Date(e.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!events.length && <p className="muted">No recorded activity yet.</p>}
    </div>
  );
}
