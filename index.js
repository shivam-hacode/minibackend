const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const moment = require("moment");

// Routes
const router = require("./src/router/resultRoutes.js");
const loginrouter = require("./src/router/authRouter.js");
const appConfigRouterModule = require("./src/router/appConfigRouter.js");

const appConfigRouter = appConfigRouterModule;
const appConfigRootRouter = appConfigRouterModule.rootRouter;

// Models
const Result2 = require("./src/models/ScrapperResultModel.js");

// Redis
const redis = require("./src/redisClient.js");

// ?? Disable buffering
mongoose.set("bufferCommands", false);

// ?? Mongo URI
const mongoURI =
  "mongodb+srv://shivamw2c_db_user:GjrZVTdi8pzcNRbZ@cluster0.q178wlu.mongodb.net/myDatabase?retryWrites=true&w=majority";

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api", router);
app.use("/api", loginrouter);
app.use("/api", appConfigRouter);
app.use("/", appConfigRootRouter);

// Test route
app.get("/api/hello", (req, res) => {
  res.json({ message: "Server running ?" });
});

// ?? MAIN API
app.post("/api/upload-data", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ message: "DB not connected" });
    }

    const { categoryname, date, time, result, number, next_result, mode } =
      req.body;

    if (!categoryname || !date || !time || !result || !number || !next_result) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const formattedDate = moment(date, ["DD/MM/YY", "YYYY-MM-DD"]).format("YYYY-MM-DD");
    const formattedTime = moment(time, ["HH:mm", "hh:mm A"]).format("hh:mm A");

    const cacheKey = `results:${categoryname}:${formattedDate}`;

    let existingDoc = await Result2.findOne({
      categoryname: { $regex: new RegExp(`^${categoryname}$`, "i") },
    });

    if (!existingDoc) {
      const newDoc = new Result2({
        categoryname,
        date: formattedDate,
        result: [{ date: formattedDate, time: formattedTime, number }],
        number,
        next_result: formattedTime,
        mode,
      });

      await newDoc.save();
      await redis.set(cacheKey, JSON.stringify(newDoc), { ex: 120 });

      return res.status(201).json({ message: "Created", data: newDoc });
    }

    const existingIndex = existingDoc.result.findIndex(
      (e) => e.date === formattedDate && e.time === formattedTime
    );

    if (existingIndex !== -1) {
      existingDoc.result[existingIndex].number = number;
    } else {
      existingDoc.result.push({ date: formattedDate, time: formattedTime, number });
    }

    existingDoc.number = number;
    existingDoc.next_result = formattedTime;
    existingDoc.mode = mode;
    existingDoc.date = formattedDate;

    await existingDoc.save();
    await redis.set(cacheKey, JSON.stringify(existingDoc), { ex: 120 });

    return res.status(200).json({ message: "Updated", data: existingDoc });

  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// ?? START APP (CORRECT ORDER)
const startApp = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log("MongoDB Connected ?");

    app.listen(5000, () => {
      console.log("Server running on port 5000 ??");
      console.log("[backend] index.js build: scheduler-inline-v3");

      setTimeout(() => {
        try {
          const mod = require("./src/scheduler.js");
          const run =
            typeof mod === "function"
              ? mod
              : mod?.startScheduler ?? mod?.default;
          if (typeof run !== "function") {
            console.error("[scheduler] bad export from src/scheduler.js:", mod);
            return;
          }
          run();
        } catch (err) {
          console.error("[scheduler] failed:", err);
        }
      }, 3000);
    });

  } catch (error) {
    console.error("MongoDB Error ?:", error.message);

    // retry
    setTimeout(startApp, 5000);
  }
};

startApp();

module.exports = app;