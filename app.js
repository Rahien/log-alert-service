import { app, errorHandler } from "mu";
import SyslogServer from "syslog-server";
import { executeRules } from "./rule-service";

app.get("/health", async function (req, res) {
  res.send({ health: "ok" });
});

app.use(errorHandler);

const server = new SyslogServer();

server.on("start", () => {
  console.log("Syslog server has started");
});

server.on("message", (value) => {
  executeRules(value).catch((e) => {
    console.error(
      `Unexpected error: ${e}\nMessage was: ${JSON.stringify(value)}`
    );
  });
});

server.start();
