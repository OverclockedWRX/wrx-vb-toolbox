export type ObdOrigin = "subaru-bulletin" | "subaru-dit" | "sae";

export type ObdEntry = {
  code: string;
  meaning: string;
  origin: ObdOrigin;
};

const CODES: Record<string, ObdEntry> = {};

function add(origin: ObdOrigin, items: [string, string][]) {
  for (const [code, meaning] of items) CODES[code] = { code, meaning, origin };
}

/** Named in Subaru service bulletin 09-94-22 for the 2022 WRX (NHTSA). */
add("subaru-bulletin", [
  ["P0011", "Intake camshaft timing over-advanced, or the system is out of range, bank 1."],
  ["P0014", "Exhaust camshaft timing over-advanced, or the system is out of range, bank 1."],
  ["P0016", "Crankshaft and intake camshaft positions do not correlate, bank 1."],
  ["P0017", "Crankshaft and exhaust camshaft positions do not correlate, bank 1."],
  ["P0018", "Crankshaft and intake camshaft positions do not correlate, bank 2."],
  ["P0019", "Crankshaft and exhaust camshaft positions do not correlate, bank 2."],
  ["P0021", "Intake camshaft timing over-advanced, or the system is out of range, bank 2."],
  ["P0024", "Exhaust camshaft timing over-advanced, or the system is out of range, bank 2."],
  ["P0087", "Fuel rail pressure is too low."],
  ["P0088", "Fuel rail pressure is too high."],
  ["P0128", "Coolant is staying below the temperature the thermostat should hold."],
  ["P050B", "Cold-start ignition timing is not performing as expected."],
  ["P1604", "Startability fault. Subaru uses this when the engine does not start as the monitor expects."],
]);

/** Subaru direct-injection definitions. FA24 (2022+ WRX) shares this family; not a 2025–2026-only publication. */
add("subaru-dit", [
  ["P000A", "Intake camshaft on bank 1 is slow to reach the position the ECU asked for."],
  ["P000B", "Exhaust camshaft on bank 1 is slow to reach the position the ECU asked for."],
  ["P000C", "Intake camshaft on bank 2 is slow to reach the position the ECU asked for."],
  ["P000D", "Exhaust camshaft on bank 2 is slow to reach the position the ECU asked for."],
  ["P1086", "Tumble generator valve position sensor 2 circuit low."],
  ["P1087", "Tumble generator valve position sensor 2 circuit high."],
  ["P1088", "Tumble generator valve position sensor 1 circuit low."],
  ["P1089", "Tumble generator valve position sensor 1 circuit high."],
  ["P1090", "Tumble generator valve 1 is stuck open."],
  ["P1091", "Tumble generator valve 1 is stuck closed."],
  ["P1092", "Tumble generator valve 2 is stuck open."],
  ["P1093", "Tumble generator valve 2 is stuck closed."],
  ["P1094", "Tumble generator valve 1 circuit open."],
  ["P1095", "Tumble generator valve 1 circuit over-current."],
  ["P1096", "Tumble generator valve 2 circuit open."],
  ["P1097", "Tumble generator valve 2 circuit over-current."],
  ["P2004", "Intake runner / tumble valve stuck open, bank 1."],
  ["P2005", "Intake runner / tumble valve stuck open, bank 2."],
  ["P2006", "Intake runner / tumble valve stuck closed, bank 1."],
  ["P2007", "Intake runner / tumble valve stuck closed, bank 2."],
  ["P2008", "Intake runner control circuit open, bank 1."],
  ["P2016", "Tumble generator valve position sensor 1 circuit low."],
  ["P2017", "Tumble generator valve position sensor 1 circuit high."],
  ["P2021", "Tumble generator valve position sensor 2 circuit low."],
  ["P2022", "Tumble generator valve position sensor 2 circuit high."],
  ["P226B", "Boost went past the limiter. On the FA24 this code can command a fuel cut and a throttle cut."],
]);

