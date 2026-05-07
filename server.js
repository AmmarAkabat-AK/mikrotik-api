const express = require("express");
const cors = require("cors");
const RouterOSAPI = require("node-routeros").RouterOSAPI;

const app = express();

app.use(cors());

app.use(express.json());

/* =========================================
   TEST
========================================= */

app.get("/", (req,res)=>{

  res.send("MikroTik API Running ✅");
});

/* =========================================
   CONNECT ROUTER
========================================= */

app.post("/connect", async (req,res)=>{

  const {
    host,
    user,
    pass,
    port
  } = req.body;

  if(!host || !user || !pass){

    return res.json({

      connected:false,

      message:"بيانات ناقصة"
    });
  }

  const conn =
    new RouterOSAPI({

      host,
      user,
      password: pass,
      port: port || 8728,
      timeout: 5000
    });

  try{

    await conn.connect();

    const identity =
      await conn.write(
        "/system/identity/print"
      );

    await conn.close();

    res.json({

      connected:true,

      identity:
        identity[0]?.name || "MikroTik"
    });

  }catch(err){

    res.json({

      connected:false,

      message: err.message
    });
  }
});

/* =========================================
   SCAN DEVICES
========================================= */

app.post("/scan", async (req,res)=>{

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
        port: port || 8728,
        timeout: 7000
      });

    await conn.connect();

    const arp =
      await conn.write(
        "/ip/arp/print"
      );

    const dhcp =
      await conn.write(
        "/ip/dhcp-server/lease/print"
      );

    const hotspot =
      await conn.write(
        "/ip/hotspot/active/print"
      );

    await conn.close();

    const devices = [];

    const added = {};

    arp.forEach(d => {

      if(!d.address) return;

      if(added[d.address]) return;

      added[d.address] = true;

      devices.push({

        name:
          d["host-name"] || "Unknown",

        ip:
          d.address,

        mac:
          d["mac-address"] || "-",

        source:"ARP"
      });
    });

    dhcp.forEach(d => {

      if(!d.address) return;

      if(added[d.address]) return;

      added[d.address] = true;

      devices.push({

        name:
          d["host-name"] ||
          d.comment ||
          "DHCP Client",

        ip:
          d.address,

        mac:
          d["mac-address"] || "-",

        source:"DHCP"
      });
    });

    hotspot.forEach(d => {

      if(!d.address) return;

      if(added[d.address]) return;

      added[d.address] = true;

      devices.push({

        name:
          d.user || "Hotspot User",

        ip:
          d.address,

        mac:
          d["mac-address"] || "-",

        source:"Hotspot"
      });
    });

    res.json({

      success:true,

      count: devices.length,

      devices
    });

  }catch(e){

    res.json({

      success:false,

      message:e.message
    });
  }
});

/* =========================================
   USERMANAGER PROFILES
========================================= */

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

    /* قراءة الباقات */

    const profiles =
      await conn.write(
        "/tool/user-manager/profile/print"
      );

    await conn.close();

    console.log("USERMANAGER PROFILES:", profiles);

    res.json({

      success: true,

      profiles: profiles.map(p =>

        p.name ||
        p["actual-profile"] ||
        p.profile ||
        "Profile"

      )
    });

  }catch(e){

    console.error("PROFILE ERROR:", e);

    res.json({

      success:false,
      profiles:[]
    });
  }
});

/* =========================================
   USERMANAGER USERS
========================================= */

app.post("/usermanager/users", async (req,res)=>{

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
        port: port || 8728,
        timeout:7000
      });

    await conn.connect();

    const users =
      await conn.write(
        "/tool/user-manager/user/print"
      );

    await conn.close();

    res.json({

      success:true,

      users: users.map(u => ({

        username:
          u.username || "",

        password:
          u.password || "",

        profile:
          u.actual_profile || "",

        uptime:
          u.uptime || "0",

        disabled:
          u.disabled || "false"
      }))
    });

  }catch(e){

    console.error(e);

    res.json({

      success:false,

      users:[],

      message:e.message
    });
  }
});

/* =========================================
   SERVER
========================================= */

app.listen(3000, ()=>{

  console.log(
    "Server running on port 3000"
  );
});
