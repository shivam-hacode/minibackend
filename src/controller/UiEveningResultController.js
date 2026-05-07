const moment = require("moment");
const UiEveningResult = require("../models/UiEveningResultModel");

function safeFormatTime(rawTime) {
  if (!rawTime) return null;
  const m = moment(rawTime, ["HH:mm", "hh:mm A", "hh:mma"], true);
  return m.isValid() ? m.format("hh:mm A") : null;
}

/**
 * POST — upserts one time-slot row into ui_evening_results only (no Redis / main Result collection).
 * Intended for ~7:30 PM pushes from your UI backend.
 */
const upsertEveningResult = async (req, res) => {
  try {
    const {
      categoryname,
      date,
      time,
      result,
      number,
      next_result,
      mode,
    } = req.body;

    if (
      !categoryname ||
      !date ||
      !time ||
      result === undefined ||
      result === null ||
      result === "" ||
      number === undefined ||
      number === null ||
      !next_result
    ) {
      return res.status(400).json({
        message:
          "Missing required fields: categoryname, date, time, result, number, next_result",
      });
    }

    const formattedDate = moment(date, ["DD/MM/YY", "YYYY-MM-DD"]).format(
      "YYYY-MM-DD"
    );
    if (!moment(formattedDate, "YYYY-MM-DD", true).isValid()) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const formattedTime = safeFormatTime(time);
    if (!formattedTime) {
      return res.status(400).json({ message: "Invalid or missing time format" });
    }

    const canonicalCategory =
      req.uiEveningCategoryKey?.categoryname ?? categoryname;
    const canonicalKey = req.uiEveningCategoryKey?.key;

    let existingDoc = await UiEveningResult.findOne({
      categoryname: { $regex: new RegExp(`^${canonicalCategory}$`, "i") },
    });

    if (!existingDoc) {
      const newDoc = new UiEveningResult({
        categoryname: canonicalCategory,
        key: canonicalKey,
        date: formattedDate,
        result: [{ date: formattedDate, time: formattedTime, number }],
        number,
        next_result: formattedTime,
        mode,
      });
      await newDoc.save();
      return res.status(201).json({ message: "Created", data: newDoc });
    }

    const existingIndex = existingDoc.result.findIndex(
      (e) => e.date === formattedDate && e.time === formattedTime
    );

    if (existingIndex !== -1) {
      existingDoc.result[existingIndex].number = number;
    } else {
      existingDoc.result.push({
        date: formattedDate,
        time: formattedTime,
        number,
      });
    }

    existingDoc.number = number;
    existingDoc.next_result = formattedTime;
    existingDoc.mode = mode;
    existingDoc.date = formattedDate;
    existingDoc.key = canonicalKey;

    await existingDoc.save();
    return res.status(200).json({ message: "Updated", data: existingDoc });
  } catch (error) {
    console.error("[UiEveningResult] upsert:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  upsertEveningResult,
};
