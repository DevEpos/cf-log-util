export class CliError extends Error {
  constructor(message, { exitCode = 1, helpText } = {}) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    this.helpText = helpText;
  }
}
