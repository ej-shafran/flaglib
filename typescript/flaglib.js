/**
 * @template T
 * @typedef {{ value: T; }} FlagPointer
 **/

/**
 * @typedef {{
 *    short?: string;
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
 * @typedef {{ type: "boolean"; value: boolean | null; } & SharedProperties & BooleanOptions} BooleanFlag
 * @typedef {{ type: "number"; value: number | null; } & SharedProperties & NumberOptions} NumberFlag
 * @typedef {{ type: "string"; value: string | null; } & SharedProperties & StringOptions} StringFlag
 * @typedef {BooleanFlag | NumberFlag | StringFlag} Flag
 **/

/**
 * @enum {number} the possible error codes which can be returned from parsing flags
 *
 * The value of each key is used internally to determine the priority of the error.
 **/
export const ErrorKind = {
  MISSING_REQUIRED: 1,
  NOT_A_NUMBER: 2,
  NOT_ONE_OF: 3,
  NOT_INVERTABLE: 4,
  UNEXPECTED_ARG: 5,
  MISSING_ARG: 6,
  UNRECOGNIZED_FLAG: 7,
};

class ParserError {
  /**
   * @param {ErrorKind} kind
   * @param {string} arg
   * @param {string|undefined} morearg
   **/
  constructor(kind, arg, morearg = undefined) {
    this.kind = kind;

    switch (this.kind) {
      case ErrorKind.MISSING_REQUIRED:
        this.message = `missing required flag - \`${arg}\``;
        break;
      case ErrorKind.NOT_A_NUMBER:
        this.message = `the \`${arg}\` flag expects a numerical value`;
        break;
      case ErrorKind.NOT_ONE_OF:
        this.message = `the \`${arg}\` flag expects one of: ${morearg}`;
        break;
      case ErrorKind.NOT_INVERTABLE:
        this.message = `the \`${arg}\` flag cannot be inverted`;
        break;
      case ErrorKind.UNEXPECTED_ARG:
        this.message = `the \`${arg}\` flag does not expect an argument`;
        break;
      case ErrorKind.MISSING_ARG:
        this.message = `the \`${arg}\` flag expects an argument`;
        break;
      case ErrorKind.UNRECOGNIZED_FLAG:
        this.message = `unrecognized flag - \`${arg}\``;
        break;
    }
  }
}

/**
 * @enum {number} different possible types of CLI arguments
 **/
const ArgType = {
  /**
   * A long flag, beggining with `"--"`
   **/
  FLAG_LONG: 0,
  /**
   * A short flag or bunching of short flags, beginning with `"-"`.
   **/
  FLAG_SHORT: 1,
  /**
   * A positional argument.
   **/
  POSITIONAL: 2,
  /**
   * A literal `"--"`, used to specify that everything from this point onwards is a positional argument.
   **/
  FORCE_FLAG_END: 3,
};

/**
 * Check what type of argument a certain CLI arg is.
 *
 * @param {string} arg the CLI argument to parse
 * @param {boolean} forceEnd whether a `"--"` has already been parsed
 *
 * @returns {ArgType}
 **/
function parseArgType(arg, forceEnd = false) {
  if (forceEnd) return ArgType.POSITIONAL;
  if (arg === "--") return ArgType.FORCE_FLAG_END;
  if (arg.startsWith("--")) return ArgType.FLAG_LONG;
  if (arg[0] === "-") return ArgType.FLAG_SHORT;
  return ArgType.POSITIONAL;
}

/**
 * Given a flag and the parsed value (either after a `=`, a "touching" value after a short flag, or the next argument), set that flag's value, checking for any errors.
 *
 * @param {Flag} flag
 * @param {string} value
 * @param {string} arg
 *
 * @returns {ParserError | null}
 **/
function setFlagValue(flag, value, arg) {
  switch (flag.type) {
    case "number":
      const number = Number(value);
      flag.value = number;
      if (Number.isNaN(number))
        return new ParserError(ErrorKind.NOT_A_NUMBER, arg);
      break;
    case "string":
      flag.value = value;
      if (flag.oneOf && !flag.oneOf.includes(value)) {
        const options = stringify(flag.oneOf);
        return new ParserError(ErrorKind.NOT_ONE_OF, arg, options);
      }
      break;
    case "boolean":
      return new ParserError(ErrorKind.UNEXPECTED_ARG, arg);
  }

  return null;
}

