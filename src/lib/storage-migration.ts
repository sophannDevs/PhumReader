/**
 * One-time move of saved data to the V2.1 prefix `phumireader.` (design/spec.md §0 "Brand").
 * Keys saved under the old prefixes `phumreader.` (V1) and `toonwave.` (the prototype) are copied to the new
 * prefix when the new key does not exist yet, then removed, so it runs only once per browser.
 *
 * It runs as plain JS in <head> before the first paint (prepended to THEME_INIT_SCRIPT), before the theme is
 * read and before the store hydrates. Kept as a string so the server layout can inline it.
 */
export const STORAGE_PREFIX = "phumireader."
const OLD_PREFIXES = ["phumreader.", "toonwave."] as const

export const STORAGE_MIGRATION_SCRIPT = `try{var s=localStorage,o=${JSON.stringify(OLD_PREFIXES)},m=[];for(var i=0;i<s.length;i++){var k=s.key(i);for(var j=0;j<o.length;j++){if(k&&k.indexOf(o[j])===0)m.push([j,k])}}m.sort(function(a,b){return a[0]-b[0]});for(var n=0;n<m.length;n++){var k2=m[n][1],nk="${STORAGE_PREFIX}"+k2.slice(o[m[n][0]].length);if(s.getItem(nk)===null)s.setItem(nk,s.getItem(k2));s.removeItem(k2)}}catch(e){}`
