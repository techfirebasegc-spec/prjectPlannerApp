export const BUSINESS_ID_TYPES = Object.freeze({
  pi: Object.freeze({ prefix: "PI" }), feature: Object.freeze({ prefix: "FEAT" }),
  sprint: Object.freeze({ prefix: "SPR" }), story: Object.freeze({ prefix: "US" }),
  task: Object.freeze({ prefix: "TASK" })
});
export function formatBusinessId(entityType, sequence) {
  const definition = BUSINESS_ID_TYPES[entityType];
  if (!definition) throw new TypeError("Unknown business ID entity type: " + entityType);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new RangeError("Business ID sequence must be a positive safe integer.");
  return definition.prefix + "-" + String(sequence).padStart(3, "0");
}
export function parseBusinessIdSequence(entityType, code) {
  const definition = BUSINESS_ID_TYPES[entityType];
  if (!definition || typeof code !== "string") return null;
  const match = code.trim().match(new RegExp("^" + definition.prefix + "-([0-9]{3,})$"));
  if (!match) return null;
  const sequence = Number(match[1]);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}
export function highestBusinessIdSequence(entityType, records) {
  return (Array.isArray(records) ? records : []).reduce((highest, record) => {
    const parsed = parseBusinessIdSequence(entityType, record?.code);
    return parsed === null ? highest : Math.max(highest, parsed);
  }, 0);
}
