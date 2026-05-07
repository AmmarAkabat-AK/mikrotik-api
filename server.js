const express = require("express");
const cors = require("cors");
const RouterOSAPI = require("node-routeros").RouterOSAPI;

const app = express();

app.use(cors());
app.use(express.json());

const DEFAULT_PORT = 8728;

/* =========================================
   TEST
========================================= */
app.get("/", (req, res) => {
  res.send("MikroTik API Running ✅");
});

/* =========================================
   CONNECT ROUTER
========================================= */
app.post("/connect", async (req, res) => {
  const { host, user, pass, port } = req.body;

  if (!host || !user || !pass) {
    return res.json({
      connected: false,
      message: "بيانات ناقصة"
    });
  }

  const conn = new RouterOSAPI({
    host,
    user,
    password: pass,
    port: port || DEFAULT_PORT,
    timeout: 5000
  });

  try {
    await conn.connect();
    const identity = await conn.write("/system/identity/print");
    res.json({
      connected: true,
      identity: identity[0]?.name || "MikroTik"
    });
  } catch (err) {
    res.json({
      connected: false,
      message: err.message
    });
  } finally {
    try { await conn.close(); } catch {}
  }
});

/* =========================================
   SCAN DEVICES
========================================= */
app.post("/scan", async (req, res) => {
  const { host, user, pass, port } = req.body;
  const conn = new RouterOSAPI({
    host,
    user,
    password: pass,
    port: port || DEFAULT_PORT,
    timeout: 7000
  });

  try {
    await conn.connect();
    const [arp, dhcp, hotspot] = await Promise.all([
      conn.write("/ip/arp/print"),
      conn.write("/ip/dhcp-server/lease/print"),
      conn.write("/ip/hotspot/active/print")
    ]);
    const devices = [];
    const added = {};

    arp.forEach(d => {
      if (!d.address || added[d.address]) return;
      added[d.address] = true;
      devices.push({
        name: d["host-name"] || "Unknown",
        ip: d.address,
        mac: d["mac-address"] || "-",
        source: "ARP"
      });
    });

    dhcp.forEach(d => {
      if (!d.address || added[d.address]) return;
      added[d.address] = true;
      devices.push({
        name: d["host-name"] || d.comment || "DHCP Client",
        ip: d.address,
        mac: d["mac-address"] || "-",
        source: "DHCP"
      });
    });

    hotspot.forEach(d => {
      if (!d.address || added[d.address]) return;
      added[d.address] = true;
      devices.push({
        name: d.user || "Hotspot User",
        ip: d.address,
        mac: d["mac-address"] || "-",
        source: "Hotspot"
      });
    });

    res.json({
      success: true,
      count: devices.length,
      devices
    });
  } catch (e) {
    res.json({
      success: false,
      message: e.message
    });
  } finally {
    try { await conn.close(); } catch {}
  }
});

/* =========================================
   USERMANAGER PROFILES
========================================= */
app.post("/usermanager/profiles", async (req, res) => {
  const { host, user, pass, port } = req.body;
  const conn = new RouterOSAPI({
    host,
    user,
    password: pass,
    port: port || DEFAULT_PORT
  });

  try {
    await conn.connect();
    const profiles = await conn.write("/tool/user-manager/profile/print");
    res.json({
      success: true,
      profiles: profiles.map(p =>
        p.name ||
        p["actual-profile"] ||
        p.profile ||
        "Profile"
      )
    });
  } catch (e) {
    res.json({
      success: false,
      profiles: [],
      message: e.message
    });
  } finally {
    try { await conn.close(); } catch {}
  }
});

/* =========================================
   USERMANAGER USERS
========================================= */
app.post("/usermanager/users", async (req, res) => {
  const { host, user, pass, port } = req.body;
  const conn = new RouterOSAPI({
    host,
    user,
    password: pass,
    port: port || DEFAULT_PORT,
    timeout: 7000
  });

  try {
    await conn.connect();
    const users = await conn.write("/tool/user-manager/user/print");
    res.json({
      success: true,
      users: users.map(u => ({
        username: u.username || "",
        // لا ترسل كلمة السر أبداً
        // password: u.password || "",
        profile: u.actual_profile || "",
        uptime: u.uptime || "0",
        disabled: u.disabled || "false"
      }))
    });
  } catch (e) {
    res.json({
      success: false,
      users: [],
      message: e.message
    });
  } finally {
    try { await conn.close(); } catch {}
  }
});

/* =========================================
   SERVER
========================================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
