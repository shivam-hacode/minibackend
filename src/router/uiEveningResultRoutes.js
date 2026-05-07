const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const uiEveningKeyMiddleware = require("../middleware/uiEveningKeyMiddleware");
const { upsertEveningResult } = require("../controller/UiEveningResultController");

const router = express.Router();

router.post(
	"/upload",
	authenticate,
	uiEveningKeyMiddleware,
	upsertEveningResult
);

module.exports = router;
