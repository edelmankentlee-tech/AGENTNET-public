#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const distDir = path.join(rootDir, 'dist');

const packageName = packageJson.name || '@agentnet/agent';
const packageVersion = packageJson.version || '0.0.0';
const safePackageName = packageName.replace(/^@/, '').replace(/\//g, '-');
const releaseName = `${safePackageName}-standalone`;
const downloadBase = process.env.RELEASE_DOWNLOAD_BASE || 'https://example.com/downloads';

const args = process.argv.slice(2);
const compatMode = parseCompatMode();

const PLATFORM_MATRIX = {
  'linux-x64': {
    platform: 'linux',
    arch: 'x64',
    archiveExt: 'tar.gz',
    packageLabel: 'linux-x64',
    installerScript: 'install.sh',
  },
  'linux-arm64': {
    platform: 'linux',
    arch: 'arm64',
    archiveExt: 'tar.gz',
    packageLabel: 'linux-arm64',
    installerScript: 'install.sh',
  },
  'darwin-x64': {
    platform: 'darwin',
    arch: 'x64',
    archiveExt: 'tar.gz',
    packageLabel: 'macos-x64',
    installerScript: 'install.sh',
  },
  'darwin-arm64': {
    platform: 'darwin',
    arch: 'arm64',
    archiveExt: 'tar.gz',
    packageLabel: 'macos-arm64',
    installerScript: 'install.sh',
  },
  'win-x64': {
    platform: 'win32',
    arch: 'x64',
    archiveExt: 'zip',
    packageLabel: 'win-x64',
    installerScript: 'install.bat',
  },
};

function parseCompatMode() {
  const arg = args.find((item) => item.startsWith('--compat-mode='));
  if (!arg) return '';
  return arg.split('=', 2)[1] || '';
}

function usage() {
  console.log('Usage: node scripts/release-pack.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --platform <platform>   linux-x64 | linux-arm64 | darwin-x64 | darwin-arm64 | win-x64 | all (default: all)');
  console.log('  --compat-mode=<mode>    开关兼容策略（目前支持 sea）');
  console.log('  --verify                仅做发布链路校验，不产出安装包');
  console.log('  --help, -h              显示本帮助');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/release-pack.js --platform all');
  console.log('  node scripts/release-pack.js --platform linux-x64 --compat-mode=sea');
  console.log('  node scripts/release-pack.js --verify');
  console.log('');
  console.log('Supported platforms:');
  Object.keys(PLATFORM_MATRIX).forEach((platform) => {
    const item = PLATFORM_MATRIX[platform];
    console.log(`  - ${platform} (${item.platform}/${item.arch})`);
  });
}

function getArgValue(name, fallback = null) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

function commandExists(cmd) {
  const resolved = spawnSync(process.platform === 'win32' ? 'where' : 'command', process.platform === 'win32' ? [cmd] : ['-v', cmd], { stdio: 'ignore' });
  return resolved.status === 0;
}

function runCommand(command, commandArgs, cwd, label) {
  const result = spawnSync(command, commandArgs, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    const printable = `${command} ${commandArgs.map((item) => (/\s/.test(item) ? `"${item}"` : item)).join(' ')}`;
    throw new Error(`${label || '命令失败'}: ${printable}`);
  }
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function safeRemove(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyPath(source, target) {
  if (!fs.existsSync(source)) return;
  ensureDir(path.dirname(target));
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.cpSync(source, target, { recursive: true });
  } else {
    fs.copyFileSync(source, target);
  }
}

function resolveTargets() {
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }

  const raw = getArgValue('--platform', 'all');
  const list = String(raw).split(',').map((item) => item.trim()).filter(Boolean);

  if (list.length === 0) return [];
  if (list.includes('all')) return Object.keys(PLATFORM_MATRIX);

  const unknown = list.filter((item) => !PLATFORM_MATRIX[item]);
  if (unknown.length > 0) {
    throw new Error(`不支持的平台参数: ${unknown.join(', ')}`);
  }

  return list;
}

function verifyNodeCheckScript() {
  const nodeCheck = spawnSync('node', ['--check', path.join(rootDir, 'scripts', 'release-pack.js')], { stdio: 'inherit' });
  if (nodeCheck.status !== 0) {
    throw new Error('release-pack.js 自身语法检查失败');
  }

  const agentCheck = spawnSync('node', ['--check', path.join(rootDir, 'src', 'standalone-agent.js')], { stdio: 'inherit' });
  if (agentCheck.status !== 0) {
    throw new Error('standalone-agent.js 语法检查失败');
  }
}

function verifyShellHelpers() {
  const installSh = path.join(rootDir, 'scripts', 'install.sh');
  const startSh = path.join(rootDir, 'scripts', 'start.sh');

  if (!fs.existsSync(installSh)) {
    throw new Error(`缺少安装脚本: ${installSh}`);
  }
  if (!fs.existsSync(startSh)) {
    throw new Error(`缺少启动脚本: ${startSh}`);
  }

  const scriptCheck = spawnSync('bash', ['-n', installSh], { stdio: 'inherit' });
  if (scriptCheck.status !== 0) {
    throw new Error('install.sh 脚本语法检查失败');
  }
}

function verifyInputs() {
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`缺少 package.json: ${packageJsonPath}`);
  }

  const entry = path.join(rootDir, packageJson.main || 'src/standalone-agent.js');
  if (!fs.existsSync(entry)) {
    throw new Error(`缺少入口文件: ${entry}`);
  }

  verifyNodeCheckScript();
  verifyShellHelpers();

  const hasNode = commandExists('node');
  if (!hasNode) {
    throw new Error('缺少Node.js，需安装 Node.js');
  }

  const hasTar = commandExists('tar');
  const hasZip = commandExists('zip');
  const hasPowershell = commandExists('powershell');
  if (!hasTar && !hasZip && !hasPowershell) {
    throw new Error('缺少打包工具：tar/zip/powershell 均不可用');
  }

  const includes = packageJson.files || [];
  const missing = includes.filter((item) => !fs.existsSync(path.join(rootDir, item)));
  if (missing.length > 0) {
    throw new Error(`package.json 文件白名单中路径不存在: ${missing.join(', ')}`);
  }
}

