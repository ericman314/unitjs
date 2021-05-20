import unit from '../es/UnitMath.js'
import Decimal from 'decimal.js'
import approx from './approx'

function configCustomUnits (units) {
  return unit.config({
    definitions: {
      units
    }
  })
}

let unitDec
let typeNoPow, typeNoGt, typeNoComp, typeFunnyFormat, typeNoRound

beforeAll(() => {
  Decimal.set({ precision: 32 })

  // Use strict type checking to make sure no numbers sneak in
  const isDec = a => expect(a).toBeInstanceOf(Decimal)

  let typeComplete = {
    conv: a => new Decimal(a),
    clone: a => { isDec(a); return new Decimal(a) },
    add: (a, b) => {
      isDec(a)
      isDec(b)
      return Decimal.add(a, b)
    },
    sub: (a, b) => {
      isDec(a)
      isDec(b)
      return Decimal.sub(a, b)
    },
    mul: (a, b) => {
      isDec(a)
      isDec(b)
      return Decimal.mul(a, b)
    },
    div: (a, b) => {
      isDec(a)
      isDec(b)
      return Decimal.div(a, b)
    },
    pow: (a, b) => {
      isDec(a)
      isDec(b)
      return Decimal.pow(a, b)
    },
    eq: (a, b) => {
      isDec(a)
      isDec(b)
      return a.equals(b)
    },
    lt: (a, b) => a.lt(b),
    le: (a, b) => a.lte(b),
    gt: (a, b) => a.gt(b),
    ge: (a, b) => a.gte(b),
    abs: (a) => a.abs(),
    round: (a) => a.round(),
    trunc: (a) => Decimal.trunc(a)
  }

  typeNoPow = Object.assign({}, typeComplete)
  delete typeNoPow.pow

  typeNoGt = Object.assign({}, typeComplete)
  delete typeNoGt.gt

  typeNoRound = Object.assign({}, typeComplete)
  delete typeNoRound.round

  typeNoComp = Object.assign({}, typeComplete)
  delete typeNoComp.eq
  delete typeNoComp.lt
  delete typeNoComp.le
  delete typeNoComp.gt
  delete typeNoComp.ge

  typeFunnyFormat = { format: (a, b, c) => b + a.toString().split('').reverse().join(c) }
  unitDec = unit.config({ type: typeComplete })

  // These will be tested below
  // unitDecNoPow = unit.config({ type: typeNoPow })
  // unitDecNoGt = unit.config({ type: typeNoGt })
  // unitDecNoEq = unit.config({ type: typeNoEq })
})

