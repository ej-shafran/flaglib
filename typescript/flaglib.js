/**
 * @template T
 * @typedef {{ current: T; }} FlagPointer
 **/

/**
 * @typedef {{ short?: string;
 *    invertable?: boolean;
 * }} SharedOptions
 * @typedef {SharedOptions & {
 *    urgent?: boolean;
 * }} BooleanOptions
 * @typedef {SharedOptions & {
 *    default?: number;
 *    argName?: string;
 *    required?: boolean;
 * }} NumberOptions
 * @typedef {SharedOptions & {
 *    default?: string;
 *    argOptional?: string;
 *    argName?: string;
 *    oneOf?: string[];
 *    required?: boolean;
 * }} StringOptions
 *
 * @typedef {{ long: string; description: string; }} SharedProperties
 * @typedef {{ type: "boolean"; current: boolean | null; } & SharedProperties & BooleanOptions} BooleanFlag
 * @typedef {{ type: "number"; current: number | null; } & SharedProperties & NumberOptions} NumberFlag
 * @typedef {{ type: "string"; current: string | null; } & SharedProperties & StringOptions} StringFlag
 * @typedef {BooleanFlag | NumberFlag | StringFlag} Flag
 **/

/**
 * @param {string} long
 * @param {string} description
 * @param {BooleanOptions} options
 *
 * @returns {FlagPointer<boolean>}
 **/
function boolean(long, description, options = {}) {
  /** @type {BooleanFlag} */
  const flag = {
    ...options,
    long,
    description,
    type: "boolean",
    current: null,
  };

  return /** @type {*} */ (flag);
}

/**
 * @param {string} long
 * @param {string} description
 * @param {StringOptions} options
 *
 * @returns {FlagPointer<string>}
 **/
function string(long, description, options = {}) {
  /** @type {StringFlag} */
  const flag = {
    ...options,
    long,
    description,
    current: null,
    type: "string",
  };

  return /** @type {*} */ (flag);
}

/**
 * @param {string} long
 * @param {string} description
 * @param {NumberOptions} options
 *
 * @returns {FlagPointer<number>}
 **/
function number(long, description, options = {}) {
  /** @type {NumberFlag} */
  const flag = {
    ...options,
    long,
    description,
    current: null,
    type: "number",
  };

  return /** @type {*} */ (flag);
}

/**
 * @enum {number}
 **/
const ParseErrorKind = {
  MISSING_REQUIRED: 1,
  NOT_A_NUMBER: 2,
  NOT_ONE_OF: 3,
  NOT_INVERTABLE: 4,
  UNEXPECTED_ARG: 5,
  MISSING_ARG: 6,
  UNRECOGNIZED_FLAG: 7,
};

/**
 * @typedef {{ message: string; kind: ParseErrorKind; }} ParseError
 **/

/**
 * @enum {number}
 **/
const ArgType = {
  FLAG_LONG: 0,
  FLAG_SHORT: 1,
  POSITIONAL: 2,
  FORCE_FLAG_END: 3,
};

/**
 * @param {string} arg
 * @param {boolean} forceEnd
 *
 * @returns {ArgType}
 **/
function parseArgType(arg, forceEnd) {
  if (forceEnd) return ArgType.POSITIONAL;
  if (arg === "--") return ArgType.FORCE_FLAG_END;
  if (arg.startsWith("--")) return ArgType.FLAG_LONG;
  if (arg[0] === "-") return ArgType.FLAG_SHORT;
  return ArgType.POSITIONAL;
}

/**
 * @param {Flag} flag
 * @param {string} value
 * @param {string} arg
 *
 * @returns {ParseError | null}
 **/
function setFlagValue(flag, value, arg) {
  switch (flag.type) {
    case "number":
      const number = Number(value);
      flag.current = number;
      if (Number.isNaN(number)) {
        return {
          kind: ParseErrorKind.NOT_A_NUMBER,
          message: `the \`${arg}\` flag expects a numerical value`,
        };
      }
      break;
    case "string":
      if (flag.oneOf && !flag.oneOf.includes(value)) {
        return {
          kind: ParseErrorKind.NOT_ONE_OF,
          message: `the \`${arg}\` flag expects one of: ${stringify(
            flag.oneOf,
          )}`,
        };
      }

      flag.current = value;
      break;
    case "boolean":
      return {
        kind: 0,
        message: `the \`${arg}\` flag does not expect an argument`,
      };
  }

  return null;
}

