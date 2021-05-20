import createParser, { ParsedUnit } from './Parser'
import { normalize } from './utils'
import * as builtIns from './BuiltIns'
import { isUnitPropsWithQuantity, Options, UnitDefinitions, UnitDefinitionsButCooler, UnitProps, UnitPropsButCooler, UnitSystems } from "./Unit";


/**
 * Creates a new unit store.
 */
export default function createUnitStore<T>(options: Options<T>) {
  /* Units are defined by these objects:
   * defs.prefixes
   * defs.units
   */

  // TODO: Should we deep freeze the built-ins to prevent modification of the built-in units?

  const { skipBuiltIns } = options.definitions

  // Merge the built-in units with the user's definitions

  let systems: UnitSystems

  if (skipBuiltIns) {
    systems = { ...options.definitions.systems }
  } else {
    systems = { ...builtIns.systems } as any

    // Prepend the user's units onto the built-in ones, so that the user's will be chosen first
    for (let system of Object.keys(options.definitions.systems)) {
      if (systems.hasOwnProperty(system)) {
        systems[system] = [...options.definitions.systems[system], ...systems[system]]
      } else {
        systems[system] = [...options.definitions.systems[system]]
      }
    }
  }

  const originalDefinitions: UnitDefinitions<T> = {
    systems,
    prefixes: {
      ...(skipBuiltIns ? {} : builtIns.prefixes),
      ...options.definitions.prefixes
    },
    units: {
      ...(skipBuiltIns ? {} : builtIns.units),
      ...options.definitions.units
    }
  }

  // These will contain copies we can mutate without affecting the originals
  const defs: UnitDefinitionsButCooler<T> = {
    units: {},
    prefixes: { ...originalDefinitions.prefixes },
    systems: {}
  }
  for (let system of Object.keys(originalDefinitions.systems)) {
    defs.systems[system] = originalDefinitions.systems[system].slice()
  }

  /* All of the prefixes, units, and systems have now been defined.
   *
   * We will perform the following processing steps to prepare the UnitStore for use:
   *
   * - For each QUANTITY, parse its value and replace it with a dimension array, where each index of the array
   *   corresponds to the base quantity's index in defs.baseQuantities, and the value of each element is the power
   *   (exponent) of that base in the dimension.
   *
   * - Initialize the parser with an empty set of units.
   *
   * - Loop through the units. If the unit has a `quantity` property, initialize that unit with the quantity's
   *   dimension, and the given value property. If the unit does not, then parse the unit's value property (which is
   *   either a string or an two-element array) using the parser, and create the dimension and value from the resulting
   *   Unit. Create the unit with the name, dimension, value, offset, prefixes, and commonPrefixes properties. Convert
   *   the prefixes from a string to the associated object from the defs.prefixes object.
   *
   * - Some units will fail to be parsed if the defs.units object keys are not enumerated in the optimal order. Repeat
   *   the loop until all units have been converted.
   *
   * - Verify that each unit's commonPrefixes are contained in prefixes.
   *
   * - Loop through the defs.systems and convert the strings into valueless units.
   *
   * - Add the unit system names to each unit (as an array) for reverse lookup.
   *
   * - Clone units that have aliases. Shallow copies are acceptable since the resulting defs.units object will be
   *   deep-immutable.
   *
*/

  // Create a parser configured for these options, and also supply it with the findUnit function
  const parser = createParser(options, findUnit)

  // Loop through the units. If the unit has a `quantity` property, initialize that unit with the quantity's dimension,
  // and the given value property. If the unit does not, then parse the unit's value property (which is either a string
  // or a two-element array) using the parser, and create the dimension and value from the resulting Unit. Create the
  // unit with the name, dimension, value, offset, prefixes, and commonPrefixes properties. Convert the prefixes from a
  // string to the associated object from the defs.prefixes object.

  while (true) {
    let unitsAdded = 0
    let unitsSkipped = []
    let reasonsSkipped = []

    for (const unitDefKey of Object.keys(originalDefinitions.units)) {
      if (defs.units.hasOwnProperty(unitDefKey)) continue

      const unitDef = originalDefinitions.units[unitDefKey]
      if (!unitDef) continue

      const unitDefObj = typeof unitDef === 'string' ? null : unitDef

      // uses unknown set of prefixes?
      if (unitDefObj && unitDefObj.prefixes && !defs.prefixes.hasOwnProperty(unitDefObj.prefixes)) {
        throw new Error(`Unknown prefixes '${unitDefObj.prefixes}' for unit '${unitDefKey}'`)
      }

      let unitValue: T|number
      let unitDimension: { [s: string]: number }
      let unitQuantity: UnitProps<T>['quantity']

      let skipThisUnit = false
      if (isUnitPropsWithQuantity(unitDefObj)) {
        // Defining the unit based on a quantity.
        unitValue = unitDefObj.value
        unitDimension = { [unitDefObj.quantity]: 1 }
        unitQuantity = unitDefObj.quantity
      } else {
        // Defining the unit based on other units.
        let parsed: ParsedUnit<T|number>
        try {
          if (unitDef.hasOwnProperty('value')) {
            if (unitDefObj && typeof unitDefObj.value === 'string') {
              parsed = parser(unitDefObj.value)
            } else if (Array.isArray(unitDefObj.value) && unitDefObj.value.length === 2) {
              parsed = parser(unitDefObj.value[1])
              parsed.value = options.type.conv(unitDefObj.value[0])
            } else {
              throw new TypeError(`Unit definition for '${unitDefKey}' must be a string, or it must be an object with a value property where the value is a string or a two-element array.`)
            }
          } else if (typeof unitDef === 'string') {
            parsed = parser(unitDef)
          } else {
            throw new TypeError(`Unit definition for '${unitDefKey}' must be a string, or it must be an object with a value property where the value is a string or a two-element array.`)
          }
          unitValue = normalize(parsed.units, parsed.value, options.type)
          unitDimension = Object.freeze(parsed.dimension)
        } catch (ex) {
          if (/Unit.*not found/.test(ex.toString())) {
            unitsSkipped.push(unitDefKey)
            reasonsSkipped.push(ex.toString())
            skipThisUnit = true
          } else {
            throw ex
          }
        }
      }

      if (!skipThisUnit) {
        // Add this units and its aliases (they are all the same except for the name)
        let unitAndAliases = [unitDefKey].concat(unitDefObj?.aliases ?? [])
        unitAndAliases.forEach(newUnitName => {
          if (defs.units.hasOwnProperty(newUnitName)) {
            throw new Error(`Alias '${newUnitName}' would override an existing unit`)
          }
          if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(newUnitName) && newUnitName !== '') {
            throw new SyntaxError(`Unit name contains non-alphanumeric characters or begins with a number: '${newUnitName}'`)
          }
          const newUnit: UnitPropsButCooler<any> = {
            name: newUnitName,
            value: unitValue,
            offset: unitDefObj?.offset ?? 0,
            dimension: unitDimension,
            prefixes: defs.prefixes[unitDefObj?.prefixes] ?? { '': 1 },
            commonPrefixes: unitDefObj?.commonPrefixes // Default should be undefined
            // systems: []
          }
          if (unitQuantity) newUnit.quantity = unitQuantity
          if (unitDefObj?.basePrefix) newUnit.basePrefix = unitDefObj.basePrefix
          Object.freeze(newUnit)
          defs.units[newUnitName] = newUnit
          unitsAdded++
        })
      }
    }

    // console.log(`Added ${unitsAdded} units and skipped: ${unitsSkipped.join(', ')}`)
    if (unitsSkipped.length === 0) break
    else if (unitsAdded === 0) {
      throw new Error(`Could not create the following units: ${unitsSkipped.join(', ')}. Reasons follow: ${reasonsSkipped.join(' ')}`)
    }
  }

  // Check to make sure config options has selected a unit system that exists.
  if (options.system !== 'auto') {
    if (!defs.systems.hasOwnProperty(options.system)) {
      throw new Error(`Unknown unit system ${options.system}. Available systems are: auto, ${Object.keys(defs.systems).join(', ')} `)
    }
  }

  // Replace unit system strings with valueless units
  for (let system of Object.keys(defs.systems)) {
    let sys = defs.systems[system]
    for (let i = 0; i < sys.length; i++) {
      // Important! The unit below is not a real unit, but for now it is-close enough
      let unit: any = parser(sys[i])
      if (unit) {
        unit.type = 'Unit'
        Object.freeze(unit)
        sys[i] = unit
      } else {
        throw new Error(`Unparsable unit '${sys[i]}' in unit system '${system}'`)
      }
    }
  }

  // Final setup for units
  for (let key of Object.keys(defs.units)) {
    const unit = defs.units[key]
    // Check that each commonPrefix is in prefixes
    if (unit.commonPrefixes) {
      for (let i = 0; i < unit.commonPrefixes.length; i++) {
        let s = unit.commonPrefixes[i]
        if (!unit.prefixes.hasOwnProperty(s)) {
          throw new Error(`In unit ${unit.name}, common prefix ${s} was not found among the allowable prefixes`)
        }
      }
    }
  }

  /**
   * Tests whether the given string exists as a known unit. The unit may have a prefix.
   * @param {string} singleUnitString The name of the unit, with optional prefix.
   */
  function exists (singleUnitString: string) {
    return findUnit(singleUnitString) !== null
  }

  /**
   * Find a unit from a string
   * @param {string} unitString              A string like 'cm' or 'inch'
   * @returns {Object | null} result  When found, an object with fields unit and
   *                                  prefix is returned. Else, null is returned.
   * @private
   */
  function findUnit (unitString: string): { unit: UnitPropsButCooler<T>, prefix: string } | null {
    if (typeof unitString !== 'string') {
      throw new TypeError(`parameter must be a string (${unitString} given)`)
    }
    // First, match units names exactly. For example, a user could define 'mm' as 10^-4 m, which is silly, but then we would want 'mm' to match the user-defined unit.
    if (defs.units.hasOwnProperty(unitString)) {
      const unit = defs.units[unitString]
      return {
        unit,
        prefix: ''
      }
    }

    for (const name of Object.keys(defs.units)) {
      if (unitString.substring(unitString.length - name.length, unitString.length) === name) {
        const unit = defs.units[name]
        const prefixLen = (unitString.length - name.length)
        const prefix = unitString.substring(0, prefixLen)
        if (unit.prefixes.hasOwnProperty(prefix)) {
          // store unit, prefix, and value
          // console.log(`findUnit(${unitString}): { unit.name: ${unit.name}, prefix: ${prefix} }`)
          return {
            unit,
            prefix
          }
        }
      }
    }

    return null
  }

  Object.freeze(defs.prefixes)
  Object.freeze(defs.systems)
  Object.freeze(defs.units)

  return { originalDefinitions, defs, exists, findUnit, parser }
}
