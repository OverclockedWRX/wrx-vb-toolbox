export type RequiredColumn = {
  label: string;
  why: string;
  test: (header: string) => boolean;
};

export function normHeader(header: string) {
  return header.toLowerCase().replace(/\s+/g, " ").trim();
}

export const REQUIRED_COLUMNS: RequiredColumn[] = [
  {
    label: "Time",
    why: "Pull length, knock duration, and the sample rate all come from the timestamp.",
    test: (header) => header.startsWith("time"),
  },
  {
    label: "RPM",
    why: "Pulls, the chart axis, and the horsepower estimate are all judged against engine speed.",
    test: (header) => header === "rpm" || header.startsWith("rpm ") || header.startsWith("rpm("),
  },
  {
    label: "Accel Position",
    why: "Wide-open throttle is defined from the pedal. Throttle angle is not a substitute on a drive-by-wire car.",
    test: (header) => header.includes("accel position"),
  },
  {
    label: "AF Sens 1 Ratio",
    why: "This is the wideband reading. Without it there is no way to tell whether the mixture under boost is safe.",
    test: (header) => header.includes("af sens 1"),
  },
  {
    label: "Comm Fuel Final",
    why: "The wideband has to be compared with the AFR the ECU actually requested.",
    test: (header) => header.includes("comm fuel final") || header.includes("fuel final"),
  },
  {
    label: "Boost",
    why: "On-boost samples and overboost are judged from boost pressure, not from throttle alone.",
    test: (header) => header === "boost" || header.startsWith("boost "),
  },
  {
    label: "Target Boost Final Rel",
    why: "Actual boost is compared with the boost the map is asking for.",
    test: (header) => header.includes("target boost"),
  },
  {
    label: "DAM",
    why: "DAM below 1.00 means the ECU has pulled global timing after knock. A review that cannot see DAM can call a knocked log clean.",
    test: (header) => header.includes("dyn adv") || /\bdam\b/.test(header),
  },
  {
    label: "Feedback Knock",
    why: "This is the timing the ECU pulls the moment the knock sensor trips.",
    test: (header) => header.includes("feedback knock"),
  },
  {
    label: "Fine Knock Learn",
    why: "This is timing the ECU has stored. It shows whether a knock event was learned in, not just a one-sample blip.",
    test: (header) => header.includes("fine knock"),
  },
  {
    label: "Ignition Timing",
    why: "The review needs the timing that was actually delivered on a pull.",
    test: (header) => header.startsWith("ignition timing"),
  },
  {
    label: "AF Learning 1",
    why: "This closed-loop trim shows whether cruise fueling is already compensating for an airflow error.",
    test: (header) => header.includes("af learning 1"),
  },
  {
    label: "AF Learning 3",
    why: "This is the learned fuel trim in the load range. A large value means the airflow model is off where the car makes boost.",
    test: (header) => header.includes("af learning 3"),
  },
  {
    label: "AF Correction 1",
    why: "Short-term fuel trim shows whether the ECU is still chasing the mixture during the log.",
    test: (header) => header.includes("af correction 1"),
  },
  {
    label: "Calculated Load",
    why: "Grams per revolution is the airflow channel used for the horsepower estimate and for load context.",
    test: (header) => header.includes("calculated load"),
  },
  {
    label: "Gear Position",
    why: "Pulls are split by gear so a short second-gear pull is not mixed with third.",
    test: (header) => header.includes("gear position"),
  },
  {
    label: "Fuel Pressure",
    why: "Direct-injection pressure under boost is a fuel-delivery check. Low pressure can lean the engine out while trims still look normal.",
    test: (header) => header.includes("fuel pressure") && !header.includes("target"),
  },
  {
    label: "Coolant Temp",
    why: "A pull that starts cold, or a coolant temperature that runs away, changes how the fueling and knock results should be read.",
    test: (header) => header.includes("coolant"),
  },
  {
    label: "Vehicle Speed",
    why: "Speed confirms the pull is on the road and feeds the road-load power check.",
    test: (header) => header.includes("vehicle speed"),
  },
  {
    label: "AP Info",
    why: "The Accessport header is where the model year, the WRX identity, and the reflash name are written. Without it the review cannot confirm a 2022–2026 VB or which tune is loaded.",
    test: (header) => header.startsWith("ap info"),
  },
];

export const INTAKE_REQUIREMENT: RequiredColumn = {
  label: "Intake Temp or Intake Temp Manifold",
  why: "Charge temperature changes knock margin. Either Intake Temp or Intake Temp Manifold satisfies this.",
  test: (header) => header.includes("intake temp"),
};

export function requirementList(): RequiredColumn[] {
  return [...REQUIRED_COLUMNS, INTAKE_REQUIREMENT];
}

export function missingRequirements(headers: string[]): RequiredColumn[] {
  const norms = headers.map(normHeader);
  const missing = REQUIRED_COLUMNS.filter((column) => !norms.some((header) => column.test(header)));
  if (!norms.some((header) => INTAKE_REQUIREMENT.test(header))) missing.push(INTAKE_REQUIREMENT);
  return missing;
}
