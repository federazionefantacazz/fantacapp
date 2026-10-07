import { renderAnteprimaClassificaStandard } from "./AnteprimaClassificaStandard.js";
import { renderAnteprimaClassificaTabellone } from "./AnteprimaClassificaTabellone.js";

/** Sceglie l'anteprima giusta in base al tipo di competizione. */
export function renderAnteprimaClassifica(comp, teamsList, myTeamId) {
  if (comp && comp.type === 'diretta') {
    return renderAnteprimaClassificaTabellone(comp, teamsList, myTeamId);
  }
  return renderAnteprimaClassificaStandard(comp, teamsList, myTeamId);
}
