# Log Alert Service

This service monitors an udp syslog stream for messages that match certain characteristics and performs an action when they do.

## Config

The config for this service is expected to be found in /config/config.json

The format is as follows:

```
{
  "rules": [
    {
      "name": "alerts to rocket-chat",
      "match": {
        "contains": "[plugins.actions.server-log]"
      },
      "endpoint": "http://host",
      "fetchOptions": {
        "method": "POST",
        "body": {
          "foobar": "baz",
          "message": "$message",
          "date": "$date"
        },
        "headers": {
          "x-extra-header": "i'm a header!",
          "x-mega-secret": "$SECRET_SUPER_SECRET_ENV_VAR"
        }
      }
    },
    {
      "name": "alerts to db",
      "match": {
        "contains": "[plugins.actions.server-log]"
      },
      "graph": "http://mu.semte.ch/alerts",
      "rdfType": "http://semanticweb.cs.vu.nl/2009/11/sem/Event",
      "prefix": "http://mu.semte.ch/vocabularies/ext/"
    }
  ]
}
```

The config is a set of rules. Currently the only rules that are supported are _endpoint rules_ and _graph rules_. These rules will be explained in the next sections.

## General rule properties

### name

All rules are expected to have a _name_. This property should clarify what the rule is meant to do.

### match

Rules should also contain a _match_ block. This block specifies the set of log messages that the rule should act on. Currently the only type of match blocks supported is a block that contains a single _contains_ property, meaning that the rule will fire if and only if the log message contains the specified string.

## Endpoint rules

Endpoint rules are rules that contain an _endpoint_ property. When they activate, they make an HTTP request to the endpoint in this property.

### endpoint

The endpoint to send the HTTP request to

### fetchOptions

This service uses _fetch_ to send the HTTP request. _fetchOptions_ is a JSON object in the form of fetch's second parameter. If body is a JSON object, it is stringified before it is sent.

In these options, _$message_ is replaced by the complete log text being matched by the rule (" and \n are escaped). _$date_ is replaced by the timestamp of the log. Both are optional.

It's also possible to insert _environment variables_ into the request (e.g. for secret authentication tokens). These have the form $SECRET_SOME_VAR_HERE where SOME_VAR_HERE is expected to be present in the environment variables.

## Graph rules

Graph rules are rules that contain a _graph_ property. This rule writes a simple set of triples to the triplestore called 'database' in the docker's network.

The insert query being used looks like:

```
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
```

### graph

The URI of the graph to write the triples to.

### rdfType

The rdf type to use for the event being logged. Defaults to http://semanticweb.cs.vu.nl/2009/11/sem/Event

### prefix

The prefix to use in the uri of the event. This prefix is being concatenated with a uuid to form the uri. Defaults to http://mu.semte.ch/vocabularies/ext/
