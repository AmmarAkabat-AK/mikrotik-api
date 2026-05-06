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
// ================== SCAN DEVICES ==================
app.post("/scan", async (req, res) => {
  try {
    const { host, user, pass, port } = req.body;

    const conn = new RouterOSAPI({
      host,
      user,
      password: pass,
      port: port || 8728,
      timeout: 7000
    });

    await conn.connect();

    const arp = await conn.write("/ip/arp/print");
    const dhcp = await conn.write("/ip/dhcp-server/lease/print");
    const hotspot = await conn.write("/ip/hotspot/active/print");

    await conn.close();

    const devices = [];
    const added = {};

    // ===== ARP =====
    arp.forEach(d => {
      if (!d.address) return;
      if (added[d.address]) return;

      added[d.address] = true;

      devices.push({
        name: d["host-name"] || "Unknown",
        ip: d.address,
        mac: d["mac-address"] || "-",
        source: "ARP"
      });
    });

    // ===== DHCP =====
    dhcp.forEach(d => {
      if (!d.address) return;
      if (added[d.address]) return;

      added[d.address] = true;

      devices.push({
        name: d["host-name"] || d.comment || "DHCP Client",
        ip: d.address,
        mac: d["mac-address"] || "-",
        source: "DHCP"
      });
    });

    // ===== Hotspot =====
    hotspot.forEach(d => {
      if (!d.address) return;
      if (added[d.address]) return;

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
  }
});

app.post("/usermanager/profiles", async (req,res)=>{

  try{

    const {
      host,
      user,
      pass,
      port
    } = req.body;

    const conn =
      new RouterOSAPI({

        host,
        user,
        password: pass,
        port: port || 8728
      });

    await conn.connect();

    const profiles =
      await conn.write(
        "/tool/user-manager/profile/print"
      );

    await conn.close();

    res.json({

      success:true,

      profiles:
        profiles.map(p => p.name)
    });

  }catch(e){

    console.error(e);

    res.json({

      success:false,
      profiles:[]
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
