import { api } from "./api";
import { mockBranches } from "./mockData";

export const branchService = {
  /**
   * Get all branches belonging to landlord/manager
   */
  async getBranches() {
    try {
      const res = await api.get("/branches");
      return res.data || res;
    } catch {
      return mockBranches;
    }
  },
};
