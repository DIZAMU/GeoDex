---
id: introduce.region
moment: introduce
---
{target.name} ligger i regionen {target.subregion}{?target.neighborsText: og grenser til {target.neighborsText}}.
---
id: introduce.island
moment: introduce
when: target.neighborCount == 0
---
{target.name} har ingen landegrense mot noe land. Du finner det i regionen {target.subregion}.
---
id: introduce.home
moment: introduce
requires: [home]
when: target.distanceFromHomeKm > 300
---
{target.name} ligger {target.distanceFromHome} {target.directionFromHome} for {home.name} og er {target.sizeVsHome}.
---
id: introduce.capital
moment: introduce
---
{target.name} ligger i regionen {target.subregion}. Hovedstaden er {target.capital}.
