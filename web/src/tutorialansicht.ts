// Ansicht des Tutorials: zeigt die Schritte im <dialog>, bei jedem Öffnen der Seite. Nur DOM-Knoten (Regel 12).
import { element } from "./ansicht.ts";
import { fortschrittText, istLetzterSchritt, naechsterSchritt } from "./tutorial.ts";

const TEXT_WEITER = "Weiter";
const TEXT_ENDE = "Los geht’s";

/**
 * Richtet das Tutorial ein und zeigt es sofort bei jedem Öffnen der Seite. Während es offen ist, lädt die Karte im
 * Hintergrund weiter; wer es überspringt, bevor sie fertig ist, sieht den Ladeschleier (ansicht.ts).
 */
export function richteTutorialEin(): void {
  const dialog = element("tutorial", HTMLDialogElement);
  const schritte = Array.from(dialog.querySelectorAll<HTMLElement>("[data-schritt]"));
  const punkte = element("tutorial-punkte", HTMLOListElement);
  const fortschritt = element("tutorial-fortschritt", HTMLElement);
  const zurueck = element("tutorial-zurueck", HTMLButtonElement);
  const weiter = element("tutorial-weiter", HTMLButtonElement);
  let aktuell = 0;

  punkte.replaceChildren(...schritte.map(() => document.createElement("li")));

  const zeige = (nummer: number): void => {
    aktuell = nummer;
    schritte.forEach((schritt, position) => {
      schritt.hidden = position !== nummer;
    });
    Array.from(punkte.children).forEach((punkt, position) => {
      if (position === nummer) {
        punkt.setAttribute("aria-current", "step");
      } else {
        punkt.removeAttribute("aria-current");
      }
    });
    fortschritt.textContent = fortschrittText(nummer, schritte.length);
    zurueck.disabled = nummer === 0;
    weiter.textContent = istLetzterSchritt(nummer, schritte.length) ? TEXT_ENDE : TEXT_WEITER;
  };
  const oeffne = (): void => {
    zeige(0);
    dialog.showModal();
  };

  weiter.addEventListener("click", () => {
    if (istLetzterSchritt(aktuell, schritte.length)) {
      dialog.close();
      return;
    }
    zeige(naechsterSchritt(aktuell, schritte.length, "vor"));
  });
  zurueck.addEventListener("click", () => {
    zeige(naechsterSchritt(aktuell, schritte.length, "zurueck"));
  });
  element("tutorial-ueberspringen", HTMLButtonElement).addEventListener("click", () => {
    dialog.close();
  });
  element("tutorial-oeffnen", HTMLButtonElement).addEventListener("click", oeffne);

  oeffne();
}
