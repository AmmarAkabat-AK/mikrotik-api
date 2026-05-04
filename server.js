import express from "express";
import cors from "cors";
import MikroNode from "mikronode";

const app = express();
app.use(cors());
app.use(express.json());

let routers = [];
let idCounter = 1;

/* =============================
   إضافة راوتر
============================= */
app.post("/routers", async (req, res) => {
  const { name, host, username, password, port } = req.body;

  try {
    const device = new MikroNode(host);
    const conn = await device.connect(username, password);
    conn.close();

    const router = {
      id: idCounter++,
      name,
      host,
      username,
      password,
      port,
      status: "online"
    };

    routers.push(router);

    res.json({
      connected: true,
      message: "تم الاتصال بنجاح"
    });

  } catch (e) {
    res.json({
      connected: false,
      message: "فشل الاتصال: " + e.message
    });
  }
});

/* =============================
   عرض الراوترات
============================= */
app.get("/routers", (req, res) => {
  res.json(routers);
});

/* =============================
   فحص الاتصال
============================= */
app.post("/routers/:id/connect", async (req, res) => {
  const r = routers.find(x => x.id == req.params.id);
  if (!r) return res.status(404).json({ error: "Not found" });

  try {
    const device = new MikroNode(r.host);
    const conn = await device.connect(r.username, r.password);
    const chan = await conn.openChannel();

    const sys = await chan.write("/system/identity/print");
    conn.close();

    r.status = "online";

    res.json({
      connected: true,
      identity: sys[0]?.identity || "MikroTik",
      version: "OK"
    });

  } catch (e) {
    r.status = "offline";

    res.json({
      connected: false,
      error: e.message
    });
  }
});

/* =============================
   كشف الأجهزة الحقيقي
============================= */
app.post("/routers/:id/scan", async (req, res) => {
  const r = routers.find(x => x.id == req.params.id);
  if (!r) return res.status(404).json({ error: "Not found" });

  try {
    const device = new MikroNode(r.host);
    const conn = await device.connect(r.username, r.password);
    const chan = await conn.openChannel();

    // DHCP
    const dhcp = await chan.write("/ip/dhcp-server/lease/print");

    // ARP
    const arp = await chan.write("/ip/arp/print");

    // Wireless
    const wireless = await chan.write("/interface/wireless/registration-table/print");

    conn.close();

    let devices = [];

    dhcp.forEach(d => {
      devices.push({
        name: d.host_name || "DHCP Device",
        ip: d.address,
        source: "DHCP"
      });
    });

    arp.forEach(a => {
      devices.push({
        name: "ARP Device",
        ip: a.address,
        source: "ARP"
      });
    });

    wireless.forEach(w => {
      devices.push({
        name: w.mac_address,
        ip: w.last_ip || "unknown",
        source: "Wireless"
      });
    });

    res.json({
      count: devices.length,
      devices
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =============================
   حذف راوتر
============================= */
app.delete("/routers/:id", (req, res) => {
  routers = routers.filter(r => r.id != req.params.id);
  res.json({ success: true });
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});