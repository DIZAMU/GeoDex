---
id: lapse.location.chosen
moment: lapse
cardTypes: [map_to_name, name_to_map]
requires: [chosen]
---
Dette kunne du før. Du valgte {chosen.name}; {target.name} hører til {target.subregion}{?target.neighborsText: og grenser til {target.neighborsText}}.
---
id: lapse.location
moment: lapse
cardTypes: [map_to_name, name_to_map, flag_to_name, name_to_flag]
---
Dette kunne du før. {target.name} hører til {target.subregion}{?target.knownNeighbor: og ligger ved siden av {target.knownNeighbor}}.
---
id: lapse.capital
moment: lapse
cardTypes: [country_to_capital, capital_to_country]
---
Dette kunne du før. Hovedstaden {target.inName} er {target.capital}.
---
id: lapse.currency
moment: lapse
cardTypes: [country_to_currency]
---
Dette kunne du før. Valutaen {target.inName} er {target.currency}.
---
id: lapse.language
moment: lapse
cardTypes: [country_to_language]
---
Dette kunne du før. Et offisielt språk {target.inName} er {target.language}.
