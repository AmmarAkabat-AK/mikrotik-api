const express = require("express");
const cors = require("cors");
const RouterOSAPI = require("node-routeros").RouterOSAPI;

const app = express();
app.use(cors());
app.use(express.json());

// اختبار
app.get("/", (req, res) => {
  res.send("MikroTik API Running ✅");
});

// 🔥 الاتصال الحقيقي
app.post("/connect", async (req, res) => {
  const { host, user, pass, port } = req.body;

  if (!host || !user || !pass) {
    return res.json({
      connected: false,
      message: "بيانات ناقصة"
    });
  }

  const conn = new RouterOSAPI({
    host: host,
    user: user,
    password: pass,
    port: port || 8728,
    timeout: 5000
  });

  try {
    await conn.connect();

    const identity = await conn.write("/system/identity/print");

    conn.close();

    res.json({
      connected: true,
      identity: identity[0]?.name || "MikroTik"
    });

  } catch (err) {
    res.json({
      connected: false,
      message: err.message
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
