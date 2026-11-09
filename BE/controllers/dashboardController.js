const service = require("../services/dashboardService");
const reminders = require("../services/debtReminderService");
const respond = require("../utils/response");
exports.stats = async (req, res) => respond(res, await service.stats(req));
exports.debts = async (req, res) => respond(res, await service.debts(req));
exports.reminderSettings = async (req, res) => respond(res, await reminders.getSettings(req));
exports.updateReminderSettings = async (req, res) =>
  respond(res, await reminders.updateSettings(req));