function makeReleaseNotes(cfg) {
  const lines = [
    '# AgentNet Standalone Agent Release',
    '',
    `版本: ${packageVersion}`,
    `平台: ${cfg.platform}/${cfg.arch}`,
    `兼容模式: ${compatMode ? `SEA兼容模式 (${compatMode})` : '标准分发包'}`,
    '',
    '安装方式:',
    `1. 解压 ${cfg.packageLabel} 安装包`,
    `2. 进入解压目录，执行 scripts/${cfg.installerScript}`,
    '3. 执行自检: node src/standalone-agent.js --self-check',
    '4. 启动 Agent: npm start 或 scripts/start.sh/start.bat',
    '',
    '配置要点:',
    '- 首次运行可执行 node src/standalone-agent.js --setup',
    '- 关键配置文件: config/agent.json 与 config/llm.json',
    '- 默认安装目录: config 目录自动复制为示例文件',
    '',
    '验收清单:',
    '- `node src/standalone-agent.js --version`',
    '- `node src/standalone-agent.js --self-check`',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function copyIncludedFiles(targetDir, platformKey) {
  const include = packageJson.files || [];
  include.forEach((entry) => copyPath(path.join(rootDir, entry), path.join(targetDir, entry)));

  // 若 package.json 修改导致遗漏，至少保证基础安装/启动文件可用
  ['install.sh', 'install.bat', 'start.sh', 'start.bat'].forEach((name) => {
    copyPath(path.join(rootDir, 'scripts', name), path.join(targetDir, 'scripts', name));
  });

  const releaseInfo = {
    packageName,
    packageVersion,
    platform: platformKey,
    generatedAt: new Date().toISOString(),
    compatMode: compatMode || 'standard',
    buildTool: 'scripts/release-pack.js',
  };

  fs.writeFileSync(
    path.join(targetDir, 'release-info.json'),
    JSON.stringify(releaseInfo, null, 2),
    'utf-8'
  );
}

function makeArchive(stagingDir, targetPath, archiveExt, artifactLabel) {
  if (archiveExt === 'zip') {
    if (commandExists('zip')) {
      const zipTarget = `./${artifactLabel}`;
      runCommand('zip', ['-r', zipTarget, '.'], stagingDir, 'ZIP 打包失败');
      if (fs.existsSync(path.join(stagingDir, zipTarget))) {
        fs.renameSync(path.join(stagingDir, zipTarget), targetPath);
      }
      return;
    }

    if (!commandExists('powershell')) {
      throw new Error('zip/powershell 均不可用，无法生成 windows 压缩包');
    }

    const command = `$ErrorActionPreference = 'Stop'; Compress-Archive -Path . -DestinationPath '${targetPath}' -Force`;
    runCommand('powershell', ['-NoProfile', '-Command', command], stagingDir, 'PowerShell 压缩失败');
    return;
  }

  if (!commandExists('tar')) {
    throw new Error('tar 不可用，无法生成 tar.gz 包');
  }
  runCommand('tar', ['-czf', targetPath, '.'], stagingDir, 'tar 打包失败');
}

function computeSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function runSelfCheck(stagingDir) {
  const node = process.platform === 'win32' ? 'node.exe' : 'node';
  const cmd = path.join(stagingDir, 'src', 'standalone-agent.js');
  const result = spawnSync(node, [cmd, '--self-check'], {
    cwd: stagingDir,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`安装包自检失败: ${output || 'unknown'}`);
  }
}

function buildArtifacts(platforms) {
  ensureDir(distDir);
  const artifacts = [];

  platforms.forEach((platformKey) => {
    const cfg = PLATFORM_MATRIX[platformKey];
    const fileBase = `${releaseName}-v${packageVersion}-${cfg.packageLabel}`;
    const fileName = `${fileBase}.${cfg.archiveExt}`;
    const targetPath = path.join(distDir, fileName);
    const stagingDir = path.join(distDir, `${fileBase}-staging`);

    safeRemove(stagingDir);
    ensureDir(stagingDir);
    copyIncludedFiles(stagingDir, platformKey);

    fs.writeFileSync(
      path.join(stagingDir, 'RELEASE_README.md'),
      makeReleaseNotes(cfg),
      'utf-8'
    );

    if (cfg.platform === 'win32') {
      makeArchive(stagingDir, targetPath, 'zip', fileName);
    } else {
      makeArchive(stagingDir, targetPath, 'tar.gz', fileBase);
    }

    runSelfCheck(stagingDir);

    const checksum = computeSha256(targetPath);
    const size = fs.statSync(targetPath).size;

    artifacts.push({
      file: fileName,
      platform: cfg.platform,
      arch: cfg.arch,
      size,
      sha256: checksum,
      downloadUrl: `${downloadBase}/${fileName}`,
    });

    safeRemove(stagingDir);
  });

  return artifacts;
}

function writeManifest(artifacts) {
  const manifest = {
    releaseName,
    packageName,
    version: packageVersion,
    generatedAt: new Date().toISOString(),
    packageMode: compatMode || 'standard',
    artifacts: artifacts.map((artifact) => ({
      file: artifact.file,
      platform: artifact.platform,
      arch: artifact.arch,
      size: artifact.size,
      sha256: artifact.sha256,
      downloadUrl: artifact.downloadUrl,
    })),
  };
  fs.writeFileSync(
    path.join(distDir, `${releaseName}-v${packageVersion}-release.json`),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  const checksums = artifacts
    .map((artifact) => `${artifact.sha256}  ${artifact.file}`)
    .join('\n');
  fs.writeFileSync(
    path.join(distDir, `${releaseName}-v${packageVersion}-checksums.sha256`),
    `${checksums}\n`,
    'utf-8'
  );
}

function printSummary(artifacts) {
  console.log('\n┌────────────────────────────────────────────────────────────');
  console.log('  AgentNet Standalone Agent 发布包生成完成');
  console.log('└────────────────────────────────────────────────────────────');
  console.log(`版本: ${packageVersion}`);
  console.log(`输出目录: ${distDir}`);
  console.log(`兼容模式: ${compatMode || 'standard'}`);
  console.log('');
  artifacts.forEach((artifact) => {
    console.log(`- ${artifact.file}`);
    console.log(`  平台: ${artifact.platform}/${artifact.arch}`);
    console.log(`  大小: ${artifact.size} bytes`);
    console.log(`  SHA256: ${artifact.sha256}`);
  });
}

function runVerify() {
  verifyInputs();
  console.log('发布链路校验通过：');
  console.log('- package.json 可解析');
  console.log('- 语法检查通过（release-pack.js / standalone-agent.js）');
  console.log('- 安装/启动脚本存在且可解析（install.sh/start.sh）');
  console.log('- 打包依赖可用（tar/zip/powershell 任一）');
}

function main() {
  const shouldVerifyOnly = args.includes('--verify');
  const targets = resolveTargets();
  verifyInputs();

  if (shouldVerifyOnly) {
    runVerify();
    return;
  }

  if (targets.length === 0) {
    throw new Error('没有可执行的平台目标');
  }

  const artifacts = buildArtifacts(targets);
  writeManifest(artifacts);
  printSummary(artifacts);
}

try {
  main();
} catch (error) {
  console.error(`[ERROR] ${error.message}`);
  process.exit(1);
}
