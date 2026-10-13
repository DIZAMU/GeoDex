---
id: wrong.location.far
moment: wrong
cardTypes: [map_to_name, name_to_map]
requires: [chosen]
when: chosen.sameSubregion == false
---
You picked {chosen.name}, in {chosen.subregion}. {target.name} is in {target.subregion}{?target.neighborsText:, next to {target.neighborsText}}.
---
id: wrong.location.near
moment: wrong
cardTypes: [map_to_name, name_to_map]
requires: [chosen]
when: chosen.sameSubregion == true and chosen.isNeighbor == false
---
You picked {chosen.name}. {target.name} is {target.distanceFromChosen} {target.directionFromChosen} of it{?target.neighborsText:, bordering {target.neighborsText}}.
---
id: wrong.location.neighbor
moment: wrong
cardTypes: [map_to_name, name_to_map]
requires: [chosen]
when: chosen.isNeighbor == true
---
You picked {chosen.name}, a neighbor. {target.name} lies to its {target.directionFromChosen}.
---
id: wrong.location.home
moment: wrong
cardTypes: [name_to_map]
requires: [chosen, home]
when: target.distanceFromHomeKm > 1500
---
{target.name} is {target.distanceFromHome} {target.directionFromHome} of {home.name}. You picked {chosen.name}, in {chosen.subregion}.
---
id: wrong.location.shown
moment: wrong
cardTypes: [map_to_name, name_to_map]
---
This is {target.name}, in {target.subregion}{?target.neighborsText:, bordering {target.neighborsText}}.
---
id: wrong.capital.country
moment: wrong
cardTypes: [country_to_capital]
requires: [chosen]
---
You picked {chosen.capital}, the capital of {chosen.name}. The capital of {target.name} is {target.capital}.
---
id: wrong.capital.city
moment: wrong
cardTypes: [capital_to_country]
requires: [chosen]
---
{target.capital} is the capital of {target.name}. The capital of {chosen.name}, your pick, is {chosen.capital}.
---
id: wrong.capital.shown
moment: wrong
cardTypes: [country_to_capital, capital_to_country]
---
The capital of {target.name} is {target.capital}.
---
id: wrong.flag.chosen
moment: wrong
cardTypes: [flag_to_name]
requires: [chosen]
---
That flag belongs to {target.name}, not {chosen.name}.
---
id: wrong.flag.picked
moment: wrong
cardTypes: [name_to_flag]
requires: [chosen]
---
You picked the flag of {chosen.name}. The flag of {target.name} is the one shown here.
---
id: wrong.flag.shown
moment: wrong
cardTypes: [flag_to_name, name_to_flag]
---
This is the flag of {target.name}.
---
id: wrong.currency
moment: wrong
cardTypes: [country_to_currency]
---
The currency {target.inName} is {target.currency}.
---
id: wrong.language
moment: wrong
cardTypes: [country_to_language]
---
An official language {target.inName} is {target.language}.
