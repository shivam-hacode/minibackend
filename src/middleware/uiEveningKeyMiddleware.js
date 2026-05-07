const CategoryKeyModel = require("../models/KeyModel");

/**
 * Validates that body.key (or X-Category-Key header) matches a registered
 * CategoryKeys row for the given categoryname.
 */
const uiEveningKeyMiddleware = async (req, res, next) => {
  try {
    const key =
      req.headers["x-category-key"] ||
      req.headers["x-api-key"] ||
      req.body?.key;
    const categoryname = req.body?.categoryname;

    if (!key || !categoryname) {
      return res.status(400).json({
        message: "categoryname and key are required (body.key or X-Category-Key)",
      });
    }

    const record = await CategoryKeyModel.findOne({
      key,
      categoryname: { $regex: new RegExp(`^${categoryname}$`, "i") },
    });

    if (!record) {
      return res.status(403).json({ message: "Invalid key for this category" });
    }

    req.uiEveningCategoryKey = record;
    next();
  } catch (err) {
    res.status(500).json({ message: "Key validation failed", error: err.message });
  }
};

module.exports = uiEveningKeyMiddleware;
