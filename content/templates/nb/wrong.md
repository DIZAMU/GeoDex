---
id: wrong.location.far
moment: wrong
cardTypes: [map_to_name, name_to_map]
requires: [chosen]
when: chosen.sameSubregion == false
---
Du valgte {chosen.name}, som hører til {chosen.subregion}. {target.name} hører til {target.subregion}{?target.neighborsText: og grenser til {target.neighborsText}}.
---
id: wrong.location.near
moment: wrong
cardTypes: [map_to_name, name_to_map]
requires: [chosen]
when: chosen.sameSubregion == true and chosen.isNeighbor == false
---
Du valgte {chosen.name}. {target.name} ligger {target.distanceFromChosen} {target.directionFromChosen} for {chosen.name}{?target.neighborsText: og grenser til {target.neighborsText}}.
---
id: wrong.location.neighbor
moment: wrong
cardTypes: [map_to_name, name_to_map]
requires: [chosen]
when: chosen.isNeighbor == true
---
Du valgte {chosen.name}, et naboland. {target.name} ligger {target.directionFromChosen} for {chosen.name}.
---
id: wrong.location.home
moment: wrong
cardTypes: [name_to_map]
requires: [chosen, home]
when: target.distanceFromHomeKm > 1500
---
{target.name} ligger {target.distanceFromHome} {target.directionFromHome} for {home.name}. Du valgte {chosen.name}, som hører til {chosen.subregion}.
---
id: wrong.location.shown
moment: wrong
cardTypes: [map_to_name, name_to_map]
---
Dette er {target.name}, som hører til {target.subregion}{?target.neighborsText: og grenser til {target.neighborsText}}.
---
id: wrong.capital.country
moment: wrong
cardTypes: [country_to_capital]
requires: [chosen]
---
Du valgte {chosen.capital}, hovedstaden {chosen.inName}. Hovedstaden {target.inName} er {target.capital}.
---
id: wrong.capital.city
moment: wrong
cardTypes: [capital_to_country]
requires: [chosen]
---
{target.capital} er hovedstaden {target.inName}. Du valgte {chosen.name}, der hovedstaden er {chosen.capital}.
---
id: wrong.capital.shown
moment: wrong
cardTypes: [country_to_capital, capital_to_country]
---
Hovedstaden {target.inName} er {target.capital}.
---
id: wrong.flag.chosen
moment: wrong
cardTypes: [flag_to_name]
requires: [chosen]
---
Det flagget tilhører {target.name}, ikke {chosen.name}.
---
id: wrong.flag.picked
moment: wrong
cardTypes: [name_to_flag]
requires: [chosen]
---
Du valgte flagget til {chosen.name}. Flagget til {target.name} er det som vises her.
---
id: wrong.flag.shown
moment: wrong
cardTypes: [flag_to_name, name_to_flag]
---
Dette er flagget til {target.name}.
---
id: wrong.currency
moment: wrong
cardTypes: [country_to_currency]
---
Valutaen {target.inName} er {target.currency}.
---
id: wrong.language
moment: wrong
cardTypes: [country_to_language]
---
Et offisielt språk {target.inName} er {target.language}.
