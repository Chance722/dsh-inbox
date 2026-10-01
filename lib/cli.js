#!/usr/bin/env node

// src/cli.ts
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
var PACKAGE_NAME = "@chance722/dsh-inbox";
var PRESET_ROW = `
# dsh-inbox: the vault's conversation tools (inbox_search / inbox_get).
- id: dsh-inbox
  name: '${PACKAGE_NAME}'
`;
var PRESET_ROW_PATTERN = /(^[ \t]*-[ \t]*id:[ \t]*dsh-inbox[ \t]*\r?\n[ \t]*name:[ \t]*['"]?)([^'"\r\n]+)(['"]?[ \t]*$)/m;
function ensurePresetRow(body) {
  const row = PRESET_ROW_PATTERN.exec(body);
  if (row === null) {
    return { body: `${body.replace(/\s*$/, "")}
${PRESET_ROW}`, change: "added" };
  }
  const from = (row[2] ?? "").trim();
  if (from === PACKAGE_NAME) return { body, change: "unchanged" };
  return { body: body.replace(PRESET_ROW_PATTERN, `$1${PACKAGE_NAME}$3`), change: "renamed", from };
}
function usage() {
  return `dsh-inbox init \u2014\u2014 \u628A inbox \u88C5\u8FDB\u4E00\u4E2A dsh profile\uFF0C\u5E76\u8BA9\u52A9\u624B\u770B\u5F97\u89C1\u5B83\u7684\u5DE5\u5177

\u7528\u6CD5\uFF1A
  dsh-inbox init [\u9009\u9879]

\u9009\u9879\uFF1A
  --profile <\u540D\u5B57>   \u88C5\u8FDB\u54EA\u4E2A dsh profile\uFF1B\u4E0D\u7ED9\u5C31\u81EA\u5DF1\u6311\uFF1A\u4F18\u5148\u4F60\u5DF2\u6709\u7684 web\uFF0C
                     \u5176\u6B21\u8FD9\u53F0\u673A\u5668\u4E0A\u552F\u4E00\u7684\u90A3\u4E2A\uFF08\u6311\u4E0D\u51FA\u6765\u4F1A\u62A5\u9519\u5E76\u544A\u8BC9\u4F60\u600E\u4E48\u8BF4\uFF09
  --create-profile   profile \u4E0D\u5B58\u5728\u65F6\u7528 dsh \u81EA\u5E26\u7684 web \u6A21\u677F\u5EFA\u4E00\u4E2A\uFF08\u9ED8\u8BA4\u4E0D\u5F00\uFF09
  --preset <id>      agent preset \u7684 id\uFF0C\u9ED8\u8BA4 inbox
  --package <\u6765\u6E90>   \u63D2\u4EF6\u6765\u6E90\uFF0C\u9ED8\u8BA4 ${PACKAGE_NAME}\uFF08\u672C\u5730\u5F00\u53D1\u4F20\u4ED3\u5E93\u8DEF\u5F84\uFF09
  --install-pnpm     PATH \u4E0A\u6CA1\u6709 pnpm \u65F6\u66FF\u4F60\u88C5\uFF08\u5148 npm i -g pnpm\uFF0C\u4E0D\u884C\u518D\u8BD5 corepack\uFF09
  --no-default       \u4E0D\u628A\u9ED8\u8BA4 preset \u6307\u8FC7\u53BB\uFF08\u53EA\u88C5\uFF0C\u4E0D\u6539 dsh \u7684\u9ED8\u8BA4\u9009\u62E9\uFF09
  --help             \u8FD9\u4EFD\u8BF4\u660E

\u505A\u4E09\u4EF6\u4E8B\uFF1A\u2460 \u628A\u63D2\u4EF6\u88C5\u8FDB profile\uFF1B\u2461 \u590D\u5236 standard preset \u5230
<DSH_HOME>/.agent-presets/<id> \u5E76\u8FFD\u52A0\u672C\u63D2\u4EF6\uFF1B\u2462 \u628A\u7528\u6237\u7EA7\u9ED8\u8BA4 preset \u6307\u5411\u5B83\u3002
dsh 0.2 \u8D77 preset \u6362\u4E86\u8F7D\u4F53\uFF08\u76EE\u5F55\u4E0D\u518D\u88AB\u8BFB\uFF09\uFF0C\u2461\u2462 \u81EA\u52A8\u8DF3\u8FC7\u2014\u2014\u90A3\u4E00\u7248\u4E0D\u9700\u8981\u5B83\u4EEC\u3002
\u91CD\u590D\u8FD0\u884C\u662F\u5B89\u5168\u7684\uFF1A\u5DF2\u7ECF\u505A\u8FC7\u7684\u4E0D\u4F1A\u91CD\u590D\u505A\u3002`;
}
function parse(argv) {
  const options = {
    profile: void 0,
    preset: "",
    source: PACKAGE_NAME,
    defaultPreset: true,
    createProfile: false,
    installPnpm: false
  };
  const rest = argv[0] === "init" ? argv.slice(1) : argv;
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = () => {
      const next = rest[index + 1];
      if (next === void 0 || next.startsWith("--")) {
        throw new Error(`${String(flag)} \u9700\u8981\u4E00\u4E2A\u503C`);
      }
      index += 1;
      return next;
    };
    if (flag === "--help" || flag === "-h") return void 0;
    else if (flag === "--profile") options.profile = value();
    else if (flag === "--preset") options.preset = value();
    else if (flag === "--package") options.source = value();
    else if (flag === "--no-default") options.defaultPreset = false;
    else if (flag === "--create-profile") options.createProfile = true;
    else if (flag === "--install-pnpm") options.installPnpm = true;
    else throw new Error(`\u770B\u4E0D\u61C2\u7684\u9009\u9879\uFF1A${String(flag)}`);
  }
  if (options.preset.length === 0) options.preset = "inbox";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(options.preset)) {
    throw new Error(`preset id \u53EA\u80FD\u7528\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u8FDE\u5B57\u7B26\uFF1A${options.preset}`);
  }
  return options;
}
function listProfiles(home) {
  const root = join(home, "profiles");
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name);
  } catch {
    return [];
  }
  return entries.filter((name) => existsSync(join(root, name, "package.json"))).sort();
}
function chooseProfile(options, existing) {
  if (options.profile !== void 0 && options.profile.length > 0) {
    return { kind: "use", profile: options.profile, label: "" };
  }
  if (existing.includes("web")) {
    return { kind: "use", profile: "web", label: "\u4F60\u65E5\u5E38 `dsh web` \u7528\u7684\u90A3\u4E2A" };
  }
  const only = existing[0];
  if (existing.length === 1 && only !== void 0) {
    return { kind: "use", profile: only, label: "\u8FD9\u53F0\u673A\u5668\u4E0A\u552F\u4E00\u7684 profile" };
  }
  if (existing.length === 0) {
    if (options.createProfile) {
      return { kind: "use", profile: "web", label: "\u8FD8\u6CA1\u6709 profile\uFF0C\u8FD9\u4E2A\u7528 dsh \u81EA\u5E26\u7684 web \u6A21\u677F\u65B0\u5EFA" };
    }
    return {
      kind: "refuse",
      message: "\u8FD9\u53F0\u673A\u5668\u4E0A\u8FD8\u6CA1\u6709\u4EFB\u4F55 dsh profile\u3002\n\u5148\u8DD1\u4E00\u6B21 `dsh web`\uFF08\u5B83\u4F1A\u5EFA\u597D\u9ED8\u8BA4 profile\uFF09\uFF0C\u6216\u8005\u91CD\u8DD1\u65F6\u52A0\u4E0A --create-profile \u8BA9\u8FD9\u4E00\u6B65\u81EA\u5DF1\u53D1\u751F\u3002\n"
    };
  }
  return {
    kind: "refuse",
    message: `\u6709\u591A\u4E2A profile\uFF0C\u4F46\u6CA1\u627E\u5230 web\uFF1A${existing.join("\u3001")}\u3002
\u7528 --profile <\u540D\u5B57> \u8BF4\u660E\u88C5\u8FDB\u54EA\u4E00\u4E2A\u3002
`
  };
}
function isEntryPoint(moduleUrl, entry) {
  if (entry === void 0 || entry.length === 0) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(entry);
  } catch {
    return false;
  }
}
function dshHome() {
  const configured = process.env.DSH_HOME;
  return configured !== void 0 && configured.length > 0 ? configured : join(homedir(), ".dsh");
}
function shippedStandard(home, profileDir) {
  const candidates = [];
  const roster = (moduleRoot) => join(moduleRoot, "@deepseek-ai", "dsh-agent-presets");
  const nestedRoster = (moduleRoot) => join(moduleRoot, "@deepseek-ai", "dsh", "node_modules", "@deepseek-ai", "dsh-agent-presets");
  try {
    const require2 = createRequire(join(profileDir, "package.json"));
    candidates.push(dirname(require2.resolve("@deepseek-ai/dsh-agent-presets/package.json")));
  } catch {
  }
  candidates.push(
    roster(join(profileDir, "node_modules")),
    nestedRoster(join(profileDir, "node_modules")),
    roster(join(home, "profiles", "node_modules")),
    nestedRoster(join(home, "profiles", "node_modules"))
  );
  for (const prefix of dshPrefixes()) {
    candidates.push(nestedRoster(join(prefix, "node_modules")), roster(join(prefix, "node_modules")));
  }
  for (const candidate of candidates) {
    const standard = join(candidate, "presets", "standard");
    if (existsSync(join(standard, "agent.cordis.yml"))) return standard;
  }
  return void 0;
}
function dshPrefixes() {
  const found = spawnSync(process.platform === "win32" ? "where" : "which", ["dsh"], {
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  const prefixes = [];
  for (const line of (found.stdout ?? "").split(/\r?\n/)) {
    const bin = line.trim();
    if (bin.length > 0) prefixes.push(dirname(bin));
  }
  return prefixes;
}
function presetMechanism(version) {
  const match = /(\d+)\.(\d+)\./.exec(version ?? "");
  if (match === null) return "unknown";
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major > 0) return "declaration";
  return minor >= 2 ? "declaration" : "directory";
}
function dshVersion() {
  const probe = spawnSync("dsh", ["--version"], {
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  if (probe.error !== void 0 || probe.status !== 0) return void 0;
  return `${probe.stdout ?? ""}${probe.stderr ?? ""}`;
}
function setDefaultPreset(settingsPath, id) {
  const original = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : "";
  const commit = (next, note) => {
    if (next === original) return "\u9ED8\u8BA4 preset \u5DF2\u7ECF\u662F\u5B83\uFF0C\u6CA1\u6539";
    if (original.length > 0) writeFileSync(`${settingsPath}.bak-${String(Date.now())}`, original, "utf8");
    writeFileSync(settingsPath, next, "utf8");
    return note;
  };
  const lines = original.split(/\r?\n/);
  const head = lines.findIndex((line) => /^agent-presets:\s*$/.test(line));
  if (head === -1) {
    const block = `agent-presets:
  default: ${id}
`;
    const body = original.length === 0 ? block : `${original.replace(/\s*$/, "")}
${block}`;
    mkdirSync(dirname(settingsPath), { recursive: true });
    return commit(body, original.length === 0 ? "\u65B0\u5EFA\u4E86 settings.yaml" : `\u8FFD\u52A0\u4E86 agent-presets.default: ${id}`);
  }
  let end = lines.length;
  for (let index = head + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.length > 0 && !/^\s/.test(line)) {
      end = index;
      break;
    }
  }
  const before = lines.slice(0, end);
  const after = lines.slice(end);
  const defaultAt = before.findIndex((line, index) => index > head && /^\s+default:/.test(line));
  if (defaultAt !== -1) before[defaultAt] = `  default: ${id}`;
  else before.push(`  default: ${id}`);
  return commit([...before, ...after].join("\n"), `\u628A agent-presets.default \u6539\u6210 ${id}`);
}
function main(argv) {
  let options;
  try {
    const parsed = parse(argv);
    if (parsed === void 0) {
      process.stdout.write(`${usage()}
`);
      return 0;
    }
    options = parsed;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}

`);
    process.stderr.write(`${usage()}
`);
    return 2;
  }
  const home = dshHome();
  const choice = chooseProfile(options, listProfiles(home));
  if (choice.kind === "refuse") {
    process.stderr.write(choice.message);
    return 1;
  }
  const profile = choice.profile;
  const chosen = choice.label.length === 0 ? "" : `\uFF08${choice.label}\uFF09`;
  const profileDir = join(home, "profiles", profile);
  if (!hasPnpm()) {
    if (!options.installPnpm) {
      process.stderr.write(missingPnpmMessage(profile, options.source));
      return 1;
    }
    process.stdout.write("\xB7 PATH \u4E0A\u6CA1\u6709 pnpm\uFF0C\u5148\u88C5\u4E00\u4E2A\uFF08--install-pnpm\uFF09\u2026\n");
    if (!installPnpm()) {
      process.stderr.write(missingPnpmMessage(profile, options.source));
      return 1;
    }
    process.stdout.write("   pnpm \u88C5\u597D\u4E86\n");
  }
  if (!existsSync(join(profileDir, "package.json"))) {
    const hint = `\u5148\u5EFA\u4E00\u4E2A\uFF1Adsh --profile ${profile} --from-default-profile web --dump-config
\uFF08profile \u540D\u662F dsh \u81EA\u5E26\u6A21\u677F\u65F6\u7528\uFF1Adsh --profile ${profile} --dump-config\uFF09
\uFF08\u6216\u8005\u91CD\u8DD1\u65F6\u52A0\u4E0A --create-profile\uFF0C\u8BA9\u8FD9\u4E00\u6B65\u81EA\u5DF1\u53D1\u751F\uFF09
`;
    if (!options.createProfile) {
      process.stderr.write(`\u627E\u4E0D\u5230 profile \u300C${profile}\u300D\uFF08${profileDir}\uFF09\u3002
${hint}`);
      return 1;
    }
    process.stdout.write(`\u24EA profile \u300C${profile}\u300D\u4E0D\u5B58\u5728\uFF0C\u7528 dsh \u81EA\u5E26\u7684\u6A21\u677F\u5EFA\u4E00\u4E2A\u2026
`);
    const created = createProfile(profile);
    if (!created.ok || !existsSync(join(profileDir, "package.json"))) {
      if (created.output.trim().length > 0) process.stderr.write(`${created.output.trimEnd()}
`);
      process.stderr.write(`\u5EFA profile \u5931\u8D25\u3002
${hint}`);
      return 1;
    }
    process.stdout.write(`   \u5EFA\u597D\u4E86 ${profileDir}
`);
  }
  const version = dshVersion();
  process.stdout.write(
    `\u2460 \u628A ${options.source} \u88C5\u8FDB profile\u300C${profile}\u300D${chosen}\uFF08\u7528 dsh ${version === void 0 ? "\uFF08\u7248\u672C\u95EE\u4E0D\u51FA\u6765\uFF09" : version.trim()}\uFF09\u2026
`
  );
  const added = spawnSync("dsh", ["plugin", "--profile", profile, "add", options.source], {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (added.error !== void 0 || added.status !== 0) {
    process.stderr.write(
      `\u88C5\u63D2\u4EF6\u5931\u8D25${added.error === void 0 ? "" : `\uFF08${added.error.message}\uFF09`}\u3002
\u53EF\u4EE5\u5728\u4F60\u7684\u7EC8\u7AEF\u91CC\u624B\u52A8\u8DD1\uFF1Adsh plugin --profile ${profile} add ${options.source}
`
    );
    return 1;
  }
  const mechanism = presetMechanism(version);
  if (mechanism === "declaration") {
    process.stdout.write(
      "\u2461 \u8DF3\u8FC7 preset\uFF1A\u8FD9\u4E00\u7248 dsh \u4E0D\u518D\u8BFB ~/.dsh/.agent-presets/\uFF08preset \u6539\u6210\u4E86\u968F bundle \u58F0\u660E\u7684\u884C\uFF09\u3002\n   \u4E5F**\u4E0D\u9700\u8981**\u5B83\u2014\u2014\u88C5\u8FDB profile \u7684\u90A3\u4E00\u884C\uFF0C\u5DE5\u5177\u5BF9\u4F1A\u8BDD\u76F4\u63A5\u53EF\u89C1\uFF080.2.0-rc.2 \u5B9E\u6D4B\uFF09\u3002\n"
    );
  } else {
    const standard = shippedStandard(home, profileDir);
    if (standard === void 0) {
      process.stderr.write("\u627E\u4E0D\u5230\u968F dsh \u9644\u5E26\u7684 standard preset\uFF0C\u65E0\u6CD5\u521B\u5EFA agent preset\u3002\n");
      return 1;
    }
    const presetDir = join(home, ".agent-presets", options.preset);
    if (existsSync(join(presetDir, "agent.cordis.yml"))) {
      process.stdout.write(`\u2461 preset \u300C${options.preset}\u300D\u5DF2\u5B58\u5728\uFF0C\u53EA\u8865\u4E0A\u7F3A\u5931\u7684\u63D2\u4EF6\u884C
`);
    } else {
      process.stdout.write(`\u2461 \u4ECE standard \u590D\u5236\u4E00\u4EFD preset \u5230 ${presetDir}
`);
      mkdirSync(dirname(presetDir), { recursive: true });
      cpSync(standard, presetDir, { recursive: true });
      const manifest = join(presetDir, "preset.yml");
      if (existsSync(manifest)) {
        const text = readFileSync(manifest, "utf8");
        writeFileSync(
          manifest,
          text.replace(/^name:.*$/m, "name: \u6536\u4EF6\u7BB1\uFF08\u5E26 dsh-inbox\uFF09").replace(
            /^description:.*$/m,
            "description: \u6807\u51C6\u6A21\u5F0F + dsh-inbox\uFF1A\u52A9\u624B\u53EF\u4EE5\u76F4\u63A5\u67E5\u4F60\u7684\u6536\u4EF6\u7BB1\uFF08\u53EB\u5B83\u4ED3\u5E93 / inbox \u4E5F\u884C\uFF09\u5E76\u628A\u5185\u5BB9\u53D6\u56DE\u6765\u3002"
          ),
          "utf8"
        );
      }
    }
    const composition = join(presetDir, "agent.cordis.yml");
    const body = readFileSync(composition, "utf8");
    const outcome = ensurePresetRow(body);
    if (outcome.change === "added") {
      writeFileSync(composition, outcome.body, "utf8");
      process.stdout.write(`   \u5DF2\u628A ${PACKAGE_NAME} \u8FFD\u52A0\u8FDB preset \u7684\u7EC4\u5408
`);
    } else if (outcome.change === "renamed") {
      writeFileSync(composition, outcome.body, "utf8");
      process.stdout.write(`   preset \u91CC\u90A3\u4E00\u884C\u7684\u6765\u6E90\u4ECE ${String(outcome.from)} \u6539\u6210 ${PACKAGE_NAME}
`);
    } else {
      process.stdout.write("   preset \u91CC\u5DF2\u7ECF\u6709\u8FD9\u4E2A\u63D2\u4EF6\uFF0C\u8DF3\u8FC7\n");
    }
    if (options.defaultPreset) {
      const changed = setDefaultPreset(join(home, "settings.yaml"), options.preset);
      process.stdout.write(`\u2462 \u9ED8\u8BA4 preset\uFF1A${changed}
`);
    }
  }
  process.stdout.write(
    `
\u5B8C\u6210\u3002\u63A5\u4E0B\u6765\uFF1A
  \xB7 \u91CD\u542F dsh\uFF08profile \u7684\u63D2\u4EF6\u884C\u5728\u542F\u52A8\u65F6\u52A0\u8F7D\uFF09
  \xB7 \u7528\u4F60\u5E73\u65F6\u90A3\u6761\u547D\u4EE4\u542F\u52A8\u5B83\uFF1A${profile === "web" ? "dsh web" : `dsh --profile ${profile}`}
  \xB7 \u65B0\u5EFA\u4E00\u4E2A\u4F1A\u8BDD\uFF0C\u5B83\u5C31\u4F1A\u5E26\u4E0A\u6536\u4EF6\u7BB1\u5DE5\u5177\uFF1B\u60F3\u8BA9\u52A9\u624B\u67E5\u4ED3\u5E93\uFF0C\u76F4\u63A5\u95EE\u300C\u6211\u7684\u6536\u4EF6\u7BB1\u91CC\u6709\u54EA\u4E9B\u8FD8\u6CA1\u770B\u7684\u94FE\u63A5\u300D
  \xB7 \u9762\u677F\uFF08\u4FA7\u680F Inbox\uFF09\u4E0D\u9700\u8981 preset\uFF0C\u88C5\u5B8C\u5C31\u5728
  \xB7 \u4EE5\u540E\u8981\u66F4\u65B0\u5230\u7EBF\u4E0A\u6700\u65B0\u7248\uFF1Adsh plugin --profile ${profile} add ${PACKAGE_NAME}@latest\uFF08\u91CD\u590D\u8DD1 init \u53EA\u4F1A\u91CD\u590D\u68C0\u67E5\uFF0Cpnpm \u56DE\u4E00\u53E5 "Already up to date"\uFF0C\u4E0D\u4F1A\u5347\u7EA7\uFF09
`
  );
  return 0;
}
function profileCreationAttempts(profile) {
  return [
    ["--profile", profile, "--from-default-profile", "web", "--dump-config"],
    ["--profile", profile, "--dump-config"]
  ];
}
function hasPnpm() {
  const probe = spawnSync("pnpm", ["--version"], {
    shell: process.platform === "win32",
    stdio: "ignore"
  });
  return probe.error === void 0 && probe.status === 0;
}
function pnpmInstallAttempts() {
  return [
    ["npm", "i", "-g", "pnpm"],
    ["corepack", "enable", "pnpm"]
  ];
}
function installPnpm() {
  for (const args of pnpmInstallAttempts()) {
    const command = args.join(" ");
    process.stdout.write(`   ${command} \u2026
`);
    const run = spawnSync(args[0], [...args].slice(1), {
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    if (run.error === void 0 && run.status === 0 && hasPnpm()) return true;
  }
  return false;
}
function missingPnpmMessage(profile, source) {
  return `\u88C5\u63D2\u4EF6\u9700\u8981 pnpm\uFF1Adsh \u7684 \`plugin add\` \u662F\u8F6C\u53D1\u7ED9 pnpm \u7684\uFF08\u4E0D\u662F\u672C\u547D\u4EE4\u7684\u9009\u62E9\uFF09\u3002
\u8981\u4E48\u81EA\u5DF1\u88C5\uFF1Anpm i -g pnpm    \uFF08\u6216\u8005\uFF1Acorepack enable pnpm\uFF09
\u8981\u4E48\u91CD\u8DD1\u65F6\u52A0\u4E0A --install-pnpm\uFF0C\u8BA9\u672C\u547D\u4EE4\u66FF\u4F60\u88C5\u3002
\u624B\u52A8\u7B49\u4EF7\u547D\u4EE4\uFF1Adsh plugin --profile ${profile} add ${source}
`;
}
function createProfile(profile) {
  let output = "";
  for (const args of profileCreationAttempts(profile)) {
    const run = spawnSync("dsh", [...args], {
      encoding: "utf8",
      shell: process.platform === "win32"
    });
    output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
    if (run.error === void 0 && run.status === 0) return { ok: true, output };
  }
  return { ok: false, output };
}
if (isEntryPoint(import.meta.url, process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
export {
  chooseProfile,
  ensurePresetRow,
  isEntryPoint,
  listProfiles,
  missingPnpmMessage,
  parse,
  pnpmInstallAttempts,
  presetMechanism,
  profileCreationAttempts
};