/** Generic SAE J2012 wording. Not a Subaru service definition. */
add("sae", [
  ["P0010", "Intake camshaft timing solenoid circuit open, bank 1."],
  ["P0012", "Intake camshaft timing over-retarded, bank 1."],
  ["P0013", "Exhaust camshaft timing solenoid circuit open, bank 1."],
  ["P0015", "Exhaust camshaft timing over-retarded, bank 1."],
  ["P0020", "Intake camshaft timing solenoid circuit open, bank 2."],
  ["P0030", "Upstream oxygen sensor heater circuit, bank 1."],
  ["P0031", "Upstream oxygen sensor heater circuit low, bank 1."],
  ["P0036", "Downstream oxygen sensor heater circuit, bank 1."],
  ["P0037", "Downstream oxygen sensor heater circuit low, bank 1."],
  ["P0101", "Mass airflow sensor range or performance."],
  ["P0102", "Mass airflow sensor circuit low."],
  ["P0103", "Mass airflow sensor circuit high."],
  ["P0106", "Manifold pressure sensor range or performance."],
  ["P0107", "Manifold pressure sensor circuit low."],
  ["P0108", "Manifold pressure sensor circuit high."],
  ["P0112", "Intake air temperature sensor circuit low."],
  ["P0113", "Intake air temperature sensor circuit high."],
  ["P0116", "Coolant temperature sensor range or performance."],
  ["P0117", "Coolant temperature sensor circuit low."],
  ["P0118", "Coolant temperature sensor circuit high."],
  ["P0122", "Throttle position sensor circuit low."],
  ["P0123", "Throttle position sensor circuit high."],
  ["P0130", "Upstream oxygen sensor circuit, bank 1."],
  ["P0131", "Upstream oxygen sensor circuit low, bank 1."],
  ["P0132", "Upstream oxygen sensor circuit high, bank 1."],
  ["P0134", "Upstream oxygen sensor shows no activity, bank 1."],
  ["P0137", "Downstream oxygen sensor circuit low, bank 1."],
  ["P0138", "Downstream oxygen sensor circuit high, bank 1."],
  ["P0171", "Fuel system too lean, bank 1."],
  ["P0172", "Fuel system too rich, bank 1."],
  ["P0174", "Fuel system too lean, bank 2."],
  ["P0175", "Fuel system too rich, bank 2."],
  ["P0201", "Fuel injector 1 circuit open."],
  ["P0202", "Fuel injector 2 circuit open."],
  ["P0203", "Fuel injector 3 circuit open."],
  ["P0204", "Fuel injector 4 circuit open."],
  ["P0234", "Turbo overboost."],
  ["P0299", "Turbo underboost."],
  ["P0300", "Random or multiple-cylinder misfire."],
  ["P0301", "Cylinder 1 misfire."],
  ["P0302", "Cylinder 2 misfire."],
  ["P0303", "Cylinder 3 misfire."],
  ["P0304", "Cylinder 4 misfire."],
  ["P0325", "Knock sensor 1 circuit."],
  ["P0327", "Knock sensor 1 circuit low."],
  ["P0335", "Crankshaft position sensor circuit."],
  ["P0340", "Intake camshaft position sensor circuit, bank 1."],
  ["P0341", "Intake camshaft position sensor range or performance, bank 1."],
  ["P0351", "Ignition coil 1 primary circuit."],
  ["P0352", "Ignition coil 2 primary circuit."],
  ["P0353", "Ignition coil 3 primary circuit."],
  ["P0354", "Ignition coil 4 primary circuit."],
  ["P0420", "Catalyst efficiency below threshold, bank 1."],
  ["P0441", "Evaporative purge flow incorrect."],
  ["P0442", "Evaporative system small leak."],
  ["P0455", "Evaporative system large leak."],
  ["P0456", "Evaporative system very small leak."],
  ["P0500", "Vehicle speed sensor."],
  ["P0601", "Control module memory checksum."],
  ["P0606", "Control module processor."],
  ["P0700", "Transmission control system fault. The transmission module asked the engine light on."],
]);

export function originLabel(origin: ObdOrigin) {
  if (origin === "subaru-bulletin") return "Subaru-specific";
  if (origin === "subaru-dit") return "Subaru DIT";
  return "Generic SAE";
}

export function originNote(origin: ObdOrigin) {
  if (origin === "subaru-bulletin") {
    return "Named in Subaru service bulletin 09-94-22 for the 2022 WRX. The same FA24 engine family continued after 2024; a separate 2025–2026 code list was not in the sources checked.";
  }
  if (origin === "subaru-dit") {
    return "Subaru direct-injection definition, including tumble valves and the FA24 boost limiter. Not from a 2025–2026 WRX-only publication.";
  }
  return "Generic SAE J2012 wording. Subaru may phrase the same code differently. This is not a Subaru service definition.";
}

export type ObdLookup =
  | { status: "empty" }
  | { status: "invalid"; raw: string }
  | { status: "known"; entry: ObdEntry }
  | { status: "unknown"; code: string; family: string };

export function normalizeObd(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function lookupObd(raw: string): ObdLookup {
  const compact = normalizeObd(raw);
  if (!compact) return { status: "empty" };
  const code = /^[0-9A-F]{4}$/.test(compact) ? `P${compact}` : compact;
  if (!/^[PCBU][0-3][0-9A-F]{3}$/.test(code)) return { status: "invalid", raw: compact };
  const entry = CODES[code];
  if (entry) return { status: "known", entry };
  return { status: "unknown", code, family: familyNote(code) };
}

function familyNote(code: string) {
  const system = { P: "Powertrain", C: "Chassis", B: "Body", U: "Network" }[code[0]] ?? "Unknown";
  const kind = code[1] === "0" || code[1] === "2" ? "generic SAE" : "manufacturer-specific";
  return `${system} code, ${kind}. No stored definition for this one. A generic reader and Subaru’s own wording can differ, especially on manufacturer codes.`;
}
