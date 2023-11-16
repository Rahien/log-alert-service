import fs from "fs";
import { uuid, sparqlEscapeString, sparqlEscapeDateTime } from "mu";
import { updateSudo } from "@lblod/mu-auth-sudo";

const configString = fs.readFileSync("/config/config.json", "utf8");
const config = JSON.parse(configString);

const matchesRule = (rule, logMessage) => {
  if (!rule.match?.contains) {
    return false;
  }
  return logMessage.message.indexOf(rule.match.contains) >= 0;
};

const executeEndpointRule = async (rule, logMessage) => {
  console.log(`>> endpoint rule: ${rule.name}`);
  let options = JSON.stringify(rule.fetchOptions);
  const cleanedMessage = logMessage.message
    .split('"')
    .join('\\"')
    .split("\n")
    .join("\\n");
  options = options.replaceAll("$message", cleanedMessage);
  options = options.replaceAll("$date", logMessage.date.toISOString());
  const secretRegex = /\$SECRET_[a-zA-Z0-9_]+/g;
  for (let match of options.matchAll(secretRegex)) {
    const secretName = match[0].substring(8);
    const secretValue = process.env[secretName];
    if (secretValue) {
      options = options.replaceAll(match, secretValue);
    }
  }

  const modifiedOptions = JSON.parse(options);
  if (modifiedOptions.body && typeof modifiedOptions.body !== "string") {
    modifiedOptions.body = JSON.stringify(modifiedOptions.body);
  }

  const response = await fetch(rule.endpoint, modifiedOptions);
  if (response.status >= 400) {
    const body = await response.text();
    console.error(
      `Error while executing endpoint rule ${rule.name}: ${response.status} ${response.statusText} ${body}`
    );
  }
};

const executeGraphRule = async (rule, logMessage) => {
  const prefix = rule.prefix || "http://mu.semte.ch/vocabularies/ext/";
  const type = rule.type || "http://semanticweb.cs.vu.nl/2009/11/sem/Event";
  console.log(`>> graph rule: ${rule.name}`);
  await updateSudo(
    `
    INSERT DATA {
      GRAPH <${rule.graph}> {
        <${prefix}${uuid()}> a <${type}> ;
                            <http://purl.org/dc/terms/description> ${sparqlEscapeString(
                              logMessage.message
                            )} ;
                            <http://semanticweb.cs.vu.nl/2009/11/sem/hasTimeStamp> ${sparqlEscapeDateTime(
                              logMessage.date
                            )} .
      }
    }
  `
  );
};

const executeRule = async (rule, logMessage, matchedAnyRule) => {
  if (!matchesRule(rule, logMessage)) {
    return false;
  }
  if (!matchedAnyRule) {
    console.log(`Matched a rule for message: ${JSON.stringify(logMessage)}`);
  }
  if (rule.endpoint) {
    await executeEndpointRule(rule, logMessage).catch((e) => {
      console.error(e);
    });
  }
  if (rule.graph) {
    await executeGraphRule(rule, logMessage).catch((e) => {
      console.error(e);
    });
  }
  return true;
};

export const executeRules = async (logMessage) => {
  let matchedAnyRule = false;
  config.rules.forEach((rule) => {
    const matchedThisRule = executeRule(rule, logMessage, matchedAnyRule);
    matchedAnyRule = matchedAnyRule || matchedThisRule;
  });
};
