import { TOPIC_OPTIONS, FORMAT_OPTIONS } from "../../../shared/preferences";
interface Props {
  topics: string[]; formats: string[]; onTopics: (items: string[]) => void; onFormats: (items: string[]) => void; disabled?: boolean;
}
/** La encuesta y Mi perfil usan las mismas opciones e identificadores. */
export function PreferenceFields({ topics, formats, onTopics, onFormats, disabled = false }: Props) {
  const toggle = (items: string[], id: string, checked: boolean) => checked ? [...items, id] : items.filter(item => item !== id);
  return <div className="preference-fields">
    <fieldset disabled={disabled}><legend>¿Qué tipo de información te interesa consultar en Visual Community?</legend>
      <p className="muted small">Selecciona uno o varios temas.</p>
      <div className="preference-options">{TOPIC_OPTIONS.map(item => <label className={topics.includes(item.id) ? "selected" : ""} key={item.id}>
        <input type="checkbox" checked={topics.includes(item.id)} onChange={e => onTopics(toggle(topics, item.id, e.target.checked))}/><span>{item.label}</span>
      </label>)}</div>
    </fieldset>
    <fieldset disabled={disabled}><legend>¿Qué contenido prefieres ver? <span className="muted small">(Opcional)</span></legend>
      <div className="preference-options formats">{FORMAT_OPTIONS.map(item => <label className={formats.includes(item.id) ? "selected" : ""} key={item.id}>
        <input type="checkbox" checked={formats.includes(item.id)} onChange={e => onFormats(toggle(formats, item.id, e.target.checked))}/><span>{item.label}</span>
      </label>)}</div>
    </fieldset>
  </div>;
}
