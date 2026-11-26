import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmdirSync } from 'node:fs';
import path from 'node:path';

// Only the newly created, dedicated default archive directory is owned by the service.
// Explicit archive paths and existing directories retain the operator's ACL.
export function prepareDefaultDirectory(directory: string) {
  if (existsSync(directory)) return;
  if (process.platform !== 'win32') { mkdirSync(directory, { recursive: true, mode: 0o700 }); return; }
  const staging = mkdtempSync(path.join(path.dirname(directory), '.archive-dir-'));
  const script = [
    "$ErrorActionPreference='Stop'",
    '$path=$env:HOLOBEAT_NEW_ARCHIVE_DIR',
    '$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User',
    '$acl=[System.IO.Directory]::GetAccessControl($path)',
    '$acl.SetAccessRuleProtection($true,$false)',
    "foreach($principal in @($sid, [System.Security.Principal.SecurityIdentifier]'S-1-5-18', [System.Security.Principal.SecurityIdentifier]'S-1-5-32-544')) {",
    "$rule=[System.Security.AccessControl.FileSystemAccessRule]::new($principal,'FullControl','ContainerInherit,ObjectInherit','None','Allow')",
    '$acl.AddAccessRule($rule)}',
    '[System.IO.Directory]::SetAccessControl($path,$acl)',
  ].join('\n');
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true, stdio: 'pipe', env: { ...process.env, HOLOBEAT_NEW_ARCHIVE_DIR: staging },
    });
    if (!existsSync(directory)) renameSync(staging, directory);
  } finally {
    if (existsSync(staging)) rmdirSync(staging);
  }
}
