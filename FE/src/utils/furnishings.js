// Furniture handed over with a room; mirrors BE utils/furnishings.js.
export const FURNISHING_TYPE_LABELS = {
  FURNISHED: "Phòng đầy đủ đồ",
  UNFURNISHED: "Phòng trống (không kèm đồ)",
};

export const furnishingsTotal = (items = []) =>
  items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);

// UNFURNISHED: nothing handed over. Otherwise the room's own list, or the branch catalogue.
export function effectiveFurnishings(room, branch) {
  if (room?.furnishingType === "UNFURNISHED") return { furnishingType: "UNFURNISHED", furnishings: [] };
  const items = Array.isArray(room?.furnishings) ? room.furnishings : branch?.defaultFurnishings || [];
  return {
    furnishingType: room?.furnishingType || (items.length ? "FURNISHED" : "UNFURNISHED"),
    furnishings: items,
  };
}

// Form rows -> API body: trimmed names, whole-number quantity/price, empty notes dropped.
export const cleanFurnishings = (items = []) =>
  items.map(({ name, quantity, price, note }) => ({
    name: name.trim(),
    quantity: Math.max(1, Math.round(Number(quantity) || 1)),
    price: Math.max(0, Math.round(Number(price) || 0)),
    ...(note?.trim() ? { note: note.trim() } : {}),
  }));

// First problem in the rows, or "" (the server checks the same rules).
export function furnishingsError(items = []) {
  const names = new Set();
  for (const item of items) {
    const name = item.name.trim();
    if (!name) return "Tên vật dụng không được để trống.";
    if (names.has(name.toLowerCase())) return `Vật dụng "${name}" bị trùng tên.`;
    names.add(name.toLowerCase());
    if (!(Number(item.quantity) >= 1)) return `Số lượng "${name}" phải từ 1 trở lên.`;
    if (!(Number(item.price) >= 0)) return `Đơn giá "${name}" không được âm.`;
  }
  return "";
}
