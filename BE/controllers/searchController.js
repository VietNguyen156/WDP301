const service = require("../services/searchService");
const respond = require("../utils/response");
exports.search = async (req, res) => respond(res, await service.search(req));
