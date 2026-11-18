/**
 * A country's names for Names & Faces. Add a country = add one file like
 * `ro.ts` and list it in `index.ts`. Names are UTF-8 with correct diacritics.
 */
export interface NameSet {
  /** lowercase ISO code, e.g. 'ro' */
  id: string
  /** English name of the country, shown in the settings */
  name: string
  female: readonly string[]
  male: readonly string[]
  last: readonly string[]
}
