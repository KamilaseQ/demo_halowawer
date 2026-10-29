import { createStore } from "./store";

/** Items of the hero nav; chapters of the film and the sections below light them up. */
export type NavKey = "home" | "about" | "properties" | "location" | "contact";

/**
 * Who owns the highlight: the scroll film while its track is on screen
 * (chapters), the section observer once it has scrolled past.
 */
export const activeNav = createStore<NavKey>("home");
