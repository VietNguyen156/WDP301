import { api } from "./api";

export const branchService = {
  /**
   * Get all branches belonging to landlord/manager from real MongoDB
   */
  async getBranches() {
    try {
      const res = await api.get("/branches?limit=100");
      const payload = res?.data !== undefined ? res.data : res;
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.items)) return payload.items;
      return [];
    } catch (err) {
      console.error("Failed to fetch branches:", err);
      return [];
    }
  },
};

