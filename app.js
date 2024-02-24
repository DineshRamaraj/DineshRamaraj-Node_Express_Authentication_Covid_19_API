const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const app = express();
app.use(express.json());

dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let database = null;

initializationDbAndServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializationDbAndServer();

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

// middleware Function

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// User Login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `
        SELECT
            *
        FROM
            user
        WHERE
            username = '${username}';`;

  const dbUser = await database.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    console.log(isPasswordMatch);

    if (isPasswordMatch === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// GET States API

app.get("/states/", authenticationToken, async (request, response) => {
  const selectStatesQuery = `
        SELECT
            *
        FROM 
            state`;

  const dbResponse = await database.all(selectStatesQuery);
  response.send(
    dbResponse.map((eachObj) => convertStateDbObjectToResponseObject(eachObj))
  );
});

// GET State API
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  //   console.log(stateId);
  const selectStateQuery = `
        SELECT
            *
        FROM
            state
        WHERE
            state_id = ${stateId};`;

  const dbState = await database.get(selectStateQuery);
  response.send(convertStateDbObjectToResponseObject(dbState));
});

// POST Districts API

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictsItem = `
        INSERT INTO
            district (district_name, state_id, cases, cured, active, deaths)
        VALUES
        ('${districtName}', ${stateId}, ${cases},${cured}, ${active}, ${deaths});`;

  await database.run(addDistrictsItem);
  response.send("District Successfully Added");
});

// GET District API

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const selectDistrictsQuery = `
        SELECT
            *
        FROM
            district
        WHERE
            district_id=${districtId};`;
    const dbResponse = await database.get(selectDistrictsQuery);
    response.send(convertDistrictDbObjectToResponseObject(dbResponse));
  }
);

// DELECT District API

app.delete(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const deleteDistrictQuery = `
        DELETE FROM
            district
        WHERE
            district_id =${districtId};
            `;

    await database.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// PUT District API

app.put(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
        UPDATE
            district
        SET
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE
            district_id = ${districtId};`;

    await database.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// GET states API

app.get(
  "/states/:stateId/stats",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;

    const selectStateQuery = `
        SELECT
            SUM(cases),
            SUM(cured),
            SUM(active),
            SUM(deaths)
        FROM
            district
        WHERE
            state_id = ${stateId};`;

    const stats = await database.get(selectStateQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
