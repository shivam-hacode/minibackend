const mongoose = require("mongoose");

const mongoURI =
  "mongodb+srv://shivamw2c_db_user:GjrZVTdi8pzcNRbZ@cluster0.q178wlu.mongodb.net/myDatabase?retryWrites=true&w=majority";

// ?? important
mongoose.set("bufferCommands", false);

const connectDB = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log("MongoDB Connected ?");
  } catch (error) {
    console.error("MongoDB Error ?:", error.message);

    // ? process.exit hata diya
    // ?? retry after 5 sec
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;