/**
 * @param {ParseError | null} error
 * @param {ParseError | null} newError
 **/
function setError(error, newError) {
  if (newError === null) return error;
  if (error === null) return newError;

  return newError.kind > error.kind ? newError : error;
}

/**
 * @param {string} arg
 * @param {Flag[]} flags
 **/
function parseShortFlag(arg, flags) {
  let error = /** @type {ParseError | null} */ (null);

  for (let i = 0; i < arg.length; i++) {
    const miniflag = arg[i];
    const value = arg.slice(i + 1);

    const validFlag = flags.find((flag) => flag.short === miniflag);

    if (!validFlag) {
      error = setError(error, {
        kind: ParseErrorKind.UNRECOGNIZED_FLAG,
        message: `unrecognized flag - \`${miniflag}\``,
      });
    } else if (validFlag.type === "boolean") {
      validFlag.current = true;
    } else if (value) {
      const newError = setFlagValue(validFlag, value, miniflag);
      return setError(error, newError);
    } else if (
      validFlag.type === "string" &&
      validFlag.argOptional !== undefined
    ) {
      validFlag.current = validFlag.argOptional;
    } else {
      return {
        kind: ParseErrorKind.MISSING_ARG,
        message: `flag \`${arg}\` requires an argument`,
      };
    }
  }

  return error;
}

/**
 * @param {string} flagLong
 * @param {string} arg
 **/
function isInverted(flagLong, arg) {
  return (
    (flagLong.startsWith("no-") && arg === flagLong.slice(3)) ||
    (arg.startsWith("no-") && flagLong === arg.slice(3))
  );
}

/**
 * @param {number} i
 * @param {string[]} argv
 * @param {Flag[]} flags
 *
 * @returns {ParseError | number}
 **/
function parseLongFlag(i, argv, flags) {
  const arg = argv[i].slice(2); // remove "--"

  const eqIndex = arg.indexOf("=");
  if (eqIndex >= 0) {
    const argKey = arg.slice(0, eqIndex);
    const validFlag = flags.find((flag) => flag.long === argKey);

    if (!validFlag) {
      return {
        kind: ParseErrorKind.UNRECOGNIZED_FLAG,
        message: `unrecognized flag - \`${argKey}\``,
      };
    }

    const argValue = arg.slice(eqIndex + 1);
    if (!argValue) {
      return {
        kind: ParseErrorKind.MISSING_ARG,
        message: `flag \`${argKey}\` requires an argument`,
      };
    }

    return setFlagValue(validFlag, argValue, argKey) ?? i;
  }

  let inverted = false;
  const validFlag = flags.find((flag) => {
    if (isInverted(flag.long, arg)) {
      inverted = true;
      return true;
    }

    return flag.long === arg;
  });

  if (!validFlag) {
    return {
      kind: ParseErrorKind.UNRECOGNIZED_FLAG,
      message: `unrecognized flag - \`${arg}\``,
    };
  }

  if (inverted) {
    if (!validFlag.invertable) {
      return {
        kind: ParseErrorKind.NOT_INVERTABLE,
        message: `flag \`${validFlag.long}\` cannot be inverted`,
      };
    } else {
      switch (validFlag.type) {
        case "boolean":
          validFlag.current = false;
          break;
        case "string":
          validFlag.current = "";
          break;
        case "number":
          validFlag.current = 0;
      }
      return i;
    }
  }

  if (validFlag.type === "boolean") {
    validFlag.current = true;
    return i;
  }

  const argValue = argv[++i];
  if (!argValue || parseArgType(argValue, false) !== ArgType.POSITIONAL) {
    if (validFlag.type === "string" && validFlag.argOptional !== undefined) {
      validFlag.current = validFlag.argOptional;
      return i;
    }

    return {
      kind: ParseErrorKind.MISSING_ARG,
      message: `flag \`${arg}\` requires an argument`,
    };
  }

  return setFlagValue(validFlag, argValue, arg) ?? i;
}

