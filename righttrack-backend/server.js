require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const ensureSuperAdmin = require("./utils/bootstrapSuperAdmin");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/claims", require("./routes/claimsRoutes"));
app.use("/api/claims", require("./routes/messagesRoutes"));
app.use("/api/policies", require("./routes/policiesRoutes"));

app.get("/", (req, res) => {
  res.send("RightTrack API is running.");
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();
  await ensureSuperAdmin();
  return app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error("Server startup failed:", err.message);
    process.exit(1);
  });
}

module.exports = { app, startServer };
