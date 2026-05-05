const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

    // 🔥 فلترة الشبكة
    let prefix = "172.16.";
    if (network && network.includes("/")) {
      const parts = network.split(".");
      prefix = parts[0] + "." + parts[1] + ".";
    }

    function addDevice(d, name) {
      if (!d.address) return;
      if (!d.address.startsWith(prefix)) return;
      if (added[d.address]) return;

      added[d.address] = true;

      devices.push({
        name: name,
        ip: d.address,
        mac: d["mac-address"] || "-",
        type: "network",
        status: "online",
        router: host
      });
    }

    arp.forEach(d => addDevice(d, d["host-name"] || "Unknown"));
    dhcp.forEach(d => addDevice(d, d["host-name"] || d.comment || "DHCP"));
    hotspot.forEach(d => addDevice(d, d.user || "Hotspot"));

    // 🔥 حفظ في Supabase
    if (devices.length > 0) {
      const { error } = await supabase
        .from("devices")
        .upsert(devices, { onConflict: "ip" });

      if (error) {
        console.log("Supabase error:", error.message);
      }
    }

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
