import path from "path";

import { flag } from "../flaglib.js";

const help = flag.boolean("help", "Print this help information and exit.", {
  short: "h",
  urgent: true,
});
const version = flag.boolean("version", "Print version information and exit.", {
  short: "V",
  urgent: true,
});
const verbose = flag.boolean("verbose", "Print extra debugging information.", {
  short: "v",
  invertable: true,
});

const count = flag.number("count", "The amount of times to greet the user.", {
  short: "c",
  default: 1,
  argName: "amount",
});
const color = flag.string("color", "Use colors when greeting.", {
  default: "auto",
  argOptional: "always",
  oneOf: ["always", "never", "auto"],
  invertable: true,
  argName: "when",
});
const prefix = flag.string("prefix", "Prefix the greeting (with something).", {
  short: "p",
  argOptional: "Hello",
  argName: "greeting",
});

const age = flag.number("age", "The age of the user, in years.", {
  short: "a",
  required: true,
  argName: "years",
});
const lastName = flag.string("last-name", "The last name of the user.", {
  required: true,
  argName: "name",
});

const flags = [
  help,
  version,
  verbose,
  "Customization options",
  count,
  color,
  prefix,
  "User details",
  age,
  lastName,
];

const scriptName = path.basename(process.argv[1]);
const args = process.argv.slice(2);

const error = flag.parse(args, flags);

if (error !== null) {
  console.error(error);
  process.exit(1);
}

if (help.current) {
  console.log(`usage: ./${scriptName} [<options>] [--] <name>...\n`);
  console.log(flag.info(flags, { prefix: 4 }));
  process.exit(0);
}

if (version.current) {
  console.log(`${scriptName} - v1.0.0`);
  process.exit(0);
}

if (args.length < 1) {
  console.error("missing required positional argument - <name>");
  process.exit(1);
}

/**
 * @param {unknown} str
 * @returns {string}
 **/
const yellow = (str) => {
  // handles `--no-color`
  if (color.current === "") color.current = "never";

  if (color.current === "never") return String(str);

  const colored = `\x1b[33m${str}\x1b[0m`;
  if (color.current === "always") return colored;

  return process.stdin.isTTY ? colored : String(str);
};

/**
 * @param {string} msg
 **/
function debug(msg) {
  if (verbose.current) {
    console.log(`[ ${yellow("DEBUG")} ] ${msg}`);
  }
}

const name = args.join(" ");

debug("configuration:");
debug(`\tcount = ${flag.stringify(count.current)}`);
debug(`\tcolor = ${flag.stringify(color.current)}`);
debug(`\tprefix = ${flag.stringify(prefix.current)}`);
debug(`\tage = ${flag.stringify(age.current)}`);
debug(`\tlast-name = ${flag.stringify(lastName.current)}`);
debug(`\tname = ${flag.stringify(name)}`)

debug("starting loop...");
for (let i = 0; i < count.current; i++) {
  debug(`i = ${i}`);

  let line = `${name} ${lastName.current}`;
  line = yellow(line);
  if (prefix.current) {
    line = `${prefix.current}, ${line}!`;
  } else {
    line += " -";
  }
  line += ` You are ${yellow(age.current)} years old!`;

  console.log(line);
}
