# flaglib

This project is a basic, copy-and-paste-able CLI flag parsing library implemented in a myriad of languages.

## Reading This Document

TODO

## General API

Each version of `flaglib` shares a general API, which is only slightly changed when the language demands it.

### Flag Types

There are three types of flags which can be defined:
- A boolean flag, which can be `true` if the flag is present or `false` if it isn't
    - i.e. `./bin --verbose`, specifies that the script should be run in verbose mode
- A string flag, which consumes the next argument as its value
    - i.e. `./bin --prefix ~/.local`, configures the prefix with which the script should be run
- A numeric flag, which consumes the next argument and parses it as a number
    - i.e. `./bin --jobs 3`, configures the amount of jobs the script should run with

### Defining Flags

Each of the three [flag types](#flag-types) can be defined by calling a function from the API. This function is specific to the flag's type, but all three share some similarities. These functions are referred to as "flag-defining functions".

#### Shared Required Parameters

Each flag-defining function requires passing in a `long ` parameter and a `description` parameter.

##### `long`

Type: string.

The long form of the flag, which is a multi-character string that can be prefixed with `--` on the command line to specify this flag.
The parameter should _not_ be prefixed with a `--` as this is done automatically.
This parameter should be a series of lowercase alphabetic characters separated by dashes ("kebab-case").

##### `description`

Type: string.

A short description of the flag's effect on the program.
This parameter should be capitalized, only a couple sentences long at most, and end with a period.

#### Shared Optional Parameters

Each flag-defining function also accepts passing in a `short` parameter.

##### `short`

Type: character.

The short form of the flag, which is a single character that can be prefixed with `-` on the command line to specify this flag. Short flags can also be bundled together, as in combining `-a` and `-b` into `-ab`.
This parameter should be single alphabetic character.

#### Boolean Options

The boolean flag-defining function accepts the following options:
- `urgent`
- `invertable`

##### `urgent`

Type: boolean.

When `true`, the flag will immediately halt parsing when it is reached.
This is mainly for flags like `--help` and `--version`, which should override all parsing errors and execute some unique code when present.

##### `invertable`

Type: boolean.

When `true`, the flag's value can be set to `false` using a `--no-` prefix to its long form.


#### String Options

The string flag-defining function accepts the following options:
- `default`
- `arg-name`
- `arg-optional`
- `one-of`
- `required`
- `invertable`

##### `default`

Type: string.

The default value for the flag, which should be used in case the flag isn't specified on the command line.
Cannot be used alongside `required`.

##### `arg-name`

Type: string.

The name displayed in help information for the flag's argument. When set to an empty string, nothing will be displayed.
If `arg-optional` is not set, this name will be displayed like ` <name>`. Otherwise, the name will be displayed like `[=<name>]`.

##### `arg-optional`

Type: string.

The default value which should be used if just the flag is specified without any argument. Unless this is set, not passing the flag's argument is a parsing error.

##### `one-of`

Type: string list.

An enumeration of the possible values for the flag's argument. Any other value will result in a parsing error.

##### `required`

Type: boolean.

When `true`, the flag being missing will result in a parsing error.

##### `invertable`

Type: boolean.

When `true`, the flag's value can be set to an empty string using a `--no-` prefix to its long form.

#### Number Options

The number flag-defining function accepts the following options:
- `default`
- `arg-name`
- `arg-optional`
- `required`
- `invertable`

##### `default`

Type: number.

The default value for the flag, which should be used in case the flag isn't specified on the command line.
Cannot be used alongside `required`.

##### `arg-name`

Type: string.

The name displayed in help information for the flag's argument. When set to an empty string, nothing will be displayed.
If `arg-optional` is not set, this name will be displayed like ` <name>`. Otherwise, the name will be displayed like `[=<name>]`.

##### `arg-optional`

Type: number.

The default value which should be used if just the flag is specified without any argument. Unless this is set, not passing the flag's argument is a parsing error.

##### `required`

Type: boolean.

When `true`, the flag being missing will result in a parsing error.

##### `invertable`

Type: boolean.

When `true`, the flag's value can be set to `0` using a `--no-` prefix to its long form.


## Examples

TODO

## Contributing

TODO
