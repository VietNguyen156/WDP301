// Emails tenants about unpaid invoices on the schedule in services/debtReminderService.js.
// Runs every hour but only sends between 8:00 and 20:00 Vietnam time; each invoice gets at most
// one email per day. DEBT_REMINDER_AUTO=false turns the job off; each landlord can also turn it
// off for their own tenants (PUT /dashboard/reminder-settings).
const { runAutoReminders } = require("../services/debtReminderService");
const { VN_OFFSET_MS } = require("../utils/vnTime");

const INTERVAL_MS = 3600000;
const enabled = () => process.env.DEBT_REMINDER_AUTO !== "false";
const vnHour = () => new Date(Date.now() + VN_OFFSET_MS).getUTCHours();

function start() {
  if (!enabled()) return;
  const run = () => {
    const hour = vnHour();
    if (hour < 8 || hour >= 20) return;
    runAutoReminders()
      .then(({ sent, failed }) => {
        if (sent || failed) console.log(`Nhắc nợ qua email: đã gửi ${sent}, lỗi ${failed}`);
      })
      .catch((error) => console.error("Gửi email nhắc nợ tự động thất bại:", error.message));
  };
  // Give the server a minute to finish starting before the first run.
  setTimeout(run, 60000).unref();
  setInterval(run, INTERVAL_MS).unref();
}

module.exports = { start };
