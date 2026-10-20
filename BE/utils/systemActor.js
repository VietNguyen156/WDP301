// Audit actor for changes triggered by SePay / bank callbacks rather than a signed-in user.
// Logged under the affected landlord so their audit trail stays complete.
const systemActor = (landlordId) => ({ _id: landlordId, role: "SYSTEM", landlordId });

// Same actor shaped as an Express request, for services that read req.user.
const systemReq = (landlordId) => ({ user: systemActor(landlordId) });

module.exports = { systemActor, systemReq };
