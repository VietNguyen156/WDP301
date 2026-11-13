// Furniture and equipment handed over with a room, each with a unit price (the agreed value the
// tenant pays if it is lost or broken). Branch.defaultFurnishings is the branch catalogue;
// Room.furnishingType + Room.furnishings decide what one room actually has; a new contract keeps
// a copy (Contract.furnishings) so later catalogue edits never change a signed contract.
const FURNISHING_TYPES = ["UNFURNISHED", "FURNISHED"];

const plainItems = (list = []) =>
  list.map(({ name, quantity, price, note }) => ({
    name,
    quantity,
    price,
    ...(note ? { note } : {}),
  }));

// UNFURNISHED: nothing is handed over. Otherwise the room's own list, or the branch catalogue
// when the room has none. Rooms created before this feature have no type: furnished if any
// item applies.
function effectiveFurnishings(room, branch) {
  if (room?.furnishingType === "UNFURNISHED") return { furnishingType: "UNFURNISHED", furnishings: [] };
  const items = plainItems(Array.isArray(room?.furnishings) ? room.furnishings : branch?.defaultFurnishings || []);
  return {
    furnishingType: room?.furnishingType || (items.length ? "FURNISHED" : "UNFURNISHED"),
    furnishings: items,
  };
}

const furnishingsTotal = (items = []) =>
  items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);

module.exports = { FURNISHING_TYPES, effectiveFurnishings, furnishingsTotal };