/**
 * @param {string[]} argv
 * @param {(string | FlagPointer<unknown>)[]} flags
 **/
function parse(argv, flags) {
  const realFlags = /** @type {Flag[]} */ (
    flags.filter((flag) => typeof flag !== "string")
  );

  let error = /** @type {ParseError | null} */ (null);
  let forceFlagEnd = false;
  /** @type {string[]} */
  const restArgv = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (parseArgType(arg, forceFlagEnd)) {
      case ArgType.FORCE_FLAG_END:
        forceFlagEnd = true;
        break;
      case ArgType.POSITIONAL:
        restArgv.push(arg);
        break;
      case ArgType.FLAG_SHORT:
        const shortFlagError = parseShortFlag(arg.slice(1), realFlags);
        error = setError(error, shortFlagError);
        break;
      case ArgType.FLAG_LONG:
        const longFlagError = parseLongFlag(i, argv, realFlags);
        if (typeof longFlagError === "number") {
          i = longFlagError;
        } else {
          error = setError(error, longFlagError);
        }
        break;
    }
  }

  for (const flag of realFlags) {
    if ("urgent" in flag && flag.urgent && flag.current) {
      return null;
    }

    if (flag.current === null && flag.type !== "boolean") {
      if (flag.required) {
        error = setError(error, {
          kind: ParseErrorKind.MISSING_REQUIRED,
          message: `missing required flag - \`${flag.long}\``,
        });
      } else if (flag.default !== undefined) {
        flag.current = flag.default;
      }
    }
  }

  argv.splice(0, argv.length, ...restArgv);

  if (!error) return null;
  return error.message;
}

/**
 * @param {unknown} value
 * @returns {string}
 **/
function stringify(value) {
  if (value === null) return "N/A";

  if (Array.isArray(value)) {
    return value.map(stringify).join(", ");
  }

  if (typeof value !== "string") return String(value);
  if (value.match(/\s/)) return `"${value}"`;
  return value;
}

const INFO_FLAG_WIDTH = 26;

/**
 * @param {(string | FlagPointer<unknown>)[]} flags
 * @param {{ prefix?: string | number; }} options
 *
 * @returns {string}
 **/
function info(flags, options = { prefix: "" }) {
  /** @type {string} */
  let prefix;
  switch (typeof options.prefix) {
    case "number":
      prefix = " ".repeat(options.prefix);
      break;
    case "undefined":
      prefix = "";
      break;
    default:
      prefix = options.prefix;
      break;
  }

  if (options.prefix === undefined) {
    options.prefix = "";
  }

  const realFlags = /** @type {(Flag | string)[]} */ (flags);
  return /** @type {string} */ (
    realFlags.reduce((acc, cur) => {
      if (typeof cur === "string") return acc + "\n" + cur + "\n";

      let line = `--${cur.long}`;
      if (cur.short) {
        line = `-${cur.short}, ${line}`;
      }

      const argOptional = "argOptional" in cur && cur.argOptional !== undefined;
      if (cur.type !== "boolean") {
        let argName = `<${cur.argName}>`;
        if (argOptional) {
          argName = `[=${argName}]`;
        } else {
          argName = ` ${argName}`;
        }

        line += argName;
      }

      if (line.length >= INFO_FLAG_WIDTH - 1) {
        line += "\n" + prefix + " ".repeat(INFO_FLAG_WIDTH);
      } else {
        line += " ".repeat(INFO_FLAG_WIDTH - line.length);
      }

      line += cur.description;

      if (cur.type === "string" && cur.oneOf) {
        let modes = `\n${prefix}${" ".repeat(INFO_FLAG_WIDTH)}`;
        modes += argOptional ? "Optional m" : "M";
        modes += `odes: ${stringify(cur.oneOf)}.`;
        line += modes;
      }

      if (cur.type !== "boolean" && (cur.default || argOptional)) {
        line += " (Default: ";
        line += argOptional ? cur.argOptional : cur.default;
        line += ")";
      }

      line += "\n";

      return acc + prefix + line;
    }, "")
  );
}

export const flag = {
  boolean,
  string,
  number,
  parse,
  stringify,
  info,
};
