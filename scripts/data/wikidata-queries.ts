/**
 * SPARQL queries for country data. Each runs over the curated scope (VALUES ?item).
 * Labels fall back to "mul" (Wikidata's language-neutral label) when "en" is missing.
 * Queries return statements with rank and qualifiers; selection happens in the build step.
 */
export function countryQueries(values: string): Record<string, string> {
  return {
    basics: `SELECT ?item ?iso3 ?iso2 ?num ?en ?nb ?mul ?enOfficial ?nbOfficial WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item wdt:P298 ?iso3 }
  OPTIONAL { ?item wdt:P297 ?iso2 }
  OPTIONAL { ?item wdt:P299 ?num }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?nb FILTER(LANG(?nb) = "nb") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?item wdt:P1448 ?enOfficial FILTER(LANG(?enOfficial) = "en") }
  OPTIONAL { ?item wdt:P1448 ?nbOfficial FILTER(LANG(?nbOfficial) = "nb") }
}`,
    altLabels: `SELECT ?item ?alt WHERE {
  VALUES ?item { ${values} }
  ?item skos:altLabel ?alt FILTER(LANG(?alt) = "en" || LANG(?alt) = "nb")
}`,
    capitals: `SELECT ?item ?cap ?rank ?start ?end ?en ?nb ?mul ?coord WHERE {
  VALUES ?item { ${values} }
  ?item p:P36 ?st . ?st ps:P36 ?cap ; wikibase:rank ?rank .
  OPTIONAL { ?st pq:P580 ?start }
  OPTIONAL { ?st pq:P582 ?end }
  OPTIONAL { ?cap rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?cap rdfs:label ?nb FILTER(LANG(?nb) = "nb") }
  OPTIONAL { ?cap rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?cap wdt:P625 ?coord }
}`,
    area: `SELECT ?item ?amount ?unit ?rank ?time WHERE {
  VALUES ?item { ${values} }
  ?item p:P2046 ?st . ?st wikibase:rank ?rank ; psv:P2046 ?v .
  ?v wikibase:quantityAmount ?amount ; wikibase:quantityUnit ?unit .
  OPTIONAL { ?st pq:P585 ?time }
}`,
    population: `SELECT ?item ?amount ?rank ?time WHERE {
  VALUES ?item { ${values} }
  ?item p:P1082 ?st . ?st ps:P1082 ?amount ; wikibase:rank ?rank .
  OPTIONAL { ?st pq:P585 ?time }
}`,
    currencies: `SELECT ?item ?cur ?code ?rank ?end ?en ?nb WHERE {
  VALUES ?item { ${values} }
  ?item p:P38 ?st . ?st ps:P38 ?cur ; wikibase:rank ?rank .
  OPTIONAL { ?st pq:P582 ?end }
  OPTIONAL { ?cur wdt:P498 ?code }
  OPTIONAL { ?cur rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?cur rdfs:label ?nb FILTER(LANG(?nb) = "nb") }
}`,
    languages: `SELECT ?item ?lang ?rank ?end ?en ?nb WHERE {
  VALUES ?item { ${values} }
  ?item p:P37 ?st . ?st ps:P37 ?lang ; wikibase:rank ?rank .
  OPTIONAL { ?st pq:P582 ?end }
  OPTIONAL { ?lang rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?lang rdfs:label ?nb FILTER(LANG(?nb) = "nb") }
}`,
    borders: `SELECT ?item ?other ?otherIso3 ?end WHERE {
  VALUES ?item { ${values} }
  ?item p:P47 ?st . ?st ps:P47 ?other .
  OPTIONAL { ?st pq:P582 ?end }
  OPTIONAL { ?other wdt:P298 ?otherIso3 }
}`,
    landlocked: `SELECT ?item WHERE {
  VALUES ?item { ${values} }
  ?item wdt:P31 wd:Q123480 .
}`,
  };
}

/** Labels and aliases for a set of entities (capitals, languages, currencies). */
export function labelQuery(values: string): string {
  return `SELECT ?item ?en ?nb ?mul ?alt WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?item rdfs:label ?nb FILTER(LANG(?nb) = "nb") }
  OPTIONAL { ?item skos:altLabel ?alt FILTER(LANG(?alt) = "en" || LANG(?alt) = "nb") }
}`;
}

/**
 * City facts for candidate QIDs. Statements keep rank and qualifiers for the build. Countries
 * come back as QIDs and are mapped to ISO3 through data/countries.json (a join on P298 here
 * times out).
 */
export function cityQueries(values: string): Record<string, string> {
  return {
    labels: labelQuery(values),
    country: `SELECT ?item ?country ?rank ?end WHERE {
  VALUES ?item { ${values} }
  ?item p:P17 ?st . ?st ps:P17 ?country ; wikibase:rank ?rank .
  OPTIONAL { ?st pq:P582 ?end }
}`,
    coord: `SELECT ?item ?coord WHERE {
  VALUES ?item { ${values} }
  ?item wdt:P625 ?coord .
}`,
    population: `SELECT ?item ?pop ?rank ?time WHERE {
  VALUES ?item { ${values} }
  ?item p:P1082 ?st . ?st ps:P1082 ?pop ; wikibase:rank ?rank .
  OPTIONAL { ?st pq:P585 ?time }
}`,
    capitalOf: `SELECT ?item ?of ?start ?end WHERE {
  VALUES ?item { ${values} }
  ?item p:P1376 ?st . ?st ps:P1376 ?of .
  OPTIONAL { ?st pq:P580 ?start }
  OPTIONAL { ?st pq:P582 ?end }
}`,
  };
}

/** Landmark facts for the seed QIDs: names, country statements, coordinates and image. */
export function landmarkQueries(values: string): Record<string, string> {
  return {
    labels: labelQuery(values),
    country: `SELECT ?item ?country ?rank ?end WHERE {
  VALUES ?item { ${values} }
  ?item p:P17 ?st . ?st ps:P17 ?country ; wikibase:rank ?rank .
  OPTIONAL { ?st pq:P582 ?end }
}`,
    coord: `SELECT ?item ?coord WHERE {
  VALUES ?item { ${values} }
  ?item wdt:P625 ?coord .
}`,
    image: `SELECT ?item ?image WHERE {
  VALUES ?item { ${values} }
  ?item wdt:P18 ?image .
}`,
  };
}
