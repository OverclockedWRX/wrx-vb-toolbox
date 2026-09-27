export type RequiredColumn = {
  label: string;
  why: string;
  test: (header: string) => boolean;
};

export function normHeader(header: string) {
  return header.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Shared matchers for the requirement list and the CSV parser. Headers are already normalized. */
export const COLUMN_TESTS = {
  time: (header: string) => header.startsWith("time"),
  rpm: (header: string) => header === "rpm" || header.startsWith("rpm ") || header.startsWith("rpm("),
  accel: (header: string) => header.includes("accel position"),
  afr: (header: string) => header.includes("af sens 1"),
  cmd: (header: string) => header.includes("comm fuel final") || header.includes("fuel final"),
  boost: (header: string) => header === "boost" || header.startsWith("boost "),
  targetBoost: (header: string) => header.includes("target boost"),
  dam: (header: string) => header.includes("dyn adv") || /\bdam\b/.test(header),
  feedbackKnock: (header: string) => header.includes("feedback knock"),
  fineKnock: (header: string) => header.includes("fine knock"),
  timing: (header: string) => header.startsWith("ignition timing"),
  learn1: (header: string) => header.includes("af learning 1"),
  learn3: (header: string) => header.includes("af learning 3"),
  corr: (header: string) => header.includes("af correction 1"),
  load: (header: string) => header.includes("calculated load"),
  gear: (header: string) => header.includes("gear position"),
  fuelPressure: (header: string) => header.includes("fuel pressure") && !header.includes("target"),
  coolant: (header: string) => header.includes("coolant"),
  speed: (header: string) => header.includes("vehicle speed"),
  apInfo: (header: string) => header.startsWith("ap info"),
  intake: (header: string) => header.includes("intake temp"),
};

export function columnPresent(headers: string[], test: (header: string) => boolean) {
  return headers.some((header) => test(normHeader(header)));
}

export const REQUIRED_COLUMNS: RequiredColumn[] = [
  {
    label: "Time",
    why: "Pull length, knock duration, and the sample rate all come from the timestamp.",
    test: COLUMN_TESTS.time,
  },
  {
    label: "RPM",
    why: "Pulls, the chart axis, and the horsepower estimate are all judged against engine speed.",
    test: COLUMN_TESTS.rpm,
  },
  {
    label: "Accel Position",
    why: "Wide-open throttle is defined from the pedal. Throttle angle is not a substitute on a drive-by-wire car.",
    test: COLUMN_TESTS.accel,
  },
  {
    label: "AF Sens 1 Ratio",
    why: "This is the wideband reading. Without it there is no way to tell whether the mixture under boost is safe.",
    test: COLUMN_TESTS.afr,
  },
  {
    label: "Comm Fuel Final",
    why: "The wideband has to be compared with the AFR the ECU actually requested.",
    test: COLUMN_TESTS.cmd,
  },
  {
    label: "Boost",
    why: "On-boost samples and overboost are judged from boost pressure, not from throttle alone.",
    test: COLUMN_TESTS.boost,
  },
  {
    label: "Target Boost Final Rel",
    why: "Actual boost is compared with the boost the map is asking for.",
    test: COLUMN_TESTS.targetBoost,
  },
  {
    label: "DAM",
    why: "DAM below 1.00 means the ECU has pulled global timing after knock. A review that cannot see DAM can call a knocked log clean.",
    test: COLUMN_TESTS.dam,
  },
  {
    label: "Feedback Knock",
    why: "This is the timing the ECU pulls the moment the knock sensor trips.",
    test: COLUMN_TESTS.feedbackKnock,
  },
  {
    label: "Fine Knock Learn",
    why: "This is timing the ECU has stored. It shows whether a knock event was learned in, not just a one-sample blip.",
    test: COLUMN_TESTS.fineKnock,
  },
  {
    label: "Ignition Timing",
    why: "The review needs the timing that was actually delivered on a pull.",
    test: COLUMN_TESTS.timing,
  },
  {
    label: "AF Learning 1",
    why: "This closed-loop trim shows whether cruise fueling is already compensating for an airflow error.",
    test: COLUMN_TESTS.learn1,
  },
  {
    label: "AF Learning 3",
    why: "This is the learned fuel trim in the load range. A large value means the airflow model is off where the car makes boost.",
    test: COLUMN_TESTS.learn3,
  },
  {
    label: "AF Correction 1",
    why: "Short-term fuel trim shows whether the ECU is still chasing the mixture during the log.",
    test: COLUMN_TESTS.corr,
  },
  {
    label: "Calculated Load",
    why: "Grams per revolution is the airflow channel used for the horsepower estimate and for load context.",
    test: COLUMN_TESTS.load,
  },
  {
    label: "Gear Position",
    why: "Pulls are split by gear so a short second-gear pull is not mixed with third.",
    test: COLUMN_TESTS.gear,
  },
  {
    label: "Fuel Pressure",
    why: "Direct-injection pressure under boost is a fuel-delivery check. Low pressure can lean the engine out while trims still look normal.",
    test: COLUMN_TESTS.fuelPressure,
  },
  {
    label: "Coolant Temp",
    why: "A pull that starts cold, or a coolant temperature that runs away, changes how the fueling and knock results should be read.",
    test: COLUMN_TESTS.coolant,
  },
  {
    label: "Vehicle Speed",
    why: "Speed confirms the pull is on the road and feeds the road-load power check.",
    test: COLUMN_TESTS.speed,
  },
  {
    label: "AP Info",
    why: "The Accessport header is where the model year, the WRX identity, and the reflash name are written. Without it the review cannot confirm a 2022–2026 VB or which tune is loaded.",
    test: COLUMN_TESTS.apInfo,
  },
];

export const INTAKE_REQUIREMENT: RequiredColumn = {
  label: "Intake Temp or Intake Temp Manifold",
  why: "Charge temperature changes knock margin. Either Intake Temp or Intake Temp Manifold satisfies this.",
  test: COLUMN_TESTS.intake,
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
