// Clean all return data from Railway Postgres
import { execSync } from "child_process";
import { readFileSync } from "fs";

const TOKEN = readFileSync("/root/.secrets/railway_returns.txt", "utf8").trim();
const PROJECT_ID = "dbc456b7-fc58-4676-8d98-31001a9eb310";
const SERVICE_ID = "3ab9938a-280c-4df5-bca0-3394ef731f1d"; // Postgres

// Use Railway GraphQL API to get the variable value
const query = {
  query: `query { service(id: "${SERVICE_ID}") { name environments { edges { node { id name variables { edges { node { name value } } } } } } } }`,
};

const resp = JSON.parse(execSync(
  `curl -s -X POST https://backboard.railway.com/graphql/v2 \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '${JSON.stringify(query)}'`,
  { encoding: "utf8" }
));

const vars = resp?.data?.service?.environments?.edges?.[0]?.node?.variables?.edges || [];
const dbVar = vars.find(v => v.node.name === "DATABASE_URL");
if (!dbVar) {
  console.error("DATABASE_URL not found");
  console.log(JSON.stringify(resp, null, 2));
  process.exit(1);
}

const DB_URL = dbVar.node.value;
console.log("DB URL found:", DB_URL.slice(0, 30) + "...");

// Clean
execSync(`psql "${DB_URL}" -c "DELETE FROM \\"FraudSignal\\"; DELETE FROM \\"DecisionLog\\"; DELETE FROM \\"ReturnRequest\\";"`, { stdio: "inherit" });
console.log("Done!")