describe('unitmath', () => {
  describe('unitmath namespace', () => {
    test('should be a function', () => {
      expect(typeof unit).toEqual('function')
    })

    test('should return a unit', () => {
      expect(unit(1, 'm').type).toEqual('Unit')
    })

    test('should have a config method', () => {
      expect(typeof unit.config).toEqual('function')
    })

    test('should be frozen', () => {
      expect(() => { unit.config = 42 }).toThrow()
      expect(() => { unit.foo = 42 }).toThrow()
    })

    test('should have the correct default format config options', () => {
      let optionsToCheckEquality = {
        parentheses: false,
        precision: 15,
        prefix: 'auto',
        prefixMin: 0.1,
        prefixMax: 1000,
        prefixesToChooseFrom: 'common',
        simplify: 'auto',
        simplifyThreshold: 2,
        system: 'auto',
        subsystem: 'auto',
        definitions: {
          skipBuiltIns: false,
          units: {},
          prefixes: {},
          systems: {}
        }
      }
      let actualOptions = unit.config()
      for (let key in optionsToCheckEquality) {
        expect(optionsToCheckEquality[key]).toEqual(actualOptions[key])
      }
    })
  })

  describe('config', () => {
    test('should return current config when called with no arguments', () => {
      expect(typeof unit.config()).toEqual('object')
    })

    test('should clone the options argument', () => {
      let options = { prefix: 'always' }
      let newUnit = unit.config(options)
      expect(options).not.toBe(newUnit.config())
    })

    test('should freeze the options', () => {
      let newUnit = unit.config({})
      let options = newUnit.config()
      expect(() => { options.prefix = 'always' }).toThrow()
    })

    test('should set new config options', () => {
      let newUnit = unit.config({ prefix: 'always' })
      expect(unit.config().prefix).toEqual('auto')
      expect(newUnit.config().prefix).toEqual('always')
      expect(newUnit.config().simplify).toEqual('auto')
    })

    test('should throw on invalid options', () => {
      expect(() => unit.config({ prefix: 'invalidOption' })).toThrow(/Invalid option for prefix: 'invalidOption'/)
      expect(() => unit.config({ simplify: 'bad' })).toThrow(/Invalid option for simplify: 'bad'/)
    })

    describe('custom definitions', () => {
      test('should create new units', () => {
        let newUnit = configCustomUnits({
          furlongsPerFortnight: { value: '1 furlong/fortnight' },
          furlong: '220 yards',
          fortnight: { value: [2, 'weeks'] }
        })

        expect(newUnit('1 furlongsPerFortnight').to('yards/week').toString()).toEqual('110 yards / week')
      })

      test('should use custom units when simplifying', () => {
        let newUnit = configCustomUnits({
          mph: { value: '1 mi/hr' }
        })
        expect(newUnit('5 mi').div('2 hr').toString()).toEqual('2.5 mph')
      })

      test('should use custom units derived from other custom units when simplifying', () => {
        const newUnit = configCustomUnits({
          widget: { value: '5 kg bytes' },
          woggle: { value: '4 widget^2' },
          gadget: { value: '5 N/woggle' },
          whimsy: { value: '8 gadget hours' }
        })
        expect(newUnit(1000, 'N h kg^-2 bytes^-2').toString()).toEqual('2500 whimsy')
      })

      test('should apply prefixes and offset to custom units', () => {
        const newUnit = configCustomUnits({
          wiggle: { value: '4 rad^2/s', offset: 1, prefixes: 'LONG', commonPrefixes: ['', 'kilo'] }
        })
        let unit1 = newUnit('8000 rad^2/s')
        expect(unit1.toString()).toEqual('1.999 kilowiggle')
      })

      test('should only allow valid names for units', () => {
        expect(() => configCustomUnits({ 'not_a_valid_unit': '3.14 kg' })).toThrow(/Unit name contains non-alpha/)
        expect(() => configCustomUnits({ '5tartsWithNumber': '42 ft' })).toThrow(/Unit name contains non-alpha/)
        expect(() => configCustomUnits({ 5: '5 day' })).toThrow(/Unit name contains non-alpha/)
      })

      test('should throw on invalid unit value type', () => {
        expect(() => configCustomUnits({ myUnit: 42 })).toThrow(/Unit definition for 'myUnit' must be a string/)

        expect(() => configCustomUnits({ myUnit: { value: 42 } })).toThrow(/Unit definition for 'myUnit' must be a string/)
      })

      test('should override existing units', () => {
        let newUnit = configCustomUnits({
          poundmass: {
            value: '0.5 kg',
            aliases: ['lb', 'lbs', 'lbm', 'poundmasses']
          }
        })
        expect(unit('1 lb').to('kg').toString()).toEqual('0.45359237 kg')
        expect(newUnit('1 lb').to('kg').toString()).toEqual('0.5 kg')
      })

      test('should remove existing units if value is falsey', () => {
        let newUnit = configCustomUnits({ henry: null })
        expect(() => unit('henry')).not.toThrow()
        expect(() => newUnit('henry')).toThrow(/Unit "henry" not found/)
      })

      test('should throw if not all units could be created', () => {
        expect(() => configCustomUnits({
          myUnit: '1 theirUnit',
          theirUnit: '1 myUnit'
        })).toThrow(/Could not create the following units: myUnit, theirUnit. Reasons follow: SyntaxError: Unit "theirUnit" not found. SyntaxError: Unit "myUnit" not found./)

        expect(() => configCustomUnits({
          myUnit: 'q038hfqi3hdq0'
        })).toThrow(/Could not create the following units: myUnit. Reasons follow: SyntaxError: Unit "q038hfqi3hdq0" not found./)

        expect(() => configCustomUnits({
          myUnit: '8 m^'
        })).toThrow(/In "8 m\^", "\^" must be followed by a floating-point number/)
      })

      test('should throw if an alias would override an existing unit', () => {
        expect(() => configCustomUnits({
          myUnit: {
            value: '1 m',
            aliases: ['m']
          }
        })).toThrow(/Alias 'm' would override an existing unit/)
      })

      test('should throw on unknown prefix', () => {
        expect(() => configCustomUnits({
          myUnit: {
            value: '45 s',
            prefixes: 'MADE_UP_PREFIXES'
          }
        })).toThrow(/Unknown prefixes 'MADE_UP_PREFIXES' for unit 'myUnit'/)
      })

      test('should create new prefixes', () => {
        // TODO: Mutating individual units in the definitions can have bad side effects!
        let meter = { ...unit.definitions().units.meter }
        meter.prefixes = 'FUNNY'
        meter.commonPrefixes = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
        let newUnit = unit.config({
          prefixMin: 1,
          prefixMax: 2,
          definitions: {
            units: {
              meter
            },
            prefixes: {
              FUNNY: { '': 1, 'A': 2, 'B': 4, 'C': 8, 'D': 16, 'E': 32, 'F': 64, 'G': 128 }
            }
          }
        })

        expect(newUnit('6 meter').toString()).toEqual('1.5 Bmeter')
        expect(newUnit('10 Cmeter').toString()).toEqual('1.25 Fmeter')
      })

      test('should only allow common prefixes that are included in prefixes', () => {
        let meter = Object.assign({}, unit.definitions().units.meter)
        meter.commonPrefixes = ['', 'invalidPrefix']
        expect(() => configCustomUnits({
          meter
        })).toThrow(/common prefix.*was not found among the allowable prefixes/)
      })

      test('should create new base units', () => {
        let newUnit = unit.config({
          definitions: {
            units: {
              foo: {
                quantity: 'ESSENCE_OF_FOO',
                value: 1,
                prefixes: 'LONG'
              },
              fib: '5 foo/hr',
              flab: '1 foo^3'
            }
          }
        })

        expect(newUnit('1 megafoo/s').simplify().toString()).toEqual('720000000 fib')
        expect(newUnit('1 megafoo/s').to('fib').toString()).toEqual('720000000 fib')
        expect(newUnit('3 foo').pow(3).toString()).toEqual('27 flab')
      })

      test('should prepend, but not replace, individual unit systems', () => {
        let newUnit = unit.config({
          definitions: {
            units: { mph: '1 mi/hr' },
            systems: {
              us: ['mph', 'mi']
            }
          }
        })
        expect(newUnit('70 mi').div('60 min').toString()).toEqual('70 mph')
        expect(newUnit.definitions().systems.us.includes('lbm')).toBeTruthy()
      })

      test('should skip builtins if so desired', () => {
        let newUnit = unit.config({
          prefixMin: 0.200001,
          prefixMax: 4.99999,
          definitions: {
            skipBuiltIns: true,
            units: {
              foo: {
                quantity: 'ESSENCE_OF_FOO',
                value: 1,
                prefixes: 'PREFOO',
                commonPrefixes: ['fff', 'ff', 'f', '', 'F', 'FF', 'FFF']
              },
              fib: { value: '5 foo', prefixes: 'PREFOO', commonPrefixes: ['fff', 'ff', 'f', '', 'F', 'FF', 'FFF'] },
              flab: { value: '1 foo^3', prefixes: 'PREFOO', commonPrefixes: ['fff', 'ff', 'f', '', 'F', 'FF', 'FFF'] }
            },
            systems: {
              fooSys: ['foo', 'flab']
            },
            prefixes: {
              PREFOO: {
                'fff': 0.008,
                'ff': 0.04,
                'f': 0.2,
                '': 1,
                'F': 5,
                'FF': 25,
                'FFF': 125
              }
            }
          }
        })

        expect(newUnit('40 fib').format()).toEqual('1.6 FFfib')
      })

      test('should use base prefix', () => {
        let newUnit = unit.config({
          definitions: {
            units: {
              widget: {
                quantity: 'THINGS_YOU_CAN_MAKE',
                value: 1,
                prefixes: 'LONG',
                basePrefix: 'kilo'
              },
            },
          }
        })
        expect(newUnit('5000 widget').toBaseUnits().toString()).toEqual('5 kilowidget')
      })

    })

    describe('newly returned namespace', () => {
      test('should be a new unitmath namespace', () => {
        let newUnit = unit.config({})
        expect(unit).not.toBe(newUnit)
      })
      test('should create unit instances in a separate prototype chain', () => {
        let newUnit = unit.config({})
        expect(unit(1, 'm').add).not.toBe(newUnit(1, 'm').add)
      })
      test('should have a clone of the config options from the first namespace', () => {
        let newUnit = unit.config({})
        expect(unit.config()).not.toBe(newUnit.config())
      })
    })
  })

  describe('definitions', () => {
    test('should return the original built-in unit definitions', () => {
      let defs = unit.definitions()

      expect(defs.units.inch.value).toEqual('0.0254 meter')
      expect(defs.units.foot.aliases).toEqual(['ft', 'feet'])
      expect(defs.units.kelvin.prefixes).toEqual('LONG')
      expect(defs.prefixes.LONG.giga).toEqual(1e9)
      expect(defs.prefixes.SHORT_LONG.giga).toEqual(1e9)


      // TODO: Add custom unit below so that the units get reprocessed (in case we cache unit definitions in the future)
      let defs2 = unit.config({}).definitions()

      expect(defs2.units.inch.value).toEqual('0.0254 meter')
      expect(defs2.units.foot.aliases).toEqual(['ft', 'feet'])
      expect(defs2.units.kelvin.prefixes).toEqual('LONG')
      expect(defs2.prefixes.LONG.giga).toEqual(1e9)
      expect(defs2.prefixes.SHORT_LONG.giga).toEqual(1e9)

    })
  })

  describe('unit instance', () => {
    test('should have prototype methods add, mul, etc.', () => {
      let u1 = unit(1, 'm')
      let u2 = unit(2, 'kg')
      let fns = ['add', 'mul']
      fns.forEach(fn => {
        expect(typeof u1[fn]).toEqual('function')
      })
      expect(u1.add).toEqual(u2.add)
    })

    test('should be frozen', () => {
      expect(Object.isFrozen(unit(1, 'm'))).toBeTruthy()
    })
  })

  describe('factory function', () => {
    test('should create unit correctly', () => {
      let unit1 = unit()
      expect(unit1.value).toEqual(null)
      expect(unit1.units.length).toEqual(0)

      unit1 = unit(5000, 'cm')
      expect(unit1.value).toEqual(5000)
      expect(unit1.units[0].unit.name).toEqual('m')

      unit1 = unit(5, 'kg')
      expect(unit1.value).toEqual(5)
      expect(unit1.units[0].unit.name).toEqual('g')

      unit1 = unit('kg')
      expect(unit1.value).toEqual(null)
      expect(unit1.units[0].unit.name).toEqual('g')

      unit1 = unit('10 Hz')
      expect(unit1.value).toEqual(10)
      expect(unit1.units[0].unit.name).toEqual('Hz')

      unit1 = unit(9.81, 'kg m/s^2')
      expect(unit1.value).toEqual(9.81)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[1].unit.name).toEqual('m')
      expect(unit1.units[2].unit.name).toEqual('s')

      unit1 = unit('9.81 kg m/s^2')
      expect(unit1.value).toEqual(9.81)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[1].unit.name).toEqual('m')
      expect(unit1.units[2].unit.name).toEqual('s')

      unit1 = unit('9.81', 'kg m/s^2')
      expect(unit1.value).toEqual(9.81)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[1].unit.name).toEqual('m')
      expect(unit1.units[2].unit.name).toEqual('s')
    })

    test('should combine duplicate units', () => {
      expect(unit('3 kg kg')).toEqual(unit('3 kg^2'))
      expect(unit('3 kg/kg')).toEqual(unit('3'))
      expect(unit('3 kg m / s s')).toEqual(unit('3 kg m / s^2'))
      expect(unit('3 m cm')).toEqual(unit('0.03 m^2'))
      expect(unit('3 cm m / s minute')).toEqual(unit('300 cm^2 / s minute'))
    })

    test('should throw an error if called with wrong type of arguments', () => {
      expect(() => { console.log(unit(0, 'bla')) }).toThrow(/Unit.*not found/)
      expect(() => { console.log(unit(0, 3)) }).toThrow(/you must supply a single/)
    })
  })

  describe('exists', () => {
    test('should return true if the string contains unit plus a prefix', () => {
      expect(unit.exists('cm')).toBeTruthy()
      expect(unit.exists('inch')).toBeTruthy()
      expect(unit.exists('kb')).toBeTruthy()
      expect(unit.exists('bla')).toBeFalsy()
      expect(unit.exists('5cm')).toBeFalsy()
    })

    test('should throw on invalid parameter', () => {
      expect(() => unit.exists(42)).toThrow(/parameter must be a string/)
    })
  })

  describe('equalQuantity', () => {
    test('should test whether two units are of the same quantity', () => {
      expect(unit(5, 'cm').equalQuantity(unit(10, 'm'))).toBeTruthy()
      expect(unit(5, 'cm').equalQuantity(unit(10, 'kg'))).toBeFalsy()
      expect(unit(5, 'N').equalQuantity(unit(10, 'kg m / s ^ 2'))).toBeTruthy()
      expect(unit(8.314, 'J / mol K').equalQuantity(unit(0.02366, 'ft^3 psi / mol degF'))).toBeTruthy()
    })
  })

  describe('equals', () => {
    test('should test whether two units are equal', () => {
      expect(unit(100, 'cm').equals(unit(1, 'm'))).toBeTruthy()
      expect(unit(100, 'cm').equals(unit(2, 'm'))).toBeFalsy()
      expect(unit(100, 'cm').equals(unit(1, 'kg'))).toBeFalsy()
      expect(unit(100, 'ft lbf').equals(unit(1200, 'in lbf'))).toBeTruthy()
      expect(unit(100, 'N').equals(unit(100, 'kg m / s ^ 2'))).toBeTruthy()
      expect(unit(100, 'N').equals(unit(100, 'kg m / s'))).toBeFalsy()
      expect(unit(100, 'Hz').equals(unit(100, 's ^ -1'))).toBeTruthy()
    })

    test('should work with valueless units', () => {
      expect(unit('cm').equals(unit('cm'))).toBeTruthy()
      expect(unit('cm').equals(unit('m'))).toBeFalsy()
      expect(unit('cm/s').equals(unit('cm/s'))).toBeTruthy()
    })

    test('should return false if one unit has a value and the other does not', () => {
      expect(unit('cm/s').equals(unit('1 cm/s'))).toBeFalsy()
    })

    test('should convert parameter to a unit', () => {
      expect(unit(100, 'cm').equals('1 m')).toBeTruthy()
      expect(unit('3 kg / kg').equals(3)).toBeTruthy()
    })
  })

  describe('compare', () => {
    test('should compare two units', () => {
      expect(unit('30 min').compare('1 hour')).toEqual(-1)
      expect(unit('60 min').compare('1 hour')).toEqual(0)
      expect(unit('90 min').compare('1 hour')).toEqual(1)
    })

    test('should work with valueless units', () => {
      expect(unit('kg/hr').compare('kg/min')).toEqual(-1)
      expect(unit('kg/hr').compare('kg/hr')).toEqual(0)
      expect(unit('kg/hr').compare('g/hr')).toEqual(1)
    })

    test('should throw if dimensions do not match', () => {
      expect(() => unit(100, 'N').compare(unit(100, 'kg m / s'))).toThrow(/Cannot compare units.*dimensions do not match/)
      expect(() => unit(100, 'cm').compare(unit(1, 'kg'))).toThrow(/Cannot compare units.*dimensions do not match/)
    })

    test('should convert parameter to a unit', () => {
      expect(unit(100, 'cm').compare('2 m')).toEqual(-1)
      expect(unit('3 kg / kg').compare(2)).toEqual(1)
    })

    test('should consistently compare NaNs', () => {
      expect(unit(100, 'cm').compare(unit(NaN, 'cm'))).toEqual(-1)
      expect(unit(NaN, 'cm').compare(unit(100, 'cm'))).toEqual(1)
      expect(unit(NaN, 'cm').compare(unit(NaN, 'cm'))).toEqual(1)
    })

    test('should sort Infinities and NaNs correctly', () => {
      const units = [
        unit(10, 'ft'),
        unit(Infinity, 'm'),
        unit(NaN, 'm'),
        unit(1, 'in'),
        unit(-Infinity, 'm'),
        unit(1, 'ft'),
        unit(Infinity, 'm'),
        unit(NaN, 'm'),
        unit(-Infinity, 'm'),
        unit(10, 'in')
      ]

      units.sort((a, b) => a.compare(b))
      expect(
        units.map(u => u.toString())).toEqual(
        [
          '-Infinity m', '-Infinity m',
          '1 in', '10 in',
          '1 ft', '10 ft',
          'Infinity m', 'Infinity m',
          'NaN m', 'NaN m'
        ]
      )
    })
  })

  describe('lessThan', () => {
    test('should test whether one unit is less than another', () => {
      expect(unit(100, 'cm').lessThan(unit(1, 'm'))).toBeFalsy()
      expect(unit(100, 'cm').lessThan(unit(2, 'm'))).toBeTruthy()
      // expect(unit(100, 'ft lbf').lessThan(unit(1200, 'in lbf'))).toBeFalsy()  // Round-off error
      expect(unit(100, 'N').lessThan(unit(100, 'kg m / s ^ 2'))).toBeFalsy()
      expect(unit(100, 'Hz').lessThan(unit(100, 's ^ -1'))).toBeFalsy()
      expect(unit(101, 'Hz').lessThan(unit(100, 's ^ -1'))).toBeFalsy()
      expect(unit(99, 'Hz').lessThan(unit(100, 's ^ -1'))).toBeTruthy()
    })

    test('should work with valueless units', () => {
      expect(unit('cm').lessThan(unit('cm'))).toBeFalsy()
      expect(unit('cm').lessThan(unit('m'))).toBeTruthy()
      expect(unit('cm/s').lessThan(unit('cm/min'))).toBeFalsy()
    })

    test('should throw if dimensions do not match', () => {
      expect(() => unit(100, 'N').lessThan(unit(100, 'kg m / s'))).toThrow(/Cannot compare units.*dimensions do not match/)
      expect(() => unit(100, 'cm').lessThan(unit(1, 'kg'))).toThrow(/Cannot compare units.*dimensions do not match/)
    })

    test('should throw if one unit has a value and the other does not', () => {
      expect(() => unit('1m').lessThan('km')).toThrow(/Cannot compare units.*one has a value and the other does not/)
    })

    test('should convert parameter to a unit', () => {
      expect(unit(100, 'cm').lessThan('2 m')).toBeTruthy()
      expect(unit('3 kg / kg').lessThan(4)).toBeTruthy()
    })
  })

  describe('lessThanOrEqual', () => {
    test('should test whether one unit is less than another', () => {
      expect(unit(100, 'cm').lessThanOrEqual(unit(1, 'm'))).toBeTruthy()
      expect(unit(100, 'cm').lessThanOrEqual(unit(2, 'm'))).toBeTruthy()
      // expect(unit(100, 'ft lbf').lessThanOrEqual(unit(1200, 'in lbf'))).toBeFalsy()  // Round-off error
      expect(unit(100, 'N').lessThanOrEqual(unit(100, 'kg m / s ^ 2'))).toBeTruthy()
      expect(unit(100, 'Hz').lessThanOrEqual(unit(100, 's ^ -1'))).toBeTruthy()
      expect(unit(101, 'Hz').lessThanOrEqual(unit(100, 's ^ -1'))).toBeFalsy()
      expect(unit(99, 'Hz').lessThanOrEqual(unit(100, 's ^ -1'))).toBeTruthy()
    })

    test('should work with valueless units', () => {
      expect(unit('cm').lessThanOrEqual(unit('cm'))).toBeTruthy()
      expect(unit('cm').lessThanOrEqual(unit('m'))).toBeTruthy()
      expect(unit('cm/s').lessThanOrEqual(unit('cm/min'))).toBeFalsy()
    })

    test('should throw if dimensions do not match', () => {
      expect(() => unit(100, 'N').lessThanOrEqual(unit(100, 'kg m / s'))).toThrow(/Cannot compare units.*dimensions do not match/)
      expect(() => unit(100, 'cm').lessThanOrEqual(unit(1, 'kg'))).toThrow(/Cannot compare units.*dimensions do not match/)
    })

    test('should throw if one unit has a value and the other does not', () => {
      expect(() => unit('1m').lessThanOrEqual('km')).toThrow(/Cannot compare units.*one has a value and the other does not/)
    })

    test('should convert parameter to a unit', () => {
      expect(unit(100, 'cm').lessThanOrEqual('2 m')).toBeTruthy()
      expect(unit('3 kg / kg').lessThanOrEqual(4)).toBeTruthy()
    })
  })

  describe('greaterThan', () => {
    test('should test whether one unit is greater than another', () => {
      expect(unit(100, 'cm').greaterThan(unit(1, 'm'))).toBeFalsy()
      expect(unit(100, 'cm').greaterThan(unit(0.5, 'm'))).toBeTruthy()
      // expect(unit(100, 'ft lbf').greaterThan(unit(1200, 'in lbf'))).toBeFalsy()  // Round-off error
      expect(unit(100, 'N').greaterThan(unit(100, 'kg m / s ^ 2'))).toBeFalsy()
      expect(unit(100, 'Hz').greaterThan(unit(100, 's ^ -1'))).toBeFalsy()
      expect(unit(101, 'Hz').greaterThan(unit(100, 's ^ -1'))).toBeTruthy()
      expect(unit(99, 'Hz').greaterThan(unit(100, 's ^ -1'))).toBeFalsy()
    })

    test('should work with valueless units', () => {
      expect(unit('cm').greaterThan(unit('cm'))).toBeFalsy()
      expect(unit('cm').greaterThan(unit('m'))).toBeFalsy()
    })

    test('should throw if dimensions do not match', () => {
      expect(() => unit(100, 'N').greaterThan(unit(100, 'kg m / s'))).toThrow(/Cannot compare units.*dimensions do not match/)
      expect(() => unit(100, 'cm').greaterThan(unit(1, 'kg'))).toThrow(/Cannot compare units.*dimensions do not match/)
    })

    test('should throw if one unit has a value and the other does not', () => {
      expect(() => unit('1m').greaterThan('km')).toThrow(/Cannot compare units.*one has a value and the other does not/)
    })

    test('should convert parameter to a unit', () => {
      expect(unit(100, 'cm').greaterThan('0.5 m')).toBeTruthy()
      expect(unit('3 kg / kg').greaterThan(2)).toBeTruthy()
    })
  })

  describe('greaterThanOrEqual', () => {
    test('should test whether one unit is greater than another', () => {
      expect(unit(100, 'cm').greaterThanOrEqual(unit(1, 'm'))).toBeTruthy()
      expect(unit(100, 'cm').greaterThanOrEqual(unit(2, 'm'))).toBeFalsy()
      // expect(unit(100, 'ft lbf').greaterThanOrEqual(unit(1200, 'in lbf'))).toBeFalsy()  // Round-off error
      expect(unit(100, 'N').greaterThanOrEqual(unit(100, 'kg m / s ^ 2'))).toBeTruthy()
      expect(unit(100, 'Hz').greaterThanOrEqual(unit(100, 's ^ -1'))).toBeTruthy()
      expect(unit(101, 'Hz').greaterThanOrEqual(unit(100, 's ^ -1'))).toBeTruthy()
      expect(unit(99, 'Hz').greaterThanOrEqual(unit(100, 's ^ -1'))).toBeFalsy()
    })

    test('should work with valueless units', () => {
      expect(unit('cm').greaterThanOrEqual(unit('cm'))).toBeTruthy()
      expect(unit('cm').greaterThanOrEqual(unit('m'))).toBeFalsy()
      expect(unit('cm/s').greaterThanOrEqual(unit('cm/min'))).toBeTruthy()
    })

    test('should throw if dimensions do not match', () => {
      expect(() => unit(100, 'N').greaterThanOrEqual(unit(100, 'kg m / s'))).toThrow(/Cannot compare units.*dimensions do not match/)
      expect(() => unit(100, 'cm').greaterThanOrEqual(unit(1, 'kg'))).toThrow(/Cannot compare units.*dimensions do not match/)
    })

    test('should throw if one unit has a value and the other does not', () => {
      expect(() => unit('1m').greaterThanOrEqual('km')).toThrow(/Cannot compare units.*one has a value and the other does not/)
    })

    test('should convert parameter to a unit', () => {
      expect(unit(100, 'cm').greaterThanOrEqual('0.5 m')).toBeTruthy()
      expect(unit('3 kg / kg').greaterThanOrEqual(2)).toBeTruthy()
    })
  })

  describe('clone', () => {
    test('should clone a unit', () => {
      const u1 = unit(100, 'cm')
      const u2 = u1.clone()
      expect(u1).not.toBe(u2) // u2 must be a clone
      expect(u1).toApproximatelyEqual(u2) // u2 must be a clone

      const u3 = unit(8.314, 'km/hr')
      const u4 = u3.clone()
      expect(u3).not.toBe(u4)
      expect(u3).toApproximatelyEqual(u4)


      const u7 = unit(8.314, 'kg m^2 / s^2 K mol')
      const u8 = u7.clone()
      expect(u7).not.toBe(u8)
      expect(u7).toApproximatelyEqual(u8)


      const u9 = unit(8.314, 'kg m^2 / s^2 K mol').to()
      const u10 = u9.clone()
      expect(u9).not.toBe(u10)
      expect(u9).toApproximatelyEqual(u10)

    })

    test('should freeze the returned unit', () => {
      expect(Object.isFrozen(unit(100, 'cm').clone())).toBeTruthy()
    })
  })

  describe('to', () => {
    test('should convert a unit using a target unit string', () => {
      const u1 = unit(5000, 'in')
      expect(u1.value).toEqual(5000)
      expect(u1.units[0].unit.name).toEqual('in')
      expect(u1.units[0].prefix).toEqual('')

      const u2 = u1.to('cm')
      expect(u1).not.toBe(u2) // u2 must be a clone
      expect(u2.value).toEqual(12700)
      expect(u2.units[0].unit.name).toEqual('m')
      expect(u2.units[0].prefix).toEqual('c')

      const u3 = unit(299792.458, 'km/s')
      expect(u3.value).toEqual(299792.458)
      expect(u3.units[0].unit.name).toEqual('m')
      expect(u3.units[1].unit.name).toEqual('s')
      expect(u3.units[0].prefix).toEqual('k')

      const u4 = u3.to('m/s')
      expect(u3).not.toBe(u4) // u2 must be a clone
      expect(u4.value).toEqual(299792458)
      expect(u4.units[0].unit.name).toEqual('m')
      expect(u4.units[1].unit.name).toEqual('s')
      expect(u4.units[0].prefix).toEqual('')
    })

    test('should convert a unit using a target unit', () => {
      const u1 = unit(5000, 'in')
      expect(u1.value).toEqual(5000)
      expect(u1.units[0].unit.name).toEqual('in')
      expect(u1.units[0].prefix).toEqual('')

      const u2 = u1.to(unit('cm'))
      expect(u1).not.toBe(u2) // u2 must be a clone
      expect(u2.value).toEqual(12700)
      expect(u2.units[0].unit.name).toEqual('m')
      expect(u2.units[0].prefix).toEqual('c')

      const u3 = unit(299792.458, 'km/s')
      expect(u3.value).toEqual(299792.458)
      expect(u3.units[0].unit.name).toEqual('m')
      expect(u3.units[1].unit.name).toEqual('s')
      expect(u3.units[0].prefix).toEqual('k')

      const u4 = u3.to(unit('m/s'))
      expect(u3).not.toBe(u4) // u2 must be a clone
      expect(u4.value).toEqual(299792458)
      expect(u4.units[0].unit.name).toEqual('m')
      expect(u4.units[1].unit.name).toEqual('s')
      expect(u4.units[0].prefix).toEqual('')
    })

    test('should convert a valueless unit', () => {
      const u1 = unit(null, 'm')
      expect(u1.value).toEqual(null)
      expect(u1.units[0].unit.name).toEqual('m')
      expect(u1.units[0].prefix).toEqual('')

      const u2 = u1.to(unit(null, 'cm'))
      expect(u1).not.toBe(u2) // u2 must be a clone
      expect(u2.value).toEqual(100) // u2 must have a value
      expect(u2.units[0].unit.name).toEqual('m')
      expect(u2.units[0].prefix).toEqual('c')

      const u3 = unit(null, 'm/s')
      expect(u3.value).toEqual(null)
      expect(u3.units[0].unit.name).toEqual('m')
      expect(u3.units[1].unit.name).toEqual('s')
      expect(u3.units[0].prefix).toEqual('')

      const u4 = u3.to(unit(null, 'cm/s'))
      expect(u3).not.toBe(u4) // u2 must be a clone
      expect(u4.value).toEqual(100) // u4 must have a value
      expect(u4.units[0].unit.name).toEqual('m')
      expect(u4.units[1].unit.name).toEqual('s')
      expect(u4.units[0].prefix).toEqual('c')

      const u5 = unit(null, 'km').to('cm')
      expect(u5.value).toEqual(100000)
      expect(u5.units[0].unit.name).toEqual('m')
      expect(u5.units[0].prefix).toEqual('c')
    })

    test('should convert a binary prefixes (1)', () => {
      const u1 = unit(1, 'Kib')
      expect(u1.value).toEqual(1)
      expect(u1.units[0].unit.name).toEqual('b')
      expect(u1.units[0].prefix).toEqual('Ki')

      const u2 = u1.to(unit(null, 'b'))
      expect(u1).not.toBe(u2) // u2 must be a clone
      expect(u2.value).toEqual(1024) // u2 must have a value
      expect(u2.units[0].unit.name).toEqual('b')
      expect(u2.units[0].prefix).toEqual('')

      const u3 = unit(1, 'Kib/s')
      expect(u3.value).toEqual(1)
      expect(u3.units[0].unit.name).toEqual('b')
      expect(u3.units[1].unit.name).toEqual('s')
      expect(u3.units[0].prefix).toEqual('Ki')

      const u4 = u3.to(unit(null, 'b/s'))
      expect(u3).not.toBe(u4) // u2 must be a clone
      expect(u4.value).toEqual(1024) // u4 must have a value
      expect(u4.units[0].unit.name).toEqual('b')
      expect(u4.units[1].unit.name).toEqual('s')
      expect(u4.units[0].prefix).toEqual('')
    })

    test('should convert a binary prefixes (2)', () => {
      const u1 = unit(1, 'kb')
      expect(u1.value).toEqual(1)
      expect(u1.units[0].unit.name).toEqual('b')
      expect(u1.units[0].prefix).toEqual('k')

      const u2 = u1.to(unit(null, 'b'))
      expect(u1).not.toBe(u2) // u2 must be a clone
      expect(u2.value).toEqual(1000) // u2 must have a value
      expect(u2.units[0].unit.name).toEqual('b')
      expect(u2.units[0].prefix).toEqual('')
    })

    test('the alternate api syntax should also work', () => {
      expect(unit.to('lbm', 'kg').format()).toEqual('0.45359237 kg')
      expect(unit.to(unit('10 lbm'), unit('kg')).format()).toEqual('4.5359237 kg')
    })

    test('should throw an error when converting to an incompatible unit', () => {
      const u1 = unit(5000, 'cm')
      expect(() => { u1.to('kg') }).toThrow(/dimensions do not match/)
      const u2 = unit(5000, 'N s')
      expect(() => { u2.to('kg^5 / s') }).toThrow(/dimensions do not match/)
    })

    test('should throw an error when converting to a unit having a value', () => {
      const u1 = unit(5000, 'cm')
      expect(() => { u1.to(unit(4, 'm')) }).toThrow(/unit must be valueless/)
    })

    test('should throw an error when converting to an unsupported type of argument', () => {
      const u1 = unit(5000, 'cm')
      expect(() => { u1.to(new Date()) }).toThrow(/Parameter must be a Unit or a string./)
    })
  })

  describe('getUnits', () => {
    test('should return the units only of a unit', () => {
      expect(unit('42 kg / m s^2').getUnits()).toApproximatelyEqual(unit('kg / m s^2'))
    })
  })

  describe('toString', () => {
    test('should convert to string when no extra simplification is requested', () => {
      expect(unit(5000, 'cm').to().toString()).toEqual('5000 cm')
      expect(unit(5, 'kg').to().toString()).toEqual('5 kg')
      expect(unit(2 / 3, 'm').to().toString()).toEqual('0.666666666666667 m')
      expect(unit(5, 'N').to().toString()).toEqual('5 N')
      expect(unit(5, 'kg^1.0e0 m^1.0e0 s^-2.0e0').to().toString()).toEqual('5 kg m / s^2')
      expect(unit(5, 's^-2').to().toString()).toEqual('5 s^-2')
      expect(unit(5, 'm / s ^ 2').to().toString()).toEqual('5 m / s^2')
      expect(unit(null, 'kg m^2 / s^2 mol').to().toString()).toEqual('kg m^2 / s^2 mol')
      expect(unit(10, 'hertz').to().toString()).toEqual('10 hertz')
      expect(unit('3.14 rad').to().toString()).toEqual('3.14 rad')
      expect(unit('J / mol K').to().toString()).toEqual('J / mol K')
      expect(unit(2).to().toString()).toEqual('2')
      expect(unit().to().toString()).toEqual('')
    })

    test('should convert to string properly', () => {
      expect(unit(5, 'kg').toString()).toEqual('5 kg')
      expect(unit(2 / 3, 'm').toString()).toEqual('0.666666666666667 m')
      expect(unit(5, 'N').toString()).toEqual('5 N')
      expect(unit(5, 'kg^1.0e0 m^1.0e0 s^-2.0e0').to().toString()).toEqual('5 kg m / s^2')
      expect(unit(5, 's^-2').toString()).toEqual('5 s^-2')
      expect(unit(5, 'm / s ^ 2').toString()).toEqual('5 m / s^2')
      expect(unit(null, 'kg m^2 / s^2 mol').toString()).toEqual('kg m^2 / s^2 mol')
      expect(unit(10, 'hertz').toString()).toEqual('10 hertz')
    })

    test('should render with the best prefix', () => {
      expect(unit(0.000001, 'm').format(8)).toEqual('1 um')
      expect(unit(0.00001, 'm').format(8)).toEqual('10 um')
      expect(unit(0.0001, 'm').format(8)).toEqual('0.1 mm')
      expect(unit(0.0005, 'm').format(8)).toEqual('0.5 mm')
      expect(unit(0.0006, 'm').toString()).toEqual('0.6 mm')
      expect(unit(0.001, 'm').toString()).toEqual('0.1 cm')
      expect(unit(0.01, 'm').toString()).toEqual('1 cm')
      expect(unit(100000, 'm').toString()).toEqual('100 km')
      expect(unit(300000, 'm').toString()).toEqual('300 km')
      expect(unit(500000, 'm').toString()).toEqual('500 km')
      expect(unit(600000, 'm').toString()).toEqual('600 km')
      expect(unit(1000000, 'm').toString()).toEqual('1000 km')
      expect(unit(10000000, 'm').toString()).toEqual('10000 km')
      expect(unit(2000, 'ohm').toString()).toEqual('2 kohm')

      expect(unit(-0.000001, 'm').format(8)).toEqual('-1 um')
      expect(unit(-0.00001, 'm').format(8)).toEqual('-10 um')
      expect(unit(-0.0001, 'm').format(8)).toEqual('-0.1 mm')
      expect(unit(-0.0005, 'm').format(8)).toEqual('-0.5 mm')
      expect(unit(-0.0006, 'm').toString()).toEqual('-0.6 mm')
      expect(unit(-0.001, 'm').toString()).toEqual('-0.1 cm')
      expect(unit(-0.01, 'm').toString()).toEqual('-1 cm')
      expect(unit(-100000, 'm').toString()).toEqual('-100 km')
      expect(unit(-300000, 'm').toString()).toEqual('-300 km')
      expect(unit(-500000, 'm').toString()).toEqual('-500 km')
      expect(unit(-600000, 'm').toString()).toEqual('-600 km')
      expect(unit(-1000000, 'm').toString()).toEqual('-1000 km')
      expect(unit(-10000000, 'm').toString()).toEqual('-10000 km')
      expect(unit(-2000, 'ohm').toString()).toEqual('-2 kohm')
    })

    test('should keep the original prefix when in range', () => {
      expect(unit(0.0999, 'm').toString()).toEqual('9.99 cm')
      expect(unit(0.1, 'm').toString()).toEqual('0.1 m')
      expect(unit(0.5, 'm').toString()).toEqual('0.5 m')
      expect(unit(0.6, 'm').toString()).toEqual('0.6 m')
      expect(unit(1, 'm').toString()).toEqual('1 m')
      expect(unit(10, 'm').toString()).toEqual('10 m')
      expect(unit(100, 'm').toString()).toEqual('100 m')
      expect(unit(300, 'm').toString()).toEqual('300 m')
      expect(unit(500, 'm').toString()).toEqual('500 m')
      expect(unit(600, 'm').toString()).toEqual('600 m')
      expect(unit(1000, 'm').toString()).toEqual('1000 m')
      expect(unit(1001, 'm').toString()).toEqual('1.001 km')
    })

    test('should render best prefix for a single unit raised to integral power', () => {
      expect(unit(3.2e7, 'm^2').toString()).toEqual('32 km^2')
      expect(unit(3.2e-7, 'm^2').toString()).toEqual('0.32 mm^2')
      expect(unit(15000, 'm^-1').toString()).toEqual('150 cm^-1')
      expect(unit(3e-9, 'm^-2').toString()).toEqual('0.003 km^-2')
      expect(unit(3e-9, 'm^-1.5').toString()).toEqual('3e-9 m^-1.5')
      expect(unit(2, 'kg^0').toString()).toEqual('2')
    })

    test('should not change the prefix unless there is a `commonPrefixes` defined for the unit', () => {
      // lumen has prefixes, but no commonPrefixes, so its prefixes should not change
      expect(unit('4 microlumen').format()).toEqual('4 microlumen')
      expect(unit('4e-6 lumen').format()).toEqual('0.000004 lumen')

      // newton has prefixes and commonPrefixes so its prefix should change
      expect(unit('4 micronewton').format()).toEqual('4 micronewton')
      expect(unit('4e-6 newton').format()).toEqual('4 micronewton')
    })

    test('should use the prefixesToChooseFrom option', () => {
      expect(unit('4 microlumen').format({ prefixesToChooseFrom: 'all' })).toEqual('4 microlumen')
      expect(unit('4e-6 lumen').format({ prefixesToChooseFrom: 'all' })).toEqual('4 microlumen')

      expect(unit('4e-6 micronewton').format({ prefixesToChooseFrom: 'all' })).toEqual('4 piconewton')
      expect(unit('4e-2 newton').format({ prefixesToChooseFrom: 'all' })).toEqual('0.4 decinewton')
      expect(unit('4e+9 newton').format({ prefixesToChooseFrom: 'all' })).toEqual('4 giganewton')

      expect(unit('4e-6 micronewton').format({ prefixesToChooseFrom: 'common' })).toEqual('0.000004 micronewton')
      expect(unit('4e-2 newton').format({ prefixesToChooseFrom: 'common' })).toEqual('40 millinewton')
      expect(unit('4e+9 newton').format({ prefixesToChooseFrom: 'common' })).toEqual('4000 meganewton')
    })

    test('should avoid division by zero by not choosing a prefix for very small values', () => {
      expect(unit('1e-40 m').format()).toEqual('1e-31 nm')
      expect(unit('1e-60 m').format()).toEqual('1e-60 m')
      expect(unit('0 m').format()).toEqual('0 m')
      expect(unit('-1e-40 m').format()).toEqual('-1e-31 nm')
      expect(unit('-1e-60 m').format()).toEqual('-1e-60 m')
    })

    test('should not render best prefix if "fixed" by the `to` method', () => {
      const u = unit(5e-3, 'm')
      expect(u.toString()).toEqual('0.5 cm')
      const v = u.to()
      expect(v.toString()).toEqual('0.005 m')
    })

    test('should format a unit without value', () => {
      expect(unit(null, 'cm').toString()).toEqual('cm')
      expect(unit(null, 'm').toString()).toEqual('m')
      expect(unit(null, 'kg m/s').toString()).toEqual('kg m / s')
    })

    test('should format a unit with fixed prefix and without value', () => {
      expect(unit(null, 'km').to('cm').toString()).toEqual('100000 cm')
      expect(unit(null, 'inch').to('cm').toString()).toEqual('2.54 cm')
      expect(unit(null, 'N/m^2').to('lbf/inch^2').toString({ precision: 10 })).toEqual('0.0001450377377 lbf / inch^2')
    })

    // test('should ignore properties in Object.prototype when finding the best prefix', () => {
    //   Object.prototype.foo = 'bar' // eslint-disable-line no-extend-native

    //   expect(unit(5e5, 'cm').format(), '5 km')

    //   delete Object.prototype.foo
    // })
  })

  describe('setValue', () => {
    test('should set a unit\'s value', () => {
      expect(unit('10 lumen').setValue(20).format()).toEqual('20 lumen')
      expect(unit('lumen').setValue(20).format()).toEqual('20 lumen')
      expect(unit('10 lumen').setValue(null).format()).toEqual('lumen')
      expect(unit('10 lumen').setValue().format()).toEqual('lumen')
    })
  })

  describe('getValue', () => {
    test('should get a unit\'s value', () => {
      expect(unit('20 kg').getValue()).toEqual(20)
      expect(unit('3 g').getValue()).toEqual(3)
      expect(unit('40 mi/hr').getValue()).toEqual(40)
      expect(unit('km/hr').getValue()).toEqual(null)
    })
  })

  describe('getNormalizedValue', () => {
    test('should get a unit\'s normalized value', () => {
      expect(unit('20 kg').getNormalizedValue()).toEqual(20)
      expect(unit('3 g').getNormalizedValue()).toEqual(0.003)
      expect(unit('40 mi/hr').getNormalizedValue()).toEqual(17.8816)
      expect(unit('km/hr').getNormalizedValue()).toEqual(null)
    })
  })

  describe('setNormalizedValue', () => {
    test('should set a unit\'s normalized value', () => {
      expect(unit('20 kg').setNormalizedValue(10).format()).toEqual('10 kg')
      expect(unit('3 g').setNormalizedValue(5).format()).toEqual('5 kg')
      expect(unit('40 mi/hr').setNormalizedValue(10).format()).toEqual('22.369362920544 mi / hr')
      expect(unit('km/hr').setNormalizedValue(1).format()).toEqual('3.6 km / hr')
    })
  })

  describe('simplify', () => {
    test('should not simplify units fixed by the to() method', () => {
      const unit1 = unit(10, 'kg m/s^2').to()
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[1].unit.name).toEqual('m')
      expect(unit1.units[2].unit.name).toEqual('s')
      expect(unit1.toString()).toEqual('10 kg m / s^2')
    })

    test('should simplify units without values', () => {
      expect(unit('kg m/s^2').simplify().format()).toEqual('N')
    })

    test('should simplify units when they cancel out', () => {
      const unit1 = unit(2, 'Hz')
      const unit2 = unit(2, 's')
      const unit3 = unit1.mul(unit2)
      expect(unit3.toString()).toEqual('4')

      const nounit = unit('40m').mul('40N').div('40J')
      expect(nounit.toString()).toEqual('40')

      const nounit2 = unit('2 hours').div('1 hour')
      expect(nounit2.toString()).toEqual('2')
    })

    test('should simplify units according to chosen unit system', () => {
      // Simplify explicitly
      let unit1 = unit.config({ system: 'us' })('10 N')
      expect(unit1.simplify().toString()).toEqual('2.2480894309971 lbf')

      let unit2 = unit.config({ system: 'cgs' })('10 N')
      expect(unit2.simplify().toString()).toEqual('1000 kdyn')

      // Reduce threshold to 0
      let newUnit = unit.config({ simplifyThreshold: 0 })

      let unit3 = newUnit.config({ system: 'us' })('10 N')
      expect(unit3.toString()).toEqual('2.2480894309971 lbf')

      let unit4 = newUnit.config({ system: 'cgs' })('10 N')
      expect(unit4.toString()).toEqual('1000 kdyn')
    })

    test('should correctly simplify units when unit system is "auto"', () => {
      const unit1 = unit(5, 'lbf min / s')
      expect(unit1.simplify().toString()).toEqual('300 lbf')
      expect(unit('150 lbf').div('10 in^2').toString()).toEqual('15 psi')
      expect(unit('400 N').div('10 cm^2').toString()).toEqual('400 kPa')
    })

    test('should infer the unit system when using non-preferred units which are members of that system', () => {
      // mile and kip are not preferred, but are members of the 'us' system, therefore result should simplify to 'BTU'
      let unit1 = unit('10 mile').mul('10 kip')
      expect(unit1.toString({ simplifyThreshold: 0 })).toEqual('0.678515620705073 MMBTU')
    })

    test('it should correctly differentiate between si and cgs units when unit system is "auto"', () => {
      let unit1Cgs = unit('5 cm')
      let unit2Cgs = unit('10 g')
      let unit1Si = unit('5 m')
      let unit2Si = unit('10 kg')
      let unit3 = unit('2 s')

      expect(unit2Cgs.mul(unit1Cgs).div(unit3.pow(2)).toString()).toEqual('12.5 dyn')
      expect(unit2Si.mul(unit1Si).div(unit3.pow(2)).toString()).toEqual('12.5 N')
    })

    test('should try to use preexisting units in the simplified expression', () => {
      let unit1 = unit('10 ft hour / minute')
      expect(unit1.toString()).toEqual('600 ft')

      unit1 = unit('10 mile hour / minute')
      expect(unit1.toString()).toEqual('600 mile')

      unit1 = unit('10 mi hour / minute')
      expect(unit1.toString()).toEqual('600 mi')

      unit1 = unit('10 m hour / minute')
      expect(unit1.toString()).toEqual('600 m')

      unit1 = unit('10 meter hour / minute')
      expect(unit1.toString()).toEqual('600 meter')
    })

    test('should not simplify unless complexity is reduced by the threshold', () => {
      expect(unit('10 N m').toString()).toEqual('10 N m')
      expect(unit('10 J / m').toString()).toEqual('10 N')
      expect(unit('10 m^3 Pa').toString()).toEqual('10 J')
      expect(unit('10 s^-1').toString()).toEqual('10 Hz')
      expect(unit('10 C/s').toString()).toEqual('10 A')

      let newUnit = unit.config({ simplifyThreshold: 10 })
      expect(newUnit('10 N m').toString()).toEqual('10 N m')
      expect(newUnit('10 J / m').toString()).toEqual('10 J / m')
      expect(newUnit('10 m^3 Pa').toString()).toEqual('10 m^3 Pa')

      newUnit = newUnit.config({ simplifyThreshold: 0 })
      expect(newUnit('10 N m').toString()).toEqual('10 J')
      expect(newUnit('10 J / m').toString()).toEqual('10 N')
      expect(newUnit('10 m^3 Pa').toString()).toEqual('10 J')
    })
  })

  describe('precision', () => {
    test('should format units with given precision', () => {
      expect(unit.config({ precision: 3 })(2 / 3, 'm').toString()).toEqual('0.667 m')
      expect(unit.config({ precision: 1 })(2 / 3, 'm').toString()).toEqual('0.7 m')
      expect(unit.config({ precision: 10 })(2 / 3, 'm').toString()).toEqual('0.6666666667 m')
    })
  })

  describe('format', () => {
    test('should accept formatting options as argument to the function', () => {
      expect(unit('1 lb').to('kg').format({ prefix: 'always', prefixMin: 1, precision: 4 })).toEqual('453.6 g')
    })

    test('should render parentheses if desired', () => {
      expect(unit('kg m / s^2').to().format({ parentheses: true })).toEqual('(kg m) / s^2')
      expect(unit('8.314 J / mol K').to().format({ parentheses: true })).toEqual('8.314 J / (mol K)')
    })

    test('should only simplify units with values', () => {
      let unit1 = unit(null, 'kg m mol / s^2 mol')
      expect(unit1.format()).toEqual('kg m / s^2')
      unit1 = unit1.mul(1)
      expect(unit1.format()).toEqual('1 N')
    })

    test('should respect the `simplify` option', () => {
      expect(unit('1 kg m / s^2').format()).toEqual('1 N')
      expect(unit('1 kg m / s^2').format({ simplify: 'never' })).toEqual('1 kg m / s^2')
      expect(unit('1 N m').format()).toEqual('1 N m')
      expect(unit('1 N m').format({ simplify: 'always' })).toEqual('1 J')
    })
  })

  describe('valueOf', () => {
    test('should output a raw, unsimplified string representation of this unit', () => {
      expect(unit('8.314 J / mol K').valueOf()).toEqual('8.314 J / mol K')
      expect(unit('10 h / s').valueOf()).toEqual('10 h / s')
      expect(unit('10 h / s').format()).toEqual('36000')
    })
  })

  describe('parse', () => {
    test('should parse units correctly', () => {
      let unit1

      unit1 = unit('5kg')
      expect(unit1.value).toEqual(5)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[0].prefix).toEqual('k')

      unit1 = unit('5 kg')
      expect(unit1.value).toEqual(5)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[0].prefix).toEqual('k')

      unit1 = unit(' 5 kg ')
      expect(unit1.value).toEqual(5)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[0].prefix).toEqual('k')

      unit1 = unit('5e-3kg')
      expect(unit1.value).toEqual(0.005)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[0].prefix).toEqual('k')

      unit1 = unit('5e+3kg')
      expect(unit1.value).toEqual(5000)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[0].prefix).toEqual('k')

      unit1 = unit('5e3kg')
      expect(unit1.value).toEqual(5000)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[0].prefix).toEqual('k')

      unit1 = unit('-5kg')
      expect(unit1.value).toEqual(-5)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[0].prefix).toEqual('k')

      unit1 = unit('+5kg')
      expect(unit1.value).toEqual(5)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[0].prefix).toEqual('k')

      unit1 = unit('.5kg')
      expect(unit1.value).toEqual(0.5)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[0].prefix).toEqual('k')

      unit1 = unit('-5mg')
      expect(unit1.value).toEqual(-5)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[0].prefix).toEqual('m')

      unit1 = unit('5.2mg')
      expect(unit1.value).toEqual(5.2)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[0].prefix).toEqual('m')

      unit1 = unit('300 kg/minute')
      expect(unit1.value).toEqual(300)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[1].unit.name).toEqual('minute')
      expect(unit1.units[0].prefix).toEqual('k')

      unit1 = unit('981 cm/s^2')
      expect(unit1.value).toEqual(981)
      expect(unit1.units[0].unit.name).toEqual('m')
      expect(unit1.units[1].unit.name).toEqual('s')
      expect(unit1.units[1].power).toEqual(-2)
      expect(unit1.units[0].prefix).toEqual('c')

      unit1 = unit('981 cm*s^-2')
      expect(unit1.value).toEqual(981)
      expect(unit1.units[0].unit.name).toEqual('m')
      expect(unit1.units[1].unit.name).toEqual('s')
      expect(unit1.units[1].power).toEqual(-2)
      expect(unit1.units[0].prefix).toEqual('c')

      unit1 = unit('8.314 kg m^2 / s^2 K mol')
      expect(unit1.value).toEqual(8.314)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[1].unit.name).toEqual('m')
      expect(unit1.units[2].unit.name).toEqual('s')
      expect(unit1.units[3].unit.name).toEqual('K')
      expect(unit1.units[4].unit.name).toEqual('mol')
      expect(unit1.units[0].power).toEqual(1)
      expect(unit1.units[1].power).toEqual(2)
      expect(unit1.units[2].power).toEqual(-2)
      expect(unit1.units[3].power).toEqual(-1)
      expect(unit1.units[4].power).toEqual(-1)
      expect(unit1.units[0].prefix).toEqual('k')

      unit1 = unit('8.314 kg m^2 / s^2 K mol')
      expect(unit1.value).toEqual(8.314)
      expect(unit1.units[0].unit.name).toEqual('g')
      expect(unit1.units[1].unit.name).toEqual('m')
      expect(unit1.units[2].unit.name).toEqual('s')
      expect(unit1.units[3].unit.name).toEqual('K')
      expect(unit1.units[4].unit.name).toEqual('mol')
      expect(unit1.units[0].power).toEqual(1)
      expect(unit1.units[1].power).toEqual(2)
      expect(unit1.units[2].power).toEqual(-2)
      expect(unit1.units[3].power).toEqual(-1)
      expect(unit1.units[4].power).toEqual(-1)
      expect(unit1.units[0].prefix).toEqual('k')

      unit1 = unit('5exabytes')
      expect(unit1.value).toEqual(5)
      expect(unit1.units[0].unit.name).toEqual('bytes')

      unit1 = unit('1 / s')
      expect(unit1.value).toEqual(1)
      expect(unit1.units[0].unit.name).toEqual('s')
      expect(unit1.units[0].power).toEqual(-1)

      unit1 = unit('1/s')
      expect(unit1.value).toEqual(1)
      expect(unit1.units[0].unit.name).toEqual('s')
      expect(unit1.units[0].power).toEqual(-1)

      unit1 = unit('1 * s')
      expect(unit1.value).toEqual(1)
      expect(unit1.units[0].unit.name).toEqual('s')
      expect(unit1.units[0].power).toEqual(1)
    })

    test('should throw error when parsing expressions with invalid characters', () => {
      expect(() => { unit('8.314 J / (mol * K)') }).toThrow(/Unexpected "\("/)
      expect(() => { unit('8.314 J / mol / K') }).toThrow(/Unexpected additional "\/"/)
    })

    test('should parse units with correct precedence', () => {
      const unit1 = unit('1  m^3 / kg s^2') // implicit multiplication

      expect(unit1.units[0].unit.name).toEqual('m')
      expect(unit1.units[1].unit.name).toEqual('g')
      expect(unit1.units[2].unit.name).toEqual('s')
      expect(unit1.units[0].power).toEqual(3)
      expect(unit1.units[1].power).toEqual(-1)
      expect(unit1.units[2].power).toEqual(-2)
      expect(unit1.units[0].prefix).toEqual('')
    })

    test('should throw an exception when parsing an invalid unit', () => {
      expect(() => { unit('.meter') }).toThrow(/Unexpected "\."/)
      expect(() => { unit('5e') }).toThrow(/Unit "e" not found/)
      expect(() => { unit('5e.') }).toThrow(/Unit "e" not found/)
      expect(() => { unit('5e1.3') }).toThrow(/Unexpected "\."/)
      expect(() => { unit('meter.') }).toThrow(/Unexpected "\."/)
      expect(() => { unit('meter/') }).toThrow(/Trailing characters/)
      expect(() => { unit('/meter') }).toThrow(/Unexpected "\/"/)
      expect(() => { unit('1 */ s') }).toThrow(/Unexpected "\/"/)
      expect(() => { unit('45 kg 34 m') }).toThrow(/Unexpected "3"/)
      expect(() => unit('10 m^')).toThrow(/must be followed by a floating/)
      expect(() => unit('10 m+')).toThrow(/Unexpected "\+"/)
    })

    test('should parse empty strings and only numbers', () => {
      expect(unit(123).value).toEqual(123)
      expect(unit(123).units.length).toEqual(0)
      expect(unit('').value).toEqual(null)
      expect(unit('').units.length).toEqual(0)
      expect(unit().value).toEqual(null)
      expect(unit().units.length).toEqual(0)
    })

    test('should throw if parser() receives other than a string', () => {
      expect(() => unit._unitStore.parser(42)).toThrow(/Invalid argument in parse/)
    })
  })

  describe('prefixes', () => {
    test('should accept both long and short prefixes for ohm', () => {
      expect(unit('5 ohm').toString()).toEqual('5 ohm')
      expect(unit('5 milliohm').toString()).toEqual('5 milliohm')
      expect(unit('5 mohm').toString()).toEqual('5 mohm')
    })

    test('should accept both long and short prefixes for bar', () => {
      expect(unit('5 bar').toString()).toEqual('5 bar')
      expect(unit('5 millibar').toString()).toEqual('5 millibar')
      expect(unit('5 mbar').toString()).toEqual('5 mbar')
    })
  })

  describe('isCompound', () => {
    test('should return the correct value', () => {
      expect(unit('34').isCompound()).toBeFalsy()
      expect(unit('34 kg').isCompound()).toBeFalsy()
      expect(unit('34 kg/s').isCompound()).toBeTruthy()
      expect(unit('34 kg^2').isCompound()).toBeTruthy()
      expect(unit('34 N').isCompound()).toBeFalsy()
      expect(unit('34 kg m / s^2').isCompound()).toBeTruthy()
    })
  })

  describe('add', () => {
    test('should add two units', () => {
      expect(unit(300, 'm').add(unit(3, 'km'))).toApproximatelyEqual(unit(3300, 'm'))
      expect(unit('2m').add(unit('3ft'))).toApproximatelyEqual(unit('2.9144 m'))
      expect(unit('2').add(unit('3'))).toApproximatelyEqual(unit('5'))
    })

    test('should convert parameter to unit', () => {
      expect(unit('1 hour').add('30 minute')).toApproximatelyEqual(unit(1.5, 'hour'))
      expect(unit(100, 'cm / m').add(10)).toApproximatelyEqual(unit(1100, 'cm / m'))
    })

    test('should return a frozen unit', () => {
      expect(Object.isFrozen(unit(300, 'm').add(unit(3, 'km')))).toBeTruthy()
    })

    test('the alternate api syntax should also work', () => {
      expect(unit.add(unit(300, 'm'), unit(3, 'km'))).toApproximatelyEqual(unit(3300, 'm'))
      expect(unit.add('300 m', '3 km')).toApproximatelyEqual(unit(3300, 'm'))
    })

    test('should throw if one or both units do not have values', () => {
      expect(() => unit('10 m').add('ft')).toThrow(/Cannot add.*both units must have values/)
      expect(() => unit('m').add('10 ft')).toThrow(/Cannot add.*both units must have values/)
    })

    test('should throw if units are not consistent', () => {
      expect(() => unit('10 kg').add('8 day')).toThrow(/Cannot add.*dimensions do not match/)
      expect(() => unit('10 kg').add('8 kg^0.99')).toThrow(/Cannot add.*dimensions do not match/)
      expect(() => unit('10 kg').add('8')).toThrow(/Cannot add.*dimensions do not match/)
    })
  })

  describe('sub', () => {
    test('should subtract two units', () => {
      expect(unit(300, 'm').sub(unit(3, 'km'))).toEqual(unit(-2700, 'm'))
      expect(unit('2m').sub(unit('3ft'))).toApproximatelyEqual(unit('1.0856 m'))
    })

    test('should convert parameter to unit', () => {
      expect(unit('1 hour').sub('30 minute')).toEqual(unit(0.5, 'hour'))
      expect(unit(100, 'm / cm').sub(10)).toEqual(unit('99.9 m / cm'))
    })

    test('should return a frozen unit', () => {
      expect(Object.isFrozen(unit(300, 'm').sub(unit(3, 'km')))).toBeTruthy()
    })

    test('the alternate api syntax should also work', () => {
      expect(unit.sub(unit(300, 'm'), unit(3, 'km'))).toEqual(unit(-2700, 'm'))
      expect(unit.sub('300 m', '3 km')).toEqual(unit(-2700, 'm'))
    })

    test('should throw if one or both units do not have values', () => {
      expect(() => unit('10 m').sub('ft')).toThrow(/Cannot subtract.*both units must have values/)
      expect(() => unit('m').sub('10 ft')).toThrow(/Cannot subtract.*both units must have values/)
    })

    test('should throw if units are not consistent', () => {
      expect(() => unit('10 kg').sub('8 day')).toThrow(/Cannot subtract.*dimensions do not match/)
      expect(() => unit('10 kg').sub('8 kg^0.99')).toThrow(/Cannot subtract.*dimensions do not match/)
      expect(() => unit('10 kg').sub('8')).toThrow(/Cannot subtract.*dimensions do not match/)
    })
  })

  describe('mul', () => {
    test('should multiply unit\'s values and combine their units', () => {
      expect(unit('2 kg').mul(unit('3 m'))).toEqual(unit('6 kg m'))
      expect(unit('2 m').mul(unit('4 m'))).toEqual(unit('8 m^2'))
      expect(unit('2 ft').mul(unit('4 ft')),).toEqual(unit('8 ft^2'))
      expect(unit('65 mi/h').mul(unit('2 h'))).toEqual(unit('130 mi'))
      expect(unit('2 L').mul(unit('1 s^-1'))).toEqual(unit('2 L / s'))
      expect(unit('2 m/s').mul(unit('0.5 s/m'))).toEqual(unit('1'))
      expect(unit('5 degC').mul(2)).toEqual(unit('283.15 degC'))
    })

    test('should multiply units without values', () => {
      expect(unit('kg').mul('kg')).toEqual(unit('kg^2'))
      expect(unit('4 kg').mul('kg')).toEqual(unit('4 kg^2'))
      expect(unit('kg').mul('4 kg')).toEqual(unit('4 kg^2'))
      expect(unit('m/s').mul('h/m').toString()).toEqual('h / s')
      expect(unit('1 m/s').mul('h/m').toString()).toEqual('3600')
    })

    test('should convert parameter to unit', () => {
      expect(unit('1 hour').mul('30 minute')).toEqual(unit(30, 'hour minute'))
      expect(unit('1 hour').mul(3)).toEqual(unit('3 hour'))
    })

    test('should return a frozen unit', () => {
      expect(Object.isFrozen(unit('2 kg').mul(unit('3 m')))).toBeTruthy()
    })

    test('the alternate api syntax should also work', () => {
      expect(unit.mul(unit('2 kg'), unit('3 m'))).toEqual(unit('6 kg m'))
      expect(unit.mul('2 kg', '3 m')).toEqual(unit('6 kg m'))
      expect(unit.mul('2 kg', 3)).toEqual(unit('6 kg'))
      expect(unit.mul(3, '2 kg')).toEqual(unit('6 kg'))
    })
  })

  describe('div', () => {
    test('should divide unit\'s values and combine their units', () => {
      expect(unit('6 kg').div(unit('3 m'))).toEqual(unit('2 kg m^-1'))
      expect(unit('2 m').div(unit('4 m'))).toEqual(unit('0.5'))
      expect(unit('4 ft').div(unit('2 ft'))).toEqual(unit('2'))
      expect(unit('65 mi/h').div(unit('2 h'))).toEqual(unit('32.5 mi h^-2'))
      expect(unit('2 L').div(unit('1 s^-1'))).toEqual(unit('2 L s'))
      expect(unit('2 m/s').div(unit('0.5 s/m'))).toEqual(unit('4 m^2 s^-2'))
      expect(unit('2 kg').div(unit('500 g'))).toEqual(unit(4))
      expect(unit('2000 g').div(unit('0.5 kg'))).toEqual(unit(4))
    })

    test('should divide units without values', () => {
      expect(unit('kg').div('s')).toEqual(unit('kg/s'))
      expect(unit('4 kg').div('s')).toEqual(unit('4 kg/s'))
      expect(unit('kg').div('4 s')).toEqual(unit('0.25 kg/s'))
    })

    test('should convert parameter to unit', () => {
      expect(unit('1 hour').div('0.5 hour')).toEqual(unit(2))
      expect(unit('1 hour').div(2)).toEqual(unit(0.5, 'hour'))
    })

    test('should return a frozen unit', () => {
      expect(Object.isFrozen(unit('2 kg').div(unit('3 m')))).toBeTruthy()
    })

    test('the alternate api syntax should also work', () => {
      expect(unit.div(unit('6 kg'), unit('3 m'))).toEqual(unit('2 kg m^-1'))
      expect(unit.div('6 kg', '3 m')).toEqual(unit('2 kg m^-1'))
      expect(unit.div('6 kg', 3)).toEqual(unit('2 kg'))
      expect(unit.div(3, '6 kg')).toEqual(unit('0.5 kg^-1'))
    })
  })

  describe('pow', () => {
    test('should calculate the power of a unit', () => {
      expect(unit('4 N').pow(2).equals(unit('16 N^2'))).toBeTruthy()
      expect(unit('0.25 m/s').pow(-0.5).equals(unit('2 m^-0.5 s^0.5'))).toBeTruthy()
      expect(unit('123 chain').pow(0).equals(unit('1'))).toBeTruthy()
    })

    test('should work with units without values', () => {
      expect(unit('V/m').pow(2).format()).toEqual('V^2 / m^2')
      expect(unit('1 V/m').pow(2).equals(unit('1 V^2/m^2'))).toBeTruthy()
    })

    test('the alternate api syntax should also work', () => {
      expect(unit.pow('4 N', unit(2)).equals(unit('16 N^2'))).toBeTruthy()
      expect(unit.pow(unit('0.25 m/s'), -0.5).equals(unit('2 m^-0.5 s^0.5'))).toBeTruthy()
      expect(unit.pow('123 chain', 0).equals(unit('1'))).toBeTruthy()
    })
  })

  describe('sqrt', () => {
    test('should calculate the square root of a unit', () => {
      expect(unit('16 kg').sqrt().equals(unit('4 kg^0.5'))).toBeTruthy()
      expect(unit('16').sqrt().equals(unit('4'))).toBeTruthy()
      expect(unit('16 m^2/s^2').sqrt().equals(unit('4 m/s'))).toBeTruthy()
      expect(unit('-16 m^2/s^2').sqrt().format()).toEqual('NaN m / s')
    })

    test('the alternate api syntax should also work', () => {
      expect(unit.sqrt('16 kg').equals(unit('4 kg^0.5'))).toBeTruthy()
      expect(unit.sqrt(16).equals(unit('4'))).toBeTruthy()
      expect(unit.sqrt(unit('16 m^2/s^2')).equals(unit('4 m/s'))).toBeTruthy()
    })
  })

  describe('abs', () => {
    test('should return the absolute value of a unit', () => {
      expect(unit('5 m').abs().format()).toEqual('5 m')
      expect(unit('-5 m/s').abs().format()).toEqual('5 m / s')
      expect(unit('-283.15 degC').abs().format()).toEqual('-263.15 degC')
    })

    test('the alternate api syntax should also work', () => {
      expect(unit.abs('5 m').format()).toEqual('5 m')
      expect(unit.abs('-5 m/s').format()).toEqual('5 m / s')
      expect(unit.abs(unit('-5 m/s')).format()).toEqual('5 m / s')
      expect(unit.abs(-5).format()).toEqual('5')
      expect(unit.abs('-283.15 degC').format()).toEqual('-263.15 degC')
    })
  })

  describe('mul, div, and pow', () => {
    test('should retain the units of their operands without simplifying', () => {
      const unit1 = unit(10, 'N/s')
      const unit2 = unit(10, 'h')
      const unitM = unit1.mul(unit2)
      expect(unitM.units[0].unit.name).toEqual('N')
      expect(unitM.units[1].unit.name).toEqual('s')
      expect(unitM.units[2].unit.name).toEqual('h')

      const unit3 = unit(14.7, 'lbf')
      const unit4 = unit(1, 'in in')
      const unitD = unit3.div(unit4)
      expect(unitD.units[0].unit.name).toEqual('lbf')
      expect(unitD.units[1].unit.name).toEqual('in')
      expect(unitD.units[1].power).toEqual(-2)

      const unit5 = unit(1, 'N h/s')
      const unitP = unit5.pow(-3.5)
      expect(unitP.units[0].unit.name).toEqual('N')
      expect(unitP.units[1].unit.name).toEqual('h')
      expect(unitP.units[2].unit.name).toEqual('s')
    })
  })

  describe('plurals', () => {
    test('should support plurals', () => {
      const unit1 = unit(5, 'meters')
      expect(unit1.value).toEqual(5)
      expect(unit1.units[0].unit.name).toEqual('meters')
      expect(unit1.units[0].prefix).toEqual('')

      const unit2 = unit(5, 'kilometers')
      expect(unit2.value).toEqual(5)
      expect(unit2.units[0].unit.name).toEqual('meters')
      expect(unit2.units[0].prefix).toEqual('kilo')

      const unit3 = unit(5, 'inches')
      expect(unit3.value).toEqual(5)
      expect(unit3.units[0].unit.name).toEqual('inches')
      expect(unit3.units[0].prefix).toEqual('')

      const unit4 = unit(9.81, 'meters/second^2')
      expect(unit4.value).toEqual(9.81)
      expect(unit4.units[0].unit.name).toEqual('meters')
      expect(unit4.units[0].prefix).toEqual('')
    })
  })

  describe('aliases', () => {
    test('should support aliases', () => {
      const unit1 = unit(5, 'lt')
      expect(unit1.value).toEqual(5)
      expect(unit1.units[0].unit.name).toEqual('lt')
      expect(unit1.units[0].prefix).toEqual('')

      const unit2 = unit(1, 'lb')
      expect(unit2.value).toEqual(1)
      expect(unit2.units[0].unit.name).toEqual('lb')
      expect(unit2.units[0].prefix).toEqual('')
    })
  })

  describe('unitStore', () => {
    describe('defs.units', () => {
      test('built-in units should be of the correct value and dimension', () => {
        expect(unit(1, 's A').equals(unit(1, 'C'))).toBeTruthy()
        expect(unit(1, 'W/A').equals(unit(1, 'V'))).toBeTruthy()
        expect(unit(1, 'V/A').equals(unit(1, 'ohm'))).toBeTruthy()
        expect(unit(1, 'C/V').equals(unit(1, 'F'))).toBeTruthy()
        expect(unit(1, 'J/A').equals(unit(1, 'Wb'))).toBeTruthy()
        expect(unit(1, 'Wb/m^2').equals(unit(1, 'T'))).toBeTruthy()
        expect(unit(1, 'Wb/A').equals(unit(1, 'H'))).toBeTruthy()
        expect(unit(1, 'ohm^-1').equals(unit(1, 'S'))).toBeTruthy()
        expect(unit(1, 'eV').equals(unit(1.602176565e-19, 'J'))).toBeTruthy()
      })

      test("For each built-in unit, 'name' should match key", () => {
        expect(unit._unitStore.defs.hasOwnProperty('units')).toBeTruthy()
        for (const key in unit._unitStore.defs.units) {
          expect(key).toEqual(unit._unitStore.defs.units[key].name)
        }
      })
    })

    it.skip('should not reprocess units if only the formatting options have changed', () => {

    })
  })

  describe('angles', () => {
    test('should create angles', () => {
      expect(unit(1, 'radian').equals(unit(1, 'rad'))).toBeTruthy()
      expect(unit(1, 'radians').equals(unit(1, 'rad'))).toBeTruthy()
      expect(unit(1, 'degree').equals(unit(1, 'deg'))).toBeTruthy()
      expect(unit(1, 'degrees').equals(unit(1, 'deg'))).toBeTruthy()
      expect(unit(1, 'gradian').equals(unit(1, 'grad'))).toBeTruthy()
      expect(unit(1, 'gradians').equals(unit(1, 'grad'))).toBeTruthy()

      expect(unit(1, 'radian').to('rad').equals(unit(1, 'rad'))).toBeTruthy()
      expect(unit(1, 'radians').to('rad').equals(unit(1, 'rad'))).toBeTruthy()
      expect(unit(1, 'deg').to('rad')).toEqual(unit(2 * Math.PI / 360, 'rad').to())
      expect(unit(1, 'degree').to('rad').equals(unit(2 * Math.PI / 360, 'rad'))).toBeTruthy()
      expect(unit(1, 'degrees').to('rad').equals(unit(2 * Math.PI / 360, 'rad'))).toBeTruthy()
      expect(unit(1, 'gradian').to('rad').equals(unit(Math.PI / 200, 'rad'))).toBeTruthy()
      expect(unit(1, 'gradians').to('rad').equals(unit(Math.PI / 200, 'rad'))).toBeTruthy()
    })

    test('should have correct long/short prefixes', () => {
      expect(unit(0.02, 'rad').toString()).toEqual('20 mrad')
      expect(unit(0.02, 'radian').toString()).toEqual('20 milliradian')
      expect(unit(0.02, 'radians').toString()).toEqual('20 milliradians')

      expect(unit(0.02, 'grad').toString()).toEqual('2 cgrad')
      expect(unit(0.02, 'gradian').toString()).toEqual('2 centigradian')
      expect(unit(0.02, 'gradians').toString()).toEqual('2 centigradians')
    })
  })

  describe('split', () => {
    test('should split a unit into parts', () => {
      expect(unit(1, 'm').split(['ft', 'in']).join(',')).toEqual('3 ft,3.37007874015748 in')
      expect(unit(-1, 'm').split(['ft', 'in']).join(',')).toEqual('-3 ft,-3.37007874015748 in')
      expect(unit(1, 'm/s').split(['m/s']).join(',')).toEqual('1 m / s')
      expect(unit(1, 'm').split(['ft', 'ft']).join(',')).toEqual('3 ft,0.280839895013124 ft')
      expect(unit(1.23, 'm/s').split([]).join(',')).toEqual('1.23 m / s')
      expect(unit(1, 'm').split(['in', 'ft']).join(',')).toEqual('39 in,0.0308398950131236 ft')
      expect(unit(10, 'km').split(['mi', 'ft', 'in']).join(',')).toEqual('6 mi,1128 ft,4.78740157486361 in')
      expect(unit(1, 'm').split([unit(null, 'ft'), unit(null, 'in')]).join(',')).toEqual('3 ft,3.37007874015748 in')
      expect(unit('51.4934 deg').split(['deg', 'arcmin', 'arcsec']).map(a => a.toString({ precision: 6 })).join(',')).toEqual('51 deg,29 arcmin,36.24 arcsec')
    })

    test('should be resistant to round-off error', () => {
      expect((unit(-12, 'in')).split(['ft', 'in']).join(',')).toEqual('-1 ft,0 in')
      expect((unit(12, 'in')).split(['ft', 'in']).join(',')).toEqual('1 ft,0 in')
      expect((unit(24, 'in')).split(['ft', 'in']).join(',')).toEqual('2 ft,0 in')
      expect((unit(36, 'in')).split(['ft', 'in']).join(',')).toEqual('3 ft,0 in')
      expect((unit(48, 'in')).split(['ft', 'in']).join(',')).toEqual('4 ft,0 in')
      expect((unit(60, 'in')).split(['ft', 'in']).join(',')).toEqual('5 ft,0 in')
      expect((unit(36000, 'in')).split(['ft', 'in']).join(',')).toEqual('3000 ft,0 in')
    })
  })

  describe('toBaseUnits', () => {
    test('should return a clone of the unit', () => {
      const u1 = unit('3 ft')
      const u2 = u1.toBaseUnits()
      expect(u1).not.toBe(u2)
    })

    test('should return the unit in SI units', () => {
      expect(unit('4 ft').toBaseUnits()).toApproximatelyEqual(unit('1.2192 m').to())
      expect(unit('0.111 ft^2').toBaseUnits()).toApproximatelyEqual(unit('0.01031223744 m^2').to())
    })

    test('should return SI units for valueless units', () => {
      expect(unit('ft/minute').toBaseUnits()).toApproximatelyEqual(unit('m / s').to())
    })

    test('alterate api syntax should work too', () => {
      expect(unit.toBaseUnits(unit('4 ft'))).toApproximatelyEqual(unit('1.2192 m').to())
      expect(unit.toBaseUnits('4 ft')).toApproximatelyEqual(unit('1.2192 m').to())
    })

    test('should return SI units for custom units defined from other units', () => {
      let newUnit = configCustomUnits({ foo: '3 kW' })
      expect(newUnit('42 foo').toBaseUnits().format()).toEqual('126000 kg m^2 / s^3')
    })
  })

  describe('custom types', () => {
    describe('configuration', () => {
      test('should throw if failed to include all custom type functions', () => {
        expect(() => unit.config({ type: typeNoPow })).toThrow(/You must supply all required custom type functions/)
      })

      test('should throw if failed to include conditionally required functions', () => {
        expect(() => unit.config({ type: typeNoGt })).toThrow(/The following custom type functions are required when prefix is/)
        expect(() => unit.config({ type: typeNoGt, prefix: 'never' })).not.toThrow()
      })

      test('should throw if attempting to call a method that depends on a custom type function that was not provided', () => {
        let unitDecNoComp = unit.config({ type: typeNoComp, prefix: 'never' })
        let unitDecNoRound = unit.config({ type: typeNoRound })
        expect(() => unitDecNoComp('3 m').equals('4 m')).toThrow(/When using custom types, equals requires a type.eq function/)
        expect(() => unitDecNoComp('3 m').compare('4 m')).toThrow(/When using custom types, compare requires a type.gt and a type.lt function/)
        expect(() => unitDecNoComp('3 m').lessThan('4 m')).toThrow(/When using custom types, lessThan requires a type.lt function/)
        expect(() => unitDecNoComp('3 m').lessThanOrEqual('4 m')).toThrow(/When using custom types, lessThanOrEqual requires a type.le function/)
        expect(() => unitDecNoComp('3 m').greaterThan('4 m')).toThrow(/When using custom types, greaterThan requires a type.gt function/)
        expect(() => unitDecNoComp('3 m').greaterThanOrEqual('4 m')).toThrow(/When using custom types, greaterThanOrEqual requires a type.ge function/)
        expect(() => unitDecNoRound('3 m').split(['ft'], ['in'])).toThrow(/When using custom types, split requires a type.round and a type.trunc function/)
      })
    })

    describe('constructing a unit', () => {
      test('if given a single string, should parse the numeric portion using type.conv', () => {
        let u = unitDec('3.1415926535897932384626433832795 rad')
        expect(u.value).toBeInstanceOf(Decimal)
        expect(u.toString()).toEqual('3.1415926535897932384626433832795 rad')
      })

      test('if given a number, should convert it to custom type', () => {
        expect(unitDec(3.1415, 'rad').value).toBeInstanceOf(Decimal)
      })

      test('should work if given the custom type directly', () => {
        let u = unitDec(new Decimal('3.1415926535897932384626433832795'), 'rad')
        expect(u.toString()).toEqual('3.1415926535897932384626433832795 rad')
        expect(u.value).toBeInstanceOf(Decimal)
      })

      test('should create valueless units', () => {
        let u = unitDec('rad')
        expect(u.toString()).toEqual('rad')
        expect(u.value).toBeNull()
      })
    })

    describe('operations', () => {
      test('should add custom typed units', () => {
        let u1 = unitDec('0.3333333333333333333333 kg/m^3')
        let u2 = unitDec('0.6666666666666666666666 kg/m^3')
        let u3 = u1.add(u2)
        expect(u3.toString()).toEqual('0.9999999999999999999999 kg / m^3')
        expect(u3.value).toBeInstanceOf(Decimal)
      })

      test('should subtract custom typed units', () => {
        let u1 = unitDec('0.3333333333333333333333 kg/m^3')
        let u2 = unitDec('0.6666666666666666666666 kg/m^3')
        let u3 = u1.sub(u2)
        expect(u3.toString()).toEqual('-0.3333333333333333333333 kg / m^3')
        expect(u3.value).toBeInstanceOf(Decimal)
      })

      test('should multiply custom typed units', () => {
        let u1 = unitDec('0.3333333333333333333333 kg/m^3')
        let u2 = unitDec('3 m^3')
        let u3 = u1.mul(u2)
        expect(u3.toString()).toEqual('0.9999999999999999999999 kg')
        expect(u3.value).toBeInstanceOf(Decimal)
      })

      test('should divide custom typed units', () => {
        let u1 = unitDec('1 kg')
        let u2 = unitDec('3 m^3')
        let u3 = u1.div(u2)
        expect(u3.toString()).toEqual('0.33333333333333333333333333333333 kg / m^3') // 32 3's
        expect(u3.value).toBeInstanceOf(Decimal)
      })

      test('should do powers', () => {
        let u1 = unitDec('11 s')
        let u2 = u1.pow(30)
        expect(u2.toString()).toEqual('1.7449402268886407318558803753801e+31 s^30')
        expect(u2.value).toBeInstanceOf(Decimal)
      })

      test('should do sqrt', () => {
        expect(unitDec('64 m^2/s^2').sqrt().format()).toEqual('8 m / s')
        expect(unitDec('2 W').sqrt().format()).toEqual('1.4142135623730950488016887242097 W^0.5')
      })

      test('should do split', () => {
        expect(unitDec(1, 'm').split(['ft', 'in']).join(',')).toEqual('3 ft,3.3700787401574803149606299212595 in')
        expect(unitDec(-1, 'm').split(['ft', 'in']).join(',')).toEqual('-3 ft,-3.3700787401574803149606299212595 in')
        expect(unitDec(1, 'm/s').split(['m/s']).join(',')).toEqual('1 m / s')
        expect(unitDec(1, 'm').split(['ft', 'ft']).join(',')).toEqual('3 ft,0.28083989501312335958005249343829 ft')
        expect(unitDec(1.23, 'm/s').split([]).join(',')).toEqual('1.23 m / s')
        expect(unitDec(1, 'm').split(['in', 'ft']).join(',')).toEqual('39 in,0.03083989501312335958005249343832 ft')
        expect(unitDec(10, 'km').split(['mi', 'ft', 'in']).join(',')).toEqual('6 mi,1128 ft,4.7874015748031496062992125984252 in')
        expect(unitDec(1, 'm').split([unit(null, 'ft'), unit(null, 'in')]).join(',')).toEqual('3 ft,3.3700787401574803149606299212598 in')
        expect(unitDec(100, 'in').split(['ft', 'in']).join(',')).toEqual('8 ft,4 in')
        // TODO: Try redefining deg using a more precise value of pi
        expect(unitDec('51.4934 deg').split(['deg', 'arcmin', 'arcsec']).map(a => a.toString({ precision: 6 })).join(',')).toEqual('51 deg,29 arcmin,36.240000000000072499200000000012 arcsec')
      })

      describe('equals', () => {
        test('should test if two custom typed units are equal', () => {
          expect(unitDec(100, 'cm').equals(unitDec(1, 'm'))).toBeTruthy()
          expect(unitDec(100, 'cm').equals(unitDec(2, 'm'))).toBeFalsy()
          expect(unitDec(100, 'cm').equals(unitDec(1, 'kg'))).toBeFalsy()
          expect(unitDec(100, 'ft lbf').equals(unitDec(1200, 'in lbf'))).toBeTruthy()
          expect(unitDec(100, 'N').equals(unitDec(100, 'kg m / s ^ 2'))).toBeTruthy()
          expect(unitDec(100, 'N').equals(unitDec(100, 'kg m / s'))).toBeFalsy()
          expect(unitDec(100, 'Hz').equals(unitDec(100, 's ^ -1'))).toBeTruthy()
        })

        test('should work with valueless units', () => {
          expect(unitDec('cm').equals(unitDec('cm'))).toBeTruthy()
          expect(unitDec('cm').equals(unitDec('m'))).toBeFalsy()
          expect(unitDec('cm/s').equals(unitDec('cm/s'))).toBeTruthy()
        })

        test('should convert parameter to a unit', () => {
          expect(unitDec(100, 'cm').equals('1 m')).toBeTruthy()
          expect(unitDec('3 kg / kg').equals(3)).toBeTruthy()
        })
      })

      test('should do comparisons', () => {
        expect(unitDec('10 m').lessThan('1 km')).toBeTruthy()
        expect(unitDec('5 km').lessThanOrEqual('500000 cm')).toBeTruthy()
        expect(unitDec('5 N').greaterThan('5 dyne')).toBeTruthy()
        expect(unitDec('10 kg').greaterThanOrEqual('1 kg')).toBeTruthy()
        expect(unitDec('60 min').compare('2 hour')).toEqual(-1)
        expect(unitDec('60 min').compare('1 hour')).toEqual(0)
        expect(unitDec('60 min').compare('0.5 hour')).toEqual(1)
      })

      test('should do setValue', () => {
        expect(unitDec('64 m^2/s^2').setValue(10).format()).toEqual('10 m^2 / s^2')
        expect(unitDec('64 m^2/s^2').setValue('1.4142135623730950488016887242097').format()).toEqual('1.4142135623730950488016887242097 m^2 / s^2')
        expect(unitDec('64 m^2/s^2').setValue(new Decimal('1.4142135623730950488016887242097')).format()).toEqual('1.4142135623730950488016887242097 m^2 / s^2')
      })

      // TODO: Test all other custom functions
    })

    describe('formatting', () => {
      test('should choose the best prefix', () => {
        expect(unitDec('0.000001 m').format(8)).toEqual('1 um')
        expect(unitDec('0.00001 m').format(8)).toEqual('10 um')
        expect(unitDec('0.0001 m').format(8)).toEqual('0.1 mm')
        expect(unitDec('0.0005 m').format(8)).toEqual('0.5 mm')
        expect(unitDec('0.0006 m').toString()).toEqual('0.6 mm')
        expect(unitDec('0.001 m').toString()).toEqual('0.1 cm')
        expect(unitDec('0.01 m').toString()).toEqual('1 cm')
        expect(unitDec('100000 m').toString()).toEqual('100 km')
        expect(unitDec('300000 m').toString()).toEqual('300 km')
        expect(unitDec('500000 m').toString()).toEqual('500 km')
        expect(unitDec('600000 m').toString()).toEqual('600 km')
        expect(unitDec('1000000 m').toString()).toEqual('1000 km')
        expect(unitDec('10000000 m').toString()).toEqual('10000 km')
        expect(unitDec('1232123212321232123212321 m').toString()).toEqual('1.232123212321232123212321e+21 km')
        expect(unitDec('2000 ohm').toString()).toEqual('2 kohm')
      })

      test('should use custom formatter', () => {
        let unitFunny = unit.config({ type: typeFunnyFormat })
        expect(unitFunny('3.14159 rad').toString('$', '_')).toEqual('$9_5_1_4_1_._3 rad')
      })
    })
  })

  describe('built-in units', () => {
    test('us customary liquid units', () => {
      expect(unit('1 cup').to('mL').toString()).toEqual('236.5882365 mL')
      expect(unit('1 cup').to('gallons').toString()).toEqual('0.0625 gallons')
      expect(unit('1 cup').to('quarts').toString()).toEqual('0.25 quarts')
      expect(unit('1 cup').to('pints').toString()).toEqual('0.5 pints')
      expect(unit('1 cup').to('floz').toString()).toEqual('8 floz')
      expect(unit('1 cup').to('tablespoons').toString()).toEqual('16 tablespoons')
      expect(unit('1 cup').to('teaspoons').toString()).toEqual('48 teaspoons')
      expect(unit('1 cup').to('fluiddrams').toString()).toEqual('64 fluiddrams')
    })
  })
})
