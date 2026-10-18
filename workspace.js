'use strict';

const path = require('node:path');

function inWorkspace(thread, folders) {
  if (!folders?.length || !thread.cwd) return false;
  return folders.some(folder => {
    const relative = path.relative(folder.uri.fsPath, thread.cwd);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  });
}

function familyInWorkspace(family, folders) {
  return family.threads.some(thread => inWorkspace(thread, folders));
}

module.exports = { inWorkspace, familyInWorkspace };
