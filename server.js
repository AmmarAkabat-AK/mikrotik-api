require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { RouterOSAPI } = require("node-routeros");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ================== Supabase ==================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ================== MikroTik ==================
async function connectRouter() {
  const conn = new RouterOSAPI({
    host: process.env.MIKROTIK_HOST,
    user: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASS,
    port: process.env.MIKROTIK_PORT || 8728
  });

  await conn.connect();
  return conn;
}

// ================== الصفحة الرئيسية ==================
app.get("/", (req, res) => {
  res.send("MikroTik API is running 🚀");
});

// ================== 🔥 SCAN ROUTE (المهم) ==================
app.post("/scan", async (req, res) => {
  try {
    const { host, user, pass, port, network } = req.body;

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

    // 🔥 فلترة الشبكة (مثال: 172.16.0.0/16)
    let prefix = "172.16.";
    if (network && network.includes("/")) {
      prefix = network.split(".").slice(0, 2).join(".") + ".";
    }

    // ===== ARP =====
    arp.forEach(d => {
      if (!d.address) return;
      if (!d.address.startsWith(prefix)) return;
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
      if (!d.address.startsWith(prefix)) return;
      if (added[d.address]) return;

      added[d.address] = true;

      devices.push({
        name: d["host-name"] || d.comment || "DHCP",
        ip: d.address,
        mac: d["mac-address"] || "-",
        source: "DHCP"
      });
    });

    // ===== Hotspot =====
    hotspot.forEach(d => {
      if (!d.address) return;
      if (!d.address.startsWith(prefix)) return;
      if (added[d.address]) return;

      added[d.address] = true;

      devices.push({
        name: d.user || "Hotspot",
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
    console.error(e);
    res.json({
      success: false,
      message: e.message
    });
  }
});

// ================== تشغيل السيرفر ==================
app.listen(PORT, () => {
  console.log("Server Started 🔥 on port " + PORT);
});
