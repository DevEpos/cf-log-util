# cflogs

Transform and filter Cloud Foundry application logs — from a captured log
file or a live `cf logs` stream — into clean JSON or CSV.

## Install

```bash
npm install -g cflogs
```

## Usage

```
cflogs (<input-file> | -a <name>) [-p prop1,prop2] [--all-props] [-i] [-f <expr>] [--recent] [--csv]
```

### Input

| Option | Description |
| --- | --- |
| `<input-file>` | Transform a captured log file (prints a JSON array). |
| `-a <name>` | Run `cf logs <name>` and stream it as NDJSON. Repeatable or comma-separated to merge multiple apps into one stream (adds a synthetic `app` column). |
| `--recent` | Pass through to `cf logs --recent` (no streaming). Requires `-a`. |

### Output shaping

| Option | Description |
| --- | --- |
| `-p <prop,...>` | Include comma-separated additional properties. |
| `--all-props` | Include every property found in each record, after the default properties and `app`. |
| `-i`, `--interactive` | Interactively select which properties (discovered from an input file) to include. |
| `-f <expr>` | Filter log entries using a filter expression (see below). |
| `--csv` | Output as CSV instead of JSON. |

By default the following properties are included:
`logger`, `timestamp`, `level`, `correlation_id`, `msg`, `stacktrace`.

### Filter expressions

```
=  >  <  contains  startswith  endswith
```

Combine comparisons with `and`, `or`, and parentheses `( )`. String values are
single-quoted; `contains`/`startswith`/`endswith` are case-insensitive.

## Examples

```bash
cflogs logs.json -p thread,request_id
cflogs logs.json --all-props
cflogs logs.json --interactive
cflogs logs.json -f "logger = 'myapp'"
cflogs logs.json -f "logger = '4' or logger = '10'"
cflogs logs.json -f "(logger = '4' or msg contains '40') and correlation_id = '439034'"
cflogs logs.json --csv
cflogs -a my-app -f "level = 'ERROR'"
cflogs -a my-app --recent
cflogs -a app1,app2 -f "level = 'ERROR'"
```

## Requirements

- Node.js >= 18
- The [Cloud Foundry CLI](https://github.com/cloudfoundry/cli) (`cf`) on your
  `PATH`, and logged in, when using `-a <name>` to stream live logs.

## Development

```bash
npm install
npm test
```

The codebase is split into small, independently testable modules under `src/lib`:

- `filter.js` — the `-f` filter expression tokenizer/parser/evaluator
- `args.js` — CLI argument parsing (throws `CliError` on invalid input)
- `log-processing.js` — extracting/transforming JSON log records
- `output.js` — JSON/CSV output formatting
- `interactive.js` — the `-i` interactive property selector
- `cf-stream.js` — spawning and merging `cf logs` child processes

`src/cli.js` wires these together; `bin/cflogs.js` is the published executable.

## License

[MIT](LICENSE)
