// Incident triage with TypeSafe Jev (https://docs.typesafe.ai): Jev answers typed questions
// about the tenant's report; the category and priority are decided in code below.
// Every question, option and threshold lives in this file so it can be audited and edited.
const Incident = require("../models/Incident");
const { AppError } = require("../utils/errors");

const API_URL = "https://api.typesafe.ai/v1/systemone";
const TIMEOUT_MS = 15000;
const model = () => process.env.TYPESAFE_MODEL || "jev-latest";
const enabled = () => !!process.env.TYPESAFE_API_KEY;

// Noul thresholds: >= YES reads as yes, < NO as no, anything between is unsettled.
const YES = 0.7;
const NO = 0.3;

// Choice option name (sent to Jev) -> stored category.
const CATEGORY_OPTIONS = {
  electrical: "ELECTRICAL",
  plumbing: "PLUMBING",
  appliance: "APPLIANCE",
  doors_locks_windows: "DOOR_LOCK_WINDOW",
  walls_ceiling_floor: "WALL_CEILING_FLOOR",
  internet_wifi: "INTERNET",
  pests_or_cleaning: "PEST_CLEANING",
  shared_area: "SHARED_AREA",
};

const QUESTIONS = {
  is_maintenance: {
    type: "noul",
    instructions:
      "Does `report` describe a physical problem in the rented room, the building, or their equipment that someone needs to repair, clean, or fix?",
    criteria: {
      true: "Something is broken, leaking, blocked, dirty, infested, or not working, for example a broken tap, no electricity, cockroaches, or a door that will not lock.",
      false:
        "There is nothing physical to fix, for example a question about the bill, a complaint about a noisy neighbour, a request to extend the contract, or test text such as 'abc'.",
    },
  },
  category: {
    type: "choice",
    instructions: "Which part of the room or building has the problem described in `report`?",
    criteria: {
      electrical:
        "Wiring, sockets, switches, lights, the circuit breaker, or the electricity meter. A power cut in the room belongs here.",
      plumbing:
        "Water pipes, taps, shower, toilet, sink, drains, or the water meter. A leaking pipe, tap or toilet belongs here.",
      appliance:
        "A machine in the room: air conditioner, water heater, fridge, washing machine, fan, or stove. Water dripping from an air conditioner belongs here.",
      doors_locks_windows: "Doors, locks, keys, windows, window frames, or curtains.",
      walls_ceiling_floor:
        "Walls, ceiling, floor, roof, paint, or tiles. Water coming through the ceiling or roof from rain belongs here.",
      internet_wifi: "Internet, Wi-Fi, cable TV, or the network router.",
      pests_or_cleaning: "Cockroaches, rats, termites, mould, bad smells, rubbish, or general cleaning.",
      shared_area: "Areas outside the room: stairs, corridor, gate, parking, lift, rooftop, or the shared laundry.",
    },
  },
  safety_hazard: {
    type: "noul",
    instructions: "Does `report` describe something that could injure people right now?",
    criteria: {
      true: "Sparks, a burning smell, smoke, exposed or shocking live wires, a gas smell, fire, a ceiling or wall that may collapse, or broken glass where people walk.",
      false:
        "The problem is inconvenient or uncomfortable but cannot hurt anyone, for example a slow drain, a dead light bulb, or a noisy fan.",
    },
  },
  active_water: {
    type: "noul",
    instructions:
      "According to `report`, is water escaping right now in a way that wets or damages the floor, walls, ceiling, or belongings?",
    criteria: {
      true: "Water is spraying from a pipe, overflowing from a toilet or drain, pouring through the ceiling, or spreading across the floor.",
      false:
        "No water is escaping now, or only a little that stays contained, for example a tap dripping slowly into the sink, low water pressure, a slow drain, or a leak that only happens when it rains.",
    },
  },
  utility_out: {
    type: "noul",
    instructions: "According to `report`, is a basic utility completely unavailable in the room?",
    criteria: {
      true: "The whole room has no electricity, no water comes out of any tap, or the only toilet cannot be used.",
      false: "The utility still works but has a problem, for example one socket is dead, water pressure is low, or the toilet flushes weakly.",
    },
  },
  cannot_secure: {
    type: "noul",
    instructions: "According to `report`, can the room currently not be locked or closed securely?",
    criteria: {
      true: "The main door lock is broken, the key no longer works, the door will not close, or a window is broken so anyone can get in.",
      false: "Doors and windows still lock, for example a squeaky hinge or a stiff lock that still works.",
    },
  },
  cosmetic_only: {
    type: "noul",
    instructions: "Is the problem in `report` only cosmetic or minor, with the room still fully usable?",
    criteria: {
      true: "Peeling paint, a small stain, a loose towel hook, a scratched door, or one flickering bulb.",
      false: "Something the tenant needs is not working, or there is damage that is getting worse.",
    },
  },
};

