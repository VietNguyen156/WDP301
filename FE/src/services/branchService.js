import { branchApi } from "./api";

export const branchService = {
  /**
   * Get all branches belonging to landlord/manager from real MongoDB
   */
  async getBranches() {
    try {
      return await branchApi.options();
    } catch {
      return [];
    }
  },
};
