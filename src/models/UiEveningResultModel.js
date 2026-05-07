const mongoose = require("mongoose");

const uiEveningResultSchema = new mongoose.Schema(
  {
    categoryname: { type: String, required: true },
    key: { type: String, required: true },
    date: { type: String, required: true },
    result: [
      {
        date: String,
        time: String,
        number: mongoose.Schema.Types.Mixed,
      },
    ],
    number: mongoose.Schema.Types.Mixed,
    next_result: { type: String, required: true },
    mode: { type: String },
  },
  {
    timestamps: true,
    collection: "ui_evening_results",
  }
);

module.exports = mongoose.model("UiEveningResult", uiEveningResultSchema);