/**
 * @param {ParserError | null} error
 * @param {ParserError | null} newError
 **/
function setError(error, newError) {
  if (newError === null) return error;
  if (error === null) return newError;

  return newError.kind > error.kind ? newError : error;
}

/**
 * @param {number} argPos
 * @param {string[]} args
 * @param {Flag[]} flags
 *
 * @returns {ParserError|number} either an error parsing the short-flag bunch, or the index in the arguments to end up at
 **/
function parseShortFlag(argPos, args, flags) {
  const arg = args[argPos].slice(1);

  for (let i = 0; i < arg.length; i++) {
    const shortFlag = arg[i];
    const validFlag = flags.find((flag) => flag.short === shortFlag);

    if (!validFlag)
      return new ParserError(ErrorKind.UNRECOGNIZED_FLAG, shortFlag);

    if (validFlag.type === "boolean") {
      validFlag.value = true;
      continue;
    }

    const bunchValue = arg.slice(i + 1);
    if (bunchValue)
      return setFlagValue(validFlag, bunchValue, shortFlag) ?? argPos;

    const argValue = args[argPos + 1];
    if (argValue && parseArgType(argValue) === ArgType.POSITIONAL)
      return setFlagValue(validFlag, bunchValue, shortFlag) ?? argPos + 1;

    if (validFlag.type === "string" && validFlag.argOptional !== undefined) {
      validFlag.value = validFlag.argOptional;
      return argPos;
    }

    return new ParserError(ErrorKind.MISSING_ARG, arg);
  }

  return argPos;
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
 * @param {number} argPos
 * @param {string[]} argv
 * @param {Flag[]} flags
 *
 * @returns {ParserError | number}
 **/
function parseLongFlag(argPos, argv, flags) {
  const arg = argv[argPos].slice(2); // remove "--"

  const eqIndex = arg.indexOf("=");
  if (eqIndex >= 0) {
    const argKey = arg.slice(0, eqIndex);
    const validFlag = flags.find((flag) => flag.long === argKey);
    if (!validFlag) return new ParserError(ErrorKind.UNRECOGNIZED_FLAG, argKey);

    const argValue = arg.slice(eqIndex + 1);
    if (!argValue) return new ParserError(ErrorKind.MISSING_ARG, argKey);

    return setFlagValue(validFlag, argValue, argKey) ?? argPos;
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
    return new ParserError(ErrorKind.UNRECOGNIZED_FLAG, arg);
  }

  if (inverted) {
    if (!validFlag.invertable) {
      return new ParserError(ErrorKind.NOT_INVERTABLE, validFlag.long);
    } else {
      switch (validFlag.type) {
        case "boolean":
          validFlag.value = false;
          break;
        case "string":
          validFlag.value = "";
          break;
        case "number":
          validFlag.value = 0;
          break;
      }
      return argPos;
    }
  }

  if (validFlag.type === "boolean") {
    validFlag.value = true;
    return argPos;
  }

  const argValue = argv[++argPos];
  if (!argValue || parseArgType(argValue) !== ArgType.POSITIONAL) {
    if (validFlag.type === "string" && validFlag.argOptional !== undefined) {
      validFlag.value = validFlag.argOptional;
      return argPos;
    }

    return new ParserError(ErrorKind.MISSING_ARG, arg);
  }

  return setFlagValue(validFlag, argValue, arg) ?? argPos;
}

/**
 * @param {string[]} argv
 * @param {(string | FlagPointer<unknown>)[]} flags
 **/
function parse(argv, flags) {
  const realFlags = /** @type {Flag[]} */ (
    flags.filter((flag) => typeof flag !== "string")
  );

  let error = /** @type {ParserError | null} */ (null);
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
        const shortFlagError = parseShortFlag(i, argv, realFlags);
        if (typeof shortFlagError === "number") {
          i = shortFlagError;
        } else {
          error = setError(error, shortFlagError);
        }
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
    if ("urgent" in flag && flag.urgent && flag.value) return null;

    if (flag.value === null && flag.type !== "boolean") {
      if (flag.required) {
        error = setError(
          error,
          new ParserError(ErrorKind.MISSING_REQUIRED, flag.long),
        );
      } else if (flag.default !== undefined) {
        flag.value = flag.default;
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
  if (Array.isArray(value)) return value.map(stringify).join(", ");
  if (typeof value !== "string") return String(value);
  if (value.match(/\s/)) return `"${value}"`;
  return value;
}

const INFO_FLAG_WIDTH = 26;

/**
 * @param {FlagPointer<unknown> | string} flag
 * @param {string} prefix
 **/
function flagInfo(flag, prefix) {
  const widthString = prefix + " ".repeat(INFO_FLAG_WIDTH);

  const realFlag = /** @type {Flag} */ (flag);

  if (typeof realFlag === "string") return `\n${realFlag}`;

  const argOptional =
    "argOptional" in realFlag && realFlag.argOptional !== undefined;

  let line = `--${realFlag.long}`;

  if (realFlag.short) {
    line = `-${realFlag.short}, ${line}`;
  }

  if (realFlag.type !== "boolean") {
    const argName = realFlag.argName ?? "arg";
    line += argOptional ? `[=<${argName}>]` : ` <${argName}>`;
  }

  line +=
    line.length >= INFO_FLAG_WIDTH - 1
      ? `\n${widthString}`
      : " ".repeat(INFO_FLAG_WIDTH - line.length);

  line += realFlag.description;

  if (realFlag.type === "string" && realFlag.oneOf) {
    line += `\n${widthString}${argOptional ? "Optional m" : "M"}odes: `;
    line += stringify(realFlag.oneOf);
  }

  if (realFlag.type !== "boolean" && (realFlag.default || argOptional)) {
    line += ` (Default: ${
      argOptional ? realFlag.argOptional : realFlag.default
    })`;
  }

  return prefix + line;
}

/**
 * @param {(string | FlagPointer<unknown>)[]} flags
 * @param {{ prefix?: string | number; }} options
 *
 * @returns {string}
 **/
function info(flags, options = { prefix: "" }) {
  const prefix =
    typeof options?.prefix === "number"
      ? " ".repeat(options.prefix)
      : options?.prefix ?? "";

  return flags.map((flag) => flagInfo(flag, prefix)).join("\n");
}

/**
 * Defines a boolean flag.
 *
 * @param {string} long the long form of the flag
 * @param {string} description a short description of the flag's effect on the program
 * @param {BooleanOptions} options additional options for configuring the flag's behavior
 *
 * @returns {FlagPointer<boolean>} a "pointer" to the parsed value which is populated by `flag.parse`
 **/
function boolean(long, description, options = {}) {
  /** @type {BooleanFlag} */
  const flag = {
    ...options,
    long,
    description,
    type: "boolean",
    value: null,
  };

  return /** @type {*} */ (flag);
}

/**
 * Defines a string flag.
 *
 * @param {string} long the long form of the flag
 * @param {string} description a short description of the flag's effect on the program
 * @param {StringOptions} options additional options for configuring the flag's behavior
 *
 * @returns {FlagPointer<string>} a "pointer" to the parsed value which is populated by `flag.parse`
 **/
function string(long, description, options = {}) {
  /** @type {StringFlag} */
  const flag = {
    ...options,
    long,
    description,
    value: null,
    type: "string",
  };

  return /** @type {*} */ (flag);
}

/**
 * Defines a number flag.
 *
 * @param {string} long the long form of the flag
 * @param {string} description a short description of the flag's effect on the program
 * @param {NumberOptions} options additional options for configuring the flag's behavior
 *
 * @returns {FlagPointer<number>} a "pointer" to the parsed value which is populated by `flag.parse`
 **/
function number(long, description, options = {}) {
  /** @type {NumberFlag} */
  const flag = {
    ...options,
    long,
    description,
    value: null,
    type: "number",
  };

  return /** @type {*} */ (flag);
}

export const flag = {
  boolean,
  string,
  number,
  parse,
  stringify,
  info,
};
