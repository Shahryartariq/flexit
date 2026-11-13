export const THEME_KEY = "flexit:theme";

/** Runs in <head> before the page paints, so a saved theme never flashes. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
