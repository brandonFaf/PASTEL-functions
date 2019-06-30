const app = require("express")();
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccount.json");
const fetch = require("node-fetch");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

let db = admin.firestore();

app.get("/", function(req, res) {
  res.send("Yuppppppp");
});
app.post("/setWinners", (request, response) => {
  const batch = admin.firestore().batch();
  const pgRef = admin.firestore().collection("pastGames");
  fetch(
    "https://www.thesportsdb.com/api/v1/json/1/eventsseason.php?id=4391&s=2018"
  )
    .then(json => json.json())
    .then(data => {
      const week = 1;
      const weekData = data.events.filter(x => x.intRound == week);
      weekData.map(g => {
        let {
          idEvent: id,
          intHomeScore: homeScore,
          intAwayScore: awayScore,
          strHomeTeam: homeTm,
          strAwayTeam: awayTm
        } = g;
        const doc = pgRef.doc(id);
        homeScore = parseInt(homeScore);
        awayScore = parseInt(awayScore);
        const winner =
          homeScore > awayScore
            ? homeTm
            : homeScore < awayScore
            ? awayTm
            : "TIE";
        console.log(winner);
        batch.update(doc, { homeScore, awayScore, winner });
      });
      return batch.commit();
    })
    .then(() => {
      response.send("done");
    })
    .catch(e => response.send("error " + e));
});
app.get("/calculate", (req, res) => {
  console.log("starting up");
  const pgPromise = db
    .collection("pastGames")
    .where("week", "==", 1)
    .get();
  const picksPromise = admin
    .firestore()
    .collection("picks")
    .where("week", "==", 1)
    .get();
  const usersPromise = db.collection("users").get();
  const batch = admin.firestore().batch();
  Promise.all([pgPromise, picksPromise, usersPromise])
    .then(([pgSS, picksSS, userSS]) => {
      const users = getData(userSS);
      const picks = getData(picksSS);
      const games = getData(pgSS);
      // console.log("users", users);
      users.map(({ ref, id }) => {
        const userPicks = picks.filter(p => p.userId == id);
        const score = userPicks.reduce((acc, p) => {
          const game = games.find(g => g.id == p.gameId);
          // console.log(game.winner, p.team)
          if (game.winner == p.team) {
            acc++;
          }
          return acc;
        }, 0);
        console.log(ref._ref);

        batch.update(ref, { score });
      });
      res.send("done");
    })
    .catch(e => {
      console.log(e);
      res.send("error");
    });
});

const getData = ss => {
  return ss.docs.map(d => ({ ref: d, id: d.id, ...d.data() }));
};

app.listen("5000", () => {
  console.log("listening on 5000");
});