const REASONS = {
  safety_hazard: "Có nguy cơ gây nguy hiểm cho người",
  active_water: "Nước đang rò rỉ / tràn",
  utility_out: "Mất hoàn toàn điện, nước hoặc nhà vệ sinh",
  cannot_secure: "Phòng không khóa được",
  cosmetic_only: "Lỗi nhỏ, phòng vẫn dùng bình thường",
};
const ESCALATIONS = ["active_water", "utility_out", "cannot_secure"];

async function ask(incident) {
  const body = {
    model: model(),
    state: {
      context:
        "A maintenance report sent through the app of a Vietnamese boarding house. The text is in Vietnamese.",
      report: { title: incident.title, description: incident.description },
    },
    questions: QUESTIONS,
  };
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new AppError(`Không gọi được TypeSafe: ${error.message}`, 502, "TRIAGE_UNAVAILABLE");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.answers)
    throw new AppError(
      `TypeSafe trả lỗi ${response.status}: ${JSON.stringify(data?.detail ?? data).slice(0, 300)}`,
      502,
      "TRIAGE_FAILED",
    );
  return data;
}

// Truth table: Jev's judgments in, category + priority out.
function decide(answers) {
  const p = (name) => answers[name]?.noul ?? 0.5;
  const unsettled = (name) => p(name) >= NO && p(name) < YES;
  const reasons = Object.keys(REASONS).filter((name) => p(name) >= YES).map((name) => REASONS[name]);
  const maintenance = p("is_maintenance");

  let priority;
  if (p("safety_hazard") >= YES) priority = "URGENT";
  else if (unsettled("safety_hazard") || ESCALATIONS.some((name) => p(name) >= YES)) priority = "HIGH";
  else if (p("cosmetic_only") >= YES && !ESCALATIONS.some(unsettled)) priority = "LOW";
  else priority = "MEDIUM";

  const notMaintenance = maintenance < NO;
  if (notMaintenance) reasons.unshift("Nội dung không giống một sự cố cần sửa chữa");
  return {
    category: notMaintenance ? "OTHER" : CATEGORY_OPTIONS[answers.category?.choice] || "OTHER",
    priority,
    // A person should look when Jev could not settle whether it is a repair or a hazard.
    needsReview:
      notMaintenance ||
      unsettled("is_maintenance") ||
      unsettled("safety_hazard") ||
      ESCALATIONS.some(unsettled),
    reasons,
  };
}

// Runs the triage and stores the result. applyPriority: overwrite the priority (tenant reports,
// or a staff member explicitly asking to re-triage); otherwise the priority is only suggested.
async function triage(incidentId, { applyPriority = false } = {}) {
  if (!enabled())
    throw new AppError("Chưa cấu hình TYPESAFE_API_KEY trong BE/.env", 503, "TRIAGE_DISABLED");
  const incident = await Incident.findOne({ _id: incidentId, isDeleted: false });
  if (!incident) return null;
  try {
    const data = await ask(incident);
    const result = decide(data.answers);
    incident.category = result.category;
    if (applyPriority) incident.priority = result.priority;
    incident.triage = {
      status: "DONE",
      model: data.model,
      suggestedPriority: result.priority,
      needsReview: result.needsReview,
      reasons: result.reasons,
      signals: Object.fromEntries(
        Object.entries(data.answers).map(([name, answer]) => [
          name,
          answer.type === "noul" ? answer.noul : { choice: answer.choice, probabilities: answer.probabilities },
        ]),
      ),
      at: new Date(),
    };
  } catch (error) {
    // A failed call is an error, never an answer: category and priority stay as they were.
    incident.triage = { status: "FAILED", error: error.message, at: new Date() };
    await incident.save();
    throw error;
  }
  await incident.save();
  return incident;
}

module.exports = { enabled, ask, triage, decide, QUESTIONS, CATEGORY_OPTIONS, YES, NO };
