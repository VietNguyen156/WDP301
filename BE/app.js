const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const errorHandler = require("./middlewares/errorHandler");
const { ForbiddenError, NotFoundError } = require("./utils/errors");
const { clientUrl } = require("./utils/appUrls");

const app = express();
app.disable("x-powered-by");
// Behind a hosting proxy (Render, Railway...) set TRUST_PROXY=1 so req.ip is the real client:
// rate limits and audit logs depend on it. Leave unset when the app is reached directly.
if (process.env.TRUST_PROXY)
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

app.use(
  cors({
    origin: clientUrl(),
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "256kb",
    verify: (req, res, buffer) => {
      if (/\/payments\/webhook\/?$/i.test(req.path)) req.rawBody = buffer;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "256kb" }));
app.use(cookieParser());

app.use((req, res, next) => {
  if (req.headers["x-landlord-id"] || req.headers["x-user-id"])
    throw new ForbiddenError("Không hỗ trợ header thay đổi phạm vi chủ trọ");
  next();
});

app.get("/", (req, res) =>
  res.json({
    success: true,
    message: "WDP301 Property & Finance API",
    data: {
      api: "/api/v1",
      frontend: clientUrl(),
    },
  }),
);

// Support both /api/v1 and /api base paths
app.use("/api/v1", require("./routes"));
app.use("/api", require("./routes"));

app.use((req, res, next) =>
  next(new NotFoundError("Đường dẫn API không tồn tại")),
);
app.use(errorHandler);

module.exports = app;
