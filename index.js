var express = require('express');

var app = express();

app.set("view engine", "ejs");

app.use(express.static(__dirname + "/public"));

app.use("/admin", require("./controllers/admin.js"));
app.use("/", require("./controllers/main.js"));

app.listen(process.env.PORT || 3000);