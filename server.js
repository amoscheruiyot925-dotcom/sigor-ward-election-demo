const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // serve frontend files

// ===== DATABASE SETUP =====
const db = new sqlite3.Database("./votes.db", err=>{
    if(err) console.error(err);
    else console.log("SQLite DB ready ✅");
});

// Create tables
db.serialize(()=>{
    db.run(`CREATE TABLE IF NOT EXISTS stations(
        name TEXT PRIMARY KEY,
        password TEXT,
        max_voters INTEGER,
        submitted INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS votes(
        station TEXT,
        candidate TEXT,
        count INTEGER DEFAULT 0,
        PRIMARY KEY(station,candidate),
        FOREIGN KEY(station) REFERENCES stations(name)
    )`);
});

// ===== INITIAL DATA =====
const stationsData = {
  'Cheptuonik':395,'Lelechonik':301,'Tumoi':614,'Kamorit':331,
  'Sugurmerga1':373,'Sugurmerga2':372,'Sigor Nursery School':572,
  'St Peter Koiyet Pry Sch':520,'Mismis':494,'Terta Nursery':252,
  'Chebaraa':665,'Nyakichiwa':659,'Cheptolelyoi':372,'Tarakwet':217,
  'Marangetit':426,'Areiyet':643,'Kipkeigei1':461,'Kipkeigei2':460,
  'Lelaitich1':438,'Lelaitich2':438,'Kapsabul1':419,'Kapsabul2':419,
  'Kisiet':347,'Mwokyot':429,'Ngwonet':387,'Chepkosa':513,
  'Chemengwa':660,'Koitabkalyet':542,'Lugumek1':367,'Lugumek2':367,
  'Kabolwo1':387,'Kabolwo2':386,'Kosia':431,'Sigor Nursery':596
};

const stationPasswords = {
  "Cheptuonik":"a1v","Lelechonik":"b2u","Tumoi":"c3t","Kamorit":"d4s",
  "Sugurmerga1":"e5r","Sugurmerga2":"f6q","Sigor Nursery School":"g7p",
  "St Peter Koiyet Pry Sch":"h8o","Mismis":"i9n","Terta Nursery":"j10m",
  "Chebaraa":"k11l","Nyakichiwa":"l12k","Cheptolelyoi":"m13j","Tarakwet":"n14i",
  "Marangetit":"o15h","Areiyet":"p16g","Kipkeigei1":"q17f","Kipkeigei2":"r18e",
  "Lelaitich1":"s19d","Lelaitich2":"j20c","Kapsabul1":"u21b","Kapsabul2":"v22a",
  "Kisiet":"a1v","Mwokyot":"b2u","Ngwonet":"c3t","Chepkosa":"d4s",
  "Chemengwa":"e5r","Koitabkalyet":"f6q","Lugumek1":"g7p","Lugumek2":"h8o",
  "Kabolwo1":"i9n","Kabolwo2":"j10m","Kosia":"k11l","Sigor Nursery":"l12k"
};

db.serialize(()=>{
    for(let [name,max] of Object.entries(stationsData)){
        db.run(`INSERT OR IGNORE INTO stations(name,password,max_voters) VALUES(?,?,?)`,
        [name,stationPasswords[name],max]);

        for(let c of ["A","B","C","D","S"]){
            db.run(`INSERT OR IGNORE INTO votes(station,candidate,count) VALUES(?,?,0)`,
            [name,c]);
        }
    }
});

// ===== API ROUTES =====

// Login station
app.post("/api/login",(req,res)=>{
    const {name,password} = req.body;
    db.get(`SELECT password,submitted FROM stations WHERE name=?`,[name],(err,row)=>{
        if(err) return res.status(500).json({error:"DB error"});
        if(!row) return res.status(400).json({error:"Station not found"});
        if(row.submitted) return res.status(400).json({error:"Station already submitted"});
        if(row.password !== password) return res.status(400).json({error:"Wrong password"});
        res.json({ok:true});
    });
});

// Confirm candidate vote (partial submit)
app.post("/api/confirm",(req,res)=>{
    const {station,candidate,count} = req.body;
    db.run(`UPDATE votes SET count=? WHERE station=? AND candidate=?`,
        [count,station,candidate],
        function(err){
            if(err) return res.status(500).json({error:"DB error"});
            res.json({ok:true});
        }
    );
});

// Final submit station
app.post("/api/submit",(req,res)=>{
    const {station} = req.body;
    // Check sum <= max_voters
    db.all(`SELECT SUM(count) as sum FROM votes WHERE station=?`,[station],(err,rows)=>{
        if(err) return res.status(500).json({error:"DB error"});
        const sum = rows[0].sum || 0;
        db.get(`SELECT max_voters FROM stations WHERE name=?`,[station],(err,row)=>{
            if(err) return res.status(500).json({error:"DB error"});
            if(sum > row.max_voters) return res.status(400).json({error:"Votes exceed max voters"});
            db.run(`UPDATE stations SET submitted=1 WHERE name=?`,[station]);
            res.json({ok:true});
        });
    });
});

// Get totals
app.get("/api/totals",(req,res)=>{
    db.all(`SELECT candidate,SUM(count) as total FROM votes GROUP BY candidate`,[],(err,rows)=>{
        if(err) return res.status(500).json({error:"DB error"});
        const totals = {};
        rows.forEach(r=>totals[r.candidate]=r.total);
        res.json(totals);
    });
});

// ===== START SERVER =====
app.listen(PORT,()=>console.log(`Sigor Ward Election Backend Running ✅`));
